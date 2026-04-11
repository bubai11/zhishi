/**
 * 修复 plants.scientific_name 映射
 * 策略：
 * 1. 对每个 plants 记录，查其关联的 taxa（通过 taxon_id）
 * 2. 如果 taxa.rank='species' 且 taxa.scientific_name 有效，用 taxa.scientific_name
 * 3. 否则，尝试从 stg_wcvp_names 中找到"纯学名"（去掉作者名部分）
 */

const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database,
};

async function extractPureScientificName(taxonName) {
  // taxon_name 格式通常是 "Species epithet (Author) Author" 或类似
  // 提取纯学名（不含括号及之后内容）
  if (!taxonName) return null;
  
  // 移除括号及之后内容
  let cleaned = String(taxonName).replace(/\s*\(.*\).*$/, '').trim();
  
  // 如果只剩下单个单词（可能是属名或作者名缩写），认为不是有效学名
  const parts = cleaned.split(/\s+/).filter(p => p.length > 0);
  if (parts.length < 1) return null;
  
  // 如果只有一个单词且全是大写字母+点（如"L."、"DC."），是作者名，不是学名
  if (parts.length === 1 && /^[A-Z\.]+$/.test(parts[0])) return null;
  
  return cleaned;
}

async function fixPlantScientificNames() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('开始修复 plants.scientific_name...');
    
    // 阶段 1: 从 taxa 表补充 species 级别的学名
    console.log('\n[阶段1] 从 taxa 表补充 species 级别的正确学名...');
    const [res1] = await connection.query(`
      UPDATE plants p
      INNER JOIN taxa t ON t.id = p.taxon_id
      SET p.scientific_name = t.scientific_name
      WHERE t.taxon_rank = 'species'
        AND t.scientific_name IS NOT NULL
        AND t.scientific_name <> ''
    `);
    console.log(`  更新了 ${res1.affectedRows} 条记录`);
    
    // 阶段 2: 统计还需要修复的记录
    const [[stats]] = await connection.query(`
      SELECT
        COUNT(*) as total_plants,
        SUM(CASE WHEN p.scientific_name IS NULL OR p.scientific_name='' THEN 1 ELSE 0 END) as null_sci,
        SUM(CASE WHEN p.scientific_name REGEXP '^[A-Z\\.\\-\\s]+$' THEN 1 ELSE 0 END) as author_only_sci
      FROM plants p
    `);
    
    console.log(`\n  统计信息：`);
    console.log(`  - 总植物数: ${stats.total_plants}`);
    console.log(`  - NULL/空白 scientific_name: ${stats.null_sci}`);
    console.log(`  - 可能是作者名的 scientific_name: ${stats.author_only_sci}`);
    
    // 阶段 3: 从 stg_wcvp_names 提取纯学名并补充
    console.log('\n[阶段2] 从 stg_wcvp_names 补充纯学名...');
    
    // 先创建临时表用于存储映射
    await connection.query(`
      CREATE TEMPORARY TABLE temp_sci_names (
        scientific_name VARCHAR(200) COLLATE utf8mb4_0900_ai_ci PRIMARY KEY,
        pure_name VARCHAR(200) COLLATE utf8mb4_0900_ai_ci
      )
    `);
    
    // 读取所有 stg_wcvp_names，提取纯学名
    const [names] = await connection.query(`
      SELECT DISTINCT taxon_name FROM stg_wcvp_names 
      WHERE taxon_name IS NOT NULL AND taxon_name <> ''
      LIMIT 100000
    `);
    
    console.log(`  处理 ${names.length} 个不同的 taxon_name...`);
    
    for (const {taxon_name} of names) {
      const pureName = await extractPureScientificName(taxon_name);
      if (pureName && pureName !== taxon_name) {
        try {
          await connection.query(`
            INSERT IGNORE INTO temp_sci_names (scientific_name, pure_name)
            VALUES (?, ?)
          `, [taxon_name, pureName]);
        } catch (e) {
          // 忽略重复插入
        }
      }
    }
    
    // 用纯学名更新 plants
    const [res2] = await connection.query(`
      UPDATE plants p
      INNER JOIN temp_sci_names t ON t.scientific_name = p.scientific_name
      SET p.scientific_name = t.pure_name
      WHERE t.pure_name IS NOT NULL AND t.pure_name <> ''
    `);
    console.log(`  更新了 ${res2.affectedRows} 条记录`);
    
    // 阶段 4: 再次统计结果
    const [[finalStats]] = await connection.query(`
      SELECT
        COUNT(*) as total,
        COUNT(DISTINCT scientific_name) as distinct_names,
        SUM(CASE WHEN scientific_name IS NOT NULL AND scientific_name<>'' THEN 1 ELSE 0 END) as with_sci_name
      FROM plants
    `);
    
    console.log(`\n[完成] 修复结果：`);
    console.log(`  - 总植物数: ${finalStats.total}`);
    console.log(`  - 不同学名数: ${finalStats.distinct_names}`);
    console.log(`  - 有有效 scientific_name: ${finalStats.with_sci_name}`);
    
    // 显示top 10 学名分布
    const [topNames] = await connection.query(`
      SELECT scientific_name, COUNT(*) as cnt FROM plants 
      WHERE scientific_name IS NOT NULL AND scientific_name <> ''
      GROUP BY scientific_name ORDER BY cnt DESC LIMIT 10
    `);
    console.log('\n  Top 10 学名分布：');
    for (const {scientific_name, cnt} of topNames) {
      console.log(`    ${scientific_name}: ${cnt}`);
    }
    
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  fixPlantScientificNames().catch((err) => {
    console.error('修复失败:', err.message);
    process.exitCode = 1;
  });
}

module.exports = { fixPlantScientificNames };
