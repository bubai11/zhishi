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

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await conn.query(`
      SELECT id, chinese_name, scientific_name, wcvp_family, wcvp_genus
      FROM plants
      WHERE cover_image IS NULL OR cover_image = ''
      ORDER BY id ASC
    `);

    const lines = [
      '# Missing Plant Images',
      '',
      `Date: ${new Date().toISOString()}`,
      ''
    ];

    for (const row of rows) {
      lines.push(`- ${row.id}: ${row.chinese_name || row.scientific_name} | ${row.wcvp_family || '-'} | ${row.wcvp_genus || '-'}`);
    }

    const outputPath = path.join(__dirname, '..', `MISSING_PLANT_IMAGES_${new Date().toISOString().slice(0, 10)}.md`);
    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
    console.log(`Missing image report written to ${outputPath}`);
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('cleanup-missing-images failed:', error.message);
  process.exitCode = 1;
});
