/**
 * 精简版 WCVP 导入脚本
 * 按照 ddd.txt 的映射规则：
 * 1. wcvp_names.csv → taxa 表（科、属、种级）
 * 2. wcvp_distributions.csv → plant_distributions 表
 * 3. 通过 GBIF 映射中文名称
 * 
 * 数据流：
 * WCVP CSV → stg_wcvp_* staging → taxa/plants/plant_distributions
 */

const axios = require('axios');
const mysql = require('mysql2/promise');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
const sequelizeConfig = require('../config/config').development;
const { getWcvpNamesFile, getWcvpDistributionFile } = require('./lib/wcvpPaths');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: sequelizeConfig.database
};

const NAMES_FILE = getWcvpNamesFile();
const DIST_FILE = getWcvpDistributionFile();
const BATCH_SIZE = 10000;
const DIST_CHUNK_SIZE = 200000;

async function ensureTables(connection) {
  console.log('1/4 Creating staging tables...');
  
  // stg_wcvp_names - 精简版，只保留关键字段
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
  `);

  // stg_wcvp_distribution
  await connection.query(`
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
  `);
}

async function clearStagingTables(connection) {
  console.log('2/4 Clearing staging tables...');
  
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

async function loadNamesFromCSV(connection) {
  console.log('3/4 Loading WCVP names from CSV...');
  
  // 先检查文件是否存在
  const files = [NAMES_FILE];

  let actualPath = null;
  for (const f of files) {
    const fullPath = path.resolve(__dirname, f);
    if (fs.existsSync(fullPath)) {
      actualPath = fullPath;
      break;
    }
  }

  if (!actualPath || !fs.existsSync(actualPath)) {
    console.error(`Checked paths:`, files.map(f => path.resolve(__dirname, f)));
    throw new Error(`WCVP names file not found`);
  }

  console.log(`Using file: ${actualPath}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(actualPath),
    crlfDelay: Infinity
  });

  let lineNo = 0;
  let rows = [];
  
  for await (const line of rl) {
    lineNo += 1;
    if (lineNo === 1 || !line.trim()) continue;

    const c = line.split('|');
    // 按照修正后的列索引（修复作者名混淆）
    rows.push([
      c[0] || null,      // plant_name_id
      c[21] || null,     // taxon_name（修正索引）
      c[2] || null,      // taxon_rank
      c[4] || null,      // family
      c[6] || null,      // genus
      c[23] || null,     // accepted_plant_name_id（修正索引）
      c[3] || null       // taxon_status
    ]);

    if (rows.length >= BATCH_SIZE) {
      await bulkInsert(
        connection,
        'stg_wcvp_names',
        ['plant_name_id', 'taxon_name', 'taxon_rank', 'family', 'genus', 'accepted_plant_name_id', 'taxon_status'],
        rows
      );
      console.log(`  Loaded ${lineNo} names...`);
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

  console.log(`Total names loaded: ${lineNo - 1}`);
}

async function loadDistributionFromCSV(connection) {
  console.log('4/4 Loading WCVP distributions from CSV...');
  
  // 先检查文件是否存在
  const files = [DIST_FILE];

  let actualPath = null;
  for (const f of files) {
    const fullPath = path.resolve(__dirname, f);
    if (fs.existsSync(fullPath)) {
      actualPath = fullPath;
      break;
    }
  }

  if (!actualPath || !fs.existsSync(actualPath)) {
    console.error(`Checked paths:`, files.map(f => path.resolve(__dirname, f)));
    throw new Error(`WCVP distribution file not found`);
  }

  console.log(`Using file: ${actualPath}`);

  const rl = readline.createInterface({
    input: fs.createReadStream(actualPath),
    crlfDelay: Infinity
  });

  let lineNo = 0;
  let rows = [];
  
  for await (const line of rl) {
    lineNo += 1;
    if (lineNo === 1 || !line.trim()) continue;

    const c = line.split('|');
    rows.push([
      c[0] || null,      // plant_locality_id
      c[1] || null,      // plant_name_id
      c[2] || null,      // continent_code_l1
      c[3] || null,      // continent
      c[4] || null,      // region_code_l2
      c[5] || null,      // region_name_l2
      c[6] || null,      // area_code_l3
      c[7] || null,      // area_name_l3
      c[8] || 0,         // introduced
      c[9] || 0,         // extinct
      c[10] || 0         // location_doubtful
    ]);

    if (rows.length >= BATCH_SIZE) {
      await bulkInsert(
        connection,
        'stg_wcvp_distribution',
        ['plant_locality_id', 'plant_name_id', 'continent_code_l1', 'continent', 'region_code_l2', 'region_name_l2', 'area_code_l3', 'area_name_l3', 'introduced', 'extinct', 'location_doubtful'],
        rows
      );
      console.log(`  Loaded ${lineNo} distributions...`);
      rows = [];
    }
  }

  if (rows.length) {
    await bulkInsert(
      connection,
      'stg_wcvp_distribution',
      ['plant_locality_id', 'plant_name_id', 'continent_code_l1', 'continent', 'region_code_l2', 'region_name_l2', 'area_code_l3', 'area_name_l3', 'introduced', 'extinct', 'location_doubtful'],
      rows
    );
  }

  console.log(`Total distributions loaded: ${lineNo - 1}`);
}

async function buildTaxaAndPlants(connection) {
  console.log('Building taxa and plants from staging...');

  // 1. 插入科级
  const [res1] = await connection.query(`
    INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
    SELECT DISTINCT 'family', NULL, n.family, NOW(), NOW()
    FROM stg_wcvp_names n
    WHERE LOWER(n.taxon_rank) = 'species'
      AND LOWER(n.taxon_status) = 'accepted'
      AND n.family IS NOT NULL AND n.family <> ''
  `);
  console.log(`  ✓ Families inserted: ${res1.affectedRows}`);

  // 2. 插入属级
  const [res2] = await connection.query(`
    INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
    SELECT DISTINCT 'genus', f.id, n.genus, NOW(), NOW()
    FROM stg_wcvp_names n
    INNER JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = n.family
    WHERE LOWER(n.taxon_rank) = 'species'
      AND LOWER(n.taxon_status) = 'accepted'
      AND n.genus IS NOT NULL AND n.genus <> ''
  `);
  console.log(`  ✓ Genera inserted: ${res2.affectedRows}`);

  // 3. 插入种级（重要：使用规范学名）
  const [res3] = await connection.query(`
    INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
    SELECT DISTINCT 'species', g.id, n.taxon_name, NOW(), NOW()
    FROM stg_wcvp_names n
    INNER JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = n.family
    INNER JOIN taxa g ON g.taxon_rank = 'genus' AND g.scientific_name = n.genus AND g.parent_id = f.id
    WHERE LOWER(n.taxon_rank) = 'species'
      AND LOWER(n.taxon_status) = 'accepted'
      AND n.taxon_name IS NOT NULL AND n.taxon_name <> ''
  `);
  console.log(`  ✓ Species inserted: ${res3.affectedRows}`);

  // 4. 插入植物记录 - FIX: 修复查询逻辑
  const [res4] = await connection.query(`
    INSERT INTO plants (
      taxon_id, chinese_name, scientific_name, 
      wcvp_plant_name_id, wcvp_taxon_rank, wcvp_taxon_status, 
      wcvp_family, wcvp_genus, created_at, updated_at
    )
    SELECT DISTINCT
      s.id AS taxon_id,
      n.taxon_name AS chinese_name,  -- 将被中文映射脚本后续覆盖
      n.taxon_name AS scientific_name,
      n.plant_name_id,
      n.taxon_rank,
      n.taxon_status,
      n.family,
      n.genus,
      NOW(),
      NOW()
    FROM stg_wcvp_names n
    INNER JOIN taxa s ON s.taxon_rank = 'species' 
      AND s.scientific_name = n.taxon_name
      AND LOWER(n.taxon_rank) = 'species'
      AND LOWER(n.taxon_status) = 'accepted'
    WHERE n.taxon_name IS NOT NULL AND n.taxon_name <> ''
    GROUP BY n.plant_name_id
    ON DUPLICATE KEY UPDATE updated_at = NOW()
  `);
  console.log(`  ✓ Plants inserted: ${res4.affectedRows}`);
}

async function buildDistributions(connection) {
  console.log('Building plant_distributions from staging...');

  // 先插入区域
  await connection.query(`
    INSERT IGNORE INTO wgsrpd_regions (
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
  `);
  console.log('  ✓ Regions inserted');

  // 再插入分布数据
  const [rangeRows] = await connection.query(
    'SELECT MIN(plant_locality_id) AS min_id, MAX(plant_locality_id) AS max_id FROM stg_wcvp_distribution WHERE area_code_l3 IS NOT NULL'
  );

  const minId = Number(rangeRows[0]?.min_id || 0);
  const maxId = Number(rangeRows[0]?.max_id || 0);

  if (minId && maxId) {
    let start = minId;
    while (start <= maxId) {
      const end = Math.min(start + DIST_CHUNK_SIZE - 1, maxId);

      await connection.query(`
        INSERT INTO plant_distributions (
          plant_id, taxon_id, wcvp_plant_name_id, scientific_name,
          area_code_l1, area_code_l2, area_code_l3, area_name,
          continent, occurrence_status, introduced, extinct, data_source
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
          CASE 
            WHEN d.location_doubtful = 1 THEN 'doubtful'
            WHEN d.extinct = 1 THEN 'extinct'
            WHEN d.introduced = 1 THEN 'introduced'
            ELSE 'native'
          END,
          d.introduced,
          d.extinct,
          'WCVP'
        FROM stg_wcvp_distribution d
        INNER JOIN stg_wcvp_names n ON n.plant_name_id = d.plant_name_id
        INNER JOIN plants p ON p.scientific_name = n.taxon_name
        WHERE d.plant_locality_id BETWEEN ? AND ?
          AND d.area_code_l3 IS NOT NULL AND d.area_code_l3 <> ''
        ON DUPLICATE KEY UPDATE area_name = VALUES(area_name)
      `, [start, end]);

      console.log(`  ✓ Distributions loaded: ${start} - ${end}`);
      start = end + 1;
    }
  }
}

async function bulkInsert(connection, table, columns, rows) {
  if (!rows.length) return;
  const rowPlaceholder = `(${columns.map(() => '?').join(',')})`;
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${rows.map(() => rowPlaceholder).join(',')}`;
  await connection.query(sql, rows.flat());
}

async function printSummary(connection) {
  const [stats] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM stg_wcvp_names) AS names_rows,
      (SELECT COUNT(*) FROM stg_wcvp_distribution) AS distribution_rows,
      (SELECT COUNT(*) FROM taxa WHERE taxon_rank='family') AS family_taxa,
      (SELECT COUNT(*) FROM taxa WHERE taxon_rank='genus') AS genus_taxa,
      (SELECT COUNT(*) FROM taxa WHERE taxon_rank='species') AS species_taxa,
      (SELECT COUNT(*) FROM plants) AS plants_rows,
      (SELECT COUNT(*) FROM plant_distributions) AS distributed_rows
  `);

  console.log('\n=== Import Summary ===');
  console.table(stats[0]);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    await ensureTables(connection);
    await clearStagingTables(connection);
    await loadNamesFromCSV(connection);
    await loadDistributionFromCSV(connection);
    await buildTaxaAndPlants(connection);
    await buildDistributions(connection);
    await printSummary(connection);

    console.log('\n✓ Import completed successfully!');
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  });
}

module.exports = { main };
