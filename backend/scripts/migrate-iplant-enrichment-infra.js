const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.execute(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function ensurePlantDetailTracking(conn) {
  const additions = [
    ['data_source', "ALTER TABLE plant_detail ADD COLUMN data_source VARCHAR(50) NULL AFTER extra"],
    ['source_url', "ALTER TABLE plant_detail ADD COLUMN source_url VARCHAR(255) NULL AFTER data_source"],
    ['fetched_at', "ALTER TABLE plant_detail ADD COLUMN fetched_at DATETIME NULL AFTER source_url"]
  ];

  for (const [column, sql] of additions) {
    if (!(await hasColumn(conn, 'plant_detail', column))) {
      await conn.execute(sql);
    }
  }
}

async function ensurePlantExternalSources(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS plant_external_sources (
      id INT NOT NULL AUTO_INCREMENT,
      plant_id INT NULL,
      taxon_id INT NULL,
      provider VARCHAR(50) NOT NULL,
      source_type VARCHAR(50) NOT NULL DEFAULT 'info_page',
      external_id VARCHAR(100),
      canonical_scientific_name VARCHAR(200),
      chinese_name VARCHAR(100),
      source_url VARCHAR(255) NOT NULL,
      fetch_status ENUM('success', 'missing', 'error') NOT NULL DEFAULT 'success',
      error_message VARCHAR(500),
      payload_json JSON,
      fetched_at DATETIME,
      last_success_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_plant_provider_type (plant_id, provider, source_type),
      INDEX idx_taxon_provider (taxon_id, provider),
      INDEX idx_provider_status (provider, fetch_status),
      CONSTRAINT fk_plant_external_sources_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
      CONSTRAINT fk_plant_external_sources_taxon FOREIGN KEY (taxon_id) REFERENCES taxa(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensurePlantSynonyms(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS plant_synonyms (
      id INT NOT NULL AUTO_INCREMENT,
      plant_id INT NULL,
      taxon_id INT NULL,
      accepted_scientific_name VARCHAR(200) NOT NULL,
      synonym_name VARCHAR(200) NOT NULL,
      synonym_type VARCHAR(50) NOT NULL DEFAULT 'synonym',
      language_code VARCHAR(20),
      source_provider VARCHAR(50) NOT NULL DEFAULT 'iplant',
      source_url VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uk_accepted_synonym_source (accepted_scientific_name, synonym_name, source_provider),
      INDEX idx_plant (plant_id),
      INDEX idx_taxon (taxon_id),
      INDEX idx_synonym_type (synonym_type),
      CONSTRAINT fk_plant_synonyms_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
      CONSTRAINT fk_plant_synonyms_taxon FOREIGN KEY (taxon_id) REFERENCES taxa(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    console.log(`iPlant enrichment migration target DB: ${dbConfig.database}`);
    await ensurePlantDetailTracking(conn);
    await ensurePlantExternalSources(conn);
    await ensurePlantSynonyms(conn);
    console.log('iPlant enrichment migration completed.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('iPlant enrichment migration failed:', err.message);
  process.exitCode = 1;
});
