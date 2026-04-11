const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const categoryRules = require('../config/categoryRules');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

function matchCategory(plant) {
  const family = plant.wcvp_family || '';
  const genus = plant.wcvp_genus || '';
  const haystack = [
    plant.short_desc || '',
    plant.intro || '',
    plant.morphology || '',
    plant.habitat || '',
    plant.uses || ''
  ].join(' ');

  if (categoryRules.tropical.families.includes(family) || categoryRules.tropical.genera.includes(genus)) {
    return 'Tropical';
  }

  if (categoryRules.temperate.families.includes(family) || categoryRules.temperate.genera.includes(genus)) {
    return 'Temperate';
  }

  if (categoryRules.arid.families.includes(family) || categoryRules.arid.genera.includes(genus)) {
    return 'Arid';
  }

  if (categoryRules.aquatic.families.includes(family) || categoryRules.aquatic.genera.includes(genus)) {
    return 'Aquatic';
  }

  if (categoryRules.medicinal.keywords.some((keyword) => haystack.includes(keyword))) {
    return 'Medicinal';
  }

  if (categoryRules.ornamental.keywords.some((keyword) => haystack.includes(keyword))) {
    return 'Ornamental';
  }

  return 'Uncategorized';
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [plants] = await conn.query(`
      SELECT
        p.id,
        p.wcvp_family,
        p.wcvp_genus,
        p.short_desc,
        d.intro,
        d.morphology,
        d.habitat,
        d.uses
      FROM plants p
      LEFT JOIN plant_detail d ON d.plant_id = p.id
      WHERE p.category IS NULL OR p.category = ''
      ORDER BY p.id ASC
    `);

    const stats = {
      Tropical: 0,
      Temperate: 0,
      Arid: 0,
      Aquatic: 0,
      Medicinal: 0,
      Ornamental: 0,
      Uncategorized: 0
    };

    for (const plant of plants) {
      const category = matchCategory(plant);
      await conn.query('UPDATE plants SET category = ? WHERE id = ?', [category, plant.id]);
      stats[category] += 1;
    }

    console.log(`populate-plant-category finished: ${plants.length} rows`);
    Object.entries(stats).forEach(([name, count]) => console.log(`${name}: ${count}`));
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('populate-plant-category failed:', error.message);
  process.exitCode = 1;
});
