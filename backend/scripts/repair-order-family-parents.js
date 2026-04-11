const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const { familyOrderMap } = require('../data/taxonomy_chinese_mapping');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function fetchOrderId(connection, scientificName) {
  const [rows] = await connection.query(
    `
      SELECT id
      FROM taxa
      WHERE taxon_rank = 'order'
        AND scientific_name = ?
      ORDER BY id ASC
      LIMIT 1
    `,
    [scientificName]
  );

  return Number(rows[0]?.id || 0);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    let updated = 0;
    let skipped = 0;

    for (const [familyName, orderName] of Object.entries(familyOrderMap)) {
      const orderId = await fetchOrderId(connection, orderName);
      if (!orderId) {
        skipped += 1;
        continue;
      }

      const [result] = await connection.query(
        `
          UPDATE taxa f
          LEFT JOIN taxa p ON p.id = f.parent_id
          SET f.parent_id = ?
          WHERE f.taxon_rank = 'family'
            AND f.scientific_name = ?
            AND (
              p.id IS NULL
              OR p.taxon_rank <> 'order'
              OR p.id <> ?
            )
        `,
        [orderId, familyName, orderId]
      );

      updated += Number(result.affectedRows || 0);
    }

    console.table([{ updated, skipped }]);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('repair-order-family-parents failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = { main };
