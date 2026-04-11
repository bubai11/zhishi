const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const {
  assignUnresolvedFamilies,
  ensureStandardHierarchy,
  repairMappedFamilyParents
} = require('./lib/taxonomyHierarchy');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
  multipleStatements: true
};

const DIST_CHUNK_SIZE = Number(process.env.WCVP_DIST_CHUNK_SIZE || 100000);

async function ensureIndexes(connection) {
  const statements = [
    'CREATE INDEX idx_stg_dist_locality ON stg_wcvp_distribution(plant_locality_id)',
    'CREATE INDEX idx_stg_dist_name_area ON stg_wcvp_distribution(plant_name_id, area_code_l3)',
    'CREATE INDEX idx_stg_name_name_status ON stg_wcvp_names(plant_name_id, taxon_status)',
    'CREATE INDEX idx_stg_name_taxon_name ON stg_wcvp_names(taxon_name)',
    'CREATE INDEX idx_stg_name_family_genus ON stg_wcvp_names(family, genus)',
    'CREATE INDEX idx_plants_sci_name ON plants(scientific_name)',
    'CREATE INDEX idx_taxa_rank_name_parent ON taxa(taxon_rank, scientific_name, parent_id)',
    'CREATE INDEX idx_taxa_parent ON taxa(parent_id)'
  ];

  for (const sql of statements) {
    try {
      await connection.query(sql);
    } catch (err) {
      if (!String(err.message || '').includes('Duplicate key name')) {
        throw err;
      }
    }
  }
}

async function ensureNameToPlantMap(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS stg_wcvp_name_to_plant (
      plant_name_id VARCHAR(50) PRIMARY KEY,
      accepted_plant_name_id VARCHAR(50) NULL,
      mapped_scientific_name VARCHAR(255) NOT NULL,
      plant_id INT NOT NULL,
      taxon_id INT NULL,
      INDEX idx_map_plant_id (plant_id),
      INDEX idx_map_taxon_id (taxon_id),
      INDEX idx_map_scientific_name (mapped_scientific_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await connection.query('TRUNCATE TABLE stg_wcvp_name_to_plant');

  await connection.query(`
    INSERT INTO stg_wcvp_name_to_plant (
      plant_name_id,
      accepted_plant_name_id,
      mapped_scientific_name,
      plant_id,
      taxon_id
    )
    SELECT
      n.plant_name_id,
      MAX(n.accepted_plant_name_id) AS accepted_plant_name_id,
      MAX(
        CASE
          WHEN LOWER(n.taxon_status) = 'accepted' THEN n.taxon_name
          ELSE COALESCE(na.taxon_name, n.taxon_name)
        END
      ) AS mapped_scientific_name,
      MIN(p.id) AS plant_id,
      MIN(p.taxon_id) AS taxon_id
    FROM stg_wcvp_names n
    LEFT JOIN stg_wcvp_names na ON na.plant_name_id = n.accepted_plant_name_id
    INNER JOIN plants p
      ON p.scientific_name = (
        CASE
          WHEN LOWER(n.taxon_status) = 'accepted' THEN n.taxon_name
          ELSE COALESCE(na.taxon_name, n.taxon_name)
        END
      )
    WHERE n.plant_name_id IS NOT NULL
      AND n.plant_name_id <> ''
    GROUP BY n.plant_name_id
  `);
}

async function fillDistributions(connection) {
  const [rangeRows] = await connection.query(`
    SELECT MIN(plant_locality_id) AS min_id, MAX(plant_locality_id) AS max_id
    FROM stg_wcvp_distribution
    WHERE area_code_l3 IS NOT NULL AND area_code_l3 <> ''
  `);

  const minId = Number(rangeRows[0]?.min_id || 0);
  const maxId = Number(rangeRows[0]?.max_id || 0);
  if (!minId || !maxId) {
    return;
  }

  let start = minId;
  while (start <= maxId) {
    const end = Math.min(start + DIST_CHUNK_SIZE - 1, maxId);

    await connection.query(
      `
      INSERT INTO plant_distributions (
        plant_id, taxon_id, wcvp_plant_name_id, scientific_name,
        area_code_l1, area_code_l2, area_code_l3,
        area_name, continent, country_code,
        occurrence_status, introduced, extinct, data_source
      )
      SELECT
        m.plant_id,
        m.taxon_id,
        d.plant_name_id,
        m.mapped_scientific_name,
        d.continent_code_l1,
        d.region_code_l2,
        d.area_code_l3,
        d.area_name_l3,
        d.continent,
        NULL,
        CASE
          WHEN d.location_doubtful = 1 THEN 'doubtful'
          WHEN d.extinct = 1 THEN 'extinct'
          WHEN d.introduced = 1 THEN 'introduced'
          ELSE 'native'
        END AS occurrence_status,
        d.introduced,
        d.extinct,
        'WCVP'
      FROM stg_wcvp_distribution d
      INNER JOIN stg_wcvp_name_to_plant m ON m.plant_name_id = d.plant_name_id
      WHERE d.plant_locality_id BETWEEN ? AND ?
        AND d.area_code_l3 IS NOT NULL AND d.area_code_l3 <> ''
      ON DUPLICATE KEY UPDATE
        area_name = VALUES(area_name),
        continent = VALUES(continent),
        introduced = VALUES(introduced),
        extinct = VALUES(extinct),
        occurrence_status = VALUES(occurrence_status)
      `,
      [start, end]
    );

    console.log(`分布写入完成: ${start} - ${end}`);
    start = end + 1;
  }
}

async function ensureTaxonomyHierarchy(connection) {
  const { unresolvedOrderId } = await ensureStandardHierarchy(connection);

  await connection.query(
    `
      INSERT INTO taxa (taxon_rank, parent_id, scientific_name, common_name, chinese_name, created_at, updated_at)
      SELECT
        'family',
        ?,
        n.family,
        n.family,
        NULL,
        NOW(),
        NOW()
      FROM (
        SELECT DISTINCT family
        FROM stg_wcvp_names
        WHERE LOWER(taxon_rank) = 'species'
          AND LOWER(taxon_status) = 'accepted'
          AND family IS NOT NULL AND family <> ''
      ) n
      LEFT JOIN taxa f
        ON f.taxon_rank = 'family' AND f.scientific_name = n.family
      WHERE f.id IS NULL
    `,
    [unresolvedOrderId]
  );

  await connection.query(`
    INSERT INTO taxa (taxon_rank, parent_id, scientific_name, common_name, chinese_name, created_at, updated_at)
    SELECT
      'genus',
      f.id,
      n.genus,
      n.genus,
      NULL,
      NOW(),
      NOW()
    FROM (
      SELECT DISTINCT genus, family
      FROM stg_wcvp_names
      WHERE LOWER(taxon_rank) = 'species'
        AND LOWER(taxon_status) = 'accepted'
        AND genus IS NOT NULL AND genus <> ''
        AND family IS NOT NULL AND family <> ''
    ) n
    INNER JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = n.family
    LEFT JOIN taxa g
      ON g.taxon_rank = 'genus' AND g.scientific_name = n.genus AND g.parent_id = f.id
    WHERE g.id IS NULL
  `);

  await repairMappedFamilyParents(connection);
  await assignUnresolvedFamilies(connection, unresolvedOrderId);

  await connection.query(`
    UPDATE taxa s
    INNER JOIN stg_wcvp_names n
      ON LOWER(n.taxon_rank) = 'species'
      AND LOWER(n.taxon_status) = 'accepted'
      AND n.taxon_name = s.scientific_name
    INNER JOIN taxa f
      ON f.taxon_rank = 'family' AND f.scientific_name = n.family
    INNER JOIN taxa g
      ON g.taxon_rank = 'genus' AND g.scientific_name = n.genus AND g.parent_id = f.id
    SET s.parent_id = g.id
    WHERE s.taxon_rank = 'species'
      AND g.id IS NOT NULL
      AND (s.parent_id IS NULL OR s.parent_id <> g.id)
  `);

  await connection.query(`
    UPDATE plants p
    INNER JOIN taxa s ON s.taxon_rank = 'species' AND s.scientific_name = p.scientific_name
    SET p.taxon_id = s.id
    WHERE p.taxon_id IS NULL OR p.taxon_id <> s.id
  `);
}

async function fillTaxonomyStatistics(connection) {
  await connection.query('TRUNCATE TABLE taxonomy_statistics');

  await connection.query(`
    INSERT INTO taxonomy_statistics (
      taxon_id,
      total_species,
      total_genera,
      total_families,
      child_taxa_count,
      known_ratio,
      global_rank,
      endemic_species,
      threatened_species,
      new_species_5y,
      protected_area_coverage,
      habitat_diversity_score
    )
    SELECT
      t.id AS taxon_id,
      SUM(CASE WHEN d.species_rank = 'species' THEN 1 ELSE 0 END) AS total_species,
      SUM(CASE WHEN d.species_rank = 'genus' THEN 1 ELSE 0 END) AS total_genera,
      SUM(CASE WHEN d.species_rank = 'family' THEN 1 ELSE 0 END) AS total_families,
      (
        SELECT COUNT(*)
        FROM taxa child
        WHERE child.parent_id = t.id
      ) AS child_taxa_count,
      0 AS known_ratio,
      NULL AS global_rank,
      0 AS endemic_species,
      0 AS threatened_species,
      0 AS new_species_5y,
      0 AS protected_area_coverage,
      0 AS habitat_diversity_score
    FROM taxa t
    LEFT JOIN (
      SELECT id, parent_id, taxon_rank AS species_rank
      FROM taxa
    ) d ON d.parent_id = t.id
    GROUP BY t.id
  `);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log(`目标数据库: ${dbConfig.database}`);
    await ensureIndexes(connection);
    await ensureNameToPlantMap(connection);
    await fillDistributions(connection);
    await ensureTaxonomyHierarchy(connection);
    await fillTaxonomyStatistics(connection);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('fill-wcvp-taxonomy 失败:', err.message);
  if (err && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
