const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const ROOT = path.resolve(__dirname, '..', '..');
const IUCN_DIR = path.join(ROOT, 'data-source', 'iucn-2025-1');
const TAXON_FILE = path.join(IUCN_DIR, 'taxon.txt');
const DISTRIBUTION_FILE = path.join(IUCN_DIR, 'distribution.txt');

const TAXON_BATCH_SIZE = 5000;
const DIST_BATCH_SIZE = 10000;

const CATEGORY_MAP = {
  'EXTINCT': 'EX',
  'EXTINCT IN THE WILD': 'EW',
  'CRITICALLY ENDANGERED': 'CR',
  'ENDANGERED': 'EN',
  'VULNERABLE': 'VU',
  'NEAR THREATENED': 'NT',
  'LEAST CONCERN': 'LC',
  'DATA DEFICIENT': 'DD'
};

const CATEGORY_SEVERITY = {
  EX: 8,
  EW: 7,
  CR: 6,
  EN: 5,
  VU: 4,
  NT: 3,
  LC: 2,
  DD: 1
};

const THREAT_CATEGORIES = new Set(['CR', 'EN', 'VU']);

function normalizeCategory(text) {
  const normalized = String(text || '').trim().toUpperCase();
  return CATEGORY_MAP[normalized] || null;
}

function normalizeScientificName(parts) {
  const genus = String(parts.genus || '').trim();
  const specificEpithet = String(parts.specificEpithet || '').trim();
  const infraspecificEpithet = String(parts.infraspecificEpithet || '').trim();
  const rank = String(parts.taxonRank || '').trim().toLowerCase();

  if (genus && specificEpithet) {
    if (rank && rank !== 'species' && infraspecificEpithet) {
      return `${genus} ${specificEpithet} ${infraspecificEpithet}`.trim();
    }
    return `${genus} ${specificEpithet}`.trim();
  }

  return String(parts.scientificName || '').trim();
}

function extractAssessmentYear(text) {
  const match = String(text || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : null;
}

function determineAlertChangeType(oldCategory, newCategory) {
  if (!oldCategory) {
    return THREAT_CATEGORIES.has(newCategory) ? 'new_addition' : 'new_assessment';
  }

  const oldSeverity = CATEGORY_SEVERITY[oldCategory] || 0;
  const newSeverity = CATEGORY_SEVERITY[newCategory] || 0;

  if (newSeverity > oldSeverity) return 'upgraded';
  if (newSeverity < oldSeverity) return 'downgraded';
  return null;
}

function determineAlertLevel(oldCategory, newCategory, changeType) {
  if (newCategory === 'CR' || changeType === 'upgraded' && (newCategory === 'CR' || newCategory === 'EN')) {
    return 'high';
  }

  if (newCategory === 'EN' || newCategory === 'VU' || changeType === 'new_addition') {
    return 'medium';
  }

  return 'low';
}

function buildAlertReason(scientificName, oldCategory, newCategory, changeType) {
  if (changeType === 'new_assessment') {
    return `${scientificName} 首次进入红色名录评估，当前等级为 ${newCategory}。`;
  }

  if (changeType === 'new_addition') {
    return `${scientificName} 新进入重点受胁关注范围，等级更新为 ${newCategory}。`;
  }

  if (changeType === 'upgraded') {
    return `${scientificName} 风险等级由 ${oldCategory} 升至 ${newCategory}，需要优先关注。`;
  }

  if (changeType === 'downgraded') {
    return `${scientificName} 风险等级由 ${oldCategory} 调整为 ${newCategory}。`;
  }

  return `${scientificName} 红色名录等级更新为 ${newCategory}。`;
}

async function bulkInsert(connection, table, columns, rows) {
  if (!rows.length) return;
  const rowPlaceholder = `(${columns.map(() => '?').join(',')})`;
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${rows.map(() => rowPlaceholder).join(',')}`;
  await connection.query(sql, rows.flat());
}

async function ensureTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS stg_iucn_taxon (
      iucn_id VARCHAR(50) PRIMARY KEY,
      scientific_name VARCHAR(255),
      canonical_scientific_name VARCHAR(255),
      kingdom VARCHAR(50),
      family VARCHAR(120),
      genus VARCHAR(120),
      specific_epithet VARCHAR(120),
      taxon_rank VARCHAR(50),
      taxonomic_status VARCHAR(50),
      assessed_year YEAR NULL,
      bibliographic_citation TEXT,
      iucn_url VARCHAR(255),
      INDEX idx_stg_iucn_taxon_scientific_name (scientific_name),
      INDEX idx_stg_iucn_taxon_canonical_name (canonical_scientific_name),
      INDEX idx_stg_iucn_taxon_family (family)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS stg_iucn_distribution (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      iucn_id VARCHAR(50) NOT NULL,
      establishment_means VARCHAR(100),
      locality VARCHAR(255),
      occurrence_status VARCHAR(100),
      source_text TEXT,
      threat_status VARCHAR(100),
      country_code VARCHAR(10),
      INDEX idx_stg_iucn_distribution_id (iucn_id),
      INDEX idx_stg_iucn_distribution_threat (threat_status),
      INDEX idx_stg_iucn_distribution_country (country_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function clearStagingTables(connection) {
  await connection.query('TRUNCATE TABLE stg_iucn_taxon');
  await connection.query('TRUNCATE TABLE stg_iucn_distribution');
}

async function loadTaxonData(connection) {
  const rl = readline.createInterface({
    input: fs.createReadStream(TAXON_FILE),
    crlfDelay: Infinity
  });

  let total = 0;
  let kept = 0;
  let rows = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    total += 1;

    const [
      iucnId,
      scientificName,
      kingdom,
      _phylum,
      _className,
      _orderName,
      family,
      genus,
      specificEpithet,
      _scientificNameAuthorship,
      taxonRank,
      infraspecificEpithet,
      taxonomicStatus,
      _acceptedNameUsageID,
      bibliographicCitation,
      referencesUrl
    ] = line.split('\t');

    if (String(kingdom || '').toUpperCase() !== 'PLANTAE') continue;
    if (String(taxonomicStatus || '').toLowerCase() !== 'accepted') continue;

    const canonicalScientificName = normalizeScientificName({
      genus,
      specificEpithet,
      infraspecificEpithet,
      taxonRank,
      scientificName
    });

    rows.push([
      iucnId || null,
      scientificName || null,
      canonicalScientificName || null,
      kingdom || null,
      family || null,
      genus || null,
      specificEpithet || null,
      taxonRank || null,
      taxonomicStatus || null,
      extractAssessmentYear(bibliographicCitation),
      bibliographicCitation || null,
      referencesUrl || null
    ]);

    kept += 1;

    if (rows.length >= TAXON_BATCH_SIZE) {
      await bulkInsert(connection, 'stg_iucn_taxon', [
        'iucn_id',
        'scientific_name',
        'canonical_scientific_name',
        'kingdom',
        'family',
        'genus',
        'specific_epithet',
        'taxon_rank',
        'taxonomic_status',
        'assessed_year',
        'bibliographic_citation',
        'iucn_url'
      ], rows);
      rows = [];
    }
  }

  if (rows.length) {
    await bulkInsert(connection, 'stg_iucn_taxon', [
      'iucn_id',
      'scientific_name',
      'canonical_scientific_name',
      'kingdom',
      'family',
      'genus',
      'specific_epithet',
      'taxon_rank',
      'taxonomic_status',
      'assessed_year',
      'bibliographic_citation',
      'iucn_url'
    ], rows);
  }

  return { total, kept };
}

async function loadDistributionData(connection) {
  const rl = readline.createInterface({
    input: fs.createReadStream(DISTRIBUTION_FILE),
    crlfDelay: Infinity
  });

  let total = 0;
  let kept = 0;
  let rows = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    total += 1;

    const [
      iucnId,
      establishmentMeans,
      locality,
      occurrenceStatus,
      sourceText,
      threatStatus,
      countryCode
    ] = line.split('\t');

    const category = normalizeCategory(threatStatus);
    if (!category) continue;

    rows.push([
      iucnId || null,
      establishmentMeans || null,
      locality || null,
      occurrenceStatus || null,
      sourceText || null,
      threatStatus || null,
      countryCode || null
    ]);

    kept += 1;

    if (rows.length >= DIST_BATCH_SIZE) {
      await bulkInsert(connection, 'stg_iucn_distribution', [
        'iucn_id',
        'establishment_means',
        'locality',
        'occurrence_status',
        'source_text',
        'threat_status',
        'country_code'
      ], rows);
      rows = [];
    }
  }

  if (rows.length) {
    await bulkInsert(connection, 'stg_iucn_distribution', [
      'iucn_id',
      'establishment_means',
      'locality',
      'occurrence_status',
      'source_text',
      'threat_status',
      'country_code'
    ], rows);
  }

  return { total, kept };
}

async function ensureTargetTable(connection) {
  const [rows] = await connection.execute(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'threatened_species'
      LIMIT 1
    `
  );

  if (!rows.length) {
    throw new Error('Table threatened_species does not exist. Run npm run migrate:schema:2026-03 first.');
  }
}

async function getPreviousThreatenedSnapshot(connection) {
  const [rows] = await connection.query(`
    SELECT
      id,
      plant_id,
      scientific_name,
      red_list_category
    FROM threatened_species
  `);

  return new Map(rows.map((row) => [row.scientific_name, row]));
}

async function getCurrentThreatenedSnapshot(connection) {
  const [rows] = await connection.query(`
    SELECT
      id,
      plant_id,
      scientific_name,
      red_list_category,
      DATE(COALESCE(last_assessed, assessment_date, CURDATE())) AS alert_month
    FROM threatened_species
    WHERE data_source = 'IUCN 2025-1'
  `);

  return rows;
}

async function upsertThreatenedSpecies(connection) {
  const sql = `
    INSERT INTO threatened_species (
      plant_id,
      taxon_id,
      scientific_name,
      chinese_name,
      red_list_category,
      criteria,
      population_trend,
      assessment_date,
      last_assessed,
      threats,
      conservation_actions,
      habitat,
      range_description,
      iucn_id,
      iucn_url,
      data_source,
      created_at,
      updated_at
    )
    SELECT
      p.id AS plant_id,
      COALESCE(p.taxon_id, tnode.id) AS taxon_id,
      src.canonical_scientific_name,
      p.chinese_name,
      src.red_list_category,
      NULL AS criteria,
      'unknown' AS population_trend,
      CASE
        WHEN src.assessed_year IS NOT NULL THEN STR_TO_DATE(CONCAT(src.assessed_year, '-01-01'), '%Y-%m-%d')
        ELSE NULL
      END AS assessment_date,
      CASE
        WHEN src.assessed_year IS NOT NULL THEN STR_TO_DATE(CONCAT(src.assessed_year, '-01-01'), '%Y-%m-%d')
        ELSE NULL
      END AS last_assessed,
      NULL AS threats,
      NULL AS conservation_actions,
      NULL AS habitat,
      src.range_description,
      src.iucn_id,
      src.iucn_url,
      'IUCN 2025-1' AS data_source,
      NOW(),
      NOW()
    FROM (
      SELECT
        t.iucn_id,
        t.canonical_scientific_name,
        t.assessed_year,
        t.iucn_url,
        CASE
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'EXTINCT' THEN 'EX'
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'EXTINCT IN THE WILD' THEN 'EW'
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'CRITICALLY ENDANGERED' THEN 'CR'
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'ENDANGERED' THEN 'EN'
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'VULNERABLE' THEN 'VU'
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'NEAR THREATENED' THEN 'NT'
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'LEAST CONCERN' THEN 'LC'
          WHEN UPPER(TRIM(MAX(d.threat_status))) = 'DATA DEFICIENT' THEN 'DD'
          ELSE NULL
        END AS red_list_category,
        NULLIF(
          GROUP_CONCAT(DISTINCT NULLIF(TRIM(d.locality), '') ORDER BY d.locality SEPARATOR '; '),
          ''
        ) AS range_description
      FROM stg_iucn_taxon t
      INNER JOIN stg_iucn_distribution d ON d.iucn_id = t.iucn_id
      WHERE t.canonical_scientific_name IS NOT NULL
        AND t.canonical_scientific_name <> ''
      GROUP BY
        t.iucn_id,
        t.canonical_scientific_name,
        t.assessed_year,
        t.iucn_url
    ) src
    LEFT JOIN plants p ON p.scientific_name = src.canonical_scientific_name
    LEFT JOIN taxa tnode ON tnode.scientific_name = src.canonical_scientific_name
    WHERE src.red_list_category IS NOT NULL
    ON DUPLICATE KEY UPDATE
      plant_id = VALUES(plant_id),
      taxon_id = VALUES(taxon_id),
      chinese_name = COALESCE(VALUES(chinese_name), threatened_species.chinese_name),
      red_list_category = VALUES(red_list_category),
      assessment_date = VALUES(assessment_date),
      last_assessed = VALUES(last_assessed),
      range_description = COALESCE(VALUES(range_description), threatened_species.range_description),
      iucn_id = VALUES(iucn_id),
      iucn_url = VALUES(iucn_url),
      data_source = VALUES(data_source),
      updated_at = NOW()
  `;

  const [result] = await connection.query(sql);
  return result.affectedRows;
}

async function insertGeneratedAlerts(connection, previousSnapshot) {
  const currentRows = await getCurrentThreatenedSnapshot(connection);
  let inserted = 0;

  for (const row of currentRows) {
    const previous = previousSnapshot.get(row.scientific_name);
    const oldCategory = previous?.red_list_category || null;
    const newCategory = row.red_list_category;
    const changeType = determineAlertChangeType(oldCategory, newCategory);

    if (!changeType) {
      continue;
    }

    const alertMonth = row.alert_month || new Date().toISOString().slice(0, 10);
    const alertLevel = determineAlertLevel(oldCategory, newCategory, changeType);
    const alertReason = buildAlertReason(row.scientific_name, oldCategory, newCategory, changeType);

    const [result] = await connection.query(
      `
        INSERT INTO redlist_alerts (
          alert_month,
          threatened_species_id,
          plant_id,
          scientific_name,
          old_category,
          new_category,
          change_type,
          alert_reason,
          alert_level,
          is_read,
          is_dismissed,
          created_at
        )
        SELECT
          ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW()
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1
          FROM redlist_alerts
          WHERE threatened_species_id = ?
            AND alert_month = ?
            AND change_type = ?
            AND new_category = ?
        )
      `,
      [
        alertMonth,
        row.id,
        row.plant_id || previous?.plant_id || null,
        row.scientific_name,
        oldCategory,
        newCategory,
        changeType,
        alertReason,
        alertLevel,
        row.id,
        alertMonth,
        changeType,
        newCategory
      ]
    );

    inserted += Number(result.affectedRows || 0);
  }

  return inserted;
}

async function printSummary(connection, loadStats) {
  const [rows] = await connection.query(`
    SELECT
      (SELECT COUNT(*) FROM stg_iucn_taxon) AS stg_iucn_taxon_rows,
      (SELECT COUNT(*) FROM stg_iucn_distribution) AS stg_iucn_distribution_rows,
      (SELECT COUNT(*) FROM threatened_species WHERE data_source = 'IUCN 2025-1') AS threatened_species_rows,
      (SELECT COUNT(*) FROM threatened_species WHERE data_source = 'IUCN 2025-1' AND plant_id IS NOT NULL) AS matched_plant_rows,
      (SELECT COUNT(*) FROM threatened_species WHERE data_source = 'IUCN 2025-1' AND taxon_id IS NOT NULL) AS matched_taxon_rows
  `);

  console.log('IUCN load stats:');
  console.table([{
    taxon_lines_total: loadStats.taxon.total,
    taxon_lines_kept: loadStats.taxon.kept,
    distribution_lines_total: loadStats.distribution.total,
    distribution_lines_kept: loadStats.distribution.kept
  }]);

  console.log('IUCN import summary:');
  console.table(rows);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(TAXON_FILE) || !fs.existsSync(DISTRIBUTION_FILE)) {
    throw new Error(`IUCN source files not found under ${IUCN_DIR}`);
  }

  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log(`Target DB: ${dbConfig.database}`);
    console.log(`Mode: ${dryRun ? 'dry-run' : 'import'}`);

    await ensureTables(connection);
    await clearStagingTables(connection);

    const taxonStats = await loadTaxonData(connection);
    const distributionStats = await loadDistributionData(connection);

    if (!dryRun) {
      await ensureTargetTable(connection);
      const previousSnapshot = await getPreviousThreatenedSnapshot(connection);
      const affectedRows = await upsertThreatenedSpecies(connection);
      const insertedAlerts = await insertGeneratedAlerts(connection, previousSnapshot);
      console.log(`Threatened species upsert affected rows: ${affectedRows}`);
      console.log(`Generated redlist alerts: ${insertedAlerts}`);
    }

    await printSummary(connection, {
      taxon: taxonStats,
      distribution: distributionStats
    });
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('IUCN import failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeCategory,
  normalizeScientificName,
  extractAssessmentYear,
  determineAlertChangeType,
  determineAlertLevel,
  buildAlertReason
};
