const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const BATCH_SIZE = Math.max(100, Number(process.env.SPECIES_DEDUP_BATCH_SIZE || 2000));
const START_AFTER = Math.max(0, Number(process.env.SPECIES_DEDUP_START_AFTER || 0));

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function updateForeignKeys(connection, batchTableName) {
  const [rows] = await connection.query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_SCHEMA = ?
      AND REFERENCED_TABLE_NAME = 'taxa'
      AND REFERENCED_COLUMN_NAME = 'id'
      AND NOT (TABLE_NAME = 'taxa' AND COLUMN_NAME = 'id')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `, [dbConfig.database]);

  for (const row of rows) {
    const tableName = row.TABLE_NAME;
    const columnName = row.COLUMN_NAME;

    if (tableName === 'taxonomy_features' && columnName === 'taxon_id') {
      await connection.query(`
        DELETE tf_dup
        FROM taxonomy_features tf_dup
        INNER JOIN ${quoteIdentifier(batchTableName)} m
          ON m.duplicate_id = tf_dup.taxon_id
        INNER JOIN taxonomy_features tf_keep
          ON tf_keep.taxon_id = m.keep_id
         AND tf_keep.feature_type = tf_dup.feature_type
      `);
    }

    if (tableName === 'taxonomy_statistics' && columnName === 'taxon_id') {
      await connection.query(`
        DELETE ts_dup
        FROM taxonomy_statistics ts_dup
        INNER JOIN ${quoteIdentifier(batchTableName)} m
          ON m.duplicate_id = ts_dup.taxon_id
        INNER JOIN taxonomy_statistics ts_keep
          ON ts_keep.taxon_id = m.keep_id
         AND ts_keep.statistics_year = ts_dup.statistics_year
      `);
    }

    await connection.query(`
      UPDATE ${quoteIdentifier(tableName)} target
      INNER JOIN ${quoteIdentifier(batchTableName)} m
        ON m.duplicate_id = target.${quoteIdentifier(columnName)}
      SET target.${quoteIdentifier(columnName)} = m.keep_id
    `);
  }

  await connection.query(`
    UPDATE taxa t
    INNER JOIN ${quoteIdentifier(batchTableName)} m
      ON m.duplicate_id = t.parent_id
    SET t.parent_id = m.keep_id
  `);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.query('DROP TEMPORARY TABLE IF EXISTS tmp_species_dedup_batch');
    await connection.query(`
      CREATE TEMPORARY TABLE tmp_species_dedup_batch (
        duplicate_id INT PRIMARY KEY,
        keep_id INT NOT NULL,
        KEY idx_keep_id (keep_id)
      ) ENGINE=InnoDB
    `);

    const [rows] = await connection.query(`
      SELECT t.id AS duplicate_id, g.keep_id
      FROM taxa t
      INNER JOIN (
        SELECT scientific_name, COALESCE(parent_id, 0) AS parent_key, MIN(id) AS keep_id, COUNT(*) AS total_rows
        FROM taxa
        WHERE taxon_rank = 'species'
        GROUP BY scientific_name, COALESCE(parent_id, 0)
        HAVING COUNT(*) > 1
      ) g
        ON t.taxon_rank = 'species'
       AND t.scientific_name = g.scientific_name
       AND COALESCE(t.parent_id, 0) = g.parent_key
      WHERE t.id > ?
        AND t.id <> g.keep_id
      ORDER BY t.id ASC
      LIMIT ?
    `, [START_AFTER, BATCH_SIZE]);

    if (!rows.length) {
      console.log(JSON.stringify({
        done: true,
        processed: 0,
        nextStartAfter: START_AFTER
      }));
      return;
    }

    const placeholders = rows.map(() => '(?, ?)').join(', ');
    const values = rows.flatMap((row) => [row.duplicate_id, row.keep_id]);
    await connection.query(`
      INSERT INTO tmp_species_dedup_batch (duplicate_id, keep_id)
      VALUES ${placeholders}
    `, values);

    await updateForeignKeys(connection, 'tmp_species_dedup_batch');

    await connection.query(`
      DELETE t
      FROM taxa t
      INNER JOIN tmp_species_dedup_batch m
        ON m.duplicate_id = t.id
    `);

    console.log(JSON.stringify({
      done: false,
      processed: rows.length,
      nextStartAfter: Number(rows[rows.length - 1].duplicate_id)
    }));
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('dedupe-species-taxa-batch failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = { main };
