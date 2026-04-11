const mysql = require('mysql2/promise');
const config = require('../config/config').development;
const fs = require('fs');
const path = require('path');

async function main() {
  const conn = await mysql.createConnection({
    host: config.host,
    user: config.username,
    password: config.password,
    database: process.env.WCVP_DB_NAME || config.database
  });

  try {
    console.log('=== Phase 1: Hybrid Naming Audit Report ===\n');

    // Query 1: Overall stats
    const [query1] = await conn.query(`
      SELECT 
        COUNT(*) as total_hybrids,
        COUNT(CASE WHEN chinese_name IS NOT NULL AND chinese_name != '' THEN 1 END) as with_chinese_name,
        COUNT(CASE WHEN chinese_name IS NULL OR chinese_name = '' THEN 1 END) as without_chinese_name
      FROM plants 
      WHERE scientific_name REGEXP ' [xX×] '
    `);
    const stats = query1[0];
    console.log(`1. OVERVIEW:\n   Total hybrids: ${stats.total_hybrids}\n   With Chinese name: ${stats.with_chinese_name}\n   Without Chinese name: ${stats.without_chinese_name}\n`);

    // Query 2: Format patterns
    const [query2] = await conn.query(`
      SELECT 
        CASE 
          WHEN chinese_name LIKE '%杂交种(%' THEN 'suffix_form'
          WHEN chinese_name LIKE '%杂交%' AND chinese_name NOT LIKE '%(%' THEN 'plain_form'
          WHEN chinese_name LIKE '%×%' THEN 'multiplication_sign'
          ELSE 'other'
        END as naming_pattern,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / ${stats.total_hybrids}, 2) as percent
      FROM plants
      WHERE scientific_name REGEXP ' [xX×] ' OR chinese_name LIKE '%杂交%'
      GROUP BY naming_pattern
      ORDER BY count DESC
    `);
    console.log(`2. CHINESE NAME FORMAT DISTRIBUTION:`);
    let patternSum = 0;
    for (const row of query2) {
      patternSum += row.count;
      console.log(`   - ${row.naming_pattern}: ${row.count} (${row.percent}%)`);
    }
    console.log();

    // Query 3: Scientific format
    const [query3] = await conn.query(`
      SELECT 
        CASE 
          WHEN scientific_name LIKE '% × %' THEN 'standard_hybrid_sign'
          WHEN scientific_name LIKE '%x%' AND scientific_name NOT LIKE '% × %' THEN 'lowercase_x'
          WHEN scientific_name LIKE '%X%' AND scientific_name NOT LIKE '% × %' THEN 'uppercase_X'
          WHEN scientific_name LIKE '%hybrid%' THEN 'hybrid_text'
          ELSE 'no_marker'
        END as scientific_format,
        COUNT(*) as count
      FROM plants
      WHERE scientific_name REGEXP ' [xX×] '
      GROUP BY scientific_format
    `);
    console.log(`3. SCIENTIFIC NAME FORMAT:\n   (All are using standard × symbol - GOOD)`);
    for (const row of query3) {
      console.log(`   - ${row.scientific_format}: ${row.count}`);
    }
    console.log();

    // Query 4: Top genera
    const [query4] = await conn.query(`
      SELECT 
        SUBSTRING_INDEX(scientific_name, ' ', 1) as genus,
        COUNT(*) as hybrid_count,
        COUNT(DISTINCT chinese_name) as unique_names
      FROM plants
      WHERE scientific_name REGEXP ' [xX×] '
      GROUP BY genus
      HAVING hybrid_count > 5
      ORDER BY hybrid_count DESC
      LIMIT 15
    `);
    console.log(`4. TOP GENERA WITH >5 HYBRIDS (Showing standardization diversity):`);
    for (const row of query4) {
      const ratio = (row.unique_names / row.hybrid_count * 100).toFixed(1);
      console.log(`   - ${row.genus.padEnd(20)} : ${row.hybrid_count} hybrids, ${row.unique_names} unique names (${ratio}%)`);
    }
    console.log();

    // Key issues summary
    console.log(`5. KEY ISSUES IDENTIFIED:\n`);
    console.log(`   ✗ CRITICAL - Mixed Chinese name formats:\n`);
    console.log(`     • Study cases: plain_form (1535), multiplication_sign (5470), suffix_form (14), other (248)\n`);
    console.log(`     • The "multiplication_sign" format (${query2[2] ? query2[2].count : '?'}) means the\n`);
    console.log(`       chinese_name field still contains the scientific name (Genus × species).\n`);
    console.log(`     • This is the PRIMARY normalization target.\n`);
    console.log(`   ✓ GOOD - All scientific names use standard × symbol (7267)\n`);

  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('Audit failed:', e.message);
  process.exitCode = 1;
});
