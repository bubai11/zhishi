const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const ROOT = path.resolve(__dirname, '..', '..');
const WDPA_FILE = path.join(
  ROOT,
  'data-source',
  'WDPA_WDOECM_Mar2026_Public_all_csv',
  'WDPA_WDOECM_Mar2026_Public_all_csv.csv'
);
const BATCH_SIZE = 2000;

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

function toNull(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text === 'Not Applicable' || text === 'Not Reported') return null;
  return text;
}

function toNumber(value) {
  const text = toNull(value);
  if (text == null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

async function ensureTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS protected_areas (
      site_id BIGINT PRIMARY KEY,
      site_pid BIGINT,
      source_type VARCHAR(20),
      site_type VARCHAR(20),
      name_eng VARCHAR(255),
      name_local VARCHAR(255),
      designation VARCHAR(255),
      designation_eng VARCHAR(255),
      designation_type VARCHAR(50),
      iucn_category VARCHAR(20),
      international_criteria VARCHAR(255),
      realm VARCHAR(50),
      rep_m_area DECIMAL(16, 6) NULL,
      gis_m_area DECIMAL(16, 6) NULL,
      rep_area DECIMAL(16, 6) NULL,
      gis_area DECIMAL(16, 6) NULL,
      no_take VARCHAR(50),
      no_take_area DECIMAL(16, 6) NULL,
      status VARCHAR(50),
      status_year INT NULL,
      governance_type VARCHAR(255),
      governance_subtype VARCHAR(255),
      ownership_type VARCHAR(255),
      ownership_subtype VARCHAR(255),
      management_authority VARCHAR(255),
      management_plan TEXT,
      verification_status VARCHAR(100),
      metadata_id BIGINT NULL,
      parent_iso3 VARCHAR(50),
      iso3 VARCHAR(50),
      supplemental_info TEXT,
      conservation_objective TEXT,
      inland_waters VARCHAR(100),
      oecm_assessment VARCHAR(100),
      data_source VARCHAR(100) DEFAULT 'WDPA_WDOECM_Mar2026_Public_all_csv',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_protected_areas_iso3 (iso3),
      INDEX idx_protected_areas_iucn_category (iucn_category),
      INDEX idx_protected_areas_realm (realm),
      INDEX idx_protected_areas_status (status),
      INDEX idx_protected_areas_site_type (site_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query(`
    ALTER TABLE protected_areas
    MODIFY COLUMN parent_iso3 VARCHAR(50),
    MODIFY COLUMN iso3 VARCHAR(50)
  `);
}

async function bulkInsert(connection, rows) {
  if (!rows.length) return;

  const columns = [
    'site_id',
    'site_pid',
    'source_type',
    'site_type',
    'name_eng',
    'name_local',
    'designation',
    'designation_eng',
    'designation_type',
    'iucn_category',
    'international_criteria',
    'realm',
    'rep_m_area',
    'gis_m_area',
    'rep_area',
    'gis_area',
    'no_take',
    'no_take_area',
    'status',
    'status_year',
    'governance_type',
    'governance_subtype',
    'ownership_type',
    'ownership_subtype',
    'management_authority',
    'management_plan',
    'verification_status',
    'metadata_id',
    'parent_iso3',
    'iso3',
    'supplemental_info',
    'conservation_objective',
    'inland_waters',
    'oecm_assessment',
    'data_source',
    'created_at',
    'updated_at'
  ];

  const rowPlaceholder = `(${columns.map(() => '?').join(',')})`;
  const sql = `
    INSERT INTO protected_areas (${columns.join(', ')})
    VALUES ${rows.map(() => rowPlaceholder).join(', ')}
    ON DUPLICATE KEY UPDATE
      site_pid = VALUES(site_pid),
      source_type = VALUES(source_type),
      site_type = VALUES(site_type),
      name_eng = VALUES(name_eng),
      name_local = VALUES(name_local),
      designation = VALUES(designation),
      designation_eng = VALUES(designation_eng),
      designation_type = VALUES(designation_type),
      iucn_category = VALUES(iucn_category),
      international_criteria = VALUES(international_criteria),
      realm = VALUES(realm),
      rep_m_area = VALUES(rep_m_area),
      gis_m_area = VALUES(gis_m_area),
      rep_area = VALUES(rep_area),
      gis_area = VALUES(gis_area),
      no_take = VALUES(no_take),
      no_take_area = VALUES(no_take_area),
      status = VALUES(status),
      status_year = VALUES(status_year),
      governance_type = VALUES(governance_type),
      governance_subtype = VALUES(governance_subtype),
      ownership_type = VALUES(ownership_type),
      ownership_subtype = VALUES(ownership_subtype),
      management_authority = VALUES(management_authority),
      management_plan = VALUES(management_plan),
      verification_status = VALUES(verification_status),
      metadata_id = VALUES(metadata_id),
      parent_iso3 = VALUES(parent_iso3),
      iso3 = VALUES(iso3),
      supplemental_info = VALUES(supplemental_info),
      conservation_objective = VALUES(conservation_objective),
      inland_waters = VALUES(inland_waters),
      oecm_assessment = VALUES(oecm_assessment),
      data_source = VALUES(data_source),
      updated_at = VALUES(updated_at)
  `;

  await connection.query(sql, rows.flat());
}

async function importWdpa(connection, dryRun) {
  const stream = fs.createReadStream(WDPA_FILE, { encoding: 'utf8' });
  let buffer = '';
  let currentRecord = '';
  let inQuotes = false;
  let isHeader = true;
  let totalRows = 0;
  let skippedRows = 0;
  let batch = [];

  const flushRecord = async (record) => {
    const trimmed = record.replace(/\r?\n$/, '');
    if (!trimmed.trim()) return;

    const cols = parseCsvLine(trimmed);
    if (isHeader) {
      isHeader = false;
      return;
    }

    const siteId = toNumber(cols[1]);
    if (cols.length < 34 || siteId == null) {
      skippedRows += 1;
      return;
    }

    totalRows += 1;

    batch.push([
      siteId,
      toNumber(cols[2]),
      toNull(cols[0]),
      toNull(cols[3]),
      toNull(cols[4]),
      toNull(cols[5]),
      toNull(cols[6]),
      toNull(cols[7]),
      toNull(cols[8]),
      toNull(cols[9]),
      toNull(cols[10]),
      toNull(cols[11]),
      toNumber(cols[12]),
      toNumber(cols[13]),
      toNumber(cols[14]),
      toNumber(cols[15]),
      toNull(cols[16]),
      toNumber(cols[17]),
      toNull(cols[18]),
      toNumber(cols[19]),
      toNull(cols[20]),
      toNull(cols[21]),
      toNull(cols[22]),
      toNull(cols[23]),
      toNull(cols[24]),
      toNull(cols[25]),
      toNull(cols[26]),
      toNumber(cols[27]),
      toNull(cols[28]),
      toNull(cols[29]),
      toNull(cols[30]),
      toNull(cols[31]),
      toNull(cols[32]),
      toNull(cols[33]),
      'WDPA_WDOECM_Mar2026_Public_all_csv',
      new Date(),
      new Date()
    ]);

    if (!dryRun && batch.length >= BATCH_SIZE) {
      await bulkInsert(connection, batch);
      batch = [];
    }
  };

  for await (const chunk of stream) {
    buffer += chunk;
    for (let i = 0; i < buffer.length; i += 1) {
      const ch = buffer[i];
      const next = buffer[i + 1];

      currentRecord += ch;

      if (ch === '"') {
        if (inQuotes && next === '"') {
          currentRecord += next;
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === '\n' && !inQuotes) {
        await flushRecord(currentRecord);
        currentRecord = '';
      }
    }

    buffer = '';
  }

  if (currentRecord.trim()) {
    await flushRecord(currentRecord);
  }

  if (!dryRun && batch.length) {
    await bulkInsert(connection, batch);
  }

  return { totalRows, skippedRows };
}

async function printSummary(connection, stats, dryRun) {
  if (dryRun) {
    console.log(`WDPA dry-run parsed rows: ${stats.totalRows}`);
    console.log(`WDPA dry-run skipped rows: ${stats.skippedRows}`);
    return;
  }

  const [rows] = await connection.query(`
    SELECT
      COUNT(*) AS protected_area_rows,
      COUNT(DISTINCT iso3) AS iso3_count,
      COUNT(DISTINCT iucn_category) AS iucn_category_count,
      SUM(CASE WHEN site_type = 'PA' THEN 1 ELSE 0 END) AS pa_rows,
      SUM(CASE WHEN site_type = 'OECM' THEN 1 ELSE 0 END) AS oecm_rows
    FROM protected_areas
  `);

  console.log(`WDPA parsed rows: ${stats.totalRows}`);
  console.log(`WDPA skipped rows: ${stats.skippedRows}`);
  console.table(rows);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(WDPA_FILE)) {
    throw new Error(`WDPA source file not found: ${WDPA_FILE}`);
  }

  const connection = await mysql.createConnection(dbConfig);
  try {
    console.log(`Target DB: ${dbConfig.database}`);
    console.log(`Mode: ${dryRun ? 'dry-run' : 'import'}`);
    await ensureTable(connection);
    const stats = await importWdpa(connection, dryRun);
    await printSummary(connection, stats, dryRun);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('WDPA import failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  parseCsvLine,
  toNull,
  toNumber
};
