/**
 * 从 plant_distributions 和 stg_wcvp_names 反推正确的 scientific_name
 * 策略：
 * 1. 从 plant_distributions 找出有分布数据的植物
 * 2. 通过 plant_name_id 回查 stg_wcvp_names，找出真实的学名
 * 3. 提取"纯学名"（去掉作者名）并更新 plants
 */

const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
};

function extractPureScientificName(taxonName) {
  // 提取不含作者名和括号的纯学名
  // 例如 "(Schltr.) Schltr." -> "Schltr"（但通常这也不是学名）
  // "Prunus mume D.Don" -> "Prunus mume"
  
  if (!taxonName) return null;
  
  let cleaned = String(taxonName)
    .replace(/\s+\([^)]*\)\s*/g, ' ')  // 移除括号及其内容
    .replace(/\s+(?:[A-Z]\.)*\s*(?:[A-Z]\.[A-Z]\.)*\s*$/, '')  // 移除末尾作者名缩写
    .trim();
  
  // 如果得到的是空，尝试从括号前获取
  if (!cleaned) {
    cleaned = String(taxonName).split(/[\(\s]/)[0];
  }
  
  // 过滤掉明显是单个作者名的情况
  const parts = cleaned.split(/\s+/).filter(p => p.length > 0 && !/^[A-Z]+\.?$/.test(p));
  if (parts.length === 0) return null;
  
  return parts.join(' ');
}

async function rebuildPlantsScientificNames() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('从分布数据反推重建 plants.scientific_name...\n');
    
    // 阶段 1: 从 plant_distributions 找有分布的植物
    console.log('[阶段1] 统计有分布数据的植物...');
    const [[distStats]] = await connection.query(`
      SELECT
        COUNT(DISTINCT plant_name_id) as plants_with_dist,
        COUNT(*) as total_dist
      FROM plant_distributions
    `);
    console.log(`  有分布的独立植物数: ${distStats.plants_with_dist}`);
    console.log(`  分布总条数: ${distStats.total_dist}`);
    
    // 阶段 2: 创建临时映射表（plant_name_id -> 正确的学名）
    console.log('\n[阶段2] 构建 plant_name_id 到正确学名的映射...');
    
    await connection.query(`
      CREATE TEMPORARY TABLE temp_correct_names_by_dist (
        plant_name_id VARCHAR(50) PRIMARY KEY,
        correct_scientific_name VARCHAR(200)
      ) CHARSET utf8mb4
    `);
    
    // 从 plant_distributions 找出所有的 plant_name_id，然后从 stg_wcvp_names 中查找对应的学名
    // 按照 taxon_status 优先级（accepted > synonym）来选择
    await connection.query(`
      INSERT INTO temp_correct_names_by_dist (plant_name_id, correct_scientific_name)
      SELECT
        n.plant_name_id,
        MAX(
          CASE
            WHEN LOWER(n.taxon_status) = 'accepted' THEN n.taxon_name
            ELSE COALESCE(na.taxon_name, n.taxon_name)
          END
        )
      FROM stg_wcvp_names n
      LEFT JOIN stg_wcvp_names na ON na.plant_name_id = n.accepted_plant_name_id
      INNER JOIN plant_distributions pd ON pd.plant_name_id = n.plant_name_id
      WHERE n.plant_name_id IS NOT NULL
        AND n.plant_name_id <> ''
      GROUP BY n.plant_name_id
    `);
    
    const [[mappingStats]] = await connection.query(`
      SELECT COUNT(*) as mapping_count FROM temp_correct_names_by_dist
    `);
    console.log(`  建立了 ${mappingStats.mapping_count} 个映射记录`);
    
    // 阶段 3: 查看映射的学名样本
    const [samples] = await connection.query(`
      SELECT plant_name_id, correct_scientific_name FROM temp_correct_names_by_dist LIMIT 5
    `);
    console.log('  样本映射：');
    for (const {plant_name_id, correct_scientific_name} of samples) {
      console.log(`    ${plant_name_id}: ${correct_scientific_name}`);
    }
    
    // 阶段 4: 找出哪些 plants 记录对应这些 plant_name_id
    // 但问题是 plants 表没有 plant_name_id 字段...
    // 需要通过 taxa 表来关联
    console.log('\n[阶段3] 通过 taxa 关联找出需要更新的 plants...');
    
    // 创建另一个临时表，把 plants 和正确的学名关联起来
    await connection.query(`
      CREATE TEMPORARY TABLE temp_plants_update (
        plant_id INT PRIMARY KEY,
        correct_scientific_name VARCHAR(200)
      ) CHARSET utf8mb4
    `);
    
    // 从 taxa 的 scientific_name 匹配正确的学名
    await connection.query(`
      INSERT INTO temp_plants_update (plant_id, correct_scientific_name)
      SELECT
        p.id,
        t.correct_scientific_name
      FROM plants p
      INNER JOIN taxa ta ON ta.id = p.taxon_id
      INNER JOIN temp_correct_names_by_dist t
        ON t.correct_scientific_name LIKE CONCAT(ta.scientific_name, '%')
          OR ta.scientific_name LIKE CONCAT(
            SUBSTRING_INDEX(t.correct_scientific_name, ' ', 1),
            '%'
          )
      GROUP BY p.id
    `);
    
    const [[updateCandidates]] = await connection.query(`
      SELECT COUNT(*) as cnt FROM temp_plants_update
    `);
    console.log(`  找到可更新的 plants: ${updateCandidates.cnt}`);
    
    if (updateCandidates.cnt > 0) {
      // 阶段 5: 执行更新
      console.log('\n[阶段4] 执行 plants.scientific_name 更新...');
      const [updateResult] = await connection.query(`
        UPDATE plants p
        INNER JOIN temp_plants_update t ON t.plant_id = p.id
        SET p.scientific_name = t.correct_scientific_name
        WHERE t.correct_scientific_name IS NOT NULL
          AND t.correct_scientific_name <> ''
      `);
      console.log(`  更新了 ${updateResult.affectedRows} 条记录`);
    }
    
    // 阶段 6: 最终统计
    console.log('\n[完成] 最终结果：');
    const [[finalStats]] = await connection.query(`
      SELECT
        COUNT(*) as total_plants,
        COUNT(DISTINCT scientific_name) as distinct_names,
        SUM(CASE WHEN scientific_name IS NULL OR scientific_name='' THEN 1 ELSE 0 END) as null_count,
        SUM(CASE WHEN scientific_name REGEXP '^[A-Z\\.\\s\\-]+$' THEN 1 ELSE 0 END) as author_only_count
      FROM plants
    `);
    
    console.log(`  - 总植物数: ${finalStats.total_plants}`);
    console.log(`  - 不同学名数: ${finalStats.distinct_names}`);
    console.log(`  - NULL/空白学名: ${finalStats.null_count}`);
    console.log(`  - 仍是作者名的学名: ${finalStats.author_only_count}`);
    
    const [topNames] = await connection.query(`
      SELECT scientific_name, COUNT(*) as cnt FROM plants
      WHERE scientific_name IS NOT NULL AND scientific_name <> ''
      GROUP BY scientific_name ORDER BY cnt DESC LIMIT 10
    `);
    
    console.log('\n  Top 10 学名分布:');
    for (const {scientific_name, cnt} of topNames) {
      console.log(`    ${scientific_name}: ${cnt}`);
    }
    
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  rebuildPlantsScientificNames().catch((err) => {
    console.error('重建失败:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  });
}

module.exports = { rebuildPlantsScientificNames };
