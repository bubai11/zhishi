const fs = require('fs');
const path = require('path');
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

function normalizeStem(fileName) {
  return path.parse(fileName).name.toLowerCase();
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const files = fs.existsSync(IMAGE_ROOT) ? fs.readdirSync(IMAGE_ROOT) : [];
    const [plants] = await conn.query('SELECT id, scientific_name, chinese_name FROM plants');
    const byStem = new Map(files.map((file) => [normalizeStem(file), file]));

    for (const plant of plants) {
      const scientificStem = normalizeStem(String(plant.scientific_name || '').replace(/[^a-z0-9]+/gi, '-'));
      const chineseStem = normalizeStem(String(plant.chinese_name || '').replace(/[^\w]+/gi, '-'));
      const matchedFile = byStem.get(scientificStem) || byStem.get(chineseStem);
      if (!matchedFile) continue;

      const publicUrl = `${BASE_PUBLIC_URL}/${matchedFile}`;
      await conn.query('UPDATE plants SET cover_image = ? WHERE id = ?', [publicUrl, plant.id]);

      const [existingRows] = await conn.query('SELECT id FROM media_assets WHERE url = ? LIMIT 1', [publicUrl]);
      let mediaAssetId = existingRows[0]?.id;

      if (!mediaAssetId) {
        const [insertResult] = await conn.query(
          `
            INSERT INTO media_assets (kind, storage_provider, object_key, url)
            VALUES ('image', 'local', ?, ?)
          `,
          [matchedFile, publicUrl]
        );
        mediaAssetId = insertResult.insertId;
      }

      await conn.query(
        `
          INSERT IGNORE INTO plant_media (plant_id, media_asset_id, sort_order)
          VALUES (?, ?, 0)
        `,
        [plant.id, mediaAssetId]
      );
    }
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('import-plant-images failed:', error.message);
  process.exitCode = 1;
});
