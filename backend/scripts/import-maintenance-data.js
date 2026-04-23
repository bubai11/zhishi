const fs = require('fs');
const path = require('path');
const { sequelize, Plants, ThreatenedSpecies, ProtectedAreas, WgsrpdRegionCountryMap } = require('../models');

const TARGETS = {
  plants: { model: Plants, key: 'id' },
  threatened_species: { model: ThreatenedSpecies, key: 'scientific_name' },
  protected_areas: { model: ProtectedAreas, key: 'site_id' },
  wgsrpd_region_country_map: { model: WgsrpdRegionCountryMap, key: 'area_code_l3' }
};

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
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, 'utf8');

  if (ext === '.json') {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : parsed.data || parsed.rows || [];
  }

  if (ext === '.csv') {
    return parseCsv(content);
  }

  throw new Error('Only JSON and CSV files are supported');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetName = String(args.target || '').trim();
  const file = String(args.file || '').trim();
  const dryRun = Boolean(args['dry-run']);
  const target = TARGETS[targetName];

  if (!target || !file) {
    console.log('Usage: node scripts/import-maintenance-data.js --target=protected_areas --file=./data.csv [--dry-run]');
    console.log(`Targets: ${Object.keys(TARGETS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const filePath = path.resolve(process.cwd(), file);
  const rows = readRows(filePath);
  const validRows = rows.filter((row) => row && row[target.key] !== undefined && row[target.key] !== null && row[target.key] !== '');

  console.log(`Target: ${targetName}`);
  console.log(`File: ${filePath}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Valid rows with key "${target.key}": ${validRows.length}`);

  if (dryRun) {
    console.log('Dry run enabled. No database writes were performed.');
    return;
  }

  let imported = 0;
  await sequelize.transaction(async (transaction) => {
    for (const row of validRows) {
      await target.model.upsert(row, { transaction });
      imported += 1;
    }
  });

  console.log(`Imported rows: ${imported}`);
}

main()
  .catch((error) => {
    console.error('Import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
