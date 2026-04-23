const fs = require('fs');
const path = require('path');
const { sequelize, WgsrpdRegionCountryMap } = require('../models');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'wgsrpd-region-country-map.json');

function parseArgs(argv) {
  const args = {};
  argv.forEach((item) => {
    if (!item.startsWith('--')) return;
    const [key, ...rest] = item.slice(2).split('=');
    args[key] = rest.length > 0 ? rest.join('=') : true;
  });
  return args;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] === '' ? null : cells[index];
      return row;
    }, {});
  });
}

function readRows(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.rows || parsed.data || [];
  }

  if (ext === '.csv') {
    return parseCsv(content);
  }

  throw new Error('Only JSON and CSV files are supported');
}

function normalizeRow(row) {
  const areaCode = String(row.area_code_l3 || row.areaCode || '').trim().toUpperCase();
  const iso3 = String(row.iso3 || row.country_code || '').trim().toUpperCase();
  if (!areaCode || !iso3 || iso3.length !== 3) return null;

  return {
    area_code_l3: areaCode,
    area_name: row.area_name || row.region || null,
    iso3,
    country_name: row.country_name || null,
    mapping_source: row.mapping_source || 'WGSRPD_ISO3_MANUAL_MAP',
    updated_at: new Date()
  };
}

async function ensureTable() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS wgsrpd_region_country_map (
      area_code_l3 VARCHAR(10) NOT NULL,
      area_name VARCHAR(100) NULL,
      iso3 CHAR(3) NOT NULL,
      country_name VARCHAR(100) NULL,
      mapping_source VARCHAR(100) DEFAULT 'WGSRPD_ISO3_MANUAL_MAP',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (area_code_l3, iso3),
      INDEX idx_wgsrpd_region_country_map_iso3 (iso3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(process.cwd(), args.file ? String(args.file) : DEFAULT_FILE);
  const dryRun = Boolean(args['dry-run']);
  const rows = readRows(filePath);
  const validRows = rows.map(normalizeRow).filter(Boolean);

  console.log(`File: ${filePath}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Valid mappings: ${validRows.length}`);

  if (dryRun) {
    console.log('Dry run enabled. No database writes were performed.');
    return;
  }

  await ensureTable();
  let imported = 0;
  await sequelize.transaction(async (transaction) => {
    for (const row of validRows) {
      await WgsrpdRegionCountryMap.upsert(row, { transaction });
      imported += 1;
    }
  });

  console.log(`Imported mappings: ${imported}`);
}

main()
  .catch((error) => {
    console.error('Import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
