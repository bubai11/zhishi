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
    const [ordersWithoutFamily] = await connection.query(`
      SELECT
        o.id,
        o.scientific_name,
        c.scientific_name AS class_name,
        ph.scientific_name AS phylum_name
      FROM taxa o
      LEFT JOIN taxa c ON c.id = o.parent_id
      LEFT JOIN taxa ph ON ph.id = c.parent_id
      WHERE o.taxon_rank = 'order'
        AND NOT EXISTS (
          SELECT 1 FROM taxa f WHERE f.parent_id = o.id AND f.taxon_rank = 'family'
        )
      ORDER BY ph.scientific_name ASC, c.scientific_name ASC, o.scientific_name ASC
    `);

    const [familiesWithNonOrderParent] = await connection.query(`
      SELECT
        f.id,
        f.scientific_name AS family_name,
        p.id AS parent_id,
        p.scientific_name AS parent_name,
        p.taxon_rank AS parent_rank
      FROM taxa f
      LEFT JOIN taxa p ON p.id = f.parent_id
      WHERE f.taxon_rank = 'family'
        AND (
          p.id IS NULL
          OR p.taxon_rank <> 'order'
        )
      ORDER BY f.scientific_name ASC, f.id ASC
      LIMIT 200
    `);

    const [summaryRows] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM taxa o
          WHERE o.taxon_rank = 'order'
            AND NOT EXISTS (
              SELECT 1 FROM taxa f WHERE f.parent_id = o.id AND f.taxon_rank = 'family'
            )
        ) AS orders_without_family,
        (SELECT COUNT(*) FROM taxa f
          LEFT JOIN taxa p ON p.id = f.parent_id
          WHERE f.taxon_rank = 'family'
            AND (p.id IS NULL OR p.taxon_rank <> 'order')
        ) AS families_with_non_order_parent
    `);

    console.log(JSON.stringify({
      summary: summaryRows[0],
      ordersWithoutFamily,
      familiesWithNonOrderParent
    }, null, 2));
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('audit-order-family-gaps failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = { main };
