const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const { getWcvpNamesFile, getWcvpDistributionFile } = require('./lib/wcvpPaths');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  multipleStatements: true
};

const NAMES_FILE = getWcvpNamesFile();
const DIST_FILE = getWcvpDistributionFile();

const BATCH_SIZE = 5000;

function quoteForMysqlFilePath(filePath) {
  return filePath.replace(/\\/g, '\\\\');
}

function toTinyInt(v) {
  return String(v || '').trim() === '1' ? 1 : 0;
}

async function bulkInsert(connection, table, columns, rows) {
  if (!rows.length) return;
  const rowPlaceholder = `(${columns.map(() => '?').join(',')})`;
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${rows.map(() => rowPlaceholder).join(',')}`;
  const values = rows.flat();
  await connection.query(sql, values);
}

async function streamLoadNames(connection) {
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
      c[0] || null,
      c[21] || null,
      c[2] || null,
      c[4] || null,
      c[6] || null,
      c[23] || null,
      c[3] || null
    ]);

    if (rows.length >= BATCH_SIZE) {
      await bulkInsert(
        connection,
        'stg_wcvp_names',
        ['plant_name_id', 'taxon_name', 'taxon_rank', 'family', 'genus', 'accepted_plant_name_id', 'taxon_status'],
        rows
      );
      rows = [];
    }
  }

  if (rows.length) {
    await bulkInsert(
      connection,
      'stg_wcvp_names',
      ['plant_name_id', 'taxon_name', 'taxon_rank', 'family', 'genus', 'accepted_plant_name_id', 'taxon_status'],
      rows
    );
  }
}

async function streamLoadDistribution(connection) {
  const rl = readline.createInterface({
    input: fs.createReadStream(DIST_FILE),
    crlfDelay: Infinity
  });

  let lineNo = 0;
  let rows = [];
  for await (const line of rl) {
    lineNo += 1;
    if (lineNo === 1 || !line) continue;

    const c = line.split('|');
    rows.push([
      c[0] || null,
      c[1] || null,
      c[2] || null,
      c[3] || null,
      c[4] || null,
      c[5] || null,
      c[6] || null,
      c[7] || null,
      toTinyInt(c[8]),
      toTinyInt(c[9]),
      toTinyInt(c[10])
    ]);

    if (rows.length >= BATCH_SIZE) {
      await bulkInsert(
        connection,
        'stg_wcvp_distribution',
        [
          'plant_locality_id', 'plant_name_id', 'continent_code_l1', 'continent',
          'region_code_l2', 'region_name_l2', 'area_code_l3', 'area_name_l3',
          'introduced', 'extinct', 'location_doubtful'
        ],
        rows
      );
      rows = [];
    }
  }

  if (rows.length) {
    await bulkInsert(
      connection,
      'stg_wcvp_distribution',
      [
        'plant_locality_id', 'plant_name_id', 'continent_code_l1', 'continent',
        'region_code_l2', 'region_name_l2', 'area_code_l3', 'area_name_l3',
        'introduced', 'extinct', 'location_doubtful'
      ],
      rows
    );
  }
}

async function ensureTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS stg_wcvp_names (
      plant_name_id VARCHAR(50) PRIMARY KEY,
      taxon_name VARCHAR(255),
      taxon_rank VARCHAR(50),
      family VARCHAR(120),
      genus VARCHAR(120),
      accepted_plant_name_id VARCHAR(50),
      taxon_status VARCHAR(50),
      INDEX idx_accepted (accepted_plant_name_id),
      INDEX idx_taxon_name (taxon_name),
      INDEX idx_rank_status (taxon_rank, taxon_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS stg_wcvp_distribution (
      plant_locality_id BIGINT PRIMARY KEY,
      plant_name_id VARCHAR(50),
      continent_code_l1 VARCHAR(10),
      continent VARCHAR(50),
      region_code_l2 VARCHAR(10),
      region_name_l2 VARCHAR(100),
      area_code_l3 VARCHAR(10),
      area_name_l3 VARCHAR(100),
      introduced TINYINT(1) DEFAULT 0,
      extinct TINYINT(1) DEFAULT 0,
      location_doubtful TINYINT(1) DEFAULT 0,
      INDEX idx_plant_name_id (plant_name_id),
      INDEX idx_area_code_l3 (area_code_l3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS plant_distributions (
      id INT PRIMARY KEY AUTO_INCREMENT,
      plant_id INT NULL,
      taxon_id INT NULL,
      wcvp_plant_name_id VARCHAR(50),
      scientific_name VARCHAR(200),
      area_code_l1 VARCHAR(10),
      area_code_l2 VARCHAR(10),
      area_code_l3 VARCHAR(10) NOT NULL,
      area_name VARCHAR(100),
      continent VARCHAR(50),
      country_code VARCHAR(10),
      occurrence_status ENUM('native', 'introduced', 'extinct', 'doubtful') DEFAULT 'native',
      introduced TINYINT(1) DEFAULT 0,
      extinct TINYINT(1) DEFAULT 0,
      latitude DECIMAL(10, 6) NULL,
      longitude DECIMAL(11, 6) NULL,
      data_source VARCHAR(50) DEFAULT 'WCVP',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_plant_distributions_plant_id
        FOREIGN KEY (plant_id) REFERENCES plants(id)
        ON DELETE SET NULL,
      CONSTRAINT fk_plant_distributions_taxon_id
        FOREIGN KEY (taxon_id) REFERENCES taxa(id)
        ON DELETE SET NULL,
      UNIQUE KEY uk_wcvp_distribution (plant_id, wcvp_plant_name_id, area_code_l3, occurrence_status),
      INDEX idx_area_code_l3 (area_code_l3),
      INDEX idx_plant_id (plant_id),
      INDEX idx_taxon_id (taxon_id),
      INDEX idx_continent (continent)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS wgsrpd_regions (
      area_code_l1 VARCHAR(10),
      area_name_l1 VARCHAR(100),
      area_code_l2 VARCHAR(10),
      area_name_l2 VARCHAR(100),
      area_code_l3 VARCHAR(10) PRIMARY KEY,
      area_name_l3 VARCHAR(100),
      continent VARCHAR(50),
      latitude DECIMAL(10, 6) NULL,
      longitude DECIMAL(11, 6) NULL,
      country_code VARCHAR(10) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function truncateStaging(connection) {
  try {
    await connection.query('TRUNCATE TABLE stg_wcvp_names');
  } catch (err) {
    await connection.query('DELETE FROM stg_wcvp_names');
  }

  try {
    await connection.query('TRUNCATE TABLE stg_wcvp_distribution');
  } catch (err) {
    await connection.query('DELETE FROM stg_wcvp_distribution');
  }
}

async function loadStagingFromFiles(connection) {
  const namesPath = quoteForMysqlFilePath(NAMES_FILE);
  const distPath = quoteForMysqlFilePath(DIST_FILE);

  try {
    await connection.query(`
      LOAD DATA LOCAL INFILE '${namesPath}'
      INTO TABLE stg_wcvp_names
      CHARACTER SET utf8mb4
      FIELDS TERMINATED BY '|'
      LINES TERMINATED BY '\n'
      IGNORE 1 LINES
      (@c1,@c2,@c3,@c4,@c5,@c6,@c7,@c8,@c9,@c10,@c11,@c12,@c13,@c14,@c15,@c16,@c17,@c18,@c19,@c20,@c21,@c22,@c23,@c24,@c25,@c26,@c27,@c28,@c29,@c30)
      SET
        plant_name_id = NULLIF(@c1, ''),
        taxon_rank = NULLIF(@c3, ''),
        taxon_status = NULLIF(@c4, ''),
        family = NULLIF(@c5, ''),
        genus = NULLIF(@c7, ''),
        taxon_name = NULLIF(@c22, ''),
        accepted_plant_name_id = NULLIF(@c24, '')
    `);

    await connection.query(`
      LOAD DATA LOCAL INFILE '${distPath}'
      INTO TABLE stg_wcvp_distribution
      CHARACTER SET utf8mb4
      FIELDS TERMINATED BY '|'
      LINES TERMINATED BY '\n'
      IGNORE 1 LINES
      (
        @c1,@c2,@c3,@c4,@c5,@c6,@c7,@c8,@c9,@c10,@c11
      )
      SET
        plant_locality_id = NULLIF(@c1, ''),
        plant_name_id = NULLIF(@c2, ''),
        continent_code_l1 = NULLIF(@c3, ''),
        continent = NULLIF(@c4, ''),
        region_code_l2 = NULLIF(@c5, ''),
        region_name_l2 = NULLIF(@c6, ''),
        area_code_l3 = NULLIF(@c7, ''),
        area_name_l3 = NULLIF(@c8, ''),
        introduced = IFNULL(NULLIF(@c9, ''), 0),
        extinct = IFNULL(NULLIF(@c10, ''), 0),
        location_doubtful = IFNULL(NULLIF(@c11, ''), 0)
    `);
  } catch (err) {
    if (!String(err.message).includes('Loading local data is disabled')) {
      throw err;
    }

    console.log('LOCAL INFILE 被禁用，切换到流式批量导入...');
    await streamLoadNames(connection);
    await streamLoadDistribution(connection);
  }
}

async function upsertTaxaAndPlants(connection) {
  await connection.query(`
    INSERT INTO taxa (taxon_rank, parent_id, scientific_name, chinese_name, common_name, created_at, updated_at)
    SELECT
      'family',
      NULL,
      n.family,
      n.family,
      n.family,
      NOW(),
      NOW()
    FROM stg_wcvp_names n
    LEFT JOIN taxa t
      ON t.taxon_rank = 'family' AND t.scientific_name = n.family
    WHERE LOWER(n.taxon_rank) = 'species'
      AND LOWER(n.taxon_status) = 'accepted'
      AND n.family IS NOT NULL
      AND n.family <> ''
      AND t.id IS NULL
    GROUP BY n.family
  `);

  await connection.query(`
    INSERT INTO taxa (taxon_rank, parent_id, scientific_name, chinese_name, common_name, created_at, updated_at)
    SELECT
      'species',
      f.id,
      COALESCE(
        NULLIF(nf.canonical_scientific_name, ''),
        NULLIF(CONCAT_WS(' ', NULLIF(nf.genus, ''), NULLIF(nf.species, '')), ''),
        n.taxon_name
      ) AS resolved_scientific_name,
      NULL,
      n.genus,
      NOW(),
      NOW()
    FROM stg_wcvp_names n
    LEFT JOIN stg_wcvp_names_full nf
      ON nf.plant_name_id = n.plant_name_id
    INNER JOIN taxa f
      ON f.taxon_rank = 'family' AND f.scientific_name = n.family
    LEFT JOIN taxa s
      ON s.taxon_rank = 'species' AND s.scientific_name = COALESCE(
        NULLIF(nf.canonical_scientific_name, ''),
        NULLIF(CONCAT_WS(' ', NULLIF(nf.genus, ''), NULLIF(nf.species, '')), ''),
        n.taxon_name
      )
    WHERE LOWER(n.taxon_rank) = 'species'
      AND LOWER(n.taxon_status) = 'accepted'
      AND COALESCE(
        NULLIF(nf.canonical_scientific_name, ''),
        NULLIF(CONCAT_WS(' ', NULLIF(nf.genus, ''), NULLIF(nf.species, '')), ''),
        n.taxon_name
      ) IS NOT NULL
      AND COALESCE(
        NULLIF(nf.canonical_scientific_name, ''),
        NULLIF(CONCAT_WS(' ', NULLIF(nf.genus, ''), NULLIF(nf.species, '')), ''),
        n.taxon_name
      ) <> ''
      AND s.id IS NULL
  `);

  await connection.query(`
    INSERT INTO plants (taxon_id, chinese_name, scientific_name, cover_image, short_desc, created_at)
    SELECT
      s.id,
      s.scientific_name,
      s.scientific_name,
      NULL,
      CONCAT('Imported from WCVP: ', COALESCE(f.scientific_name, 'unknown family')),
      NOW()
    FROM taxa s
    LEFT JOIN taxa f ON f.id = s.parent_id
    LEFT JOIN plants p ON p.scientific_name = s.scientific_name
    WHERE s.taxon_rank = 'species'
      AND p.id IS NULL
  `);
}

async function upsertRegionsAndDistributions(connection) {
  await connection.query(`
    INSERT INTO wgsrpd_regions (
      area_code_l1, area_name_l1, area_code_l2, area_name_l2, area_code_l3, area_name_l3, continent
    )
    SELECT DISTINCT
      d.continent_code_l1,
      d.continent,
      d.region_code_l2,
      d.region_name_l2,
      d.area_code_l3,
      d.area_name_l3,
      d.continent
    FROM stg_wcvp_distribution d
    WHERE d.area_code_l3 IS NOT NULL AND d.area_code_l3 <> ''
    ON DUPLICATE KEY UPDATE
      area_code_l1 = VALUES(area_code_l1),
      area_name_l1 = VALUES(area_name_l1),
      area_code_l2 = VALUES(area_code_l2),
      area_name_l2 = VALUES(area_name_l2),
      area_name_l3 = VALUES(area_name_l3),
      continent = VALUES(continent)
  `);

  const [rangeRows] = await connection.query(
    'SELECT MIN(plant_locality_id) AS min_id, MAX(plant_locality_id) AS max_id FROM stg_wcvp_distribution'
  );

  const minId = Number(rangeRows[0]?.min_id || 0);
  const maxId = Number(rangeRows[0]?.max_id || 0);
  if (!minId || !maxId) return;

  const RANGE_SIZE = 200000;
  let start = minId;

  while (start <= maxId) {
    const end = Math.min(start + RANGE_SIZE - 1, maxId);

    await connection.query(
      `
      INSERT INTO plant_distributions (
        plant_id, taxon_id, wcvp_plant_name_id, scientific_name,
        area_code_l1, area_code_l2, area_code_l3,
        area_name, continent, country_code,
        occurrence_status, introduced, extinct, data_source
      )
      SELECT
        p.id,
        p.taxon_id,
        d.plant_name_id,
        p.scientific_name,
        d.continent_code_l1,
        d.region_code_l2,
        d.area_code_l3,
        d.area_name_l3,
        d.continent,
        NULL,
        CASE
          WHEN d.location_doubtful = 1 THEN 'doubtful'
          WHEN d.extinct = 1 THEN 'extinct'
          WHEN d.introduced = 1 THEN 'introduced'
          ELSE 'native'
        END AS occurrence_status,
        d.introduced,
        d.extinct,
        'WCVP'
      FROM stg_wcvp_distribution d
      INNER JOIN stg_wcvp_names n ON n.plant_name_id = d.plant_name_id
      LEFT JOIN stg_wcvp_names na ON na.plant_name_id = n.accepted_plant_name_id
      INNER JOIN plants p
        ON p.scientific_name = (
          CASE
            WHEN LOWER(n.taxon_status) = 'accepted' THEN n.taxon_name
            ELSE COALESCE(na.taxon_name, n.taxon_name)
          END
        )
      WHERE d.plant_locality_id BETWEEN ? AND ?
        AND d.area_code_l3 IS NOT NULL AND d.area_code_l3 <> ''
      ON DUPLICATE KEY UPDATE
        area_name = VALUES(area_name),
        continent = VALUES(continent),
        introduced = VALUES(introduced),
        extinct = VALUES(extinct),
        occurrence_status = VALUES(occurrence_status)
      `,
      [start, end]
    );

    console.log(`   分布批次导入完成: ${start} - ${end}`);
    start = end + 1;
  }
}

async function printSummary(connection) {
  const [stats] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM stg_wcvp_names) AS names_rows,
      (SELECT COUNT(*) FROM stg_wcvp_distribution) AS distribution_rows,
      (SELECT COUNT(*) FROM taxa WHERE taxon_rank='family') AS family_taxa,
      (SELECT COUNT(*) FROM taxa WHERE taxon_rank='species') AS species_taxa,
      (SELECT COUNT(*) FROM plants) AS plants_rows,
      (SELECT COUNT(*) FROM plant_distributions) AS imported_distributions,
      (SELECT COUNT(DISTINCT area_code_l3) FROM plant_distributions) AS area_count
  `);

  console.log('导入汇总:');
  console.table(stats);
}

async function importWcvp() {
  if (!fs.existsSync(NAMES_FILE) || !fs.existsSync(DIST_FILE)) {
    throw new Error(`WCVP 文件不存在，请确认路径: ${WCVP_DIR}`);
  }

  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log(`目标数据库: ${dbConfig.database}`);
    console.log('1/6 创建数据表...');
    await ensureTables(connection);

    console.log('2/6 清空 staging 表...');
    await truncateStaging(connection);

    console.log('3/6 加载 WCVP 原始文件到 staging...');
    await loadStagingFromFiles(connection);

    console.log('4/6 依据 wcvp_names 全量补齐 taxa/plants...');
    await upsertTaxaAndPlants(connection);

    console.log('5/6 依据 wcvp_distribution 全量写入区域与分布...');
    await upsertRegionsAndDistributions(connection);

    console.log('6/6 输出汇总...');
    await printSummary(connection);
  } finally {
    await connection.end();
  }
}

importWcvp().catch((err) => {
  console.error('WCVP 全量导入失败:', err.message);
  if (err && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
