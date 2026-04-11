const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const coreEcology = require('../data/coreEcology');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const adjustmentRules = {
  tropical: {
    families: ['Orchidaceae', 'Rubiaceae', 'Arecaceae', 'Musaceae', 'Bromeliaceae', 'Zingiberaceae'],
    adjustments: { temperature_tolerance: 25, cold_tolerance: -20, light_tolerance: 10, water_requirement: 15, air_humidity: 25 }
  },
  temperate: {
    families: ['Rosaceae', 'Pinaceae', 'Salicaceae', 'Betulaceae', 'Fagaceae', 'Sapindaceae'],
    adjustments: { temperature_tolerance: 5, cold_tolerance: 20, air_humidity: -5 }
  },
  arid: {
    families: ['Cactaceae', 'Agavaceae', 'Asphodelaceae', 'Crassulaceae'],
    adjustments: { drought_tolerance: 35, water_requirement: -25, light_tolerance: 20, air_humidity: -20 }
  },
  aquatic: {
    families: ['Nymphaeaceae', 'Hydrocharitaceae', 'Lemnaceae', 'Pontederiaceae'],
    adjustments: { water_requirement: 35, drought_tolerance: -30, air_humidity: 20 }
  }
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function generateEcology(plant) {
  if (coreEcology[plant.scientific_name]) {
    return coreEcology[plant.scientific_name];
  }

  const ecology = {
    light_tolerance: 60,
    water_requirement: 50,
    temperature_tolerance: 50,
    drought_tolerance: 50,
    cold_tolerance: 50,
    air_humidity: 50
  };

  Object.values(adjustmentRules).forEach((rule) => {
    if (!rule.families.includes(plant.wcvp_family)) {
      return;
    }

    Object.entries(rule.adjustments).forEach(([key, delta]) => {
      ecology[key] = clamp(ecology[key] + delta);
    });
  });

  return ecology;
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [plants] = await conn.query(`
      SELECT p.id, p.scientific_name, p.wcvp_family
      FROM plants p
      LEFT JOIN plant_ecology e ON e.plant_id = p.id
      WHERE e.plant_id IS NULL
      ORDER BY p.id ASC
    `);

    let manualCount = 0;

    for (const plant of plants) {
      const ecology = generateEcology(plant);
      const isManual = Boolean(coreEcology[plant.scientific_name]);

      await conn.query(
        `
          INSERT INTO plant_ecology (
            plant_id,
            light_tolerance,
            water_requirement,
            temperature_tolerance,
            drought_tolerance,
            cold_tolerance,
            air_humidity,
            shade_tolerance,
            ecological_adaptability,
            data_source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            light_tolerance = VALUES(light_tolerance),
            water_requirement = VALUES(water_requirement),
            temperature_tolerance = VALUES(temperature_tolerance),
            drought_tolerance = VALUES(drought_tolerance),
            cold_tolerance = VALUES(cold_tolerance),
            air_humidity = VALUES(air_humidity),
            shade_tolerance = VALUES(shade_tolerance),
            ecological_adaptability = VALUES(ecological_adaptability),
            data_source = VALUES(data_source)
        `,
        [
          plant.id,
          ecology.light_tolerance,
          ecology.water_requirement,
          ecology.temperature_tolerance,
          ecology.drought_tolerance,
          ecology.cold_tolerance,
          ecology.air_humidity,
          clamp(100 - ecology.light_tolerance + 20),
          clamp((ecology.temperature_tolerance + ecology.water_requirement + ecology.cold_tolerance) / 3),
          isManual ? 'manual' : 'rule'
        ]
      );

      if (isManual) {
        manualCount += 1;
      }
    }

    console.log(`populate-plant-ecology finished: ${plants.length} rows`);
    console.log(`manual rows: ${manualCount}`);
    console.log(`rule rows: ${plants.length - manualCount}`);
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('populate-plant-ecology failed:', error.message);
  process.exitCode = 1;
});
