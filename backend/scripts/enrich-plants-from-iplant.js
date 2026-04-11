const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

process.env.CN_ENABLE_REMOTE = '1';

const chineseNameService = require('../services/chineseNameService');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const args = process.argv.slice(2);
let batchSize = 20;
let maxRounds = 1;
let intervalMs = 500;
let resume = true;
let prioritize = true;
let retryMissing = false;

for (const arg of args) {
  if (arg.startsWith('--batch=')) batchSize = Number(arg.split('=')[1]) || batchSize;
  if (arg.startsWith('--rounds=')) maxRounds = Number(arg.split('=')[1]) || maxRounds;
  if (arg.startsWith('--interval=')) intervalMs = Number(arg.split('=')[1]) || intervalMs;
  if (arg === '--no-resume') resume = false;
  if (arg === '--no-priority') prioritize = false;
  if (arg === '--retry-missing') retryMissing = true;
}

process.env.CN_FETCH_INTERVAL_MS = String(intervalMs);

const LOG_DIR = path.join(__dirname, '..', 'logs');
const CHECKPOINT_FILE = path.join(LOG_DIR, 'iplant-enrich-checkpoint.json');
const ERROR_LOG = path.join(LOG_DIR, 'iplant-enrich-errors.log');

const HIGH_VALUE_EPITHETS = [
  'chinensis',
  'japonica',
  'sinensis',
  'formosana',
  'yunnanensis',
  'officinalis',
  'indica',
  'szechuanica',
  'wilsonii',
  'henryi'
];

const HIGH_YIELD_GENERA = [
  'Isodon',
  'Anoectochilus',
  'Anodendron',
  'Iguanura',
  'Hydriastele',
  'Lasianthus',
  'Leptopus',
  'Madhuca',
  'Aporosa',
  'Mycetia',
  'Neanotis'
];

const LOW_YIELD_GENERA = [
  'Homalomena',
  'Houstonia',
  'Hyptis',
  'Homoranthus',
  'Hunteria',
  'Hydnophytum',
  'Isertia',
  'Isidorea'
];

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
    return { lastPlantId: 0 };
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
  return path.join(__dirname, '..', `IPLANT_ENRICHMENT_REPORT_${shanghaiDateParts().day}.md`);
}

function appendReport(lines) {
  const filePath = reportPath();
  const exists = fs.existsSync(filePath);
  const { day, timestamp } = shanghaiDateParts();
  const block = [];

  if (!exists) {
    block.push('# iPlant Enrichment Report');
    block.push('');
    block.push(`Date: ${day}`);
    block.push('');
    block.push('This file records iPlant detail/source/media enrichment runs.');
    block.push('');
  }

  block.push('## Enrichment Run');
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

async function getPendingPlants(conn, lastPlantId, limit) {
  const priorityEnabled = prioritize ? 1 : 0;
  const retryMissingEnabled = retryMissing ? 1 : 0;
  const highYieldList = HIGH_YIELD_GENERA.map((item) => `'${item}'`).join(', ');
  const lowYieldList = LOW_YIELD_GENERA.map((item) => `'${item}'`).join(', ');
  const epithetScoreExpr = HIGH_VALUE_EPITHETS.map((epithet) => `WHEN LOWER(p.scientific_name) LIKE '% ${epithet}' THEN 30`).join(' ');

  const [rows] = await conn.query(
    `
      SELECT
        p.id,
        p.taxon_id,
        p.scientific_name,
        CASE
          WHEN ? = 0 THEN 0
          WHEN p.wcvp_genus IN (${highYieldList}) THEN 40
          WHEN p.wcvp_genus IN (${lowYieldList}) THEN -30
          ELSE 0
        END
        +
        CASE
          WHEN COALESCE(gs.success_count, 0) >= 3 AND COALESCE(gs.success_count, 0) > COALESCE(gs.missing_count, 0) THEN 35
          WHEN COALESCE(gs.missing_count, 0) >= 5 AND COALESCE(gs.success_count, 0) = 0 THEN -35
          WHEN COALESCE(gs.missing_count, 0) >= 10 AND COALESCE(gs.success_count, 0) < 2 THEN -20
          ELSE 0
        END
        +
        CASE
          ${epithetScoreExpr}
          ELSE 0
        END
        +
        CASE
          WHEN p.scientific_name REGEXP '^[A-Z][a-zA-Z-]+ [a-z][a-zA-Z-]+$' THEN 10
          ELSE 0
        END AS priority_score
      FROM plants p
      LEFT JOIN (
        SELECT
          p2.wcvp_genus AS genus_name,
          SUM(CASE WHEN s2.fetch_status = 'success' THEN 1 ELSE 0 END) AS success_count,
          SUM(CASE WHEN s2.fetch_status = 'missing' THEN 1 ELSE 0 END) AS missing_count
        FROM plant_external_sources s2
        INNER JOIN plants p2 ON p2.id = s2.plant_id
        WHERE s2.provider = 'iplant'
        GROUP BY p2.wcvp_genus
      ) gs
        ON gs.genus_name = p.wcvp_genus
      LEFT JOIN plant_external_sources s
        ON s.plant_id = p.id
       AND s.provider = 'iplant'
       AND (
         s.source_type = 'info_page'
         OR s.source_type = 'accepted_name_fallback'
       )
      WHERE p.id > ?
        AND p.scientific_name IS NOT NULL
        AND p.scientific_name <> ''
        AND (
          s.id IS NULL
          OR (? = 1 AND s.fetch_status = 'missing')
        )
      ORDER BY priority_score DESC, p.id ASC
      LIMIT ?
    `,
    [priorityEnabled, lastPlantId, retryMissingEnabled, limit]
  );

  return rows;
}

async function upsertExternalSource(conn, plant, profile, status, errorMessage = null) {
  const payloadJson = profile ? JSON.stringify(profile.payload || {}) : null;
  await conn.query(
    `
      INSERT INTO plant_external_sources
        (plant_id, taxon_id, provider, source_type, external_id, canonical_scientific_name, chinese_name, source_url, fetch_status, error_message, payload_json, fetched_at, last_success_at)
      VALUES
        (?, ?, 'iplant', 'info_page', ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
      ON DUPLICATE KEY UPDATE
        external_id = VALUES(external_id),
        canonical_scientific_name = VALUES(canonical_scientific_name),
        chinese_name = VALUES(chinese_name),
        source_url = VALUES(source_url),
        fetch_status = VALUES(fetch_status),
        error_message = VALUES(error_message),
        payload_json = VALUES(payload_json),
        fetched_at = VALUES(fetched_at),
        last_success_at = VALUES(last_success_at),
        updated_at = NOW()
    `,
    [
      plant.id,
      plant.taxon_id,
      profile?.externalId || null,
      plant.scientific_name,
      profile?.chineseName || null,
      profile?.sourceUrl || `https://www.iplant.cn/info/${encodeURIComponent(plant.scientific_name)}`,
      status,
      errorMessage,
      payloadJson,
      status === 'success' ? new Date() : null
    ]
  );
}

async function upsertPlantDetail(conn, plantId, profile) {
  const [rows] = await conn.query('SELECT extra FROM plant_detail WHERE plant_id = ? LIMIT 1', [plantId]);
  const existingExtra = rows[0]?.extra && typeof rows[0].extra === 'string' ? JSON.parse(rows[0].extra) : (rows[0]?.extra || {});
  const mergedExtra = {
    ...(existingExtra || {}),
    iplant: {
      aliases: profile.aliases,
      synonyms: profile.synonyms,
      mediaCandidates: profile.mediaCandidates,
      externalId: profile.externalId,
      sourceUrl: profile.sourceUrl
    }
  };

  await conn.query(
    `
      INSERT INTO plant_detail
        (plant_id, intro, extra, data_source, source_url, fetched_at)
      VALUES
        (?, ?, ?, 'iplant', ?, NOW())
      ON DUPLICATE KEY UPDATE
        intro = COALESCE(NULLIF(intro, ''), VALUES(intro)),
        extra = VALUES(extra),
        data_source = VALUES(data_source),
        source_url = VALUES(source_url),
        fetched_at = VALUES(fetched_at)
    `,
    [plantId, profile.intro, JSON.stringify(mergedExtra), profile.sourceUrl]
  );
}

async function replaceSynonyms(conn, plant, profile) {
  await conn.query(
    `
      DELETE FROM plant_synonyms
      WHERE plant_id = ?
        AND source_provider = 'iplant'
    `,
    [plant.id]
  );

  const inserts = [];
  const seen = new Set();
  for (const alias of profile.aliases || []) {
    const dedupeKey = `alias::${alias}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    inserts.push([plant.id, plant.taxon_id, plant.scientific_name, alias, 'alias', 'zh', 'iplant', profile.sourceUrl]);
  }
  for (const synonym of profile.synonyms || []) {
    const dedupeKey = `synonym::${synonym}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    inserts.push([plant.id, plant.taxon_id, plant.scientific_name, synonym, 'synonym', null, 'iplant', profile.sourceUrl]);
  }

  if (!inserts.length) return 0;

  await conn.query(
    `
      INSERT INTO plant_synonyms
        (plant_id, taxon_id, accepted_scientific_name, synonym_name, synonym_type, language_code, source_provider, source_url)
      VALUES ?
    `,
    [inserts]
  );

  return inserts.length;
}

async function attachMediaCandidates(conn, plantId, profile) {
  let attached = 0;

  for (const media of profile.mediaCandidates || []) {
    const [existingRows] = await conn.query('SELECT id FROM media_assets WHERE url = ? LIMIT 1', [media.url]);
    let mediaAssetId = existingRows[0]?.id;

    if (!mediaAssetId) {
      const [insertResult] = await conn.query(
        `
          INSERT INTO media_assets (kind, storage_provider, object_key, url, metadata)
          VALUES ('image', 'iplant', ?, ?, ?)
        `,
        [profile.externalId || null, media.url, JSON.stringify({
          provider: 'iplant',
          sourceUrl: profile.sourceUrl,
          alt: media.alt,
          title: media.title
        })]
      );
      mediaAssetId = insertResult.insertId;
    }

    const [mappingRows] = await conn.query(
      'SELECT 1 FROM plant_media WHERE plant_id = ? AND media_asset_id = ? LIMIT 1',
      [plantId, mediaAssetId]
    );

    if (!mappingRows.length) {
      await conn.query(
        `
          INSERT INTO plant_media (plant_id, media_asset_id, sort_order, caption)
          VALUES (?, ?, 0, ?)
        `,
        [plantId, mediaAssetId, media.alt || media.title || null]
      );
      attached += 1;
    }
  }

  return attached;
}

async function applyChineseNameIfMissing(conn, plant, chineseName) {
  if (!chineseName) return;
  await conn.query(
    `
      UPDATE plants
      SET chinese_name = ?, translation_source = 'iplant', translation_confidence = 96
      WHERE id = ?
        AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
    `,
    [chineseName, plant.id]
  );

  await conn.query(
    `
      UPDATE taxa
      SET chinese_name = ?
      WHERE id = ?
        AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
    `,
    [chineseName, plant.taxon_id]
  );
}

async function main() {
  ensureLogDir();
  const conn = await mysql.createConnection(dbConfig);
  const checkpoint = loadCheckpoint();
  let cursor = Number(checkpoint.lastPlantId || 0);
  let success = 0;
  let missing = 0;
  let errors = 0;
  let synonymsInserted = 0;
  let mediaAttached = 0;
  const failureList = [];
  let completedAll = false;

  try {
    console.log(`iPlant enrichment target DB: ${dbConfig.database}`);
    for (let round = 1; round <= maxRounds; round += 1) {
      const plants = await getPendingPlants(conn, cursor, batchSize);
      if (!plants.length) {
        completedAll = true;
        break;
      }

      console.log(
        `Round ${round}: fetched ${plants.length} candidates, top priorities = ${plants
          .slice(0, 5)
          .map((item) => `${item.scientific_name}(${item.priority_score})`)
          .join(', ')}`
      );

      for (const plant of plants) {
        cursor = Math.max(cursor, plant.id);
        try {
          const profile = await chineseNameService.fetchIPlantProfile(plant.scientific_name);
          if (!profile) {
            await upsertExternalSource(conn, plant, null, 'missing', 'No usable iPlant profile content');
            missing += 1;
            failureList.push(plant.scientific_name);
            logError(plant.scientific_name, 'No usable iPlant profile content');
          } else {
            await upsertExternalSource(conn, plant, profile, 'success');
            await upsertPlantDetail(conn, plant.id, profile);
            await applyChineseNameIfMissing(conn, plant, profile.chineseName);
            synonymsInserted += await replaceSynonyms(conn, plant, profile);
            mediaAttached += await attachMediaCandidates(conn, plant.id, profile);
            success += 1;
          }
        } catch (error) {
          await upsertExternalSource(conn, plant, null, 'error', error.message.slice(0, 500));
          errors += 1;
          failureList.push(plant.scientific_name);
          logError(plant.scientific_name, error.message);
        }

        saveCheckpoint({
          lastPlantId: cursor,
          updatedAt: new Date().toISOString()
        });
      }

      if (plants.length < batchSize) {
        completedAll = true;
        break;
      }
    }
  } finally {
    await conn.end();
  }

  if (completedAll) {
    clearCheckpoint();
  }

  const reportFile = appendReport([
    '### Configuration',
    '',
    `- batch size: ${batchSize}`,
    `- max rounds: ${maxRounds}`,
    `- request interval: ${intervalMs}ms`,
    `- resume enabled: ${resume}`,
    `- priority enabled: ${prioritize}`,
    `- retry missing enabled: ${retryMissing}`,
    `- high-yield genera: ${HIGH_YIELD_GENERA.join(', ')}`,
    '',
    '### Results',
    '',
    `- success profiles: ${success}`,
    `- missing profiles: ${missing}`,
    `- error profiles: ${errors}`,
    `- synonyms inserted: ${synonymsInserted}`,
    `- media attached: ${mediaAttached}`,
    `- checkpoint file: \`${CHECKPOINT_FILE}\``,
    `- error log: \`${ERROR_LOG}\``,
    '',
    '### Failure Sample',
    '',
    ...(failureList.length ? failureList.slice(0, 50).map((item) => `- ${item}`) : ['- none'])
  ]);

  console.log(`success=${success} missing=${missing} errors=${errors} synonyms=${synonymsInserted} media=${mediaAttached}`);
  console.log(`Markdown report: ${reportFile}`);
}

main().catch((err) => {
  console.error(`iPlant enrichment failed: ${err.message}`);
  process.exitCode = 1;
});
