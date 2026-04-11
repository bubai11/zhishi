const fs = require('fs');
const os = require('os');
const path = require('path');
const mysql = require('mysql2/promise');
const axios = require('axios');
const { Jimp } = require('jimp');
const sequelizeConfig = require('../config/config').development;

const FRONTEND_PUBLIC_DIR = path.join(__dirname, '..', '..', 'frontend-aistudio', 'public');
const STANDARDIZED_ROOT_DIR = path.join(FRONTEND_PUBLIC_DIR, 'images', 'plants', 'standardized');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'ai-output');
const REPORT_PATH = path.join(OUTPUT_DIR, 'common-plant-image-standardization-report.md');
const TMP_DIR = path.join(os.tmpdir(), 'zhishi-plant-image-standardization');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  waitForConnections: true,
  connectionLimit: 4,
  queueLimit: 0
};

const options = {
  limit: 500,
  startId: 0,
  delayMs: 150,
  timeoutMs: 15000,
  dryRun: false,
  force: false,
  ids: []
};

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--limit=')) options.limit = Number(arg.split('=')[1]) || options.limit;
  if (arg.startsWith('--start-id=')) options.startId = Number(arg.split('=')[1]) || options.startId;
  if (arg.startsWith('--delay=')) options.delayMs = Number(arg.split('=')[1]) || options.delayMs;
  if (arg.startsWith('--timeout=')) options.timeoutMs = Number(arg.split('=')[1]) || options.timeoutMs;
  if (arg.startsWith('--ids=')) {
    options.ids = arg
      .split('=')[1]
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
  }
  if (arg === '--dry-run') options.dryRun = true;
  if (arg === '--force') options.force = true;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimText(value, max = 255) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max) || null;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'plant';
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

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(String(url || '').trim());
}

function isLocalPublicUrl(url) {
  return String(url || '').startsWith('/');
}

function isStandardizedUrl(url) {
  return String(url || '').startsWith('/images/plants/standardized/');
}

function resolveLocalPublicPath(publicUrl) {
  const clean = String(publicUrl || '').replace(/^\//, '').replace(/\//g, path.sep);
  return path.join(FRONTEND_PUBLIC_DIR, clean);
}

function shanghaiNow() {
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
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    timestamp: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
  };
}

async function selectCandidatePlants(pool) {
  const baseSql = `
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
        COALESCE(pm.media_count, 0) AS media_count,
        CASE WHEN p.cover_image LIKE '/images/plants/standardized/%' THEN 1 ELSE 0 END AS already_standardized,
        (
          COALESCE(f.favorite_count, 0) * 10 +
          COALESCE(b.browse_count, 0) * 3 +
          COALESCE(b.search_count, 0) * 6 +
          COALESCE(ppd.views_30d, 0) * 0.5 +
          COALESCE(ppd.favorites_30d, 0) * 4 +
          COALESCE(ppd.score_30d, 0) +
          COALESCE(d.has_detail, 0) * 5 +
          COALESCE(pm.media_count, 0) * 2 +
          CASE WHEN p.id <= 1000 THEN 3 ELSE 0 END +
          CASE WHEN p.id <= 5000 THEN 2 ELSE 0 END
        ) AS priority_score
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
        SELECT plant_id, COUNT(*) AS media_count
        FROM plant_media
        GROUP BY plant_id
      ) pm ON pm.plant_id = p.id
      WHERE p.id >= ?
        AND p.scientific_name IS NOT NULL
        AND p.scientific_name <> ''
        AND p.chinese_name IS NOT NULL
        AND p.chinese_name <> ''
        AND p.chinese_name <> p.scientific_name
      ORDER BY priority_score DESC, p.id ASC
      LIMIT ?
    `;

  let rows;
  if (options.ids.length) {
    const placeholders = options.ids.map(() => '?').join(', ');
    const sql = baseSql
      .replace('WHERE p.id >= ?', `WHERE p.id IN (${placeholders})`)
      .replace('\n      LIMIT ?', '');
    [rows] = await pool.query(sql, options.ids);
  } else {
    [rows] = await pool.query(baseSql, [options.startId, options.limit]);
  }

  return rows.filter((row) => {
    const cover = String(row.cover_image || '');
    if (isPlaceholderUrl(cover)) return false;
    if (isStandardizedUrl(cover) && !options.force) return false;
    if (!isRemoteUrl(cover) && !isLocalPublicUrl(cover)) return false;
    return true;
  });
}

async function getCoverageSnapshot(pool) {
  const [[summary]] = await pool.query(
    `
      SELECT
        COUNT(*) AS mapped_total,
        SUM(CASE WHEN cover_image LIKE '/images/plants/standardized/%' THEN 1 ELSE 0 END) AS standardized_cover_count,
        SUM(CASE WHEN cover_image LIKE 'http%' THEN 1 ELSE 0 END) AS remote_cover_count,
        SUM(
          CASE
            WHEN cover_image LIKE '%placehold.co/%'
              OR cover_image LIKE '%via.placeholder.com/%'
              OR cover_image LIKE '%source.unsplash.com/%'
              OR cover_image LIKE '%images.unsplash.com/photo-1501004318641-b39e6451bec6%'
              OR cover_image LIKE '/images/plants/placeholder%'
            THEN 1 ELSE 0
          END
        ) AS placeholder_count
      FROM plants
      WHERE chinese_name IS NOT NULL
        AND chinese_name <> ''
        AND chinese_name <> scientific_name
    `
  );

  return {
    mappedTotal: Number(summary?.mapped_total || 0),
    standardizedCoverCount: Number(summary?.standardized_cover_count || 0),
    remoteCoverCount: Number(summary?.remote_cover_count || 0),
    placeholderCount: Number(summary?.placeholder_count || 0)
  };
}

async function fetchWithRetry(http, url) {
  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await http.get(url, { responseType: 'arraybuffer' });
    } catch (error) {
      lastError = error;
      const status = Number(error.response?.status || 0);
      const retriable = status >= 500 || error.code === 'ECONNABORTED' || /timeout/i.test(String(error.message || ''));
      if (!retriable || attempt === maxAttempts) {
        throw error;
      }
      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

async function materializeSourceImage(http, plant, plantTmpDir) {
  ensureDir(plantTmpDir);
  const sourcePath = path.join(plantTmpDir, 'source.bin');
  const coverImage = String(plant.cover_image || '').trim();

  if (isRemoteUrl(coverImage)) {
    const response = await fetchWithRetry(http, coverImage);
    fs.writeFileSync(sourcePath, Buffer.from(response.data));
    return { sourcePath, sourceType: 'remote-download', originalUrl: coverImage };
  }

  if (isLocalPublicUrl(coverImage)) {
    const localPath = resolveLocalPublicPath(coverImage);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local source image not found: ${localPath}`);
    }
    fs.copyFileSync(localPath, sourcePath);
    return { sourcePath, sourceType: 'local-copy', originalUrl: coverImage };
  }

  throw new Error(`Unsupported cover image source: ${coverImage}`);
}

function runVariantResize(sourcePath, outputDir) {
  return Jimp.read(sourcePath).then(async (image) => {
    const cover = image.clone().cover({ w: 800, h: 600 });
    const detail = image.clone().cover({ w: 1200, h: 800 });
    const thumb = image.clone().cover({ w: 300, h: 200 });

    await cover.write(path.join(outputDir, 'cover.jpg'), { quality: 88 });
    await detail.write(path.join(outputDir, 'detail.jpg'), { quality: 88 });
    await thumb.write(path.join(outputDir, 'thumb.jpg'), { quality: 85 });
  });
}

function fileStatWithKnownSize(filePath, width, height) {
  const stat = fs.statSync(filePath);
  return {
    width,
    height,
    bytes: stat.size
  };
}

async function upsertMediaRecord(connection, payload) {
  const metadata = JSON.stringify(payload.metadata || {});
  await connection.query(
    `
      INSERT INTO media_assets (kind, storage_provider, object_key, url, width, height, metadata)
      VALUES ('image', ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        storage_provider = VALUES(storage_provider),
        object_key = VALUES(object_key),
        width = VALUES(width),
        height = VALUES(height),
        metadata = VALUES(metadata)
    `,
    [
      payload.storageProvider,
      payload.objectKey,
      payload.url,
      payload.width,
      payload.height,
      metadata
    ]
  );

  const [[asset]] = await connection.query(
    'SELECT id FROM media_assets WHERE kind = ? AND object_key = ? LIMIT 1',
    ['image', payload.objectKey]
  );

  return Number(asset.id);
}

async function syncPlantMedia(connection, plantId, coverAssetId, detailAssetId, chineseName) {
  const desired = [
    {
      assetId: coverAssetId,
      sortOrder: 0,
      caption: trimText(`${chineseName || ''} 封面图`, 255)
    },
    {
      assetId: detailAssetId,
      sortOrder: 1,
      caption: trimText(`${chineseName || ''} 详情图`, 255)
    }
  ];

  await connection.query(
    `
      DELETE pm
      FROM plant_media pm
      INNER JOIN media_assets ma ON ma.id = pm.media_asset_id
      WHERE pm.plant_id = ?
        AND ma.object_key LIKE 'plants/standardized/%'
        AND pm.media_asset_id NOT IN (?, ?)
    `,
    [plantId, coverAssetId, detailAssetId]
  );

  for (const item of desired) {
    await connection.query(
      `
        INSERT INTO plant_media (plant_id, media_asset_id, sort_order, caption)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          sort_order = VALUES(sort_order),
          caption = VALUES(caption)
      `,
      [plantId, item.assetId, item.sortOrder, item.caption]
    );
  }
}

async function processPlant(pool, http, plant) {
  const slug = slugify(plant.scientific_name);
  const publicDir = path.join(STANDARDIZED_ROOT_DIR, slug);
  const publicBaseUrl = `/images/plants/standardized/${slug}`;
  const plantTmpDir = path.join(TMP_DIR, slug);

  ensureDir(publicDir);
  ensureDir(plantTmpDir);

  const source = await materializeSourceImage(http, plant, plantTmpDir);
  await runVariantResize(source.sourcePath, publicDir);

  const coverPath = path.join(publicDir, 'cover.jpg');
  const detailPath = path.join(publicDir, 'detail.jpg');
  const thumbPath = path.join(publicDir, 'thumb.jpg');

  const coverInfo = fileStatWithKnownSize(coverPath, 800, 600);
  const detailInfo = fileStatWithKnownSize(detailPath, 1200, 800);
  const thumbInfo = fileStatWithKnownSize(thumbPath, 300, 200);

  if (options.dryRun) {
    return {
      plantId: plant.id,
      scientificName: plant.scientific_name,
      chineseName: plant.chinese_name,
      slug,
      sourceType: source.sourceType,
      coverUrl: `${publicBaseUrl}/cover.jpg`,
      detailUrl: `${publicBaseUrl}/detail.jpg`,
      thumbUrl: `${publicBaseUrl}/thumb.jpg`,
      coverBytes: coverInfo.bytes,
      detailBytes: detailInfo.bytes,
      thumbBytes: thumbInfo.bytes
    };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const coverAssetId = await upsertMediaRecord(connection, {
      storageProvider: 'local-public',
      objectKey: `plants/standardized/${slug}/cover.jpg`,
      url: `${publicBaseUrl}/cover.jpg`,
      width: coverInfo.width,
      height: coverInfo.height,
      metadata: {
        role: 'cover',
        plant_id: plant.id,
        scientific_name: plant.scientific_name,
        chinese_name: plant.chinese_name,
        source_url: source.originalUrl,
        generated_at: shanghaiNow().timestamp,
        bytes: coverInfo.bytes
      }
    });

    const detailAssetId = await upsertMediaRecord(connection, {
      storageProvider: 'local-public',
      objectKey: `plants/standardized/${slug}/detail.jpg`,
      url: `${publicBaseUrl}/detail.jpg`,
      width: detailInfo.width,
      height: detailInfo.height,
      metadata: {
        role: 'detail',
        plant_id: plant.id,
        scientific_name: plant.scientific_name,
        chinese_name: plant.chinese_name,
        source_url: source.originalUrl,
        generated_at: shanghaiNow().timestamp,
        bytes: detailInfo.bytes
      }
    });

    await upsertMediaRecord(connection, {
      storageProvider: 'local-public',
      objectKey: `plants/standardized/${slug}/thumb.jpg`,
      url: `${publicBaseUrl}/thumb.jpg`,
      width: thumbInfo.width,
      height: thumbInfo.height,
      metadata: {
        role: 'thumb',
        plant_id: plant.id,
        scientific_name: plant.scientific_name,
        chinese_name: plant.chinese_name,
        source_url: source.originalUrl,
        generated_at: shanghaiNow().timestamp,
        bytes: thumbInfo.bytes
      }
    });

    await connection.query(
      'UPDATE plants SET cover_image = ? WHERE id = ?',
      [`${publicBaseUrl}/cover.jpg`, plant.id]
    );

    await syncPlantMedia(connection, plant.id, coverAssetId, detailAssetId, plant.chinese_name);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    plantId: plant.id,
    scientificName: plant.scientific_name,
    chineseName: plant.chinese_name,
    slug,
    sourceType: source.sourceType,
    coverUrl: `${publicBaseUrl}/cover.jpg`,
    detailUrl: `${publicBaseUrl}/detail.jpg`,
    thumbUrl: `${publicBaseUrl}/thumb.jpg`,
    coverBytes: coverInfo.bytes,
    detailBytes: detailInfo.bytes,
    thumbBytes: thumbInfo.bytes
  };
}

function buildReport({ before, after, selectedCount, successRows, skippedRows, failedRows }) {
  const { day, timestamp } = shanghaiNow();
  const lines = [
    '# Common Plant Image Standardization Report',
    '',
    `- Generated at: ${timestamp} (Asia/Shanghai)`,
    `- Run date: ${day}`,
    `- Script: \`backend/scripts/standardize-common-plant-images.js\``,
    `- Options: limit=${options.limit}, startId=${options.startId}, delayMs=${options.delayMs}, timeoutMs=${options.timeoutMs}, dryRun=${options.dryRun}, force=${options.force}, ids=${options.ids.join(',') || 'all'}`,
    '',
    '## Scope',
    '',
    '- Target set: plants with mapped Chinese names and non-placeholder real cover images.',
    '- Goal: move available source images into managed local assets and produce standardized cover/detail/thumb variants.',
    '- Variant output:',
    '- `cover.jpg`: 800x600 JPEG',
    '- `detail.jpg`: 1200x800 JPEG',
    '- `thumb.jpg`: 300x200 JPEG',
    '',
    '## Coverage Snapshot',
    '',
    `- Before run: mapped=${before.mappedTotal}, standardized=${before.standardizedCoverCount}, remote=${before.remoteCoverCount}, placeholder=${before.placeholderCount}`,
    `- After run: mapped=${after.mappedTotal}, standardized=${after.standardizedCoverCount}, remote=${after.remoteCoverCount}, placeholder=${after.placeholderCount}`,
    `- Candidates selected in this run: ${selectedCount}`,
    `- Successful standardizations: ${successRows.length}`,
    `- Skipped: ${skippedRows.length}`,
    `- Failed: ${failedRows.length}`,
    '',
    '## Compliance Notes',
    '',
    '- This pipeline now guarantees local managed cover images for processed plants.',
    '- It standardizes the three requested usage sizes, but currently outputs JPEG rather than WebP.',
    '- It does not yet guarantee 3-5 distinct source photos per plant; current output is one source image transformed into multiple usage variants.',
    '',
    '## Successful Samples',
    ''
  ];

  if (!successRows.length) {
    lines.push('- No successful rows in this run.');
  } else {
    for (const row of successRows.slice(0, 20)) {
      lines.push(`- ${row.scientificName} / ${row.chineseName}: ${row.coverUrl} (${row.coverBytes} bytes)`);
    }
  }

  lines.push('', '## Failures', '');
  if (!failedRows.length) {
    lines.push('- No failed rows in this run.');
  } else {
    for (const row of failedRows.slice(0, 20)) {
      lines.push(`- ${row.scientificName} / ${row.chineseName}: ${row.error}`);
    }
  }

  lines.push('', '## Skipped', '');
  if (!skippedRows.length) {
    lines.push('- No skipped rows in this run.');
  } else {
    for (const row of skippedRows.slice(0, 20)) {
      lines.push(`- ${row.scientificName} / ${row.chineseName}: ${row.reason}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  ensureDir(OUTPUT_DIR);
  ensureDir(STANDARDIZED_ROOT_DIR);
  ensureDir(TMP_DIR);

  const pool = mysql.createPool(dbConfig);
  const http = axios.create({
    timeout: options.timeoutMs,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'ZhishiPlantSystemImageStandardizer/1.0'
    }
  });

  const before = await getCoverageSnapshot(pool);
  const selected = await selectCandidatePlants(pool);
  const successRows = [];
  const failedRows = [];
  const skippedRows = [];

  for (const plant of selected) {
    try {
      const result = await processPlant(pool, http, plant);
      successRows.push(result);
      console.log(`OK ${plant.id} ${plant.scientific_name} -> ${result.coverUrl}`);
    } catch (error) {
      failedRows.push({
        scientificName: plant.scientific_name,
        chineseName: plant.chinese_name,
        error: trimText(error.message, 400)
      });
      console.error(`FAIL ${plant.id} ${plant.scientific_name}: ${error.message}`);
    }

    if (options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }

  const after = await getCoverageSnapshot(pool);
  fs.writeFileSync(
    REPORT_PATH,
    buildReport({
      before,
      after,
      selectedCount: selected.length,
      successRows,
      skippedRows,
      failedRows
    }),
    'utf8'
  );

  await pool.end();

  console.log(`Report written to ${REPORT_PATH}`);
  console.log(JSON.stringify({
    selected: selected.length,
    success: successRows.length,
    skipped: skippedRows.length,
    failed: failedRows.length,
    before,
    after
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
