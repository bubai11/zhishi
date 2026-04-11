const mysql = require('mysql2/promise');
const config = require('../config/config').development;

async function main() {
  const conn = await mysql.createConnection({
    host: config.host,
    user: config.username,
    password: config.password,
    database: process.env.WCVP_DB_NAME || config.database
  });

  try {
    console.log('=== 方案 A vs B 详细对比分析 ===\n');

    // 方案A的清洗范围
    console.log('### 方案 A：保守方案（仅补齐缺失的中文名）\n');
    const [schemeA] = await conn.query(`
      SELECT 
        COUNT(*) as target_count,
        GROUP_CONCAT(DISTINCT LEFT(scientific_name, 50) SEPARATOR ' | ') as examples
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
        AND (chinese_name REGEXP ' [×xX] ' OR chinese_name LIKE 'Genus × %')
      LIMIT 1
    `);
    if (schemeA.length > 0) {
      console.log(`操作范围：${schemeA[0].target_count} 条记录（学名格式仍存在于chinese_name）`);
      console.log(`样例：${(schemeA[0].examples || '').substring(0, 150)}...\n`);
    }

    // 方案B的清洗范围
    console.log('### 方案 B：完整方案（全面统一格式并优化重复度）\n');
    const [schemeB1] = await conn.query(`
      SELECT COUNT(*) as total_hybrids FROM plants WHERE scientific_name REGEXP ' [×xX] '
    `);
    const total = schemeB1[0].total_hybrids;
    console.log(`操作范围：${total} 条记录（所有杂交种）\n`);

    // 方案B中需要优化的高重复度属
    const [schemeB2] = await conn.query(`
      SELECT 
        SUBSTRING_INDEX(scientific_name, ' ', 1) as genus,
        COUNT(*) as hybrid_count,
        COUNT(DISTINCT chinese_name) as unique_names,
        MAX(chinese_name) as sample_name
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
      GROUP BY genus
      HAVING unique_names <= 3 AND hybrid_count > 50
      ORDER BY hybrid_count DESC
    `);
    console.log(`高重复度属（需要添加区分信息）：`);
    let needOptimize = 0;
    for (const row of schemeB2) {
      needOptimize += row.hybrid_count;
      console.log(`  - ${row.genus}: ${row.hybrid_count} hybrids 使用 ${row.unique_names} 个中文名（样例：${row.sample_name}）`);
    }
    console.log(`  小计：${needOptimize} 条需优化\n`);

    // 现状展示前后对比
    console.log('### 清洗前后格式对比\n');
    const [samples] = await conn.query(`
      SELECT 
        scientific_name,
        chinese_name,
        CASE 
          WHEN chinese_name REGEXP ' [×xX] ' THEN 'sci_format'
          WHEN chinese_name LIKE '%杂交%' THEN 'hybrid_format'
          ELSE 'other'
        END as current_format
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
      GROUP BY scientific_name
      ORDER BY current_format, RAND()
      LIMIT 5
    `);
    for (const row of samples) {
      const genus = row.scientific_name.split(' ')[0];
      console.log(`科学名：${row.scientific_name}`);
      console.log(`当前中文名：${row.chinese_name}`);
      console.log(`方案A优化后：${genus}杂交种（仅替换，保持简洁）`);
      console.log(`方案B优化后：${genus}杂交种 [${row.scientific_name.split('×')[1].trim().slice(0,8)}]（添加种加词进行区分）`);
      console.log();
    }

    // 影响范围总结
    console.log('### 影响范围统计\n');
    const [format1] = await conn.query(`
      SELECT 
        COUNT(*) as sci_name_count
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
        AND (chinese_name REGEXP ' [×xX] ' OR chinese_name LIKE '%×%')
    `);
    const [format2] = await conn.query(`
      SELECT 
        COUNT(*) as hybrid_cn_count
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] ' AND chinese_name LIKE '%杂交%'
    `);
    const [format3] = await conn.query(`
      SELECT 
        COUNT(*) as other_count
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] ' AND chinese_name NOT LIKE '%杂交%' AND chinese_name NOT REGEXP ' [×xX] '
    `);

    console.log(`方案A清洗：${format1[0].sci_name_count} 条（学名格式）`);
    console.log(`已规范：${format2[0].hybrid_cn_count} 条（杂交种格式）`);
    console.log(`其他格式：${format3[0].other_count} 条\n`);

    // 前端展示效果对比
    console.log('### 前端展示效果对比\n');
    console.log(`方案A效果：\n`);
    console.log(`  当前：Cattleya × aclandiae → "中文名不显示"或"随机显示学名"`);
    console.log(`  A后：Cattleya × aclandiae → "Cattleya杂交种"`);
    console.log(`  问题：1035个Cattleya杂交种都显示同一个名字，无法搜索区分\n`);
    console.log(`方案B效果：\n`);
    console.log(`  当前：Cattleya × aclandiae → "中文名不显示"`);
    console.log(`  B后：Cattleya × aclandiae → "Cattleya杂交种(aclandiae)"`);
    console.log(`  优势：保持可识别，同时支持用种加词进行细节搜索\n`);

    // 成本对比
    console.log('### 成本、风险、维护对比\n');
    console.log(`指标              方案A(保守)                    方案B(完整)\n`);
    console.log(`─────────────────────────────────────────────────────────\n`);
    console.log(`清洗范围           ${format1[0].sci_name_count} 条(${(format1[0].sci_name_count/total*100).toFixed(1)}%)              全部 ${total} 条\n`);
    console.log(`操作复杂度         低(SQL UPDATE)                  中(需解析种加词)\n`);
    console.log(`执行时间           < 5秒                         10~30秒\n`);
    console.log(`清洗风险           极低(不改现有数据)              低(改但有回滚)\n`);
    console.log(`前端显示改进       部分(解决nullptr)              全面(解决重复)\n`);
    console.log(`维护成本           低(新记录自动采用新规范)        中(新记录需检查)\n`);
    console.log(`后续可扩展         有(方案A后可升级到B)            无(B已是最优)\n\n`);

    // 决策建议
    console.log('### 决策建议\n');
    console.log(`【选方案A如果】：\n`);
    console.log(`  • 优先保证"能显示中文名"（当前最大痛点）\n`);
    console.log(`  • 今后可能会补充更完整的属级中文名数据库\n`);
    console.log(`  • 最小化变更风险和时间投入\n\n`);
    console.log(`【选方案B如果】：\n`);
    console.log(`  • 目标是一次彻底解决杂交种命名混乱问题\n`);
    console.log(`  • 重数据一致性和前端用户体验\n`);
    console.log(`  • 后续维护中文名不会再遇到同样问题\n\n`);
    console.log(`【建议】：\n`);
    console.log(`  方案B性价比更高。理由：\n`);
    console.log(`  1. 执行时间差异在秒级，性能可接受\n`);
    console.log(`  2. 清洗后数据库再无"中文名为学名"的异常\n`);
    console.log(`  3. 方案A如果后续升级也需要重做，不如一步到位\n`);

  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('对比分析失败:', e.message);
  process.exitCode = 1;
});
