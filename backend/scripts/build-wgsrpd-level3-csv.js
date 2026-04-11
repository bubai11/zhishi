const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const INPUT_FILE = path.join(ROOT, 'data-source', 'wgsrpd-master', '109-488-1-ED', '2nd Edition', 'tblLevel3.txt');
const OUTPUT_FILE = path.join(ROOT, 'data-source', 'wgsrpd-master', 'level3.csv');

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function parseLevel3Text(rawText) {
  const lines = rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error('WGSRPD Level3 source file is empty.');
  }

  return lines.slice(1).map((line, index) => {
    const parts = line.split('*');
    if (parts.length < 6) {
      throw new Error(`Invalid Level3 row at line ${index + 2}: ${line}`);
    }

    const [areaCodeL3, areaNameL3, areaCodeL2, countryCode, ed2Status, ...noteParts] = parts;
    return {
      area_code_l3: areaCodeL3 || '',
      area_name_l3: areaNameL3 || '',
      area_code_l2: areaCodeL2 || '',
      country_code: countryCode || '',
      ed2_status: ed2Status || '',
      notes: noteParts.join('*') || ''
    };
  });
}

function buildLevel3Csv(rows) {
  const header = [
    'area_code_l3',
    'area_name_l3',
    'area_code_l2',
    'country_code',
    'ed2_status',
    'notes'
  ];

  const body = rows.map((row) => [
    row.area_code_l3,
    row.area_name_l3,
    row.area_code_l2,
    row.country_code,
    row.ed2_status,
    row.notes
  ].map(csvEscape).join(','));

  return `${header.join(',')}\n${body.join('\n')}\n`;
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(`WGSRPD Level3 source file not found: ${INPUT_FILE}`);
  }

  const rawText = fs.readFileSync(INPUT_FILE, 'utf8');
  const rows = parseLevel3Text(rawText);
  const csvText = buildLevel3Csv(rows);

  fs.writeFileSync(OUTPUT_FILE, csvText, 'utf8');

  console.log(`WGSRPD Level3 CSV generated: ${OUTPUT_FILE}`);
  console.log(`Rows written: ${rows.length}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Failed to build WGSRPD Level3 CSV:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  INPUT_FILE,
  OUTPUT_FILE,
  parseLevel3Text,
  buildLevel3Csv
};
