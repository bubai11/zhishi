const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_CSV = path.join(DATA_DIR, 'human-review-queue.csv');
const PENDING_CSV = path.join(DATA_DIR, 'cn-pending-template.csv');
const SQL_FILE = path.join(__dirname, '..', 'sql', 'extract-human-review-queue.sql');

const args = process.argv.slice(2);
let limit = 40;

for (const arg of args) {
  if (arg.startsWith('--limit=')) limit = Number(arg.split('=')[1]) || limit;
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === ',' && !inQuote) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toCsvLine(cols) {
  return cols
    .map((value) => {
      const str = String(value ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(',');
}

function normalizeSpace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function loadReviewHighMap() {
  if (!fs.existsSync(PENDING_CSV)) {
    return new Map();
  }

  const text = fs.readFileSync(PENDING_CSV, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) {
    return new Map();
  }

  const header = parseCsvLine(lines[0]);
  const sciIdx = header.indexOf('scientific_name');
  const noteIdx = header.indexOf('note');
  const map = new Map();

  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const scientificName = normalizeSpace(cols[sciIdx]);
    const note = normalizeSpace(cols[noteIdx]);
    if (!scientificName || !/REVIEW_HIGH/i.test(note)) continue;
    map.set(scientificName, note);
  }

  return map;
}

function mergeReason(baseReason, extraReason) {
  const reasons = [baseReason, extraReason]
    .map((item) => normalizeSpace(item))
    .filter(Boolean);

  return reasons.filter((item, idx) => reasons.indexOf(item) === idx).join('; ');
}

async function main() {
  const sql = fs.readFileSync(SQL_FILE, 'utf8').replace(/LIMIT\s+\d+\s*;?\s*$/i, `LIMIT ${limit};`);
  const reviewHighMap = loadReviewHighMap();

  const conn = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await conn.query(sql);
    const deduped = [];
    const seen = new Set();

    for (const row of rows) {
      const scientificName = normalizeSpace(row.scientific_name);
      if (!scientificName || seen.has(scientificName)) continue;
      seen.add(scientificName);

      const reviewHighNote = reviewHighMap.get(scientificName);
      const reviewReason = mergeReason(
        row.review_reason,
        reviewHighNote ? 'existing REVIEW_HIGH flag from cn-pending-template.csv' : ''
      );

      deduped.push({
        scientific_name: scientificName,
        family: normalizeSpace(row.family),
        genus: normalizeSpace(row.genus),
        review_reason: reviewReason,
        chinese_name: '',
        review_status: 'pending',
        reviewer: '',
        reviewed_at: ''
      });
    }

    const lines = [
      toCsvLine([
        'scientific_name',
        'family',
        'genus',
        'review_reason',
        'chinese_name',
        'review_status',
        'reviewer',
        'reviewed_at'
      ]),
      ...deduped.map((row) =>
        toCsvLine([
          row.scientific_name,
          row.family,
          row.genus,
          row.review_reason,
          row.chinese_name,
          row.review_status,
          row.reviewer,
          row.reviewed_at
        ])
      )
    ];

    fs.writeFileSync(OUTPUT_CSV, lines.join('\n'), 'utf8');

    console.log(`Exported human review queue: ${deduped.length} rows`);
    console.log(`CSV: ${OUTPUT_CSV}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`Export human review queue failed: ${err.message}`);
  process.exitCode = 1;
});
