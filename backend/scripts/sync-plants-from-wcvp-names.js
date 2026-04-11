const fs = require('fs');
const readline = require('readline');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const { getWcvpNamesFile } = require('./lib/wcvpPaths');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  multipleStatements: true
};

const NAMES_FILE = getWcvpNamesFile();
const BATCH_SIZE = Number(process.env.WCVP_SYNC_BATCH || 3000);

function valueOrNull(v) {
  const s = String(v ?? '').trim();
  return s === '' ? null : s;
}

function toBit(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'Y' || s === '1' || s === 'TRUE') return 1;
  if (s === 'N' || s === '0' || s === 'FALSE') return 0;
  return null;
}

async function addColumnIfMissing(connection, tableName, columnName, ddl) {
  const [rows] = await connection.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND column_name = ?
    LIMIT 1
    `,
    [tableName, columnName]
  );

  if (rows.length === 0) {
    await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${ddl}`);
  }
}

async function addIndexIfMissing(connection, tableName, indexName, ddl) {
  const [rows] = await connection.query(
    `
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = ?
      AND index_name = ?
    LIMIT 1
    `,
    [tableName, indexName]
  );

  if (rows.length === 0) {
    await connection.query(ddl);
  }
}

async function ensurePlantsColumns(connection) {
  const columns = [
    ['wcvp_plant_name_id', 'wcvp_plant_name_id VARCHAR(50) NULL'],
    ['ipni_id', 'ipni_id VARCHAR(50) NULL'],
    ['wcvp_taxon_rank', 'wcvp_taxon_rank VARCHAR(50) NULL'],
    ['wcvp_taxon_status', 'wcvp_taxon_status VARCHAR(50) NULL'],
    ['wcvp_family', 'wcvp_family VARCHAR(120) NULL'],
    ['genus_hybrid', 'genus_hybrid VARCHAR(20) NULL'],
    ['wcvp_genus', 'wcvp_genus VARCHAR(120) NULL'],
    ['species_hybrid', 'species_hybrid VARCHAR(20) NULL'],
    ['wcvp_species', 'wcvp_species VARCHAR(120) NULL'],
    ['infraspecific_rank', 'infraspecific_rank VARCHAR(50) NULL'],
    ['infraspecies', 'infraspecies VARCHAR(120) NULL'],
    ['parenthetical_author', 'parenthetical_author VARCHAR(200) NULL'],
    ['primary_author', 'primary_author VARCHAR(200) NULL'],
    ['publication_author', 'publication_author VARCHAR(200) NULL'],
    ['place_of_publication', 'place_of_publication VARCHAR(255) NULL'],
    ['volume_and_page', 'volume_and_page VARCHAR(100) NULL'],
    ['first_published', 'first_published VARCHAR(100) NULL'],
    ['nomenclatural_remarks', 'nomenclatural_remarks TEXT NULL'],
    ['geographic_area', 'geographic_area TEXT NULL'],
    ['lifeform_description', 'lifeform_description TEXT NULL'],
    ['climate_description', 'climate_description TEXT NULL'],
    ['wcvp_taxon_name', 'wcvp_taxon_name VARCHAR(255) NULL'],
    ['taxon_authors', 'taxon_authors VARCHAR(255) NULL'],
    ['accepted_plant_name_id', 'accepted_plant_name_id VARCHAR(50) NULL'],
    ['basionym_plant_name_id', 'basionym_plant_name_id VARCHAR(50) NULL'],
    ['replaced_synonym_author', 'replaced_synonym_author VARCHAR(255) NULL'],
    ['homotypic_synonym', 'homotypic_synonym VARCHAR(50) NULL'],
    ['parent_plant_name_id', 'parent_plant_name_id VARCHAR(50) NULL'],
    ['powo_id', 'powo_id VARCHAR(50) NULL'],
    ['hybrid_formula', 'hybrid_formula VARCHAR(255) NULL'],
    ['wcvp_reviewed', 'wcvp_reviewed TINYINT(1) NULL']
  ];

  for (const [name, ddl] of columns) {
    await addColumnIfMissing(connection, 'plants', name, ddl);
  }

  await addIndexIfMissing(
    connection,
    'plants',
    'idx_plants_wcvp_plant_name_id',
    'CREATE INDEX idx_plants_wcvp_plant_name_id ON plants(wcvp_plant_name_id)'
  );

  await addIndexIfMissing(
    connection,
    'plants',
    'idx_plants_taxon_status_rank',
    'CREATE INDEX idx_plants_taxon_status_rank ON plants(wcvp_taxon_status, wcvp_taxon_rank)'
  );
}

async function ensureStagingFull(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS stg_wcvp_names_full (
      plant_name_id VARCHAR(50) PRIMARY KEY,
      ipni_id VARCHAR(50) NULL,
      taxon_rank VARCHAR(50) NULL,
      taxon_status VARCHAR(50) NULL,
      family VARCHAR(120) NULL,
      genus_hybrid VARCHAR(20) NULL,
      genus VARCHAR(120) NULL,
      species_hybrid VARCHAR(20) NULL,
      species VARCHAR(120) NULL,
      infraspecific_rank VARCHAR(50) NULL,
      infraspecies VARCHAR(120) NULL,
      parenthetical_author VARCHAR(200) NULL,
      primary_author VARCHAR(200) NULL,
      publication_author VARCHAR(200) NULL,
      place_of_publication VARCHAR(255) NULL,
      volume_and_page VARCHAR(100) NULL,
      first_published VARCHAR(100) NULL,
      nomenclatural_remarks TEXT NULL,
      geographic_area TEXT NULL,
      lifeform_description TEXT NULL,
      climate_description TEXT NULL,
      taxon_name VARCHAR(255) NULL,
      taxon_authors VARCHAR(255) NULL,
      accepted_plant_name_id VARCHAR(50) NULL,
      basionym_plant_name_id VARCHAR(50) NULL,
      replaced_synonym_author VARCHAR(255) NULL,
      homotypic_synonym VARCHAR(50) NULL,
      parent_plant_name_id VARCHAR(50) NULL,
      powo_id VARCHAR(50) NULL,
      hybrid_formula VARCHAR(255) NULL,
      reviewed VARCHAR(10) NULL,
      canonical_scientific_name VARCHAR(255) NULL,
      INDEX idx_stg_full_rank_status (taxon_rank, taxon_status),
      INDEX idx_stg_full_canonical (canonical_scientific_name),
      INDEX idx_stg_full_acc (accepted_plant_name_id),
      INDEX idx_stg_full_family_genus (family, genus)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query('TRUNCATE TABLE stg_wcvp_names_full');
}

async function bulkInsert(connection, table, columns, rows) {
  if (!rows.length) return;
  const rowPlaceholder = `(${columns.map(() => '?').join(',')})`;
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${rows.map(() => rowPlaceholder).join(',')}`;
  await connection.query(sql, rows.flat());
}

async function loadWcvpNamesFull(connection) {
  const rl = readline.createInterface({
    input: fs.createReadStream(NAMES_FILE),
    crlfDelay: Infinity
  });

  let lineNo = 0;
  let rows = [];

  for await (const line of rl) {
    lineNo += 1;
    if (lineNo === 1 || !line) continue;

    const c = line.split('|');
    rows.push([
      valueOrNull(c[0]),
      valueOrNull(c[1]),
      valueOrNull(c[2]),
      valueOrNull(c[3]),
      valueOrNull(c[4]),
      valueOrNull(c[5]),
      valueOrNull(c[6]),
      valueOrNull(c[7]),
      valueOrNull(c[8]),
      valueOrNull(c[9]),
      valueOrNull(c[10]),
      valueOrNull(c[11]),
      valueOrNull(c[12]),
      valueOrNull(c[13]),
      valueOrNull(c[14]),
      valueOrNull(c[15]),
      valueOrNull(c[16]),
      valueOrNull(c[17]),
      valueOrNull(c[18]),
      valueOrNull(c[19]),
      valueOrNull(c[20]),
      valueOrNull(c[21]),
      valueOrNull(c[22]),
      valueOrNull(c[23]),
      valueOrNull(c[24]),
      valueOrNull(c[25]),
      valueOrNull(c[26]),
      valueOrNull(c[27]),
      valueOrNull(c[28]),
      valueOrNull(c[29]),
      valueOrNull(c[30]),
      null
    ]);

    if (rows.length >= BATCH_SIZE) {
      await bulkInsert(
        connection,
        'stg_wcvp_names_full',
        [
          'plant_name_id', 'ipni_id', 'taxon_rank', 'taxon_status', 'family', 'genus_hybrid', 'genus', 'species_hybrid',
          'species', 'infraspecific_rank', 'infraspecies', 'parenthetical_author', 'primary_author', 'publication_author',
          'place_of_publication', 'volume_and_page', 'first_published', 'nomenclatural_remarks', 'geographic_area',
          'lifeform_description', 'climate_description', 'taxon_name', 'taxon_authors', 'accepted_plant_name_id',
          'basionym_plant_name_id', 'replaced_synonym_author', 'homotypic_synonym', 'parent_plant_name_id',
          'powo_id', 'hybrid_formula', 'reviewed', 'canonical_scientific_name'
        ],
        rows
      );
      rows = [];
    }
  }

  if (rows.length) {
    await bulkInsert(
      connection,
      'stg_wcvp_names_full',
      [
        'plant_name_id', 'ipni_id', 'taxon_rank', 'taxon_status', 'family', 'genus_hybrid', 'genus', 'species_hybrid',
        'species', 'infraspecific_rank', 'infraspecies', 'parenthetical_author', 'primary_author', 'publication_author',
        'place_of_publication', 'volume_and_page', 'first_published', 'nomenclatural_remarks', 'geographic_area',
        'lifeform_description', 'climate_description', 'taxon_name', 'taxon_authors', 'accepted_plant_name_id',
        'basionym_plant_name_id', 'replaced_synonym_author', 'homotypic_synonym', 'parent_plant_name_id',
        'powo_id', 'hybrid_formula', 'reviewed', 'canonical_scientific_name'
      ],
      rows
    );
  }

  await connection.query(`
    UPDATE stg_wcvp_names_full
    SET canonical_scientific_name = NULLIF(
      TRIM(
        CONCAT_WS(
          ' ',
          NULLIF(genus, ''),
          NULLIF(species, ''),
          CASE
            WHEN infraspecific_rank IS NOT NULL AND infraspecific_rank <> '' AND infraspecies IS NOT NULL AND infraspecies <> ''
              THEN CONCAT(infraspecific_rank, ' ', infraspecies)
            WHEN infraspecies IS NOT NULL AND infraspecies <> ''
              THEN infraspecies
            ELSE NULL
          END
        )
      ),
      ''
    )
    WHERE canonical_scientific_name IS NULL
  `);
}

async function syncPlantsFromStaging(connection) {
  await connection.query(`
    UPDATE plants p
    INNER JOIN (
      SELECT plant_id, MIN(wcvp_plant_name_id) AS wcvp_plant_name_id
      FROM plant_distributions
      WHERE plant_id IS NOT NULL
        AND wcvp_plant_name_id IS NOT NULL
        AND wcvp_plant_name_id <> ''
      GROUP BY plant_id
    ) d ON d.plant_id = p.id
    SET p.wcvp_plant_name_id = COALESCE(p.wcvp_plant_name_id, d.wcvp_plant_name_id)
    WHERE p.wcvp_plant_name_id IS NULL OR p.wcvp_plant_name_id = ''
  `);

  await connection.query(`
    UPDATE plants p
    INNER JOIN stg_wcvp_names_full n ON n.plant_name_id = p.wcvp_plant_name_id
    LEFT JOIN stg_wcvp_names_full na ON na.plant_name_id = n.accepted_plant_name_id
    SET
      p.scientific_name = COALESCE(
        CASE
          WHEN LOWER(COALESCE(n.taxon_status, '')) = 'accepted' THEN n.canonical_scientific_name
          ELSE na.canonical_scientific_name
        END,
        n.canonical_scientific_name,
        p.scientific_name
      ),
      p.wcvp_taxon_name = COALESCE(
        CASE
          WHEN LOWER(COALESCE(n.taxon_status, '')) = 'accepted' THEN n.taxon_name
          ELSE na.taxon_name
        END,
        n.taxon_name,
        p.wcvp_taxon_name
      )
    WHERE COALESCE(
        CASE
          WHEN LOWER(COALESCE(n.taxon_status, '')) = 'accepted' THEN n.canonical_scientific_name
          ELSE na.canonical_scientific_name
        END,
        n.canonical_scientific_name
      ) IS NOT NULL
  `);

  await connection.query(`
    UPDATE plants p
    INNER JOIN taxa t ON t.id = p.taxon_id AND t.taxon_rank = 'species'
    SET p.scientific_name = t.scientific_name
    WHERE p.scientific_name IS NULL
      OR p.scientific_name = ''
      OR p.scientific_name REGEXP '^[A-Z][a-z]?\\.$'
  `);

  await connection.query(`
    CREATE TEMPORARY TABLE tmp_wcvp_species_pick AS
    SELECT *
    FROM (
      SELECT
        n.*,
        ROW_NUMBER() OVER (
          PARTITION BY n.canonical_scientific_name
          ORDER BY
            CASE WHEN UPPER(COALESCE(n.reviewed, '')) = 'Y' THEN 1 ELSE 0 END DESC,
            n.plant_name_id ASC
        ) AS rn
      FROM stg_wcvp_names_full n
      WHERE LOWER(COALESCE(n.taxon_rank, '')) = 'species'
        AND LOWER(COALESCE(n.taxon_status, '')) = 'accepted'
        AND n.canonical_scientific_name IS NOT NULL
        AND n.canonical_scientific_name <> ''
    ) x
    WHERE x.rn = 1
  `);

  await connection.query(`
    UPDATE plants p
    INNER JOIN taxa t ON t.id = p.taxon_id AND t.taxon_rank = 'species'
    INNER JOIN tmp_wcvp_species_pick n ON n.canonical_scientific_name = t.scientific_name
    SET
      p.wcvp_plant_name_id = COALESCE(p.wcvp_plant_name_id, n.plant_name_id),
      p.ipni_id = COALESCE(n.ipni_id, p.ipni_id),
      p.wcvp_taxon_rank = COALESCE(n.taxon_rank, p.wcvp_taxon_rank),
      p.wcvp_taxon_status = COALESCE(n.taxon_status, p.wcvp_taxon_status),
      p.wcvp_family = COALESCE(n.family, p.wcvp_family),
      p.genus_hybrid = COALESCE(n.genus_hybrid, p.genus_hybrid),
      p.wcvp_genus = COALESCE(n.genus, p.wcvp_genus),
      p.species_hybrid = COALESCE(n.species_hybrid, p.species_hybrid),
      p.wcvp_species = COALESCE(n.species, p.wcvp_species),
      p.infraspecific_rank = COALESCE(n.infraspecific_rank, p.infraspecific_rank),
      p.infraspecies = COALESCE(n.infraspecies, p.infraspecies),
      p.parenthetical_author = COALESCE(n.parenthetical_author, p.parenthetical_author),
      p.primary_author = COALESCE(n.primary_author, p.primary_author),
      p.publication_author = COALESCE(n.publication_author, p.publication_author),
      p.place_of_publication = COALESCE(n.place_of_publication, p.place_of_publication),
      p.volume_and_page = COALESCE(n.volume_and_page, p.volume_and_page),
      p.first_published = COALESCE(n.first_published, p.first_published),
      p.nomenclatural_remarks = COALESCE(n.nomenclatural_remarks, p.nomenclatural_remarks),
      p.geographic_area = COALESCE(n.geographic_area, p.geographic_area),
      p.lifeform_description = COALESCE(n.lifeform_description, p.lifeform_description),
      p.climate_description = COALESCE(n.climate_description, p.climate_description),
      p.wcvp_taxon_name = COALESCE(n.taxon_name, p.wcvp_taxon_name),
      p.taxon_authors = COALESCE(n.taxon_authors, p.taxon_authors),
      p.accepted_plant_name_id = COALESCE(n.accepted_plant_name_id, p.accepted_plant_name_id),
      p.basionym_plant_name_id = COALESCE(n.basionym_plant_name_id, p.basionym_plant_name_id),
      p.replaced_synonym_author = COALESCE(n.replaced_synonym_author, p.replaced_synonym_author),
      p.homotypic_synonym = COALESCE(n.homotypic_synonym, p.homotypic_synonym),
      p.parent_plant_name_id = COALESCE(n.parent_plant_name_id, p.parent_plant_name_id),
      p.powo_id = COALESCE(n.powo_id, p.powo_id),
      p.hybrid_formula = COALESCE(n.hybrid_formula, p.hybrid_formula),
      p.wcvp_reviewed = COALESCE(p.wcvp_reviewed, ?)
  `,
  [1]
  );

  await connection.query(`
    UPDATE plants p
    INNER JOIN stg_wcvp_names_full n ON n.plant_name_id = p.wcvp_plant_name_id
    SET p.wcvp_reviewed = COALESCE(p.wcvp_reviewed, ?)
    WHERE UPPER(COALESCE(n.reviewed, '')) IN ('Y', 'N')
  `, [1]);

  await connection.query(`
    UPDATE plants p
    INNER JOIN stg_wcvp_names_full n ON n.plant_name_id = p.wcvp_plant_name_id
    SET p.wcvp_reviewed = CASE WHEN UPPER(COALESCE(n.reviewed, '')) = 'Y' THEN 1 WHEN UPPER(COALESCE(n.reviewed, '')) = 'N' THEN 0 ELSE p.wcvp_reviewed END
  `);

  await connection.query(`
    UPDATE taxa t
    INNER JOIN plants p ON p.taxon_id = t.id
    SET t.scientific_name = p.scientific_name
    WHERE t.taxon_rank = 'species'
      AND p.scientific_name IS NOT NULL
      AND p.scientific_name <> ''
      AND p.scientific_name <> t.scientific_name
  `);

  await connection.query('DROP TEMPORARY TABLE IF EXISTS tmp_wcvp_species_pick');
}

async function printSummary(connection) {
  const [rows] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM stg_wcvp_names_full) AS stg_full_rows,
      (SELECT COUNT(*) FROM plants) AS plants_rows,
      (SELECT COUNT(*) FROM plants WHERE wcvp_plant_name_id IS NOT NULL AND wcvp_plant_name_id <> '') AS plants_with_plant_name_id,
      (SELECT COUNT(*) FROM plants WHERE wcvp_taxon_rank = 'Species' OR LOWER(COALESCE(wcvp_taxon_rank, '')) = 'species') AS plants_with_species_rank,
        (SELECT COUNT(*) FROM plants WHERE scientific_name REGEXP '^[A-Z][a-z]?\\.$') AS bad_scientific_names,
        (SELECT COUNT(*) FROM plants WHERE chinese_name IS NOT NULL AND chinese_name <> '' AND chinese_name <> scientific_name) AS plants_with_chinese
  `);

  console.log('WCVP -> plants 字段同步完成，汇总如下:');
  console.table(rows);
}

async function main() {
  if (!fs.existsSync(NAMES_FILE)) {
    throw new Error(`未找到文件: ${NAMES_FILE}`);
  }

  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log(`目标数据库: ${dbConfig.database}`);
    console.log('1/4 补齐 plants 目标字段...');
    await ensurePlantsColumns(connection);

    console.log('2/4 重建 stg_wcvp_names_full 并导入 names 全字段...');
    await ensureStagingFull(connection);
    await loadWcvpNamesFull(connection);

    console.log('3/4 同步 species 记录到 plants（含 plant_name_id 与元字段）...');
    await syncPlantsFromStaging(connection);

    console.log('4/4 输出汇总...');
    await printSummary(connection);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('同步失败:', err.message);
  if (err && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
