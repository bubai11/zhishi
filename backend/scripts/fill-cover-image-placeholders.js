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
    const [result] = await conn.query(`
      UPDATE plants
      SET cover_image = CONCAT(
        'https://placehold.co/800x600/',
        CASE wcvp_family
          WHEN 'Rosaceae' THEN 'd97706'
          WHEN 'Orchidaceae' THEN '0f766e'
          WHEN 'Pinaceae' THEN '166534'
          WHEN 'Fabaceae' THEN '65a30d'
          WHEN 'Asteraceae' THEN 'ca8a04'
          ELSE '3f8f6b'
        END,
        '/ffffff?text=',
        REPLACE(
          REPLACE(
            COALESCE(NULLIF(chinese_name, ''), NULLIF(scientific_name, ''), CONCAT('Plant ', id)),
            ' ',
            '+'
          ),
          '#',
          ''
        )
      )
      WHERE cover_image IS NULL OR cover_image = ''
    `);

    console.log(`fill-cover-image-placeholders finished: ${result.affectedRows} rows`);
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('fill-cover-image-placeholders failed:', error.message);
  process.exitCode = 1;
});
