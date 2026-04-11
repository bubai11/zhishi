const fs = require('fs');
const path = require('path');

// 确保脚本在正确的目录中运行
const scriptDir = path.dirname(path.resolve(__filename));
const backendDir = path.join(scriptDir, '..');
const dataDir = path.join(backendDir, 'data');

const genusMapping = require(path.join(backendDir, 'data', 'genus_mapping'));

const REVIEW_HYBRID_CSV = path.join(dataDir, 'cn-review-hybrid.csv');

function normalizeSpace(str = '') {
  return String(str || '').replace(/\s+/g, ' ').trim();
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

function generateInitialChineseName(scientificName, genusChineseName) {
  // Parse scientific name to extract species epithet
  const match = scientificName.match(/^([A-Z][a-z]+)\s*[×x]\s*([a-z]+)/i);
  if (!match) {
    return null;
  }

  const genus = match[1];
  const epithet = match[2];

  // Start with genus Chinese name
  let chineseName = genusChineseName || genus;

  // Add hybrid marker
  chineseName += '杂交种';

  // Add epithet information (if it looks like a geographic or characteristic name)
  const geographicPatterns = [
    /chin|sino|sinensis|huanan|guizhou|yunnan|fujian|jiangxi|tibetica|sichuanensis|formosa|nobilis|tibetan|chinensis|jap|nippon/i
  ];

  if (geographicPatterns.some((p) => p.test(epithet))) {
     chineseName += '(' + epithet.slice(0, 10) + ')';
  }

  return chineseName;
}

async function initializeHybridChineseNames() {
  console.log('Reading hybrid review CSV...');
  const csvData = readCsv(REVIEW_HYBRID_CSV);
  const objects = rowsToObjects(csvData.header, csvData.rows);

  console.log(`Found ${objects.length} hybrid species to initialize\n`);

  let initialized = 0;
  let skipped = 0;

  for (let i = 0; i < objects.length; i += 1) {
    const row = objects[i];
    const scientificName = normalizeSpace(row.scientific_name);
    const genus = normalizeSpace(row.genus);

    if (!scientificName || !genus) {
      skipped += 1;
      continue;
    }

    // Skip if already has Chinese name and review status
    if (
      normalizeSpace(row.chinese_name) &&
      normalizeSpace(row.review_status).toUpperCase() === 'APPROVED'
    ) {
      skipped += 1;
      continue;
    }

    // Get genus Chinese name from mapping
    const genusMapping_entry = genusMapping[genus] || null;
    const genusChineseName = genusMapping_entry ? genusMapping_entry.chinese_name : null;

    // Generate initial Chinese name
    const initialChineseName = generateInitialChineseName(scientificName, genusChineseName);

    if (initialChineseName) {
      row.chinese_name = initialChineseName;
      row.review_status = 'APPROVED';
      row.review_note = 'AUTO_RULE_INIT';
      row.reviewer = 'AUTO-INIT';
      row.apply_to_pending = 'Y';

      console.log(`[${i + 1}/${objects.length}] ${scientificName} => ${initialChineseName}`);
      initialized += 1;
    } else {
      console.log(`[${i + 1}/${objects.length}] ${scientificName} => SKIP (cannot generate)`);
      skipped += 1;
    }
  }

  // Write updated CSV
  console.log('\nWriting updated CSV...');
  writeCsv(REVIEW_HYBRID_CSV, csvData.header, objects);

  console.log(`\n=== Initialization Summary ===`);
  console.log(`Initialized with placeholder names: ${initialized}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${objects.length}`);
  console.log(
    `\nNext steps:\n1. Review the generated Chinese names in ${path.relative(process.cwd(), REVIEW_HYBRID_CSV)}\n2. Correct any inaccurate names\n3. Set review_status=APPROVED and apply_to_pending=Y for rows to import\n4. Run: node scripts/high-priority-manual-pipeline.js merge`
  );

  return { initialized, skipped };
}

async function main() {
  try {
    console.log('Starting hybrid Chinese name initialization...\n');
    await initializeHybridChineseNames();
    console.log('\n✓ Initialization complete.');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { initializeHybridChineseNames };
