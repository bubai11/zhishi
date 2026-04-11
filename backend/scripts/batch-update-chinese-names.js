const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let batchSize = 200;
let maxRounds = 10;
let intervalMs = 500;
let remoteEnabled = true;
let resume = true;

for (const arg of args) {
  if (arg.startsWith('--batch=')) batchSize = Number(arg.split('=')[1]) || batchSize;
  if (arg.startsWith('--rounds=')) maxRounds = Number(arg.split('=')[1]) || maxRounds;
  if (arg.startsWith('--interval=')) intervalMs = Number(arg.split('=')[1]) || intervalMs;
  if (arg === '--no-remote') remoteEnabled = false;
  if (arg === '--no-resume') resume = false;
}

process.env.CN_ENABLE_REMOTE = remoteEnabled ? '1' : '0';
process.env.CN_FETCH_INTERVAL_MS = String(intervalMs);

const ChineseNameService = require('../services/chineseNameService');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const ERROR_LOG = path.join(LOG_DIR, 'translation-errors.log');
const CHECKPOINT_FILE = path.join(LOG_DIR, 'translation-batch-checkpoint.json');

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

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logError(scientificName, reason) {
  ensureLogDir();
  fs.appendFileSync(ERROR_LOG, `[${new Date().toISOString()}] ${scientificName}: ${reason}\n`);
}

function loadCheckpoint() {
  if (!resume || !fs.existsSync(CHECKPOINT_FILE)) {
    return {
      cursor: 0,
      round: 0,
      totalUpdated: 0,
      totalTaxaUpdated: 0,
      successCount: 0,
      failureCount: 0
    };
  }

  return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
}

function saveCheckpoint(payload) {
  ensureLogDir();
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

function clearCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
}

function reportPath() {
  return path.join(__dirname, '..', `IPLANT_BATCH_REPORT_${shanghaiDateParts().day}.md`);
}

function appendReport(lines) {
  const filePath = reportPath();
  const exists = fs.existsSync(filePath);
  const { day, timestamp } = shanghaiDateParts();
  const block = [];

  if (!exists) {
    block.push('# iPlant Batch Update Report');
    block.push('');
    block.push(`Date: ${day}`);
    block.push('');
    block.push('This file records iPlant-oriented Chinese name batch runs.');
    block.push('');
  }

  block.push('## Batch Run');
  block.push('');
  block.push(`Timestamp: ${timestamp}`);
  block.push('');
  for (const line of lines) {
    block.push(line);
  }
  block.push('');

  fs.appendFileSync(filePath, block.join('\n'), 'utf8');
  return filePath;
}

async function main() {
  console.log('=== Chinese Name Batch Update ===');
  console.log(`Batch size: ${batchSize}`);
  console.log(`Max rounds: ${maxRounds}`);
  console.log(`Request interval: ${intervalMs}ms`);
  console.log(`Remote enabled: ${remoteEnabled}`);
  console.log(`Resume enabled: ${resume}`);

  await ChineseNameService.ensureInfrastructure();

  const manualResult = await ChineseNameService.applyManualMappings();
  console.log('Manual mappings applied:', manualResult);

  const checkpoint = loadCheckpoint();
  let cursor = Number(checkpoint.cursor || 0);
  let totalUpdated = Number(checkpoint.totalUpdated || 0);
  let totalTaxaUpdated = Number(checkpoint.totalTaxaUpdated || 0);
  let successCount = Number(checkpoint.successCount || 0);
  let failureCount = Number(checkpoint.failureCount || 0);
  const failedList = [];
  let completedAll = false;
  let executedRounds = 0;

  for (let round = 1; round <= maxRounds; round += 1) {
    const result = await ChineseNameService.batchUpdatePlants(batchSize, cursor);
    executedRounds += 1;

    console.log(
      `Round ${round}: total=${result.total}, plantsUpdated=${result.updated}, taxaUpdated=${result.taxaUpdated}, nextCursor=${result.nextCursor}`
    );
    console.log(`Round ${round} by source:`, result.bySource);

    totalUpdated += result.updated;
    totalTaxaUpdated += result.taxaUpdated;
    successCount +=
      (result.bySource.manual || 0) +
      (result.bySource.iplant || 0) +
      (result.bySource.gbif || 0) +
      (result.bySource.rule || 0);
    failureCount += result.failed.length;
    cursor = result.nextCursor;

    for (const failed of result.failed) {
      failedList.push(failed);
      logError(failed, 'No chinese name matched from manual/cache/rule/iplant/gbif');
    }

    saveCheckpoint({
      cursor,
      round: Number(checkpoint.round || 0) + executedRounds,
      totalUpdated,
      totalTaxaUpdated,
      successCount,
      failureCount,
      updatedAt: new Date().toISOString()
    });

    if (result.total < batchSize || result.nextCursor === 0) {
      completedAll = true;
      break;
    }
  }

  const stats = await ChineseNameService.getStatistics();
  console.log('--- Final Statistics ---');
  console.log(`Plants updated this run: ${totalUpdated}`);
  console.log(`Taxa updated this run: ${totalTaxaUpdated}`);
  console.log(`Success count this run: ${successCount}`);
  console.log(`Failure count this run: ${failureCount}`);
  console.log(`Total species: ${stats.total}`);
  console.log(`Matched species: ${stats.matched}`);
  console.log(`Unmatched species: ${stats.unmatched}`);
  console.table(stats.bySource);

  if (completedAll) {
    clearCheckpoint();
  }

  const reportFile = appendReport([
    '### Configuration',
    '',
    `- batch size: ${batchSize}`,
    `- max rounds: ${maxRounds}`,
    `- request interval: ${intervalMs}ms`,
    `- remote enabled: ${remoteEnabled}`,
    `- resume enabled: ${resume}`,
    '',
    '### Execution Summary',
    '',
    `- manual mapping rows loaded: ${manualResult.manualEntries}`,
    `- plants updated this run: ${totalUpdated}`,
    `- taxa updated this run: ${totalTaxaUpdated}`,
    `- success count: ${successCount}`,
    `- failure count: ${failureCount}`,
    `- checkpoint file: \`${CHECKPOINT_FILE}\``,
    `- error log: \`${ERROR_LOG}\``,
    '',
    '### Coverage Snapshot',
    '',
    `- total species: ${stats.total}`,
    `- matched species: ${stats.matched}`,
    `- unmatched species: ${stats.unmatched}`,
    '',
    '### Failure Sample',
    '',
    ...(failedList.length ? failedList.slice(0, 50).map((name) => `- ${name}`) : ['- none'])
  ]);

  console.log(`Markdown report: ${reportFile}`);
}

main().catch((err) => {
  console.error('Batch update failed:', err.message);
  process.exitCode = 1;
});
