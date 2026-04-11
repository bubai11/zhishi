const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const DATA_DIR = path.join(__dirname, '..', 'data');
const PENDING_CSV = path.join(DATA_DIR, 'cn-pending-template.csv');
const REVIEW_HIGH_CSV = path.join(DATA_DIR, 'cn-review-high.csv');
const REVIEW_HYBRID_CSV = path.join(DATA_DIR, 'cn-review-hybrid.csv');
const REPORT_DIR = path.join(__dirname, '..');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const HIGH_PRIORITY_PATTERNS = [
  /chinensis/i,
  /japonica/i,
  /officinalis/i,
  /sinensis/i,
  /indica/i,
  /formosana?/i,
  /hongkongensis/i,
  /taiwanensis/i,
  /yunnanensis/i
];

const ACCEPTED_STATUSES = new Set(['APPROVED', 'CONFIRMED', 'DONE', 'MERGED']);
const HYBRID_PRIORITY_FAMILIES = new Set([
  'Rubiaceae',
  'Phyllanthaceae',
  'Sapotaceae',
  'Magnoliaceae',
  'Theaceae',
  'Lamiaceae',
  'Rosaceae',
  'Orchidaceae'
]);
const HYBRID_PRIORITY_GENERA = new Set([
  'Isodon',
  'Anoectochilus',
  'Lasianthus',
  'Leptopus',
  'Aporosa',
  'Mycetia',
  'Neanotis',
  'Prunus',
  'Magnolia',
  'Yulania',
  'Camellia',
  'Rhododendron',
  'Ixora'
]);
const HYBRID_NATURAL_DISTRIBUTION_GENERA = new Set([
  'Isodon',
  'Anoectochilus',
  'Lasianthus',
  'Leptopus',
  'Aporosa',
  'Mycetia',
  'Neanotis',
  'Prunus',
  'Magnolia',
  'Yulania',
  'Camellia',
  'Rhododendron',
  'Ixora'
]);

function parseArgs(argv) {
  const options = {
    mode: 'high',
    limit: 40
  };

  for (const arg of argv) {
    if (arg.startsWith('--mode=')) options.mode = arg.split('=')[1] || options.mode;
    if (arg.startsWith('--limit=')) options.limit = Number(arg.split('=')[1]) || options.limit;
  }

  return options;
}

function getReviewCsvPath(mode) {
  return mode === 'hybrid' ? REVIEW_HYBRID_CSV : REVIEW_HIGH_CSV;
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

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );

  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    timestamp: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
  };
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

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter((line, idx, arr) => line || idx < arr.length - 1);
  if (!lines.length) {
    return { header: [], rows: [] };
  }

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    rows.push(parseCsvLine(lines[i]));
  }

  return { header, rows };
}

function rowsToObjects(header, rows) {
  return rows.map((cols) => {
    const obj = {};
    header.forEach((name, idx) => {
      obj[name] = cols[idx] ?? '';
    });
    return obj;
  });
}

function objectsToRows(header, objects) {
  return objects.map((obj) => header.map((name) => obj[name] ?? ''));
}

function hasChinese(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ''));
}

function normalizeSpace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function appendTag(note, tag) {
  const cleanNote = normalizeSpace(note);
  if (!cleanNote) return tag;
  if (cleanNote.includes(tag)) return cleanNote;
  return `${cleanNote}; ${tag}`;
}

function classifyReason(row) {
  const note = normalizeSpace(row.note);
  const scientificName = normalizeSpace(row.scientific_name);
  if (/REVIEW_HIGH/i.test(note)) {
    return 'existing REVIEW_HIGH note';
  }
  if (HIGH_PRIORITY_PATTERNS.some((pattern) => pattern.test(scientificName))) {
    return 'high-priority epithet pattern';
  }
  return 'manual carry-over';
}

function reviewHeader() {
  return [
    'scientific_name',
    'family',
    'genus',
    'current_note',
    'review_reason',
    'chinese_name',
    'review_status',
    'review_note',
    'reviewer',
    'reviewed_at',
    'apply_to_pending'
  ];
}

function loadReviewMap(reviewCsvPath) {
  if (!fs.existsSync(reviewCsvPath)) return new Map();

  const { header, rows } = readCsv(reviewCsvPath);
  const reviewObjects = rowsToObjects(header, rows);
  const map = new Map();

  for (const row of reviewObjects) {
    const scientificName = normalizeSpace(row.scientific_name);
    if (!scientificName) continue;
    map.set(scientificName, row);
  }

  return map;
}

function writeCsv(filePath, header, objects) {
  const lines = [toCsvLine(header), ...objectsToRows(header, objects).map(toCsvLine)];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function reportPathForToday() {
  const parts = shanghaiDateParts();
  return path.join(REPORT_DIR, `HIGH_PRIORITY_MANUAL_PIPELINE_${parts.day}.md`);
}

function appendReport(sectionTitle, lines) {
  const reportPath = reportPathForToday();
  const exists = fs.existsSync(reportPath);
  const { timestamp } = shanghaiDateParts();
  const block = [];

  if (!exists) {
    block.push('# High Priority Manual Completion Pipeline');
    block.push('');
    block.push(`Date: ${shanghaiDateParts().day}`);
    block.push('');
    block.push('This file is generated by `backend/scripts/high-priority-manual-pipeline.js`.');
    block.push('');
  }

  block.push(`## ${sectionTitle}`);
  block.push('');
  block.push(`Timestamp: ${timestamp}`);
  block.push('');
  for (const line of lines) {
    block.push(line);
  }
  block.push('');

  fs.appendFileSync(reportPath, block.join('\n'), 'utf8');
  return reportPath;
}

function mergeReason(baseReason, extraReason) {
  const reasons = [baseReason, extraReason].map(normalizeSpace).filter(Boolean);
  return reasons.filter((item, index) => reasons.indexOf(item) === index).join('; ');
}

function loadPendingReviewHighMap() {
  const pendingCsv = readCsv(PENDING_CSV);
  const pendingObjects = rowsToObjects(pendingCsv.header, pendingCsv.rows);
  const map = new Map();

  for (const row of pendingObjects) {
    const scientificName = normalizeSpace(row.scientific_name);
    const note = normalizeSpace(row.note);
    if (!scientificName || !/REVIEW_HIGH/i.test(note)) continue;
    map.set(scientificName, note);
  }

  return map;
}

async function queryHybridCandidates(limit) {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await conn.query(
      `
        WITH candidate_base AS (
          SELECT
            p.id AS plant_id,
            p.scientific_name,
            p.wcvp_family AS family,
            p.wcvp_genus AS genus,
            MAX(CASE WHEN s.provider = 'iplant' AND s.fetch_status = 'missing' THEN s.source_url END) AS source_url,
            CASE
              WHEN LOWER(p.scientific_name) REGEXP ' (chinensis|sinensis|yunnanensis|formosana|tibetica|sichuan[a-z]*|guizhou[a-z]*)$' THEN 100
              ELSE 0
            END AS score_epithet,
            CASE
              WHEN p.wcvp_family IN ('Rubiaceae', 'Phyllanthaceae', 'Sapotaceae', 'Magnoliaceae', 'Theaceae', 'Lamiaceae', 'Rosaceae', 'Orchidaceae')
                OR p.wcvp_genus IN ('Isodon', 'Anoectochilus', 'Lasianthus', 'Leptopus', 'Aporosa', 'Mycetia', 'Neanotis', 'Prunus', 'Magnolia', 'Yulania', 'Camellia', 'Rhododendron', 'Ixora')
              THEN 60
              ELSE 0
            END AS score_family_genus,
            CASE
              WHEN p.wcvp_genus IN ('Isodon', 'Anoectochilus', 'Lasianthus', 'Leptopus', 'Aporosa', 'Mycetia', 'Neanotis', 'Prunus', 'Magnolia', 'Yulania', 'Camellia', 'Rhododendron', 'Ixora')
              THEN 30
              ELSE 0
            END AS score_natural_distribution,
            CASE
              WHEN MAX(CASE WHEN s.provider = 'iplant' AND s.fetch_status = 'missing' THEN 1 ELSE 0 END) = 1
              THEN 25
              ELSE 0
            END AS score_iplant_missing
          FROM plants p
          LEFT JOIN plant_external_sources s
            ON s.plant_id = p.id
          WHERE p.scientific_name IS NOT NULL
            AND p.scientific_name <> ''
            AND p.scientific_name REGEXP ' [xX×] '
            AND (p.chinese_name IS NULL OR p.chinese_name = '' OR p.chinese_name = p.scientific_name OR p.chinese_name NOT REGEXP '[一-龥]')
          GROUP BY p.id, p.scientific_name, p.wcvp_family, p.wcvp_genus
        ),
        scored AS (
          SELECT
            plant_id,
            scientific_name,
            family,
            genus,
            source_url,
            score_epithet,
            score_family_genus,
            score_natural_distribution,
            score_iplant_missing,
            score_epithet + score_family_genus + score_natural_distribution + score_iplant_missing AS priority_score
          FROM candidate_base
        )
        SELECT
          plant_id,
          scientific_name,
          family,
          genus,
          source_url,
          priority_score,
          score_epithet,
          score_family_genus,
          score_natural_distribution,
          score_iplant_missing
        FROM scored
        WHERE priority_score > 0
        ORDER BY priority_score DESC, scientific_name ASC
        LIMIT ?
      `,
      [limit]
    );

    return rows;
  } finally {
    await conn.end();
  }
}

function buildHybridReviewReason(row, reviewHighMap) {
  const reasons = [];

  reasons.push('hybrid marker in scientific name');

  if (Number(row.score_epithet || 0) > 0) {
    reasons.push('china-related epithet');
  }
  if (Number(row.score_family_genus || 0) > 0) {
    reasons.push('family/genus in known China-distribution list');
  }
  if (Number(row.score_natural_distribution || 0) > 0) {
    reasons.push('genus likely has natural distribution in China');
  }
  if (Number(row.score_iplant_missing || 0) > 0) {
    reasons.push('iplant source missing');
  }
  if (reviewHighMap.has(normalizeSpace(row.scientific_name))) {
    reasons.push('existing REVIEW_HIGH flag from cn-pending-template.csv');
  }

  return reasons.join('; ');
}

function buildHybridCurrentNote(scientificName, reviewHighMap, sourceUrl) {
  const parts = [];
  const reviewHigh = reviewHighMap.get(normalizeSpace(scientificName));
  if (reviewHigh) parts.push(reviewHigh);
  if (sourceUrl) parts.push(`iplant_missing=${sourceUrl}`);
  return parts.join('; ');
}

function prepareHighQueue(reviewCsvPath) {
  const pendingCsv = readCsv(PENDING_CSV);
  const pendingObjects = rowsToObjects(pendingCsv.header, pendingCsv.rows);
  const existingReviewMap = loadReviewMap(reviewCsvPath);

  const queue = [];
  const seen = new Set();
  let carriedManual = 0;

  for (const row of pendingObjects) {
    const scientificName = normalizeSpace(row.scientific_name);
    const chineseName = normalizeSpace(row.chinese_name);
    const note = normalizeSpace(row.note);
    const isHigh =
      /REVIEW_HIGH/i.test(note) ||
      HIGH_PRIORITY_PATTERNS.some((pattern) => pattern.test(scientificName));

    if (!scientificName || !isHigh || hasChinese(chineseName) || seen.has(scientificName)) {
      continue;
    }

    const existing = existingReviewMap.get(scientificName) || {};
    if (hasChinese(existing.chinese_name)) {
      carriedManual += 1;
    }

    queue.push({
      scientific_name: scientificName,
      family: normalizeSpace(row.family),
      genus: normalizeSpace(row.genus),
      current_note: note,
      review_reason: normalizeSpace(existing.review_reason) || classifyReason(row),
      chinese_name: normalizeSpace(existing.chinese_name),
      review_status: normalizeSpace(existing.review_status) || '',
      review_note: normalizeSpace(existing.review_note),
      reviewer: normalizeSpace(existing.reviewer),
      reviewed_at: normalizeSpace(existing.reviewed_at),
      apply_to_pending: normalizeSpace(existing.apply_to_pending) || ''
    });
    seen.add(scientificName);
  }

  writeCsv(reviewCsvPath, reviewHeader(), queue);

  const statusCounts = queue.reduce((acc, row) => {
    const key = row.review_status || 'EMPTY';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const reportPath = appendReport('Prepare Queue', [
    '### Summary',
    '',
    `- pending source: \`backend/data/cn-pending-template.csv\``,
    `- review queue: \`${path.relative(path.join(__dirname, '..'), reviewCsvPath).replace(/\\/g, '/')}\``,
    `- queue rows: ${queue.length}`,
    `- carried manual answers from existing review file: ${carriedManual}`,
    '',
    '### Review Status Distribution',
    '',
    ...Object.keys(statusCounts)
      .sort()
      .map((key) => `- ${key}: ${statusCounts[key]}`),
    '',
    '### Next Step',
    '',
    `- Fill \`chinese_name\`, \`review_status\`, \`review_note\`, \`reviewer\`, \`reviewed_at\`, and \`apply_to_pending\` in \`${path.relative(path.join(__dirname, '..'), reviewCsvPath).replace(/\\/g, '/')}\`.`,
    '- Use `review_status=APPROVED` and `apply_to_pending=Y` for rows that should be merged into the pending template.'
  ]);

  return { queueRows: queue.length, carriedManual, reportPath, statusCounts };
}

async function prepareHybridQueue(reviewCsvPath, limit) {
  const rows = await queryHybridCandidates(limit);
  const existingReviewMap = loadReviewMap(reviewCsvPath);
  const reviewHighMap = loadPendingReviewHighMap();
  const queue = [];
  let carriedManual = 0;
  const seen = new Set();

  for (const row of rows) {
    const scientificName = normalizeSpace(row.scientific_name);
    if (!scientificName || seen.has(scientificName)) continue;
    seen.add(scientificName);

    const existing = existingReviewMap.get(scientificName) || {};
    if (hasChinese(existing.chinese_name)) {
      carriedManual += 1;
    }

    queue.push({
      scientific_name: scientificName,
      family: normalizeSpace(row.family),
      genus: normalizeSpace(row.genus),
      current_note: buildHybridCurrentNote(scientificName, reviewHighMap, normalizeSpace(row.source_url)),
      review_reason: normalizeSpace(existing.review_reason) || buildHybridReviewReason(row, reviewHighMap),
      chinese_name: normalizeSpace(existing.chinese_name),
      review_status: normalizeSpace(existing.review_status) || 'pending',
      review_note: normalizeSpace(existing.review_note),
      reviewer: normalizeSpace(existing.reviewer),
      reviewed_at: normalizeSpace(existing.reviewed_at),
      apply_to_pending: normalizeSpace(existing.apply_to_pending) || ''
    });
  }

  writeCsv(reviewCsvPath, reviewHeader(), queue);

  const statusCounts = queue.reduce((acc, row) => {
    const key = row.review_status || 'EMPTY';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const reportPath = appendReport('Prepare Hybrid Queue', [
    '### Summary',
    '',
    `- source table: \`plant_external_sources\``,
    `- pending source: \`backend/data/cn-pending-template.csv\``,
    `- review queue: \`${path.relative(path.join(__dirname, '..'), reviewCsvPath).replace(/\\/g, '/')}\``,
    `- queue rows: ${queue.length}`,
    `- carried manual answers from existing review file: ${carriedManual}`,
    `- limit: ${limit}`,
    '',
    '### Review Status Distribution',
    '',
    ...Object.keys(statusCounts)
      .sort()
      .map((key) => `- ${key}: ${statusCounts[key]}`),
    '',
    '### Next Step',
    '',
    `- Fill \`chinese_name\`, \`review_status\`, \`review_note\`, \`reviewer\`, \`reviewed_at\`, and \`apply_to_pending\` in \`${path.relative(path.join(__dirname, '..'), reviewCsvPath).replace(/\\/g, '/')}\`.`,
    '- Use `review_status=APPROVED` and `apply_to_pending=Y` for rows that should be merged into the pending template.'
  ]);

  return { queueRows: queue.length, carriedManual, reportPath, statusCounts };
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

function mergeQueue(reviewCsvPath) {
  const pendingCsv = readCsv(PENDING_CSV);
  const pendingObjects = rowsToObjects(pendingCsv.header, pendingCsv.rows);

  const reviewCsv = readCsv(reviewCsvPath);
  const reviewObjects = rowsToObjects(reviewCsv.header, reviewCsv.rows);
  const approvedMap = new Map();
  const rejected = [];

  for (const row of reviewObjects) {
    const scientificName = normalizeSpace(row.scientific_name);
    if (!scientificName) continue;

    if (shouldApply(row)) {
      approvedMap.set(scientificName, row);
    } else if (normalizeSpace(row.review_status)) {
      rejected.push({
        scientificName,
        review_status: normalizeSpace(row.review_status)
      });
    }
  }

  let updatedRows = 0;
  let updatedSpecies = 0;
  const touchedSpecies = new Set();

  for (const row of pendingObjects) {
    const scientificName = normalizeSpace(row.scientific_name);
    const approved = approvedMap.get(scientificName);
    if (!approved) continue;

    if (normalizeSpace(row.chinese_name) !== normalizeSpace(approved.chinese_name)) {
      row.chinese_name = normalizeSpace(approved.chinese_name);
    }
    row.source = 'MANUAL';

    const reviewer = normalizeSpace(approved.reviewer);
    const reviewedAt = normalizeSpace(approved.reviewed_at);
    const reviewNote = normalizeSpace(approved.review_note);

    row.note = appendTag(normalizeSpace(row.note), 'MANUAL_REVIEW_HIGH_OK');
    if (reviewer) {
      row.note = appendTag(row.note, `reviewer=${reviewer}`);
    }
    if (reviewedAt) {
      row.note = appendTag(row.note, `reviewed_at=${reviewedAt}`);
    }
    if (reviewNote) {
      row.note = appendTag(row.note, `review_note=${reviewNote}`);
    }

    updatedRows += 1;
    if (!touchedSpecies.has(scientificName)) {
      updatedSpecies += 1;
      touchedSpecies.add(scientificName);
    }
  }

  writeCsv(PENDING_CSV, pendingCsv.header, pendingObjects);

  const reportPath = appendReport('Merge Queue', [
    '### Summary',
    '',
    `- review source: \`${path.relative(path.join(__dirname, '..'), reviewCsvPath).replace(/\\/g, '/')}\``,
    `- pending target: \`backend/data/cn-pending-template.csv\``,
    `- approved species merged: ${updatedSpecies}`,
    `- pending rows updated: ${updatedRows}`,
    `- non-merged reviewed rows: ${rejected.length}`,
    '',
    '### Import Hint',
    '',
    '- After checking the merged pending template, run `npm run cn:import-template` to write approved Chinese names into database preparation tables.',
    '',
    '### Reviewed But Not Merged',
    '',
    ...(rejected.length
      ? rejected.slice(0, 20).map((item) => `- ${item.scientificName}: ${item.review_status}`)
      : ['- none'])
  ]);

  return { updatedSpecies, updatedRows, rejected, reportPath };
}

function printUsage() {
  console.log('Usage: node scripts/high-priority-manual-pipeline.js <prepare|merge> [--mode=high|hybrid] [--limit=30]');
}

async function main() {
  const command = process.argv[2];
  const options = parseArgs(process.argv.slice(3));
  const reviewCsvPath = getReviewCsvPath(options.mode);

  if (!command || ['-h', '--help', 'help'].includes(command)) {
    printUsage();
    return;
  }

  if (command === 'prepare') {
    const result = options.mode === 'hybrid'
      ? await prepareHybridQueue(reviewCsvPath, options.limit)
      : prepareHighQueue(reviewCsvPath);
    console.log(`Prepared ${options.mode} review queue: ${result.queueRows} rows`);
    console.log(`Markdown report: ${result.reportPath}`);
    return;
  }

  if (command === 'merge') {
    const result = mergeQueue(reviewCsvPath);
    console.log(`Merged approved review results: ${result.updatedSpecies} species / ${result.updatedRows} rows`);
    console.log(`Markdown report: ${result.reportPath}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

if (require.main === module) {
  Promise.resolve().then(async () => {
    try {
      await main();
    } catch (error) {
      console.error(`High-priority manual pipeline failed: ${error.message}`);
      process.exitCode = 1;
    }
  });
}

module.exports = {
  HIGH_PRIORITY_PATTERNS,
  ACCEPTED_STATUSES,
  parseCsvLine,
  toCsvLine,
  classifyReason,
  shouldApply
};
