const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const [[summary]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM taxa p WHERE p.taxon_rank = 'phylum' AND NOT EXISTS (
          SELECT 1 FROM taxa c WHERE c.parent_id = p.id AND c.taxon_rank = 'class'
        )) AS phyla_without_class,
        (SELECT COUNT(*) FROM taxa c WHERE c.taxon_rank = 'class' AND NOT EXISTS (
          SELECT 1 FROM taxa o WHERE o.parent_id = c.id AND o.taxon_rank = 'order'
        )) AS classes_without_order,
        (SELECT COUNT(*) FROM taxa o WHERE o.taxon_rank = 'order' AND NOT EXISTS (
          SELECT 1 FROM taxa f WHERE f.parent_id = o.id AND f.taxon_rank = 'family'
        )) AS orders_without_family
    `);

    const [phyla] = await connection.query(`
      SELECT p.id, p.scientific_name, p.chinese_name
      FROM taxa p
      WHERE p.taxon_rank = 'phylum'
        AND NOT EXISTS (
          SELECT 1 FROM taxa c WHERE c.parent_id = p.id AND c.taxon_rank = 'class'
        )
      ORDER BY p.scientific_name ASC
    `);

    const [classes] = await connection.query(`
      SELECT c.id, c.scientific_name, c.chinese_name, ph.scientific_name AS phylum_name
      FROM taxa c
      LEFT JOIN taxa ph ON ph.id = c.parent_id
      WHERE c.taxon_rank = 'class'
        AND NOT EXISTS (
          SELECT 1 FROM taxa o WHERE o.parent_id = c.id AND o.taxon_rank = 'order'
        )
      ORDER BY c.scientific_name ASC
      LIMIT 100
    `);

    console.log(JSON.stringify({ summary, phyla, classes }, null, 2));
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('audit-higher-taxonomy-gaps failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = { main };
