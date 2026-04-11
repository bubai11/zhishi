const { spawnSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');

const sequelizeConfig = require('../config/config').development;

const DEFAULT_LIMIT = 1797;
const SCRIPT_DIR = __dirname;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

function parseArgs(argv) {
  const options = {
    limit: DEFAULT_LIMIT,
    withRemote: false
  };

  for (const arg of argv) {
    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed;
      }
    }
    if (arg === '--with-remote') {
      options.withRemote = true;
    }
  }

  return options;
}

function runScript(relativeScriptPath, args = []) {
  const scriptPath = path.join(SCRIPT_DIR, relativeScriptPath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.join(SCRIPT_DIR, '..'),
    stdio: 'inherit',
    env: process.env
  });

  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`Failed: ${relativeScriptPath} (exit code ${result.status})`);
  }
}

async function verifyHybridCoverage() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [rows] = await conn.query(
      `
      SELECT
        SUM(CASE WHEN scientific_name REGEXP ' [xX×] ' AND chinese_name REGEXP '[一-龥]' THEN 1 ELSE 0 END) AS hybridWithChinese,
        SUM(CASE WHEN chinese_name REGEXP '[一-龥]' THEN 1 ELSE 0 END) AS totalWithChinese
      FROM plants
      `
    );
    const item = rows[0] || {};
    return {
      hybridWithChinese: Number(item.hybridWithChinese || 0),
      totalWithChinese: Number(item.totalWithChinese || 0)
    };
  } finally {
    await conn.end();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('=== Hybrid Chinese Names: Auto All ===');
  console.log(`- limit: ${options.limit}`);
  console.log(`- with remote lookup: ${options.withRemote ? 'yes' : 'no'}`);

  runScript('high-priority-manual-pipeline.js', ['prepare', '--mode=hybrid', `--limit=${options.limit}`]);
  runScript('init-hybrid-chinese-names.js');

  if (options.withRemote) {
    runScript('auto-fill-hybrid-chinese-names.js');
  } else {
    console.log('Skip remote auto-fill step. Use --with-remote to enable.');
  }

  runScript('import-hybrid-review-direct.js');

  const verification = await verifyHybridCoverage();
  console.log('=== Final Verification ===');
  console.log(`- hybrid species with Chinese names: ${verification.hybridWithChinese}`);
  console.log(`- total plants with Chinese names: ${verification.totalWithChinese}`);
  console.log('=== Done ===');
}

main().catch((error) => {
  console.error(`Hybrid auto-all failed: ${error.message}`);
  process.exitCode = 1;
});
