const {
  familyOrderMap,
  standardHierarchy
} = require('../../data/taxonomy_chinese_mapping');

async function fetchTaxonId(connection, rank, scientificName) {
  const [rows] = await connection.query(
    `
      SELECT id
      FROM taxa
      WHERE taxon_rank = ?
        AND scientific_name = ?
      ORDER BY id ASC
      LIMIT 1
    `,
    [rank, scientificName]
  );

  return Number(rows[0]?.id || 0);
}

async function ensureTaxon(connection, { rank, scientificName, chineseName = null, parentId = null }) {
  await connection.query(
    `
      INSERT INTO taxa (
        taxon_rank, parent_id, scientific_name, common_name, chinese_name, created_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, NOW(), NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
        FROM taxa
        WHERE taxon_rank = ?
          AND scientific_name = ?
      )
    `,
    [rank, parentId, scientificName, scientificName, chineseName, rank, scientificName]
  );

  if (parentId !== null && parentId !== undefined) {
    await connection.query(
      `
        UPDATE taxa
        SET parent_id = ?
        WHERE taxon_rank = ?
          AND scientific_name = ?
          AND (parent_id IS NULL OR parent_id <> ?)
      `,
      [parentId, rank, scientificName, parentId]
    );
  }

  if (chineseName) {
    await connection.query(
      `
        UPDATE taxa
        SET chinese_name = ?
        WHERE taxon_rank = ?
          AND scientific_name = ?
          AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
      `,
      [chineseName, rank, scientificName]
    );
  }

  return fetchTaxonId(connection, rank, scientificName);
}

async function ensureStandardHierarchy(connection) {
  const kingdomIds = {};
  for (const kingdom of standardHierarchy.kingdoms) {
    kingdomIds[kingdom.scientific_name] = await ensureTaxon(connection, {
      rank: 'kingdom',
      scientificName: kingdom.scientific_name,
      chineseName: kingdom.chinese_name
    });
  }

  const phylumIds = {};
  for (const phylum of standardHierarchy.phyla) {
    phylumIds[phylum.scientific_name] = await ensureTaxon(connection, {
      rank: 'phylum',
      scientificName: phylum.scientific_name,
      chineseName: phylum.chinese_name,
      parentId: kingdomIds[phylum.parent_scientific_name]
    });
  }

  const subphylumIds = {};
  for (const subphylum of standardHierarchy.subphyla || []) {
    subphylumIds[subphylum.scientific_name] = await ensureTaxon(connection, {
      rank: 'subphylum',
      scientificName: subphylum.scientific_name,
      chineseName: subphylum.chinese_name,
      parentId: phylumIds[subphylum.parent_scientific_name]
    });
  }

  const classIds = {};
  for (const klass of standardHierarchy.classes) {
    const parentId = subphylumIds[klass.parent_scientific_name] || phylumIds[klass.parent_scientific_name];
    classIds[klass.scientific_name] = await ensureTaxon(connection, {
      rank: 'class',
      scientificName: klass.scientific_name,
      chineseName: klass.chinese_name,
      parentId
    });
  }

  for (const order of standardHierarchy.orders) {
    const parentRank = order.parent_scientific_name.endsWith('phyta') ? 'phylum' : 'class';
    const parentId = parentRank === 'phylum'
      ? phylumIds[order.parent_scientific_name]
      : classIds[order.parent_scientific_name];
    await ensureTaxon(connection, {
      rank: 'order',
      scientificName: order.scientific_name,
      chineseName: order.chinese_name,
      parentId
    });
  }

  const unresolvedOrderId = await ensureTaxon(connection, {
    rank: 'order',
    scientificName: 'Unresolved order',
    chineseName: '未定目',
    parentId: classIds.Magnoliopsida || null
  });

  return { unresolvedOrderId };
}

async function repairMappedFamilyParents(connection) {
  for (const [familyScientificName, targetScientificName] of Object.entries(familyOrderMap)) {
    const targetRank = targetScientificName.endsWith('phyta') ? 'phylum' : 'order';
    const targetId = await fetchTaxonId(connection, targetRank, targetScientificName);
    if (!targetId) {
      continue;
    }

    await connection.query(
      `
        UPDATE taxa
        SET parent_id = ?
        WHERE taxon_rank = 'family'
          AND scientific_name = ?
          AND (parent_id IS NULL OR parent_id <> ?)
      `,
      [targetId, familyScientificName, targetId]
    );
  }
}

async function assignUnresolvedFamilies(connection, unresolvedOrderId) {
  if (!unresolvedOrderId) {
    return;
  }

  await connection.query(
    `
      UPDATE taxa
      SET parent_id = ?
      WHERE taxon_rank = 'family'
        AND (parent_id IS NULL OR parent_id = 0)
    `,
    [unresolvedOrderId]
  );
}

module.exports = {
  assignUnresolvedFamilies,
  ensureStandardHierarchy,
  repairMappedFamilyParents
};
