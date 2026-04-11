const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const IMAGE_ROOT = path.join(__dirname, '..', '..', 'frontend-aistudio', 'public', 'images', 'plants');
const BASE_PUBLIC_URL = '/images/plants';
const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const startIdArg = args.find((arg) => arg.startsWith('--start-id='));
const shouldResume = args.includes('--resume');
const placeholderOnly = args.includes('--placeholder-only');
const batchLimit = Number(limitArg?.split('=')[1] || 100);
const startId = Number(startIdArg?.split('=')[1] || 0);

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchIPlantImages(scientificName) {
  const url = `http://www.iplant.cn/api/sp/sci/${encodeURIComponent(scientificName)}`;
  const response = await axios.get(url, { timeout: 10000 });
  const images = response.data?.images || response.data?.data?.images || [];
  return images
    .map((item) => item.url || item.img || item.image)
    .filter(Boolean);
}

function buildFallbackUrl(plant) {
  const query = encodeURIComponent(`${plant.scientific_name || ''} plant`);
  return `https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80&plant-query=${query}`;
}

function buildPlaceholderUrl(plant) {
  const familyColors = {
    Rosaceae: 'd97706',
    Orchidaceae: '0f766e',
    Pinaceae: '166534',
    Fabaceae: '65a30d',
    Asteraceae: 'ca8a04'
  };
  const hex = familyColors[plant.wcvp_family] || '3f8f6b';
  const label = encodeURIComponent(plant.chinese_name || plant.scientific_name || `Plant ${plant.id}`);
  return `https://placehold.co/800x600/${hex}/ffffff?text=${label}`;
}

async function downloadImage(url, outputPath) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, response.data);
}

async function upsertMedia(conn, plantId, coverUrl, imageUrls) {
  await conn.query('UPDATE plants SET cover_image = ? WHERE id = ?', [coverUrl, plantId]);

  for (const [index, imageUrl] of imageUrls.entries()) {
    const [existingRows] = await conn.query('SELECT id FROM media_assets WHERE url = ? LIMIT 1', [imageUrl]);
    let mediaAssetId = existingRows[0]?.id;

    if (!mediaAssetId) {
      const [insertResult] = await conn.query(
        `
          INSERT INTO media_assets (kind, storage_provider, object_key, url)
          VALUES ('image', 'local', ?, ?)
        `,
        [`plant-${plantId}-${index + 1}`, imageUrl]
      );
      mediaAssetId = insertResult.insertId;
    }

    await conn.query(
      `
        INSERT IGNORE INTO plant_media (plant_id, media_asset_id, sort_order)
        VALUES (?, ?, ?)
      `,
      [plantId, mediaAssetId, index]
    );
  }
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const [plants] = await conn.query(`
      SELECT id, chinese_name, scientific_name, wcvp_family
      FROM plants
      WHERE (cover_image IS NULL OR cover_image = '')
        AND id >= ?
      ORDER BY (CASE WHEN chinese_name IS NOT NULL AND chinese_name <> '' THEN 0 ELSE 1 END), id ASC
      LIMIT ?
    `, [startId, batchLimit]);

    if (shouldResume) {
      console.log('resume mode enabled');
    }
    if (placeholderOnly) {
      console.log('placeholder-only mode enabled');
    }
    if (startId > 0) {
      console.log(`start-id: ${startId}`);
    }

    let updatedCount = 0;

    for (const plant of plants) {
      const slug = slugify(plant.scientific_name || plant.chinese_name || `plant-${plant.id}`);
      const localPath = path.join(IMAGE_ROOT, `${slug}.jpg`);
      const publicUrl = `${BASE_PUBLIC_URL}/${slug}.jpg`;
      const placeholderUrl = buildPlaceholderUrl(plant);

      let candidateUrls = [];
      if (!placeholderOnly) {
        try {
          candidateUrls = await fetchIPlantImages(plant.scientific_name);
        } catch (error) {
          candidateUrls = [];
        }

        if (!candidateUrls.length) {
          candidateUrls = [buildFallbackUrl(plant)];
        }
      }

      try {
        if (placeholderOnly) {
          await upsertMedia(conn, plant.id, placeholderUrl, [placeholderUrl]);
        } else {
          await downloadImage(candidateUrls[0], localPath);
          await upsertMedia(conn, plant.id, publicUrl, [publicUrl]);
        }
        updatedCount += 1;
        if (updatedCount <= 10 || updatedCount % 1000 === 0) {
          console.log(`updated ${plant.id} ${plant.scientific_name} (${updatedCount}/${plants.length})`);
        }
      } catch (error) {
        try {
          await upsertMedia(conn, plant.id, placeholderUrl, [placeholderUrl]);
          updatedCount += 1;
          if (updatedCount <= 10 || updatedCount % 1000 === 0) {
            console.log(`placeholder ${plant.id} ${plant.scientific_name} (${updatedCount}/${plants.length})`);
          }
        } catch (fallbackError) {
          console.error(`failed ${plant.id} ${plant.scientific_name}: ${fallbackError.message}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('populate-plant-images failed:', error.message);
  process.exitCode = 1;
});
