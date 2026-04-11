const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

function pct(part, total) {
  return total ? `${((part / total) * 100).toFixed(2)}%` : '0.00%';
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [[plants]] = await conn.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN chinese_name IS NOT NULL AND chinese_name <> '' THEN 1 ELSE 0 END) AS with_chinese_name,
        SUM(CASE WHEN cover_image IS NOT NULL AND cover_image <> '' THEN 1 ELSE 0 END) AS with_cover_image,
        SUM(CASE WHEN category IS NOT NULL AND category <> '' THEN 1 ELSE 0 END) AS with_category
      FROM plants
    `);

    const [[plantDetail]] = await conn.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN intro IS NOT NULL AND intro <> '' THEN 1 ELSE 0 END) AS intro_count,
        SUM(CASE WHEN morphology IS NOT NULL AND morphology <> '' THEN 1 ELSE 0 END) AS morphology_count,
        SUM(CASE WHEN habitat IS NOT NULL AND habitat <> '' THEN 1 ELSE 0 END) AS habitat_count,
        SUM(CASE WHEN distribution IS NOT NULL AND distribution <> '' THEN 1 ELSE 0 END) AS distribution_count
      FROM plant_detail
    `);

    const [[plantEcology]] = await conn.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN light_tolerance IS NOT NULL THEN 1 ELSE 0 END) AS light_count,
        SUM(CASE WHEN water_requirement IS NOT NULL THEN 1 ELSE 0 END) AS water_count,
        SUM(CASE WHEN temperature_tolerance IS NOT NULL THEN 1 ELSE 0 END) AS temperature_count,
        SUM(CASE WHEN air_humidity IS NOT NULL THEN 1 ELSE 0 END) AS air_count
      FROM plant_ecology
    `);

    const mediaKinds = await conn.query(`
      SELECT kind, COUNT(*) AS total
      FROM media_assets
      GROUP BY kind
      ORDER BY total DESC
    `);

    const redlistGroups = await conn.query(`
      SELECT red_list_category AS category, COUNT(*) AS total
      FROM threatened_species
      GROUP BY red_list_category
      ORDER BY total DESC
    `);

    const [missingPlants] = await conn.query(`
      SELECT id, scientific_name, chinese_name
      FROM plants
      WHERE cover_image IS NULL OR cover_image = ''
      ORDER BY id ASC
      LIMIT 50
    `);

    const lines = [
      '# Data Readiness Report',
      '',
      `Date: ${new Date().toISOString()}`,
      '',
      '## Progress',
      '',
      '| Table | Metric | Value | Coverage |',
      '|---|---|---:|---:|',
      `| plants | total | ${plants.total} | 100% |`,
      `| plants | chinese_name | ${plants.with_chinese_name} | ${pct(plants.with_chinese_name, plants.total)} |`,
      `| plants | cover_image | ${plants.with_cover_image} | ${pct(plants.with_cover_image, plants.total)} |`,
      `| plants | category | ${plants.with_category} | ${pct(plants.with_category, plants.total)} |`,
      `| plant_detail | total | ${plantDetail.total} | 100% |`,
      `| plant_detail | intro | ${plantDetail.intro_count} | ${pct(plantDetail.intro_count, plantDetail.total)} |`,
      `| plant_detail | morphology | ${plantDetail.morphology_count} | ${pct(plantDetail.morphology_count, plantDetail.total)} |`,
      `| plant_detail | habitat | ${plantDetail.habitat_count} | ${pct(plantDetail.habitat_count, plantDetail.total)} |`,
      `| plant_detail | distribution | ${plantDetail.distribution_count} | ${pct(plantDetail.distribution_count, plantDetail.total)} |`,
      `| plant_ecology | total | ${plantEcology.total} | 100% |`,
      `| plant_ecology | light_tolerance | ${plantEcology.light_count} | ${pct(plantEcology.light_count, plantEcology.total)} |`,
      `| plant_ecology | water_requirement | ${plantEcology.water_count} | ${pct(plantEcology.water_count, plantEcology.total)} |`,
      `| plant_ecology | temperature_tolerance | ${plantEcology.temperature_count} | ${pct(plantEcology.temperature_count, plantEcology.total)} |`,
      `| plant_ecology | air_humidity | ${plantEcology.air_count} | ${pct(plantEcology.air_count, plantEcology.total)} |`,
      '',
      '## Media Assets',
      ''
    ];

    for (const row of mediaKinds[0]) {
      lines.push(`- ${row.kind}: ${row.total}`);
    }

    lines.push('', '## Threatened Species', '');
    for (const row of redlistGroups[0]) {
      lines.push(`- ${row.category}: ${row.total}`);
    }

    lines.push('', '## Missing Data Sample', '');
    if (missingPlants.length === 0) {
      lines.push('- no missing cover_image rows');
    } else {
      for (const row of missingPlants) {
        lines.push(`- ${row.id}: ${row.chinese_name || row.scientific_name}`);
      }
    }

    lines.push('', '## Suggested Priorities', '');
    lines.push(`- First priority: fill plant cover images, current coverage ${pct(plants.with_cover_image, plants.total)}.`);
    lines.push(`- Second priority: fill plant categories, current coverage ${pct(plants.with_category, plants.total)}.`);
    lines.push(`- Third priority: supplement morphology/habitat text for detail pages.`);

    const outputPath = path.join(__dirname, '..', `DATA_READINESS_REPORT_${new Date().toISOString().slice(0, 10)}.md`);
    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
    console.log(`Report written to ${outputPath}`);
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('check-data-readiness failed:', error.message);
  process.exitCode = 1;
});
