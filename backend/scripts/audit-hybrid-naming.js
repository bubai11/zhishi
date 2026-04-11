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
    console.log('=== Phase 1: Hybrid Naming Audit ===\n');

    // Query 1: Overall stats
    console.log('1. Hybrid Total & Distribution:');
    const [query1] = await conn.query(`
      SELECT 
        COUNT(*) as total_hybrids,
        COUNT(CASE WHEN chinese_name IS NOT NULL AND chinese_name != '' THEN 1 END) as with_chinese_name,
        COUNT(CASE WHEN chinese_name IS NULL OR chinese_name = '' THEN 1 END) as without_chinese_name
      FROM plants 
      WHERE scientific_name REGEXP ' [xX×] '
    `);
    console.log(JSON.stringify(query1, null, 2));

    // Query 2: Chinese name format patterns
    console.log('\n2. Chinese Name Format Patterns:');
    const [query2] = await conn.query(`
      SELECT 
        CASE 
          WHEN chinese_name LIKE '%杂交种(%' THEN 'suffix_form'
          WHEN chinese_name LIKE '%杂交%' AND chinese_name NOT LIKE '%(%' THEN 'plain_form'
          WHEN chinese_name LIKE '%×%' THEN 'multiplication_sign'
          ELSE 'other'
        END as naming_pattern,
        COUNT(*) as count,
        GROUP_CONCAT(DISTINCT LEFT(chinese_name, 40) SEPARATOR ' | ') as examples
      FROM plants
      WHERE scientific_name REGEXP ' [xX×] ' OR chinese_name LIKE '%杂交%'
      GROUP BY naming_pattern
    `);
    console.log(JSON.stringify(query2, null, 2));

    // Query 3: Scientific name format
    console.log('\n3. Scientific Name Format Analysis:');
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
    console.log(JSON.stringify(query3, null, 2));

    // Query 4: Genus distribution
    console.log('\n4. Genus Distribution (Top 20 with >5 hybrids):');
    const [query4] = await conn.query(`
      SELECT 
        SUBSTRING_INDEX(scientific_name, ' ', 1) as genus,
        COUNT(*) as hybrid_count,
        COUNT(DISTINCT chinese_name) as unique_names,
        GROUP_CONCAT(DISTINCT LEFT(chinese_name, 30) SEPARATOR ' | ') as name_samples
      FROM plants
      WHERE scientific_name REGEXP ' [xX×] '
      GROUP BY genus
      HAVING hybrid_count > 5
      ORDER BY hybrid_count DESC
      LIMIT 20
    `);
    console.log(JSON.stringify(query4, null, 2));

  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('Audit failed:', e.message);
  process.exitCode = 1;
});
