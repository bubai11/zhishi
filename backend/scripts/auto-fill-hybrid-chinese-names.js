const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// 确保脚本在正确的目录中运行
const scriptDir = path.dirname(path.resolve(__filename));
const backendDir = path.join(scriptDir, '..');
const configPath = path.join(backendDir, 'config', 'config');
const dataDir = path.join(backendDir, 'data');

const sequelizeConfig = require(configPath).development;
const chineseNameService = require(path.join(backendDir, 'services', 'chineseNameService'));

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

if (!process.env.CN_ENABLE_REMOTE) {
  process.env.CN_ENABLE_REMOTE = '1';
}

const REVIEW_HYBRID_CSV = path.join(dataDir, 'cn-review-hybrid.csv');

function normalizeSpace(str = '') {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function hasChinese(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ''));
}

function shanghaiDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const obj = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      obj[part.type] = part.value;
    }
  }
  return {
    timestamp: `${obj.year}-${obj.month}-${obj.day} ${obj.hour}:${obj.minute}:${obj.second}`,
    day: `${obj.year}-${obj.month}-${obj.day}`
  };
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

function objectToRow(header, obj) {
  return header.map((key) => {
    const value = obj[key] || '';
    const str = String(value).replace(/"/g, '""');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str}"`;
    }
    return str;
  });
}

function readCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) {
    return { header: [], rows: [] };
  }

  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));
  return { header, rows };
}

function rowsToObjects(header, rows) {
  return rows.map((row) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = row[i] || '';
    }
    return obj;
  });
}

function writeCsv(filePath, header, rows) {
  const lines = [header.join(',')];
  for (const row of rows) {
    const formatted = objectToRow(header, row);
    lines.push(formatted.join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

async function fillHybridChineseNames() {
  console.log('Reading hybrid review CSV...');
  const csvData = readCsv(REVIEW_HYBRID_CSV);
  const objects = rowsToObjects(csvData.header, csvData.rows);

  console.log(`Found ${objects.length} hybrid species to process`);

  const conn = await mysql.createConnection(dbConfig);
  let successful = 0;
  let failed = 0;
  let skipped = 0;

  try {
    for (let i = 0; i < objects.length; i += 1) {
      const row = objects[i];
      const scientificName = normalizeSpace(row.scientific_name);

      if (!scientificName) {
        skipped += 1;
        continue;
      }

      // Skip if already has approved Chinese name
      if (hasChinese(row.chinese_name) && normalizeSpace(row.review_status).toUpperCase() === 'APPROVED') {
        skipped += 1;
        continue;
      }

      try {
        console.log(`[${i + 1}/${objects.length}] Querying: ${scientificName}`);
        const result = await chineseNameService.getChineseName(scientificName, conn);

        if (result && result.chineseName && hasChinese(result.chineseName)) {
          row.chinese_name = result.chineseName;
          row.review_status = result.source === 'none' ? 'PENDING_REVIEW' : 'APPROVED';
          row.apply_to_pending = result.source === 'none' ? '' : 'Y';
          row.reviewer = 'AUTO';
          row.reviewed_at = shanghaiDateParts().timestamp;
          row.review_note = `AUTO:${result.source}:${result.confidence}`;

          console.log(`  ✓ Found: ${result.chineseName} (source: ${result.source})`);
          successful += 1;
        } else {
          console.log(`  ✗ No Chinese name found`);
          failed += 1;
        }
      } catch (error) {
        console.log(`  ✗ Error: ${error.message}`);
        failed += 1;
      }

      // Rate limiting
      if (i < objects.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  } finally {
    await conn.end();
  }

  // Write updated CSV
  console.log('\nWriting updated CSV...');
  writeCsv(REVIEW_HYBRID_CSV, csvData.header, objects);

  console.log(`\n=== Auto-fill Summary ===`);
  console.log(`Successfully filled: ${successful}`);
  console.log(`Failed or not found: ${failed}`);
  console.log(`Skipped (already approved): ${skipped}`);
  console.log(`Total: ${objects.length}`);

  return { successful, failed, skipped };
}

async function main() {
  try {
    console.log('Starting auto-fill hybrid Chinese names process...\n');
    await fillHybridChineseNames();
    console.log('\n✓ Auto-fill complete. Ready to merge and import.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { fillHybridChineseNames };
