const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const args = process.argv.slice(2);
let dryRun = true;
let limit = 1000;
for (const arg of args) {
  if (arg === '--apply') dryRun = false;
  if (arg === '--dry-run') dryRun = true;
  if (arg.startsWith('--limit=')) limit = Number(arg.split('=')[1]) || limit;
}

function clean(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text || null;
}

function displayName(plant) {
  const chineseName = clean(plant.chinese_name);
  const scientificName = clean(plant.scientific_name);
  if (chineseName && scientificName && chineseName !== scientificName) return `${chineseName}（${scientificName}）`;
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

function buildExtra(plant, ecology, threatened, distributions, repairReason) {
  return {
    generatedFrom: 'local_data_repair',
    generatedAt: new Date().toISOString(),
    repairReason,
    taxonomy: {
      taxonId: plant.taxon_id,
      rank: clean(plant.wcvp_taxon_rank),
      status: clean(plant.wcvp_taxon_status),
      family: clean(plant.wcvp_family),
      genus: clean(plant.wcvp_genus)
    },
    distributionCount: distributions.length,
    previousSource: plant.data_source || null
  };
}

async function getRelatedData(conn, plantIds) {
  if (!plantIds.length) return { ecologyByPlant: new Map(), threatenedByPlant: new Map(), distributionsByPlant: new Map() };
  const [ecologyRows] = await conn.query('SELECT * FROM plant_ecology WHERE plant_id IN (?)', [plantIds]);
  const [threatenedRows] = await conn.query('SELECT * FROM threatened_species WHERE plant_id IN (?)', [plantIds]);
  const [distributionRows] = await conn.query(
    `SELECT plant_id, area_name, country_code, continent, occurrence_status, introduced, extinct
     FROM plant_distributions
     WHERE plant_id IN (?)
     ORDER BY plant_id ASC, area_name ASC`,
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

function isSuspicious(row) {
  const intro = clean(row.intro);
  if (!intro) return false;
  const scientificName = clean(row.scientific_name);
  const chineseName = clean(row.chinese_name);
  return Boolean(
    row.data_source !== 'local_generated' &&
    row.data_source !== 'manual' &&
    scientificName &&
    !intro.includes(scientificName) &&
    (!chineseName || !intro.includes(chineseName))
  );
}

function isIncomplete(row) {
  return !clean(row.intro) || !clean(row.habitat) || !clean(row.distribution) || !clean(row.ecology_importance);
}

function buildDetail(row, related, repairReason) {
  const ecology = related.ecologyByPlant.get(Number(row.id)) || null;
  const threatened = related.threatenedByPlant.get(Number(row.id)) || null;
  const distributions = related.distributionsByPlant.get(Number(row.id)) || [];
  return {
    intro: buildIntro(row),
    lifecycle: buildLifecycle(row, ecology),
    habitat: buildHabitat(row, ecology),
    distribution: buildDistribution(distributions, threatened),
    ecology_importance: buildEcologyImportance(ecology, threatened),
    extra: buildExtra(row, ecology, threatened, distributions, repairReason)
  };
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await conn.query(
      `SELECT p.*, d.intro, d.habitat, d.distribution, d.ecology_importance, d.lifecycle, d.extra, d.data_source, d.source_url
       FROM plant_detail d
       JOIN plants p ON p.id = d.plant_id
       WHERE (
           d.intro IS NULL OR d.intro = ''
           OR d.habitat IS NULL OR d.habitat = ''
           OR d.distribution IS NULL OR d.distribution = ''
           OR d.ecology_importance IS NULL OR d.ecology_importance = ''
           OR (
             COALESCE(d.data_source,'') <> 'local_generated'
             AND COALESCE(d.data_source,'') <> 'manual'
             AND d.intro IS NOT NULL AND d.intro <> ''
             AND LOCATE(p.scientific_name, d.intro) = 0
             AND (p.chinese_name IS NULL OR p.chinese_name = '' OR LOCATE(p.chinese_name, d.intro) = 0)
           )
         )
       ORDER BY p.id ASC
       LIMIT ?`,
      [limit]
    );

    const related = await getRelatedData(conn, rows.map((row) => row.id));
    let suspicious = 0;
    let incomplete = 0;
    let updated = 0;

    for (const row of rows) {
      const suspiciousRow = isSuspicious(row);
      const incompleteRow = isIncomplete(row);
      if (suspiciousRow) suspicious += 1;
      if (incompleteRow) incomplete += 1;
      const reason = suspiciousRow ? 'suspicious_mismatch' : 'fill_empty_fields';
      const generated = buildDetail(row, related, reason);

      const next = suspiciousRow
        ? {
            intro: generated.intro,
            habitat: generated.habitat,
            distribution: generated.distribution,
            ecology_importance: generated.ecology_importance,
            lifecycle: generated.lifecycle,
            extra: generated.extra,
            data_source: 'local_generated_repair',
            source_url: 'local_database'
          }
        : {
            intro: clean(row.intro) || generated.intro,
            habitat: clean(row.habitat) || generated.habitat,
            distribution: clean(row.distribution) || generated.distribution,
            ecology_importance: clean(row.ecology_importance) || generated.ecology_importance,
            lifecycle: clean(row.lifecycle) || generated.lifecycle,
            extra: row.extra || generated.extra,
            data_source: row.data_source || 'local_generated_repair',
            source_url: row.source_url || 'local_database'
          };

      if (dryRun) {
        console.log(JSON.stringify({
          plant_id: row.id,
          name: row.chinese_name || row.scientific_name,
          source: row.data_source,
          reason,
          before_intro: clean(row.intro),
          after_intro: next.intro,
          after_ecology_importance: next.ecology_importance
        }, null, 2));
        continue;
      }

      await conn.query(
        `UPDATE plant_detail
         SET intro = ?, habitat = ?, distribution = ?, ecology_importance = ?, lifecycle = ?, extra = ?, data_source = ?, source_url = ?, fetched_at = NOW()
         WHERE plant_id = ?`,
        [
          next.intro,
          next.habitat,
          next.distribution,
          next.ecology_importance,
          next.lifecycle,
          JSON.stringify(next.extra || {}),
          next.data_source,
          next.source_url,
          row.id
        ]
      );
      updated += 1;
    }

    console.log(`repair-plant-detail-quality dryRun=${dryRun} candidates=${rows.length} suspicious=${suspicious} incomplete=${incomplete} updated=${updated}`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`repair-plant-detail-quality failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});


