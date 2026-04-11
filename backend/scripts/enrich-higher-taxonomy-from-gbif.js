const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const GBIF_MATCH_ENDPOINT = 'https://api.gbif.org/v1/species/match';
const REQUEST_DELAY_MS = Number(process.env.GBIF_TAXONOMY_DELAY_MS || 150);
const LIMIT = Math.max(1, Number(process.env.GBIF_TAXONOMY_LIMIT || 0));
const ONLY_UNRESOLVED = String(process.env.GBIF_TAXONOMY_ONLY_UNRESOLVED || '1') === '1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMatchUrl(familyName) {
  const params = new URLSearchParams({
    name: familyName,
    rank: 'FAMILY',
    kingdom: 'Plantae',
    verbose: 'true'
  });
  return `${GBIF_MATCH_ENDPOINT}?${params.toString()}`;
}

async function fetchGbifClassification(familyName) {
  const response = await fetch(buildMatchUrl(familyName), {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`GBIF match failed for ${familyName}: HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !payload.usageKey || !payload.order || !payload.class || !payload.phylum) {
    return null;
  }

  return {
    family: familyName,
    kingdom: payload.kingdom || 'Plantae',
    phylum: payload.phylum || null,
    className: payload.class || null,
    order: payload.order || null,
    confidence: Number(payload.confidence || 0),
    status: payload.status || null,
    matchType: payload.matchType || null
  };
}

async function ensureRankNode(connection, { rank, scientificName, parentId = null }) {
  await connection.query(
    `
      INSERT INTO taxa (taxon_rank, parent_id, scientific_name, common_name, chinese_name, created_at, updated_at)
      SELECT ?, ?, ?, ?, NULL, NOW(), NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
        FROM taxa
        WHERE taxon_rank = ?
          AND scientific_name = ?
      )
    `,
    [rank, parentId, scientificName, scientificName, rank, scientificName]
  );

  const [rows] = await connection.query(
    `
      SELECT id, parent_id
      FROM taxa
      WHERE taxon_rank = ?
        AND scientific_name = ?
      ORDER BY id ASC
      LIMIT 1
    `,
    [rank, scientificName]
  );

  const id = Number(rows[0]?.id || 0);
  const currentParentId = rows[0]?.parent_id === null ? null : Number(rows[0]?.parent_id);

  if (id && parentId !== null && currentParentId !== parentId) {
    await connection.query(
      `
        UPDATE taxa
        SET parent_id = ?
        WHERE id = ?
      `,
      [parentId, id]
    );
  }

  return id;
}

async function ensureHigherChain(connection, classification) {
  const kingdomId = await ensureRankNode(connection, {
    rank: 'kingdom',
    scientificName: classification.kingdom || 'Plantae',
    parentId: null
  });

  const phylumId = await ensureRankNode(connection, {
    rank: 'phylum',
    scientificName: classification.phylum,
    parentId: kingdomId
  });

  const classId = await ensureRankNode(connection, {
    rank: 'class',
    scientificName: classification.className,
    parentId: phylumId
  });

  const orderId = await ensureRankNode(connection, {
    rank: 'order',
    scientificName: classification.order,
    parentId: classId
  });

  return { kingdomId, phylumId, classId, orderId };
}

async function updateFamilyParent(connection, familyName, orderId) {
  await connection.query(
    `
      UPDATE taxa
      SET parent_id = ?
      WHERE taxon_rank = 'family'
        AND scientific_name = ?
        AND (parent_id IS NULL OR parent_id <> ?)
    `,
    [orderId, familyName, orderId]
  );
}

async function fetchTargetFamilies(connection) {
  const [rows] = await connection.query(`
    SELECT DISTINCT f.scientific_name
    FROM taxa f
    ${ONLY_UNRESOLVED ? `
      LEFT JOIN taxa parent ON parent.id = f.parent_id
      WHERE f.taxon_rank = 'family'
        AND f.scientific_name IS NOT NULL
        AND f.scientific_name <> ''
        AND (
          parent.id IS NULL
          OR parent.taxon_rank <> 'order'
          OR NOT EXISTS (
            SELECT 1
            FROM taxa cls
            WHERE cls.id = parent.parent_id
              AND cls.taxon_rank = 'class'
          )
        )
    ` : `
      WHERE f.taxon_rank = 'family'
        AND f.scientific_name IS NOT NULL
        AND f.scientific_name <> ''
    `}
    ORDER BY f.scientific_name ASC
  `);

  return rows.map((row) => row.scientific_name).filter(Boolean);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    const families = await fetchTargetFamilies(connection);
    const targets = LIMIT > 0 ? families.slice(0, LIMIT) : families;

    console.log(`Target database: ${dbConfig.database}`);
    console.log(`Only unresolved families: ${ONLY_UNRESOLVED}`);
    console.log(`Families to enrich: ${targets.length}`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i += 1) {
      const familyName = targets[i];

      try {
        const classification = await fetchGbifClassification(familyName);
        if (!classification) {
          skipped += 1;
          console.log(`[${i + 1}/${targets.length}] skipped ${familyName}`);
          await sleep(REQUEST_DELAY_MS);
          continue;
        }

        const { orderId } = await ensureHigherChain(connection, classification);
        await updateFamilyParent(connection, familyName, orderId);

        success += 1;
        console.log(
          `[${i + 1}/${targets.length}] ok ${familyName} -> ${classification.phylum} / ${classification.className} / ${classification.order} (confidence ${classification.confidence})`
        );
      } catch (err) {
        failed += 1;
        console.error(`[${i + 1}/${targets.length}] failed ${familyName}: ${err.message}`);
      }

      await sleep(REQUEST_DELAY_MS);
    }

    console.log('Enrichment summary:');
    console.table([{ success, skipped, failed, total: targets.length }]);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('enrich-higher-taxonomy-from-gbif failed:', err.message);
    if (err?.stack) {
      console.error(err.stack);
    }
    process.exitCode = 1;
  });
}

module.exports = { main };
