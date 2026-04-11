const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.query(`
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  `, [tableName, columnName]);
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    if (!(await hasColumn(conn, 'plants', 'translation_source'))) {
      await conn.query(`
        ALTER TABLE plants
        ADD COLUMN translation_source VARCHAR(20) NULL AFTER chinese_name
      `);
    }

    if (!(await hasColumn(conn, 'plants', 'translation_confidence'))) {
      await conn.query(`
        ALTER TABLE plants
        ADD COLUMN translation_confidence TINYINT DEFAULT 0 AFTER translation_source
      `);
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS chinese_name_cache (
        id INT NOT NULL AUTO_INCREMENT,
        scientific_name VARCHAR(200) NOT NULL,
        chinese_name VARCHAR(100) NOT NULL,
        source VARCHAR(20) NOT NULL,
        confidence TINYINT DEFAULT 80,
        hit_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_scientific (scientific_name),
        INDEX idx_chinese (chinese_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await conn.query(`
      UPDATE plants
      SET translation_source = COALESCE(translation_source, 'legacy'),
          translation_confidence = CASE
            WHEN COALESCE(translation_confidence, 0) = 0 THEN 100
            ELSE translation_confidence
          END
      WHERE chinese_name REGEXP '[一-龥]'
        AND chinese_name <> scientific_name
        AND (translation_source IS NULL OR translation_source = '')
    `);

    console.log('Chinese name infrastructure migration completed.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Chinese name migration failed:', err.message);
  process.exitCode = 1;
});
