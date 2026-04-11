const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const REVIEW_HYBRID_CSV = path.join(__dirname, '..', 'data', 'cn-review-hybrid.csv');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const ACCEPTED_STATUSES = new Set(['APPROVED', 'CONFIRMED', 'DONE', 'MERGED']);

function normalizeSpace(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasChinese(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ''));
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

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { header: [], rows: [] };
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

function shouldApply(row) {
  const status = normalizeSpace(row.review_status).toUpperCase();
  const applyFlag = normalizeSpace(row.apply_to_pending).toUpperCase();
  return (
    hasChinese(row.chinese_name) &&
    ACCEPTED_STATUSES.has(status) &&
    ['Y', 'YES', 'TRUE', '1'].includes(applyFlag)
  );
}

async function main() {
  const csv = readCsv(REVIEW_HYBRID_CSV);
  const rows = rowsToObjects(csv.header, csv.rows);
  const approved = rows.filter(shouldApply);

  const conn = await mysql.createConnection(dbConfig);
  let plantsUpdated = 0;
  let taxaUpdated = 0;
  let speciesTouched = 0;

  try {
    for (const row of approved) {
      const scientificName = normalizeSpace(row.scientific_name);
      const chineseName = normalizeSpace(row.chinese_name);
      if (!scientificName || !chineseName) continue;

      const [plantResult] = await conn.query(
        `
        UPDATE plants
        SET chinese_name = ?,
            translation_source = 'MANUAL',
            translation_confidence = 100
        WHERE scientific_name = ?
          AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name OR chinese_name NOT REGEXP '[一-龥]')
      `,
        [chineseName, scientificName]
      );

      const [taxaResult] = await conn.query(
        `
        UPDATE taxa
        SET chinese_name = ?
        WHERE scientific_name = ?
          AND taxon_rank = 'species'
          AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name OR chinese_name NOT REGEXP '[一-龥]')
      `,
        [chineseName, scientificName]
      );

      const p = Number(plantResult.affectedRows || 0);
      const t = Number(taxaResult.affectedRows || 0);
      plantsUpdated += p;
      taxaUpdated += t;
      if (p > 0 || t > 0) speciesTouched += 1;
    }
  } finally {
    await conn.end();
  }

  console.log('Direct import completed:');
  console.log(`- source rows approved: ${approved.length}`);
  console.log(`- species touched: ${speciesTouched}`);
  console.log(`- updated plants: ${plantsUpdated}`);
  console.log(`- updated taxa: ${taxaUpdated}`);
}

main().catch((error) => {
  console.error(`Direct import failed: ${error.message}`);
  process.exitCode = 1;
});
