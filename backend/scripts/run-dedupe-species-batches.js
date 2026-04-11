const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const ROUNDS = Math.max(1, Number(process.env.SPECIES_DEDUP_ROUNDS || 10));
const BATCH_SIZE = Math.max(100, Number(process.env.SPECIES_DEDUP_BATCH_SIZE || 2000));
const CHECKPOINT_FILE = process.env.SPECIES_DEDUP_CHECKPOINT_FILE || path.join(__dirname, '..', 'ai-output', 'species-dedup-checkpoint.json');
const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

function readCheckpoint() {
  if (!fs.existsSync(CHECKPOINT_FILE)) {
    return Math.max(0, Number(process.env.SPECIES_DEDUP_START_AFTER || 0));
  }

  try {
    const payload = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    return Math.max(0, Number(payload.nextStartAfter || 0));
  } catch (_) {
    return Math.max(0, Number(process.env.SPECIES_DEDUP_START_AFTER || 0));
  }
}

function writeCheckpoint(nextStartAfter) {
  const dir = path.dirname(CHECKPOINT_FILE);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    CHECKPOINT_FILE,
    JSON.stringify({
      nextStartAfter,
      updatedAt: new Date().toISOString()
    }, null, 2)
  );
}

async function fetchSpeciesDuplicateSummary() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [[row]] = await connection.query(`
      SELECT
        COUNT(*) AS duplicate_groups,
        SUM(total_rows - 1) AS duplicate_rows
      FROM (
        SELECT scientific_name, COALESCE(parent_id, 0) AS parent_key, COUNT(*) AS total_rows
        FROM taxa
        WHERE taxon_rank = 'species'
        GROUP BY scientific_name, COALESCE(parent_id, 0)
        HAVING COUNT(*) > 1
      ) d
    `);

    return {
      duplicate_groups: Number(row?.duplicate_groups || 0),
      duplicate_rows: Number(row?.duplicate_rows || 0)
    };
  } finally {
    await connection.end();
  }
}

let startAfter = readCheckpoint();

function runSingleBatch() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'dedupe-species-taxa-batch.js')],
      {
        cwd: __dirname,
        env: {
          ...process.env,
          SPECIES_DEDUP_BATCH_SIZE: String(BATCH_SIZE),
          SPECIES_DEDUP_START_AFTER: String(startAfter)
        },
        stdio: ['ignore', 'pipe', 'pipe']
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', reject);

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `dedupe-species-taxa-batch exited with code ${code}`));
        return;
      }

      const lines = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const jsonLine = [...lines].reverse().find((line) => line.startsWith('{') && line.endsWith('}'));
      if (!jsonLine) {
        reject(new Error('Could not parse dedupe batch result JSON'));
        return;
      }

      resolve(JSON.parse(jsonLine));
    });
  });
}

async function main() {
  console.log(`Species dedupe runner start: rounds=${ROUNDS}, batchSize=${BATCH_SIZE}, startAfter=${startAfter}`);
  console.log(`Checkpoint file: ${CHECKPOINT_FILE}`);

  const before = await fetchSpeciesDuplicateSummary();
  console.log(`Before run: duplicate_groups=${before.duplicate_groups}, duplicate_rows=${before.duplicate_rows}`);

  for (let round = 1; round <= ROUNDS; round += 1) {
    console.log(`\n=== Round ${round}/${ROUNDS} ===`);
    const result = await runSingleBatch();
    startAfter = Number(result.nextStartAfter || startAfter);
    writeCheckpoint(startAfter);

    if (result.done) {
      console.log('No more duplicate species rows in the current scan range.');
      break;
    }
  }

  const after = await fetchSpeciesDuplicateSummary();
  console.log(`After run: duplicate_groups=${after.duplicate_groups}, duplicate_rows=${after.duplicate_rows}`);
  console.log(`Runner finished. Next startAfter=${startAfter}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('run-dedupe-species-batches failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = { main };
