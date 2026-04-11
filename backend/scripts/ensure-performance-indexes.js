const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

const INDEX_DEFINITIONS = [
  {
    tableName: 'plants',
    indexName: 'idx_plants_family_created_at',
    ddl: 'CREATE INDEX idx_plants_family_created_at ON plants(wcvp_family, created_at)'
  },
  {
    tableName: 'plants',
    indexName: 'idx_plants_chinese_name',
    ddl: 'CREATE INDEX idx_plants_chinese_name ON plants(chinese_name)'
  },
  {
    tableName: 'plants',
    indexName: 'idx_plants_scientific_name',
    ddl: 'CREATE INDEX idx_plants_scientific_name ON plants(scientific_name)'
  },
  {
    tableName: 'plants',
    indexName: 'idx_plants_created_at',
    ddl: 'CREATE INDEX idx_plants_created_at ON plants(created_at)'
  },
  {
    tableName: 'plants',
    indexName: 'idx_plants_family',
    ddl: 'CREATE INDEX idx_plants_family ON plants(wcvp_family)'
  },
  {
    tableName: 'plant_observations',
    indexName: 'idx_plant_observations_plant_id',
    ddl: 'CREATE INDEX idx_plant_observations_plant_id ON plant_observations(plant_id)'
  },
  {
    tableName: 'plant_popularity_daily',
    indexName: 'idx_plant_popularity_daily_plant_date',
    ddl: 'CREATE INDEX idx_plant_popularity_daily_plant_date ON plant_popularity_daily(plant_id, date)'
  }
];

async function indexExists(tableName, indexName) {
  const rows = await sequelize.query(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    {
      replacements: [tableName, indexName],
      type: QueryTypes.SELECT
    }
  );

  return rows.length > 0;
}

async function ensurePerformanceIndexes() {
  for (const { tableName, indexName, ddl } of INDEX_DEFINITIONS) {
    const exists = await indexExists(tableName, indexName);
    if (exists) {
      continue;
    }

    await sequelize.query(ddl);
    console.log(`[db] created index ${indexName}`);
  }
}

if (require.main === module) {
  ensurePerformanceIndexes()
    .then(async () => {
      console.log('[db] performance indexes ensured');
      await sequelize.close();
    })
    .catch(async (error) => {
      console.error('[db] failed to ensure performance indexes:', error);
      await sequelize.close().catch(() => {});
      process.exitCode = 1;
    });
}

module.exports = ensurePerformanceIndexes;
