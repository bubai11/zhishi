const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Jimp } = require('jimp');
const sequelizeConfig = require('../config/config').development;

const FRONTEND_PUBLIC_DIR = path.join(__dirname, '..', '..', 'frontend-aistudio', 'public');
const PLACEHOLDER_DIR = path.join(FRONTEND_PUBLIC_DIR, 'images', 'plants', 'placeholder');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'ai-output');
const REPORT_PATH = path.join(OUTPUT_DIR, 'placeholder-localization-report.md');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  waitForConnections: true,
  connectionLimit: 4,
  queueLimit: 0
};

const CATEGORY_MAP = {
  Uncategorized: { slug: 'uncategorized', bg: '#3f8f6b', accent: '#dcefe4', shade: '#2a5e49' },
  Tropical: { slug: 'tropical', bg: '#0f766e', accent: '#d7f4ef', shade: '#0a4f49' },
  Temperate: { slug: 'temperate', bg: '#567c4d', accent: '#eef5dc', shade: '#334c2e' },
  Arid: { slug: 'arid', bg: '#b7791f', accent: '#fff1cf', shade: '#7b4d0f' },
  Aquatic: { slug: 'aquatic', bg: '#2563eb', accent: '#dbeafe', shade: '#173c91' },
  default: { slug: 'generic', bg: '#4b5563', accent: '#f3f4f6', shade: '#1f2937' }
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function placeholderWhereClause() {
  return `
    cover_image LIKE '%placehold.co/%'
    OR cover_image LIKE '%via.placeholder.com/%'
    OR cover_image LIKE '%source.unsplash.com/%'
    OR cover_image LIKE '%images.unsplash.com/photo-1501004318641-b39e6451bec6%'
    OR cover_image LIKE '/images/plants/placeholder%'
  `;
}

function hexToInt(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  if (clean.length !== 6) {
    throw new Error(`Unsupported color value: ${hex}`);
  }

  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);

  return ((((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | 255) >>> 0);
}

function fillRect(image, x, y, w, h, color) {
  const maxX = Math.min(image.bitmap.width, x + w);
  const maxY = Math.min(image.bitmap.height, y + h);
  for (let px = Math.max(0, x); px < maxX; px += 1) {
    for (let py = Math.max(0, y); py < maxY; py += 1) {
      image.setPixelColor(color, px, py);
    }
  }
}

function drawCircle(image, centerX, centerY, radius, color) {
  for (let x = centerX - radius; x <= centerX + radius; x += 1) {
    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      if (x < 0 || y < 0 || x >= image.bitmap.width || y >= image.bitmap.height) continue;
      const dx = x - centerX;
      const dy = y - centerY;
      if ((dx * dx) + (dy * dy) <= radius * radius) {
        image.setPixelColor(color, x, y);
      }
    }
  }
}

async function generatePlaceholderImage(config) {
  const image = new Jimp({ width: 800, height: 600, color: hexToInt(config.bg) });
  const accent = hexToInt(config.accent);
  const shade = hexToInt(config.shade);

  fillRect(image, 0, 440, 800, 160, shade);
  fillRect(image, 60, 90, 680, 26, accent);
  fillRect(image, 120, 145, 520, 18, accent);
  fillRect(image, 120, 175, 440, 18, accent);
  drawCircle(image, 160, 430, 110, accent);
  drawCircle(image, 345, 360, 70, shade);
  drawCircle(image, 560, 395, 120, accent);
  drawCircle(image, 680, 210, 65, shade);
  fillRect(image, 315, 235, 22, 220, accent);
  fillRect(image, 310, 225, 110, 22, accent);
  fillRect(image, 235, 295, 110, 20, accent);
  fillRect(image, 330, 295, 115, 20, accent);
  fillRect(image, 275, 365, 55, 18, accent);
  fillRect(image, 330, 365, 58, 18, accent);

  return image;
}

async function writePlaceholderAssets() {
  ensureDir(PLACEHOLDER_DIR);
  const written = [];

  for (const [category, config] of Object.entries(CATEGORY_MAP)) {
    if (category === 'default') continue;
    const image = await generatePlaceholderImage(config);
    const filePath = path.join(PLACEHOLDER_DIR, `${config.slug}.jpg`);
    await image.write(filePath, { quality: 86 });
    written.push({ category, slug: config.slug, filePath, publicUrl: `/images/plants/placeholder/${config.slug}.jpg` });
  }

  const generic = await generatePlaceholderImage(CATEGORY_MAP.default);
  const genericPath = path.join(PLACEHOLDER_DIR, `${CATEGORY_MAP.default.slug}.jpg`);
  await generic.write(genericPath, { quality: 86 });
  written.push({ category: 'default', slug: CATEGORY_MAP.default.slug, filePath: genericPath, publicUrl: `/images/plants/placeholder/${CATEGORY_MAP.default.slug}.jpg` });

  return written;
}

function resolvePublicUrl(category) {
  const config = CATEGORY_MAP[category] || CATEGORY_MAP.default;
  return `/images/plants/placeholder/${config.slug}.jpg`;
}

async function getStats(pool) {
  const [[summary]] = await pool.query(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN cover_image IS NOT NULL AND cover_image <> '' THEN 1 ELSE 0 END) AS with_cover,
        SUM(CASE WHEN cover_image LIKE '/images/plants/standardized/%' THEN 1 ELSE 0 END) AS standardized,
        SUM(CASE WHEN cover_image LIKE 'http%' THEN 1 ELSE 0 END) AS remote_real,
        SUM(CASE WHEN ${placeholderWhereClause()} THEN 1 ELSE 0 END) AS placeholders,
        SUM(CASE WHEN cover_image LIKE '/images/plants/placeholder/%' THEN 1 ELSE 0 END) AS local_placeholders
      FROM plants
    `
  );

  return {
    total: Number(summary.total || 0),
    withCover: Number(summary.with_cover || 0),
    standardized: Number(summary.standardized || 0),
    remoteReal: Number(summary.remote_real || 0),
    placeholders: Number(summary.placeholders || 0),
    localPlaceholders: Number(summary.local_placeholders || 0)
  };
}

async function localizePlaceholders(pool) {
  const categories = Object.keys(CATEGORY_MAP).filter((key) => key !== 'default');
  const perCategory = [];
  let totalUpdated = 0;

  for (const category of categories) {
    const publicUrl = resolvePublicUrl(category);
    const [result] = await pool.query(
      `
        UPDATE plants
        SET cover_image = ?
        WHERE category = ?
          AND (${placeholderWhereClause()})
      `,
      [publicUrl, category]
    );

    totalUpdated += Number(result.affectedRows || 0);
    perCategory.push({ category, publicUrl, updated: Number(result.affectedRows || 0) });
  }

  const fallbackUrl = resolvePublicUrl('default');
  const categoryPlaceholders = categories.map(() => '?').join(', ');
  const [fallbackResult] = await pool.query(
    `
      UPDATE plants
      SET cover_image = ?
      WHERE (${placeholderWhereClause()})
        AND (category IS NULL OR category NOT IN (${categoryPlaceholders}))
    `,
    [fallbackUrl, ...categories]
  );

  totalUpdated += Number(fallbackResult.affectedRows || 0);
  perCategory.push({ category: 'default', publicUrl: fallbackUrl, updated: Number(fallbackResult.affectedRows || 0) });

  return { totalUpdated, perCategory };
}

function buildReport(before, after, assetRows, updateStats) {
  const lines = [
    '# Placeholder Localization Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Total plants: ${before.total}`,
    `- Plants with cover_image before: ${before.withCover}`,
    `- Placeholder covers before: ${before.placeholders}`,
    `- Local placeholder covers before: ${before.localPlaceholders}`,
    `- Standardized real covers before: ${before.standardized}`,
    `- Remote real covers before: ${before.remoteReal}`,
    `- Updated rows in this run: ${updateStats.totalUpdated}`,
    `- Placeholder covers after: ${after.placeholders}`,
    `- Local placeholder covers after: ${after.localPlaceholders}`,
    '',
    '## Generated Assets',
    '',
    ...assetRows.map((row) => `- ${row.category}: ${row.publicUrl}`),
    '',
    '## Update Breakdown',
    '',
    ...updateStats.perCategory.map((row) => `- ${row.category}: ${row.updated} -> ${row.publicUrl}`),
    ''
  ];

  return `${lines.join('\n')}\n`;
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const pool = mysql.createPool(dbConfig);

  const before = await getStats(pool);
  const assetRows = await writePlaceholderAssets();
  const updateStats = await localizePlaceholders(pool);
  const after = await getStats(pool);

  fs.writeFileSync(REPORT_PATH, buildReport(before, after, assetRows, updateStats), 'utf8');

  console.log(JSON.stringify({
    before,
    after,
    updated: updateStats.totalUpdated,
    report: REPORT_PATH
  }, null, 2));

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
