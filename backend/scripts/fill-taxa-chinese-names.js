/**
 * 批量修复 taxa 中文名，并按标准映射补齐中文链路。
 * 用法：node scripts/fill-taxa-chinese-names.js
 */

const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const {
  familyChineseMap,
  genusChineseMap,
  standardHierarchy
} = require('../data/taxonomy_chinese_mapping');
const {
  assignUnresolvedFamilies,
  ensureStandardHierarchy,
  repairMappedFamilyParents
} = require('./lib/taxonomyHierarchy');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  let familyUpdated = 0;
  let genusUpdated = 0;
  let rankUpdated = 0;

  try {
    const { unresolvedOrderId } = await ensureStandardHierarchy(conn);
    await repairMappedFamilyParents(conn);
    await assignUnresolvedFamilies(conn, unresolvedOrderId);

    for (const [scientificName, chineseName] of Object.entries(familyChineseMap)) {
      const [result] = await conn.query(
        `
          UPDATE taxa
          SET chinese_name = ?
          WHERE taxon_rank = 'family'
            AND scientific_name = ?
            AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
        `,
        [chineseName, scientificName]
      );
      familyUpdated += result.affectedRows;
    }

    for (const [scientificName, chineseName] of Object.entries(genusChineseMap)) {
      const [result] = await conn.query(
        `
          UPDATE taxa
          SET chinese_name = ?
          WHERE taxon_rank = 'genus'
            AND scientific_name = ?
            AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
        `,
        [chineseName, scientificName]
      );
      genusUpdated += result.affectedRows;
    }

    const higherRankMap = [
      ...standardHierarchy.kingdoms.map((entry) => ({ rank: 'kingdom', ...entry })),
      ...standardHierarchy.phyla.map((entry) => ({ rank: 'phylum', ...entry })),
      ...(standardHierarchy.subphyla || []).map((entry) => ({ rank: 'subphylum', ...entry })),
      ...standardHierarchy.classes.map((entry) => ({ rank: 'class', ...entry })),
      ...standardHierarchy.orders.map((entry) => ({ rank: 'order', ...entry })),
      { rank: 'order', scientific_name: 'Unresolved order', chinese_name: '未定目' }
    ];

    for (const entry of higherRankMap) {
      const [result] = await conn.query(
        `
          UPDATE taxa
          SET chinese_name = ?
          WHERE taxon_rank = ?
            AND scientific_name = ?
            AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
        `,
        [entry.chinese_name, entry.rank, entry.scientific_name]
      );
      rankUpdated += result.affectedRows;
    }

    const [[familyParentSummary]] = await conn.query(
      `
        SELECT COUNT(*) AS total
        FROM taxa
        WHERE taxon_rank = 'family'
          AND parent_id IS NOT NULL
          AND parent_id <> 0
      `
    );

    console.log('=== taxa 中文链路修复完成 ===');
    console.log(`科（family）中文名更新：${familyUpdated} 条`);
    console.log(`属（genus）中文名更新：${genusUpdated} 条`);
    console.log(`高级分类中文名更新：${rankUpdated} 条`);
    console.log(`已具备父级的科节点：${Number(familyParentSummary?.total || 0)} 条`);
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('fill-taxa-chinese-names 失败:', err.message);
  process.exitCode = 1;
});
