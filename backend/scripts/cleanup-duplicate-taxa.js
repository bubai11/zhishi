const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  multipleStatements: true
};

const BATCH_SIZE = Number(process.env.TAXA_DEDUP_BATCH_SIZE || 5000);
const TARGET_RANKS = String(process.env.TAXA_DEDUP_RANKS || 'family,genus,species')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function ensureParentNormalizedColumn(connection) {
  const [rows] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'taxa'
      AND COLUMN_NAME = 'parent_id_normalized'
  `, [dbConfig.database]);

  if (Number(rows[0]?.total || 0) === 0) {
    try {
      await connection.query(`
        ALTER TABLE taxa
        ADD COLUMN parent_id_normalized INT
        GENERATED ALWAYS AS (COALESCE(parent_id, 0)) STORED
      `);
    } catch (err) {
      if (!String(err.message || '').includes('Duplicate column name')) {
        throw err;
      }
    }
  }
}

async function updateForeignKeys(connection, mapTableName) {
  const [rows] = await connection.query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE REFERENCED_TABLE_SCHEMA = ?
      AND REFERENCED_TABLE_NAME = 'taxa'
      AND REFERENCED_COLUMN_NAME = 'id'
      AND NOT (TABLE_NAME = 'taxa' AND COLUMN_NAME = 'id')
  `, [dbConfig.database]);

  for (const row of rows) {
    const tableName = row.TABLE_NAME;
    const columnName = row.COLUMN_NAME;

    if (tableName === 'taxonomy_features' && columnName === 'taxon_id') {
      await connection.query(`
        DELETE tf_dup
        FROM taxonomy_features tf_dup
        INNER JOIN ${quoteIdentifier(mapTableName)} m
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
        INNER JOIN ${quoteIdentifier(mapTableName)} m
          ON m.duplicate_id = ts_dup.taxon_id
        INNER JOIN taxonomy_statistics ts_keep
          ON ts_keep.taxon_id = m.keep_id
         AND ts_keep.statistics_year = ts_dup.statistics_year
      `);
    }

    console.log(`Updating foreign key ${tableName}.${columnName} using ${mapTableName}...`);
    await connection.query(`
      UPDATE ${quoteIdentifier(tableName)} target
      INNER JOIN ${quoteIdentifier(mapTableName)} m
        ON m.duplicate_id = target.${quoteIdentifier(columnName)}
      SET target.${quoteIdentifier(columnName)} = m.keep_id
    `);
  }

  console.log(`Updating taxa.parent_id using ${mapTableName}...`);
  await connection.query(`
    UPDATE taxa t
    INNER JOIN ${quoteIdentifier(mapTableName)} m
      ON m.duplicate_id = t.parent_id
    SET t.parent_id = m.keep_id
  `);
}

async function dedupeRank(connection, rank) {
  const mapTableName = `tmp_taxa_dedup_${rank}`;
  const batchTableName = `tmp_taxa_dedup_${rank}_batch`;
  await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${quoteIdentifier(mapTableName)}`);
  await connection.query(`DROP TEMPORARY TABLE IF EXISTS ${quoteIdentifier(batchTableName)}`);

  await connection.query(`
    CREATE TEMPORARY TABLE ${quoteIdentifier(mapTableName)} (
      duplicate_id INT PRIMARY KEY,
      keep_id INT NOT NULL,
      KEY idx_keep_id (keep_id)
    ) ENGINE=InnoDB
    AS
    SELECT
      t.id AS duplicate_id,
      g.keep_id
    FROM taxa t
    INNER JOIN (
      SELECT scientific_name, COALESCE(parent_id, 0) AS parent_key, MIN(id) AS keep_id, COUNT(*) AS total
      FROM taxa
      WHERE taxon_rank = ?
      GROUP BY scientific_name, COALESCE(parent_id, 0)
      HAVING COUNT(*) > 1
    ) g
      ON t.taxon_rank = ?
     AND t.scientific_name = g.scientific_name
     AND COALESCE(t.parent_id, 0) = g.parent_key
    WHERE t.id <> g.keep_id
  `, [rank, rank]);

  const [[countRow]] = await connection.query(`SELECT COUNT(*) AS total FROM ${quoteIdentifier(mapTableName)}`);
  const duplicateCount = Number(countRow?.total || 0);
  if (!duplicateCount) {
    return { rank, duplicateCount: 0 };
  }

  await connection.query(`
    CREATE TEMPORARY TABLE ${quoteIdentifier(batchTableName)} (
      duplicate_id INT PRIMARY KEY,
      keep_id INT NOT NULL,
      KEY idx_keep_id (keep_id)
    ) ENGINE=InnoDB
  `);

  let lastDuplicateId = 0;
  while (true) {
    const [batchRows] = await connection.query(`
      SELECT duplicate_id, keep_id
      FROM ${quoteIdentifier(mapTableName)}
      WHERE duplicate_id > ?
      ORDER BY duplicate_id ASC
      LIMIT ?
    `, [lastDuplicateId, BATCH_SIZE]);

    if (!batchRows.length) {
      break;
    }

    await connection.query(`TRUNCATE TABLE ${quoteIdentifier(batchTableName)}`);

    const placeholders = batchRows.map(() => '(?, ?)').join(', ');
    const values = batchRows.flatMap((row) => [row.duplicate_id, row.keep_id]);
    await connection.query(`
      INSERT INTO ${quoteIdentifier(batchTableName)} (duplicate_id, keep_id)
      VALUES ${placeholders}
    `, values);

    await updateForeignKeys(connection, batchTableName);

    await connection.query(`
      DELETE t
      FROM taxa t
      INNER JOIN ${quoteIdentifier(batchTableName)} m
        ON m.duplicate_id = t.id
    `);

    lastDuplicateId = Number(batchRows[batchRows.length - 1].duplicate_id);
    console.log(`${rank} dedupe progress: ${Math.min(lastDuplicateId, duplicateCount)} / ${duplicateCount}`);
  }

  return { rank, duplicateCount };
}

async function ensureUniqueIndex(connection) {
  const [rows] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'taxa'
      AND INDEX_NAME = 'uk_taxa_rank_name_parent_norm'
  `, [dbConfig.database]);

  if (Number(rows[0]?.total || 0) === 0) {
    await connection.query(`
      CREATE UNIQUE INDEX uk_taxa_rank_name_parent_norm
      ON taxa(taxon_rank, scientific_name, parent_id_normalized)
    `);
  }
}

async function summarizeDuplicates(connection) {
  const [rows] = await connection.query(`
    SELECT taxon_rank, COUNT(*) AS duplicate_groups, SUM(total_rows - 1) AS duplicate_rows
    FROM (
      SELECT taxon_rank, scientific_name, COALESCE(parent_id, 0) AS parent_key, COUNT(*) AS total_rows
      FROM taxa
      GROUP BY taxon_rank, scientific_name, COALESCE(parent_id, 0)
      HAVING COUNT(*) > 1
    ) d
    GROUP BY taxon_rank
    ORDER BY FIELD(taxon_rank, 'kingdom', 'phylum', 'subphylum', 'class', 'order', 'family', 'genus', 'species')
  `);

  return rows;
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log(`Target database: ${dbConfig.database}`);
    console.log(`Target ranks: ${TARGET_RANKS.join(', ')}`);
    const before = await summarizeDuplicates(connection);
    console.log('Duplicate summary before cleanup:');
    console.table(before);

    await ensureParentNormalizedColumn(connection);
    const results = [];
    for (const rank of TARGET_RANKS) {
      results.push(await dedupeRank(connection, rank));
    }

    console.log('Cleanup result:');
    console.table(results);

    const after = await summarizeDuplicates(connection);
    console.log('Duplicate summary after cleanup:');
    console.table(after);

    if (after.length === 0) {
      await ensureUniqueIndex(connection);
      console.log('Unique index uk_taxa_rank_name_parent_norm is ensured.');
    } else {
      console.log('Unique index skipped because duplicate taxa rows still remain.');
    }
  } catch (err) {
    console.error('cleanup-duplicate-taxa failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
