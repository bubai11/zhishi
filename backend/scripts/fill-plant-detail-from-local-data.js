const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const args = process.argv.slice(2);
let batchSize = 500;
let limit = 5000;
let dryRun = true;
let offset = 0;

for (const arg of args) {
  if (arg.startsWith('--batch=')) batchSize = Number(arg.split('=')[1]) || batchSize;
  if (arg.startsWith('--limit=')) limit = Number(arg.split('=')[1]) || limit;
  if (arg.startsWith('--offset=')) offset = Number(arg.split('=')[1]) || offset;
  if (arg === '--apply') dryRun = false;
  if (arg === '--dry-run') dryRun = true;
}

function clean(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || null;
}

function displayName(plant) {
  const chineseName = clean(plant.chinese_name);
  const scientificName = clean(plant.scientific_name);
  if (chineseName && scientificName && chineseName !== scientificName) {
    return `${chineseName}（${scientificName}）`;
  }
  return chineseName || scientificName || `plant#${plant.id}`;
}

function joinUnique(values, maxItems = 8) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const item = clean(value);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

function scoreLabel(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return clean(value);
  if (num >= 75) return '较高';
  if (num >= 55) return '中等偏高';
  if (num >= 40) return '中等';
  if (num >= 20) return '较低';
  return '很低';
}

function buildIntro(plant) {
  const bits = [displayName(plant)];
  const rank = clean(plant.wcvp_taxon_rank);
  const family = clean(plant.wcvp_family);
  const genus = clean(plant.wcvp_genus);
  const category = clean(plant.category);
  const lifeform = clean(plant.lifeform_description);
  const climate = clean(plant.climate_description);

  const taxonomy = [];
  if (family) taxonomy.push(`${family}科`);
  if (genus) taxonomy.push(`${genus}属`);
  if (taxonomy.length) bits.push(`隶属于${taxonomy.join('、')}`);
  if (rank && rank.toLowerCase() !== 'species') bits.push(`分类等级为${rank}`);
  if (category && category !== 'Uncategorized') bits.push(`系统类群为${category}`);
  if (lifeform) bits.push(`生活型记录为${lifeform}`);
  if (climate) bits.push(`气候适应记录为${climate}`);

  return `${bits.join('，')}。`;
}

function buildHabitat(plant, ecology) {
  const parts = [];
  if (clean(plant.geographic_area)) parts.push(`地理区域记录为${clean(plant.geographic_area)}`);
  if (clean(plant.climate_description)) parts.push(`气候适应记录为${clean(plant.climate_description)}`);
  if (clean(ecology?.soil_requirement)) parts.push(`土壤适应性${scoreLabel(ecology.soil_requirement)}`);
  if (clean(ecology?.water_requirement)) parts.push(`需水水平${scoreLabel(ecology.water_requirement)}`);
  if (clean(ecology?.light_tolerance)) parts.push(`光照适应性${scoreLabel(ecology.light_tolerance)}`);
  if (clean(ecology?.temperature_tolerance)) parts.push(`温度适应性${scoreLabel(ecology.temperature_tolerance)}`);
  return parts.length ? `${parts.join('；')}。` : null;
}

function buildLifecycle(plant, ecology) {
  const parts = [];
  if (clean(plant.lifeform_description)) parts.push(`生活型：${clean(plant.lifeform_description)}`);
  if (clean(ecology?.growth_rate)) parts.push(`生长速率：${clean(ecology.growth_rate)}`);
  if (clean(ecology?.lifespan)) parts.push(`寿命记录：${clean(ecology.lifespan)}`);
  return parts.length ? `${parts.join('；')}。` : null;
}

function buildEcologyImportance(ecology, threatened) {
  const parts = [];
  if (clean(ecology?.ecological_adaptability)) parts.push(`综合生态适应性${scoreLabel(ecology.ecological_adaptability)}`);
  if (clean(threatened?.red_list_category)) parts.push(`IUCN等级为${clean(threatened.red_list_category)}`);
  if (clean(threatened?.population_trend)) parts.push(`种群趋势记录为${clean(threatened.population_trend)}`);
  if (clean(threatened?.threats)) parts.push(`主要威胁：${clean(threatened.threats)}`);
  if (clean(threatened?.conservation_actions)) parts.push(`保护行动：${clean(threatened.conservation_actions)}`);
  return parts.length ? `${parts.join('；')}。` : null;
}

function buildDistribution(distributions, threatened) {
  const areas = joinUnique(distributions.map((item) => item.area_name), 10);
  const countries = joinUnique(distributions.map((item) => item.country_code), 8);
  const parts = [];
  if (areas.length) parts.push(`WCVP分布区包括${areas.join('、')}`);
  if (countries.length) parts.push(`国家/地区代码记录为${countries.join('、')}`);
  if (clean(threatened?.range_description)) parts.push(`IUCN范围描述：${clean(threatened.range_description)}`);
  return parts.length ? `${parts.join('；')}。` : '暂未记录明确分布区，可结合分类信息与后续资料继续补充。';
}

function buildExtra(plant, ecology, threatened, distributions) {
  return {
    generatedFrom: 'local_data',
    generatedAt: new Date().toISOString(),
    taxonomy: {
      taxonId: plant.taxon_id,
      rank: clean(plant.wcvp_taxon_rank),
      status: clean(plant.wcvp_taxon_status),
      family: clean(plant.wcvp_family),
      genus: clean(plant.wcvp_genus)
    },
    plant: {
      category: clean(plant.category),
      translationSource: clean(plant.translation_source),
      translationConfidence: plant.translation_confidence,
      coverImage: clean(plant.cover_image)
    },
    ecology: ecology || null,
    threatened: threatened || null,
    distributionCount: distributions.length
  };
}

async function getPendingPlants(conn, currentOffset, currentLimit) {
  const [rows] = await conn.query(
    `
      SELECT p.*
      FROM plants p
      LEFT JOIN plant_detail d ON d.plant_id = p.id
      WHERE d.plant_id IS NULL
        AND p.scientific_name IS NOT NULL
        AND p.scientific_name <> ''
      ORDER BY
        CASE WHEN p.chinese_name IS NOT NULL AND p.chinese_name <> '' AND p.chinese_name <> p.scientific_name THEN 0 ELSE 1 END,
        p.id ASC
      LIMIT ? OFFSET ?
    `,
    [currentLimit, currentOffset]
  );
  return rows;
}

async function getRelatedData(conn, plantIds) {
  if (!plantIds.length) {
    return { ecologyByPlant: new Map(), threatenedByPlant: new Map(), distributionsByPlant: new Map() };
  }

  const [ecologyRows] = await conn.query('SELECT * FROM plant_ecology WHERE plant_id IN (?)', [plantIds]);
  const [threatenedRows] = await conn.query('SELECT * FROM threatened_species WHERE plant_id IN (?)', [plantIds]);
  const [distributionRows] = await conn.query(
    `
      SELECT plant_id, area_name, country_code, continent, occurrence_status, introduced, extinct
      FROM plant_distributions
      WHERE plant_id IN (?)
      ORDER BY plant_id ASC, area_name ASC
    `,
    [plantIds]
  );

  const ecologyByPlant = new Map(ecologyRows.map((row) => [Number(row.plant_id), row]));
  const threatenedByPlant = new Map(threatenedRows.map((row) => [Number(row.plant_id), row]));
  const distributionsByPlant = new Map();
  for (const row of distributionRows) {
    const plantId = Number(row.plant_id);
    if (!distributionsByPlant.has(plantId)) distributionsByPlant.set(plantId, []);
    distributionsByPlant.get(plantId).push(row);
  }

  return { ecologyByPlant, threatenedByPlant, distributionsByPlant };
}

function buildDetail(plant, related) {
  const ecology = related.ecologyByPlant.get(Number(plant.id)) || null;
  const threatened = related.threatenedByPlant.get(Number(plant.id)) || null;
  const distributions = related.distributionsByPlant.get(Number(plant.id)) || [];

  return {
    plant_id: plant.id,
    intro: buildIntro(plant),
    lifecycle: buildLifecycle(plant, ecology),
    habitat: buildHabitat(plant, ecology),
    distribution: buildDistribution(distributions, threatened),
    ecology_importance: buildEcologyImportance(ecology, threatened),
    extra: buildExtra(plant, ecology, threatened, distributions)
  };
}

async function insertDetails(conn, details) {
  if (!details.length) return 0;
  const values = details.map((detail) => [
    detail.plant_id,
    detail.intro,
    detail.ecology_importance,
    detail.lifecycle,
    detail.habitat,
    detail.distribution,
    JSON.stringify(detail.extra),
    'local_generated',
    'local_database',
    new Date()
  ]);

  const [result] = await conn.query(
    `
      INSERT IGNORE INTO plant_detail
        (plant_id, intro, ecology_importance, lifecycle, habitat, distribution, extra, data_source, source_url, fetched_at)
      VALUES ?
    `,
    [values]
  );

  return Number(result.affectedRows || 0);
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  let processed = 0;
  let inserted = 0;

  try {
    console.log(`fill-plant-detail-from-local-data DB=${dbConfig.database} dryRun=${dryRun} limit=${limit} batch=${batchSize} offset=${offset}`);

    while (processed < limit) {
      const remaining = Math.min(batchSize, limit - processed);
      const plants = await getPendingPlants(conn, offset, remaining);
      if (!plants.length) break;

      const related = await getRelatedData(conn, plants.map((plant) => plant.id));
      const details = plants.map((plant) => buildDetail(plant, related));

      if (dryRun) {
        console.log(`Dry run sample (${details.length} rows):`);
        for (const detail of details.slice(0, 10)) {
          console.log(JSON.stringify({
            plant_id: detail.plant_id,
            intro: detail.intro,
            habitat: detail.habitat,
            distribution: detail.distribution,
            ecology_importance: detail.ecology_importance
          }, null, 2));
        }
        break;
      }

      inserted += await insertDetails(conn, details);
      processed += plants.length;
      console.log(`processed=${processed} inserted=${inserted}`);
    }
  } finally {
    await conn.end();
  }

  console.log(`done dryRun=${dryRun} processed=${processed} inserted=${inserted}`);
}

main().catch((error) => {
  console.error(`fill-plant-detail-from-local-data failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});

