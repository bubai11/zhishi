const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.join(__dirname, '..', 'backend', 'package.json'));
const mysql = backendRequire('mysql2/promise');
const axios = backendRequire('axios');

process.env.CN_ENABLE_REMOTE = '1';
process.env.CN_REMOTE_TIMEOUT_MS = process.env.CN_REMOTE_TIMEOUT_MS || '8000';
process.env.CN_FETCH_INTERVAL_MS = process.env.CN_FETCH_INTERVAL_MS || '300';

const chineseNameService = require('../backend/services/chineseNameService');
const sequelizeConfig = require('../backend/config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  waitForConnections: true,
  connectionLimit: 6,
  queueLimit: 0
};

const OUTPUT_DIR = path.join(__dirname, '..', 'ai-output');
const REPORT_PATH = path.join(OUTPUT_DIR, 'image-enrichment-report.md');

const args = process.argv.slice(2);
const options = {
  limit: 1000,
  concurrency: 3,
  delayMs: 250,
  timeoutMs: 8000,
  dryRun: false,
  force: false,
  startId: 0,
  mappedOnly: false
};

for (const arg of args) {
  if (arg.startsWith('--limit=')) options.limit = Number(arg.split('=')[1]) || options.limit;
  if (arg.startsWith('--concurrency=')) options.concurrency = Number(arg.split('=')[1]) || options.concurrency;
  if (arg.startsWith('--delay=')) options.delayMs = Number(arg.split('=')[1]) || options.delayMs;
  if (arg.startsWith('--timeout=')) options.timeoutMs = Number(arg.split('=')[1]) || options.timeoutMs;
  if (arg.startsWith('--start-id=')) options.startId = Number(arg.split('=')[1]) || options.startId;
  if (arg === '--dry-run') options.dryRun = true;
  if (arg === '--force') options.force = true;
  if (arg === '--mapped-only') options.mappedOnly = true;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlaceholderUrl(url) {
  const value = String(url || '').toLowerCase();
  return (
    !value ||
    value.includes('placehold.co/') ||
    value.includes('via.placeholder.com/') ||
    value.includes('source.unsplash.com/') ||
    value.includes('images.unsplash.com/photo-1501004318641-b39e6451bec6') ||
    value.includes('/images/plants/placeholder')
  );
}

function trimText(value, max = 255) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
}

function encodeWikiTitle(title) {
  return encodeURIComponent(String(title || '').replace(/\s+/g, ' ').trim());
}

function normalizeImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;
  if (value.length <= 255) return value;

  try {
    const parsed = new URL(value);
    parsed.search = '';
    parsed.hash = '';
    const compact = parsed.toString();
    if (compact.length <= 255) return compact;
  } catch {
    return null;
  }

  return null;
}

function uniqueNonEmpty(values) {
  return values
    .map((value) => trimText(value, 200))
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function buildSearchCandidates(plant) {
  const scientific = trimText(plant.scientific_name, 200);
  const chinese = trimText(plant.chinese_name, 200);
  const genus = trimText(plant.wcvp_genus, 200);
  const family = trimText(plant.wcvp_family, 200);

  return uniqueNonEmpty([
    scientific,
    chinese && chinese !== scientific ? chinese : null,
    scientific && chinese && chinese !== scientific ? `${scientific} ${chinese}` : null,
    genus,
    genus && family ? `${genus} ${family}` : null
  ]);
}

async function getBehaviorSnapshot(pool) {
  const [browseRows] = await pool.query('SELECT COUNT(*) AS total FROM browse_events');
  const [favoriteRows] = await pool.query('SELECT COUNT(*) AS total FROM favorites');
  const [dailyRows] = await pool.query('SELECT COUNT(*) AS total FROM plant_popularity_daily');

  return {
    browseEvents: Number(browseRows[0]?.total || 0),
    favorites: Number(favoriteRows[0]?.total || 0),
    popularityDaily: Number(dailyRows[0]?.total || 0)
  };
}

async function selectTopPlants(pool, limit, startId, mappedOnly) {
  const behavior = await getBehaviorSnapshot(pool);
  const behaviorAvailable = behavior.browseEvents > 0 || behavior.favorites > 0 || behavior.popularityDaily > 0;

  const [rows] = await pool.query(
    `
      SELECT
        p.id,
        p.taxon_id,
        p.chinese_name,
        p.scientific_name,
        p.wcvp_family,
        p.wcvp_genus,
        p.cover_image,
        COALESCE(f.favorite_count, 0) AS favorite_count,
        COALESCE(b.browse_count, 0) AS browse_count,
        COALESCE(b.search_count, 0) AS search_count,
        COALESCE(ppd.views_30d, 0) AS views_30d,
        COALESCE(ppd.favorites_30d, 0) AS favorites_30d,
        COALESCE(ppd.score_30d, 0) AS score_30d,
        COALESCE(d.has_detail, 0) AS has_detail,
        COALESCE(t.has_threat, 0) AS has_threat,
        COALESCE(m.real_media_count, 0) AS real_media_count,
        CASE
          WHEN ? = 1 THEN
            COALESCE(f.favorite_count, 0) * 10 +
            COALESCE(b.browse_count, 0) * 3 +
            COALESCE(b.search_count, 0) * 6 +
            COALESCE(ppd.views_30d, 0) * 0.5 +
            COALESCE(ppd.favorites_30d, 0) * 4 +
            COALESCE(ppd.score_30d, 0)
          ELSE
            COALESCE(m.real_media_count, 0) * 30 +
            COALESCE(d.has_detail, 0) * 20 +
            COALESCE(t.has_threat, 0) * 10 +
            CASE WHEN p.chinese_name IS NOT NULL AND p.chinese_name <> '' AND p.chinese_name <> p.scientific_name THEN 6 ELSE 0 END +
            CASE WHEN p.id <= 5000 THEN 4 ELSE 0 END +
            CASE WHEN p.id <= 1000 THEN 2 ELSE 0 END
        END AS priority_score
      FROM plants p
      LEFT JOIN (
        SELECT plant_id, COUNT(*) AS favorite_count
        FROM favorites
        GROUP BY plant_id
      ) f ON f.plant_id = p.id
      LEFT JOIN (
        SELECT
          plant_id,
          COUNT(*) AS browse_count,
          SUM(CASE WHEN source = 'search' THEN 1 ELSE 0 END) AS search_count
        FROM browse_events
        GROUP BY plant_id
      ) b ON b.plant_id = p.id
      LEFT JOIN (
        SELECT
          plant_id,
          SUM(views) AS views_30d,
          SUM(favorites) AS favorites_30d,
          SUM(score) AS score_30d
        FROM plant_popularity_daily
        WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY plant_id
      ) ppd ON ppd.plant_id = p.id
      LEFT JOIN (
        SELECT plant_id, 1 AS has_detail
        FROM plant_detail
        GROUP BY plant_id
      ) d ON d.plant_id = p.id
      LEFT JOIN (
        SELECT plant_id, 1 AS has_threat
        FROM threatened_species
        WHERE plant_id IS NOT NULL
        GROUP BY plant_id
      ) t ON t.plant_id = p.id
      LEFT JOIN (
        SELECT pm.plant_id, COUNT(*) AS real_media_count
        FROM plant_media pm
        INNER JOIN media_assets ma ON ma.id = pm.media_asset_id
        WHERE ma.kind = 'image'
          AND ma.url IS NOT NULL
          AND ma.url <> ''
          AND ma.url NOT LIKE '%placehold.co/%'
          AND ma.url NOT LIKE '%via.placeholder.com/%'
          AND ma.url NOT LIKE '%source.unsplash.com/%'
          AND ma.url NOT LIKE '%images.unsplash.com/photo-1501004318641-b39e6451bec6%'
        GROUP BY pm.plant_id
      ) m ON m.plant_id = p.id
      WHERE p.id >= ?
        ${mappedOnly ? "AND p.chinese_name IS NOT NULL AND p.chinese_name <> '' AND p.chinese_name <> p.scientific_name" : ''}
      ORDER BY priority_score DESC, p.id ASC
      LIMIT ?
    `,
    [behaviorAvailable ? 1 : 0, startId, limit]
  );

  return { behavior, behaviorAvailable, plants: rows };
}

async function fetchINaturalistImage(http, plant) {
  const candidates = buildSearchCandidates(plant);

  for (const query of candidates) {
    const response = await http.get('https://api.inaturalist.org/v1/taxa', {
      params: {
        q: query,
        per_page: 10,
        all_names: true
      }
    });

    const results = Array.isArray(response.data?.results) ? response.data.results : [];
    const normalizedScientific = String(plant.scientific_name || '').toLowerCase();
    const normalizedQuery = String(query || '').toLowerCase();
    const candidate = results.find((item) => String(item.name || '').toLowerCase() === normalizedScientific && item.default_photo)
      || results.find((item) => String(item.matched_term || '').toLowerCase() === normalizedQuery && item.default_photo)
      || results.find((item) => item.default_photo);
    const photo = candidate?.default_photo;
    const imageUrl = normalizeImageUrl(photo?.medium_url || photo?.original_url || photo?.square_url || null);
    if (!candidate || !imageUrl) {
      continue;
    }

    return {
      provider: 'inaturalist',
      imageUrl,
      sourceUrl: `https://www.inaturalist.org/taxa/${candidate.id}`,
      externalId: String(candidate.id),
      title: trimText(candidate.preferred_common_name || candidate.name),
      license: trimText(photo?.license_code),
      attribution: trimText(photo?.attribution)
    };
  }

  return null;
}

async function fetchWikipediaImage(http, plant) {
  const queryPage = async (title) => {
    const response = await http.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        format: 'json',
        prop: 'pageimages|info',
        inprop: 'url',
        pithumbsize: 1200,
        redirects: 1,
        origin: '*',
        titles: title
      }
    });

    const pages = response.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    if (!page || page.missing !== undefined || !page.thumbnail?.source) return null;

        return {
          provider: 'wikipedia',
          imageUrl: normalizeImageUrl(page.thumbnail.source),
          sourceUrl: page.fullurl || `https://en.wikipedia.org/wiki/${encodeWikiTitle(page.title || title)}`,
          externalId: String(page.pageid || ''),
          title: trimText(page.title)
        };
  };

  const candidates = buildSearchCandidates(plant);

  for (const candidate of candidates) {
    const exact = await queryPage(candidate);
    if (exact?.imageUrl) return exact;

    const searchResp = await http.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: candidate,
        srlimit: 3,
        origin: '*'
      }
    });

    const matches = Array.isArray(searchResp.data?.query?.search) ? searchResp.data.query.search : [];
    for (const match of matches) {
      const page = await queryPage(match.title);
      if (page?.imageUrl) return page;
    }
  }

  return null;
}

async function fetchIPlantImage(plant) {
  const candidates = buildSearchCandidates(plant);

  for (const candidate of candidates) {
    const profile = await chineseNameService.fetchIPlantProfile(candidate);
    const media = Array.isArray(profile?.mediaCandidates) ? profile.mediaCandidates[0] : null;
    const imageUrl = normalizeImageUrl(media?.url);
    if (!profile || !imageUrl) {
      continue;
    }

    return {
      provider: 'iplant',
      imageUrl,
      sourceUrl: profile.sourceUrl || `https://www.iplant.cn/info/${encodeWikiTitle(candidate)}`,
      externalId: trimText(profile.externalId),
      title: trimText(media.title || media.alt || profile.chineseName || plant.scientific_name)
    };
  }

  return null;
}

async function resolveRealImage(http, plant) {
  const attempts = [];
  const providers = [
    { name: 'inaturalist', fetcher: () => fetchINaturalistImage(http, plant) },
    { name: 'wikipedia', fetcher: () => fetchWikipediaImage(http, plant) },
    { name: 'iplant', fetcher: () => fetchIPlantImage(plant) }
  ];

  for (const provider of providers) {
    try {
      const result = await provider.fetcher();
      attempts.push({ provider: provider.name, status: result ? 'success' : 'missing' });
      if (result?.imageUrl) {
        return { result, attempts };
      }
    } catch (error) {
      attempts.push({ provider: provider.name, status: 'error', message: trimText(error.message, 300) });
    }
  }

  return { result: null, attempts };
}

async function upsertMedia(pool, plant, asset) {
  const metadata = JSON.stringify({
    provider: asset.provider,
    source_url: asset.sourceUrl,
    external_id: asset.externalId || null,
    license: asset.license || null,
    attribution: asset.attribution || null,
    enriched_at: new Date().toISOString()
  });

  const [existingRows] = await pool.query('SELECT id FROM media_assets WHERE url = ? LIMIT 1', [asset.imageUrl]);
  let mediaAssetId = existingRows[0]?.id;

  if (!mediaAssetId) {
    const [insertResult] = await pool.query(
      `
        INSERT INTO media_assets (kind, storage_provider, object_key, url, metadata)
        VALUES ('image', ?, ?, ?, ?)
      `,
      [asset.provider, asset.externalId || null, asset.imageUrl, metadata]
    );
    mediaAssetId = insertResult.insertId;
  }

  await pool.query(
    `
      INSERT IGNORE INTO plant_media (plant_id, media_asset_id, sort_order, caption)
      VALUES (?, ?, 0, ?)
    `,
    [plant.id, mediaAssetId, asset.title || plant.chinese_name || plant.scientific_name]
  );

  await pool.query('UPDATE plants SET cover_image = ? WHERE id = ?', [asset.imageUrl, plant.id]);
}

function buildReport(markdown) {
  ensureOutputDir();
  fs.writeFileSync(REPORT_PATH, `${markdown.join('\n')}\n`, 'utf8');
}

async function main() {
  const pool = mysql.createPool(dbConfig);
  const http = axios.create({
    timeout: options.timeoutMs,
    headers: {
      'User-Agent': 'Mozilla/5.0 Codex Plant Image Enrichment'
    },
    validateStatus: (status) => status >= 200 && status < 500
  });

  const startedAt = Date.now();
  const ranking = await selectTopPlants(pool, options.limit, options.startId, options.mappedOnly);
  const queue = ranking.plants.filter((plant) => options.force || isPlaceholderUrl(plant.cover_image));

  const stats = {
    selected: ranking.plants.length,
    queued: queue.length,
    updated: 0,
    skipped: ranking.plants.length - queue.length,
    failed: 0,
    sourceCounts: { inaturalist: 0, wikipedia: 0, iplant: 0 },
    attemptCounts: { inaturalist: 0, wikipedia: 0, iplant: 0 },
    successExamples: [],
    failureExamples: []
  };

  let cursor = 0;

  async function worker() {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= queue.length) return;

      const plant = queue[currentIndex];
      const resolved = await resolveRealImage(http, plant);
      resolved.attempts.forEach((item) => {
        stats.attemptCounts[item.provider] = (stats.attemptCounts[item.provider] || 0) + 1;
      });

      if (!resolved.result?.imageUrl) {
        stats.failed += 1;
        if (stats.failureExamples.length < 20) {
          stats.failureExamples.push({
            plant: plant.scientific_name,
            attempts: resolved.attempts
          });
        }
        if ((currentIndex + 1) % 50 === 0) {
          console.log(`processed ${currentIndex + 1}/${queue.length}, updated=${stats.updated}, failed=${stats.failed}`);
        }
        await sleep(options.delayMs);
        continue;
      }

      if (!options.dryRun) {
        await upsertMedia(pool, plant, resolved.result);
      }

      stats.updated += 1;
      stats.sourceCounts[resolved.result.provider] = (stats.sourceCounts[resolved.result.provider] || 0) + 1;
      if (stats.successExamples.length < 20) {
        stats.successExamples.push({
          plant: plant.scientific_name,
          provider: resolved.result.provider,
          imageUrl: resolved.result.imageUrl
        });
      }

      if (stats.updated <= 10 || (currentIndex + 1) % 50 === 0) {
        console.log(`updated ${plant.id} ${plant.scientific_name} via ${resolved.result.provider} (${currentIndex + 1}/${queue.length})`);
      }

      await sleep(options.delayMs);
    }
  }

  const workerCount = Math.max(1, Math.min(options.concurrency, queue.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const sampleIds = ranking.plants.slice(0, 10).map((item) => Number(item.id));
  const [verificationRows] = sampleIds.length
    ? await pool.query(
      `
        SELECT id, scientific_name, cover_image
        FROM plants
        WHERE id IN (${sampleIds.join(',')})
        ORDER BY FIELD(id, ${sampleIds.join(',')})
      `
    )
    : [[]];

  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const [manualQueueRows] = sampleIds.length || ranking.plants.length
    ? await pool.query(
      `
        SELECT id, scientific_name, chinese_name, wcvp_family, wcvp_genus
        FROM plants
        WHERE id IN (${ranking.plants.map((item) => Number(item.id)).join(',') || '0'})
          AND (
            cover_image IS NULL OR cover_image = ''
            OR cover_image LIKE '%placehold.co/%'
            OR cover_image LIKE '%via.placeholder.com/%'
            OR cover_image LIKE '%source.unsplash.com/%'
            OR cover_image LIKE '%images.unsplash.com/photo-1501004318641-b39e6451bec6%'
            OR cover_image LIKE '%/images/plants/%'
          )
        ORDER BY id ASC
        LIMIT 100
      `
    )
    : [[]];
  const unresolvedRows = manualQueueRows.map((plant) => `- ${plant.id} | ${plant.scientific_name} | ${plant.chinese_name || ''} | ${plant.wcvp_family || ''} | ${plant.wcvp_genus || ''}`);

  const lines = [
    '# Image Enrichment Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    `- requested top limit: ${options.limit}`,
    `- selected candidates: ${stats.selected}`,
    `- queued for enrichment: ${stats.queued}`,
    `- concurrency: ${workerCount}`,
    `- delay per task: ${options.delayMs}ms`,
    `- request timeout: ${options.timeoutMs}ms`,
    `- dry run: ${options.dryRun}`,
    `- force overwrite: ${options.force}`,
    `- mapped-only mode: ${options.mappedOnly}`,
    '',
    '## Behavior Analysis',
    '',
    `- browse_events rows: ${ranking.behavior.browseEvents}`,
    `- favorites rows: ${ranking.behavior.favorites}`,
    `- plant_popularity_daily rows: ${ranking.behavior.popularityDaily}`,
    `- behavior-driven ranking available: ${ranking.behaviorAvailable}`,
    ranking.behaviorAvailable
      ? '- ranking formula: favorites + browse + search-source browse + 30-day popularity score'
      : '- fallback ranking used: existing real media + detail presence + threatened-species presence + deterministic low-id bias because behavior tables are empty',
    '',
    '## Results',
    '',
    `- updated cover_image with real URLs: ${stats.updated}`,
    `- skipped because cover already looked real: ${stats.skipped}`,
    `- failed to find real image: ${stats.failed}`,
    `- elapsed seconds: ${elapsedSeconds}`,
    `- source success counts: inaturalist=${stats.sourceCounts.inaturalist}, wikipedia=${stats.sourceCounts.wikipedia}, iplant=${stats.sourceCounts.iplant}`,
    `- source attempt counts: inaturalist=${stats.attemptCounts.inaturalist}, wikipedia=${stats.attemptCounts.wikipedia}, iplant=${stats.attemptCounts.iplant}`,
    '',
    '## Success Sample',
    '',
    ...(stats.successExamples.length
      ? stats.successExamples.map((item) => `- ${item.plant}: ${item.provider} -> ${item.imageUrl}`)
      : ['- none']),
    '',
    '## Failure Sample',
    '',
    ...(stats.failureExamples.length
      ? stats.failureExamples.map((item) => `- ${item.plant}: ${item.attempts.map((attempt) => `${attempt.provider}:${attempt.status}`).join(', ')}`)
      : ['- none']),
    '',
    '## Verification Sample',
    '',
    ...(verificationRows.length
      ? verificationRows.map((row) => `- ${row.id} ${row.scientific_name}: ${row.cover_image}`)
      : ['- no rows']),
    '',
    '## Manual Review Queue',
    '',
    '- format: `id | scientific_name | chinese_name | family | genus`',
    ...(unresolvedRows.length ? unresolvedRows : ['- none']),
    ''
  ];

  buildReport(lines);
  console.log(`Report written to ${REPORT_PATH}`);

  await pool.end();
}

main().catch((error) => {
  console.error(`enrich-real-images failed: ${error.message}`);
  process.exitCode = 1;
});
