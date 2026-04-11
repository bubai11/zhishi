const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const {
  assignUnresolvedFamilies,
  ensureStandardHierarchy,
  repairMappedFamilyParents
} = require('./lib/taxonomyHierarchy');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  multipleStatements: true
};

const UPDATE_CHUNK_SIZE = Number(process.env.TAXONOMY_REPAIR_CHUNK_SIZE || 5000);

async function ensureIndexes(connection) {
  const statements = [
    'CREATE INDEX idx_plants_scientific_name ON plants(scientific_name)',
    'CREATE INDEX idx_plants_family_genus ON plants(wcvp_family, wcvp_genus)',
    'CREATE INDEX idx_taxa_rank_name_parent ON taxa(taxon_rank, scientific_name, parent_id)',
    'CREATE INDEX idx_taxa_parent ON taxa(parent_id)',
    'CREATE INDEX idx_taxa_rank_id ON taxa(taxon_rank, id)'
  ];

  for (const sql of statements) {
    try {
      await connection.query(sql);
    } catch (err) {
      if (!String(err.message || '').includes('Duplicate key name')) {
        throw err;
      }
    }
  }
}

async function buildRepairMaps(connection) {
  await connection.query('DROP TEMPORARY TABLE IF EXISTS tmp_species_repair_map');
  await connection.query('DROP TEMPORARY TABLE IF EXISTS tmp_genus_repair_map');
  await connection.query('DROP TEMPORARY TABLE IF EXISTS tmp_species_repair_chunk');
  await connection.query('DROP TEMPORARY TABLE IF EXISTS tmp_plant_taxon_chunk');

  await connection.query(`
    CREATE TEMPORARY TABLE tmp_genus_repair_map (
      genus_name VARCHAR(100) NOT NULL PRIMARY KEY,
      family_name VARCHAR(100) NOT NULL,
      KEY idx_tmp_genus_family (family_name)
    ) ENGINE=InnoDB
    AS
    SELECT
      wcvp_genus AS genus_name,
      MIN(wcvp_family) AS family_name
    FROM plants
    WHERE wcvp_genus IS NOT NULL AND wcvp_genus <> ''
      AND wcvp_family IS NOT NULL AND wcvp_family <> ''
    GROUP BY wcvp_genus
  `);

  await connection.query(`
    CREATE TEMPORARY TABLE tmp_species_repair_map (
      scientific_name VARCHAR(200) NOT NULL PRIMARY KEY,
      family_name VARCHAR(100) NOT NULL,
      genus_name VARCHAR(100) NOT NULL,
      KEY idx_tmp_species_family_genus (family_name, genus_name)
    ) ENGINE=InnoDB
    AS
    SELECT
      scientific_name,
      MIN(wcvp_family) AS family_name,
      MIN(wcvp_genus) AS genus_name
    FROM plants
    WHERE scientific_name IS NOT NULL AND scientific_name <> ''
      AND wcvp_family IS NOT NULL AND wcvp_family <> ''
      AND wcvp_genus IS NOT NULL AND wcvp_genus <> ''
    GROUP BY scientific_name
  `);

  await connection.query(`
    CREATE TEMPORARY TABLE tmp_species_repair_chunk (
      scientific_name VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL PRIMARY KEY,
      family_name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
      genus_name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
      KEY idx_chunk_family_genus (family_name, genus_name)
    ) ENGINE=InnoDB
  `);

  await connection.query(`
    CREATE TEMPORARY TABLE tmp_plant_taxon_chunk (
      scientific_name VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL PRIMARY KEY
    ) ENGINE=InnoDB
  `);
}

async function ensureFamilyAndGenusNodes(connection, unresolvedOrderId) {
  await connection.query(
    `
      INSERT INTO taxa (taxon_rank, parent_id, scientific_name, common_name, chinese_name, created_at, updated_at)
      SELECT
        'family',
        ?,
        p.wcvp_family,
        p.wcvp_family,
        NULL,
        NOW(),
        NOW()
      FROM (
        SELECT DISTINCT wcvp_family
        FROM plants
        WHERE wcvp_family IS NOT NULL AND wcvp_family <> ''
      ) p
      LEFT JOIN taxa f
        ON f.taxon_rank = 'family'
       AND f.scientific_name COLLATE utf8mb4_unicode_ci = p.wcvp_family COLLATE utf8mb4_unicode_ci
      WHERE f.id IS NULL
    `,
    [unresolvedOrderId]
  );

  await connection.query(`
    INSERT INTO taxa (taxon_rank, parent_id, scientific_name, common_name, chinese_name, created_at, updated_at)
    SELECT
      'genus',
      f.id,
      x.wcvp_genus,
      x.wcvp_genus,
      NULL,
      NOW(),
      NOW()
    FROM (
      SELECT DISTINCT wcvp_family, wcvp_genus
      FROM plants
      WHERE wcvp_family IS NOT NULL AND wcvp_family <> ''
        AND wcvp_genus IS NOT NULL AND wcvp_genus <> ''
    ) x
    INNER JOIN taxa f
      ON f.taxon_rank = 'family'
     AND f.scientific_name COLLATE utf8mb4_unicode_ci = x.wcvp_family COLLATE utf8mb4_unicode_ci
    LEFT JOIN taxa g
      ON g.taxon_rank = 'genus'
     AND g.scientific_name COLLATE utf8mb4_unicode_ci = x.wcvp_genus COLLATE utf8mb4_unicode_ci
     AND g.parent_id = f.id
    WHERE g.id IS NULL
  `);
}

async function repairFamilyParents(connection, unresolvedOrderId) {
  await repairMappedFamilyParents(connection);
  await assignUnresolvedFamilies(connection, unresolvedOrderId);
}

async function repairGenusParents(connection) {
  await connection.query(`
    UPDATE taxa g
    INNER JOIN tmp_genus_repair_map p
      ON p.genus_name COLLATE utf8mb4_unicode_ci = g.scientific_name COLLATE utf8mb4_unicode_ci
    INNER JOIN taxa f
      ON f.taxon_rank = 'family'
     AND f.scientific_name COLLATE utf8mb4_unicode_ci = p.family_name COLLATE utf8mb4_unicode_ci
    SET g.parent_id = f.id
    WHERE g.taxon_rank = 'genus'
      AND (g.parent_id IS NULL OR g.parent_id = 0)
  `);
}

async function repairSpeciesParents(connection) {
  let lastScientificName = '';

  while (true) {
    const [chunkRows] = await connection.query(
      `
        SELECT scientific_name, family_name, genus_name
        FROM tmp_species_repair_map
        WHERE scientific_name > ?
        ORDER BY scientific_name ASC
        LIMIT ?
      `,
      [lastScientificName, UPDATE_CHUNK_SIZE]
    );

    if (!chunkRows.length) {
      return;
    }

    const repairRows = chunkRows.filter((row) => row.scientific_name && row.family_name && row.genus_name);
    if (!repairRows.length) {
      return;
    }

    await connection.query('TRUNCATE TABLE tmp_species_repair_chunk');

    const valuePlaceholders = repairRows.map(() => '(?, ?, ?)').join(', ');
    const insertParams = repairRows.flatMap((row) => [row.scientific_name, row.family_name, row.genus_name]);
    await connection.query(
      `
        INSERT INTO tmp_species_repair_chunk (scientific_name, family_name, genus_name)
        VALUES ${valuePlaceholders}
      `,
      insertParams
    );

    await connection.query(
      `
        UPDATE taxa s
        INNER JOIN tmp_species_repair_chunk p
          ON p.scientific_name = s.scientific_name
        INNER JOIN taxa f
          ON f.taxon_rank = 'family'
         AND f.scientific_name = p.family_name
        INNER JOIN taxa g
          ON g.taxon_rank = 'genus'
         AND g.scientific_name = p.genus_name
         AND g.parent_id = f.id
        SET s.parent_id = g.id
        WHERE s.taxon_rank = 'species'
          AND (s.parent_id IS NULL OR s.parent_id <> g.id)
      `
    );

    lastScientificName = repairRows[repairRows.length - 1].scientific_name;
    console.log(`species -> genus 修复完成: ${repairRows[0].scientific_name} -> ${lastScientificName} (${repairRows.length} names)`);
  }
}

async function repairPlantTaxonIds(connection) {
  const [rangeRows] = await connection.query(`
    SELECT MIN(id) AS min_id, MAX(id) AS max_id
    FROM plants
  `);

  const minId = Number(rangeRows[0]?.min_id || 0);
  const maxId = Number(rangeRows[0]?.max_id || 0);
  if (!minId || !maxId) return;

  let start = minId;
  while (start <= maxId) {
    const end = Math.min(start + UPDATE_CHUNK_SIZE - 1, maxId);
    const [chunkRows] = await connection.query(
      `
        SELECT DISTINCT scientific_name
        FROM plants
        WHERE id BETWEEN ? AND ?
          AND scientific_name IS NOT NULL
          AND scientific_name <> ''
      `,
      [start, end]
    );

    const scientificNames = chunkRows
      .map((row) => row.scientific_name)
      .filter(Boolean);

    if (scientificNames.length) {
      await connection.query('TRUNCATE TABLE tmp_plant_taxon_chunk');

      const valuePlaceholders = scientificNames.map(() => '(?)').join(', ');
      await connection.query(
        `
          INSERT INTO tmp_plant_taxon_chunk (scientific_name)
          VALUES ${valuePlaceholders}
        `,
        scientificNames
      );

      await connection.query(
        `
          UPDATE plants p
          INNER JOIN tmp_plant_taxon_chunk c
            ON c.scientific_name = p.scientific_name
          INNER JOIN taxa s
            ON s.taxon_rank = 'species'
           AND s.scientific_name = p.scientific_name
          SET p.taxon_id = s.id
          WHERE p.id BETWEEN ? AND ?
            AND (p.taxon_id IS NULL OR p.taxon_id <> s.id)
        `,
        [start, end]
      );
    }

    console.log(`plants.taxon_id 回填完成: ${start} - ${end}`);
    start = end + 1;
  }
}

async function fetchSummary(connection) {
  const [rows] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM plants) AS plants_total,
      (SELECT COUNT(*) FROM taxa WHERE taxon_rank = 'family' AND (parent_id IS NULL OR parent_id = 0)) AS family_without_parent,
      (SELECT COUNT(*) FROM plants p
        LEFT JOIN taxa s ON s.id = p.taxon_id AND s.taxon_rank = 'species'
        LEFT JOIN taxa g ON g.id = s.parent_id AND g.taxon_rank = 'genus'
        LEFT JOIN taxa f ON f.id = g.parent_id AND f.taxon_rank = 'family'
        LEFT JOIN taxa o ON o.id = f.parent_id AND o.taxon_rank = 'order'
        LEFT JOIN taxa c ON c.id = o.parent_id AND c.taxon_rank = 'class'
        LEFT JOIN taxa sp ON sp.id = c.parent_id AND sp.taxon_rank = 'subphylum'
        LEFT JOIN taxa ph ON ph.id = CASE WHEN sp.id IS NOT NULL THEN sp.parent_id ELSE c.parent_id END AND ph.taxon_rank = 'phylum'
        LEFT JOIN taxa k ON k.id = ph.parent_id AND k.taxon_rank = 'kingdom'
       WHERE s.id IS NULL OR g.id IS NULL OR f.id IS NULL OR o.id IS NULL OR c.id IS NULL OR ph.id IS NULL OR k.id IS NULL
      ) AS plants_broken_full_chain,
      (SELECT COUNT(*) FROM plants p
        INNER JOIN taxa s ON s.id = p.taxon_id AND s.taxon_rank = 'species'
        LEFT JOIN taxa parent ON parent.id = s.parent_id
       WHERE parent.taxon_rank = 'family'
      ) AS species_pointing_to_family
  `);

  return rows[0] || {};
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log(`目标数据库: ${dbConfig.database}`);
    console.log('1/8 建索引优化...');
    await ensureIndexes(connection);

    console.log('2/8 构建 repair 临时映射表...');
    await buildRepairMaps(connection);

    console.log('3/8 补齐界门纲目骨架...');
    const { unresolvedOrderId } = await ensureStandardHierarchy(connection);

    console.log('4/8 修复 family -> order ...');
    await repairFamilyParents(connection, unresolvedOrderId);

    console.log('5/8 确保 family/genus 节点存在...');
    await ensureFamilyAndGenusNodes(connection, unresolvedOrderId);
    await repairFamilyParents(connection, unresolvedOrderId);

    console.log('6/8 修复 genus -> family ...');
    await repairGenusParents(connection);

    console.log('7/8 修复 species -> genus ...');
    await repairSpeciesParents(connection);

    console.log('8/8 回填 plants.taxon_id ...');
    await repairPlantTaxonIds(connection);

    const summary = await fetchSummary(connection);
    console.table([summary]);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('修复 taxonomy 父链失败:', err.message);
  if (err && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
