const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const NONVASCULAR_SEED = {
  Bryophyta: {
    classes: [
      {
        scientific_name: 'Bryopsida',
        orders: [
          { scientific_name: 'Funariales', families: ['Funariaceae'] },
          { scientific_name: 'Hypnales', families: ['Hypnaceae', 'Brachytheciaceae'] },
          { scientific_name: 'Bryales', families: ['Bryaceae', 'Mniaceae'] },
          { scientific_name: 'Dicranales', families: ['Dicranaceae', 'Leucobryaceae'] },
          { scientific_name: 'Polytrichales', families: ['Polytrichaceae'] },
          { scientific_name: 'Pottiales', families: ['Pottiaceae'] }
        ]
      },
      {
        scientific_name: 'Sphagnopsida',
        orders: [{ scientific_name: 'Sphagnales', families: ['Sphagnaceae'] }]
      },
      {
        scientific_name: 'Andreaeopsida',
        orders: [{ scientific_name: 'Andreaeales', families: ['Andreaeaceae'] }]
      }
    ]
  },
  Marchantiophyta: {
    classes: [
      {
        scientific_name: 'Marchantiopsida',
        orders: [
          { scientific_name: 'Marchantiales', families: ['Marchantiaceae', 'Aytoniaceae'] },
          { scientific_name: 'Lunulariales', families: ['Lunulariaceae'] }
        ]
      },
      {
        scientific_name: 'Jungermanniopsida',
        orders: [
          { scientific_name: 'Jungermanniales', families: ['Jungermanniaceae', 'Geocalycaceae'] },
          { scientific_name: 'Porellales', families: ['Porellaceae', 'Lejeuneaceae'] },
          { scientific_name: 'Metzgeriales', families: ['Metzgeriaceae'] }
        ]
      },
      {
        scientific_name: 'Haplomitriopsida',
        orders: [{ scientific_name: 'Haplomitriales', families: ['Haplomitriaceae'] }]
      }
    ]
  }
};

async function ensureNode(connection, { rank, scientificName, parentId = null }) {
  await connection.query(
    `
      INSERT INTO taxa (taxon_rank, parent_id, scientific_name, common_name, chinese_name, created_at, updated_at)
      SELECT ?, ?, ?, ?, NULL, NOW(), NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
        FROM taxa
        WHERE taxon_rank = ?
          AND scientific_name = ?
      )
    `,
    [rank, parentId, scientificName, scientificName, rank, scientificName]
  );

  const [rows] = await connection.query(
    `
      SELECT id, parent_id
      FROM taxa
      WHERE taxon_rank = ?
        AND scientific_name = ?
      ORDER BY id ASC
      LIMIT 1
    `,
    [rank, scientificName]
  );

  const id = Number(rows[0]?.id || 0);
  const currentParentId = rows[0]?.parent_id === null ? null : Number(rows[0]?.parent_id);

  if (id && parentId !== null && currentParentId !== parentId) {
    await connection.query(
      `
        UPDATE taxa
        SET parent_id = ?
        WHERE id = ?
      `,
      [parentId, id]
    );
  }

  return id;
}

async function fetchPhylumId(connection, scientificName) {
  const [rows] = await connection.query(
    `
      SELECT id
      FROM taxa
      WHERE taxon_rank = 'phylum'
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
    console.log(`Target database: ${dbConfig.database}`);

    let classCount = 0;
    let orderCount = 0;
    let familyCount = 0;

    for (const [phylumName, config] of Object.entries(NONVASCULAR_SEED)) {
      const phylumId = await fetchPhylumId(connection, phylumName);
      if (!phylumId) {
        console.log(`skip ${phylumName}: phylum node not found`);
        continue;
      }

      for (const klass of config.classes) {
        const classId = await ensureNode(connection, {
          rank: 'class',
          scientificName: klass.scientific_name,
          parentId: phylumId
        });
        classCount += 1;

        for (const orderItem of klass.orders) {
          await ensureNode(connection, {
            rank: 'order',
            scientificName: orderItem.scientific_name,
            parentId: classId
          });
          orderCount += 1;

          const [orderRows] = await connection.query(
            `
              SELECT id
              FROM taxa
              WHERE taxon_rank = 'order'
                AND scientific_name = ?
              ORDER BY id ASC
              LIMIT 1
            `,
            [orderItem.scientific_name]
          );
          const orderId = Number(orderRows[0]?.id || 0);

          for (const familyName of orderItem.families || []) {
            await ensureNode(connection, {
              rank: 'family',
              scientificName: familyName,
              parentId: orderId || null
            });
            familyCount += 1;
          }
        }
      }
    }

    console.table([{ classCount, orderCount, familyCount }]);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('seed-nonvascular-higher-taxonomy failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = { main };
