const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function main() {
  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.execute(`
      ALTER TABLE taxa
      MODIFY COLUMN taxon_rank ENUM('kingdom', 'phylum', 'subphylum', 'class', 'order', 'family', 'genus', 'species') NOT NULL
    `);

    console.log('taxa.taxon_rank 已扩展为包含 subphylum');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('migrate-taxonomy-subphylum 失败:', err.message);
  process.exitCode = 1;
});
