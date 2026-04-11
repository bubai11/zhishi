#!/usr/bin/env node

/**
 * 高效 WCVP 导入脚本 v3
 * 直接从 staging 表构建 taxa 和 plants，避免重复处理 CSV
 * 已确认 stg_wcvp_names 和 stg_wcvp_distribution 有数据
 */

const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: sequelizeConfig.database
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('Building taxa and plants from stg_wcvp_names...\n');

    // 检查 staging 数据
    const [[stagingCount]] = await connection.query(
      'SELECT COUNT(*) as cnt FROM stg_wcvp_names WHERE taxon_rank IS NOT NULL'
    );
    console.log(`Found ${stagingCount.cnt} staging records`);

    // Phase 1: 建立 taxa 层级
    console.log('\nPhase 1: Building taxa hierarchy...');

    // 1a. 插入科
    console.log('  • Inserting families...');
    const [familyRes] = await connection.query(`
      INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
      SELECT DISTINCT 'family', NULL, family, NOW(), NOW()
      FROM stg_wcvp_names
      WHERE family IS NOT NULL AND family <> ''
        AND LOWER(taxon_rank) = 'species'
        AND LOWER(taxon_status) = 'accepted'
      LIMIT 1000000
    `);
    const [[f_cnt]] = await connection.query('SELECT COUNT(*) as cnt FROM taxa WHERE taxon_rank = "family"');
    console.log(`    ✓ ${f_cnt.cnt} families in taxa table`);

    // 1b. 插入属
    console.log('  • Inserting genera...');
    const [genusRes] = await connection.query(`
      INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
      SELECT DISTINCT 'genus', f.id, sg.genus, NOW(), NOW()
      FROM (
        SELECT DISTINCT family, genus
        FROM stg_wcvp_names
        WHERE genus IS NOT NULL AND genus <> ''
          AND LOWER(taxon_rank) = 'species'
          AND LOWER(taxon_status) = 'accepted'
      ) sg
      LEFT JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = sg.family
      WHERE f.id IS NOT NULL
    `);
    const [[g_cnt]] = await connection.query('SELECT COUNT(*) as cnt FROM taxa WHERE taxon_rank = "genus"');
    console.log(`    ✓ ${g_cnt.cnt} genera in taxa table`);

    // 1c. 插入种
    console.log('  • Inserting species...');
    const [speciesRes] = await connection.query(`
      INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
      SELECT DISTINCT 'species', g.id, ss.taxon_name, NOW(), NOW()
      FROM (
        SELECT DISTINCT family, genus, taxon_name
        FROM stg_wcvp_names
        WHERE taxon_name IS NOT NULL AND taxon_name <> ''
          AND genus IS NOT NULL AND genus <> ''
          AND LOWER(taxon_rank) = 'species'
          AND LOWER(taxon_status) = 'accepted'
      ) ss
      LEFT JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = ss.family
      LEFT JOIN taxa g ON g.taxon_rank = 'genus' AND g.scientific_name = ss.genus AND g.parent_id = f.id
      WHERE f.id IS NOT NULL AND g.id IS NOT NULL
    `);
    const [[s_cnt]] = await connection.query('SELECT COUNT(*) as cnt FROM taxa WHERE taxon_rank = "species"');
    console.log(`    ✓ ${s_cnt.cnt} species in taxa table`);

    // Phase 2: 插入 plants
    console.log('\nPhase 2: Populating plants...');
    const [plantRes] = await connection.query(`
      INSERT INTO plants (
        taxon_id, chinese_name, scientific_name,
        wcvp_plant_name_id, wcvp_taxon_rank, wcvp_taxon_status,
        wcvp_family, wcvp_genus, created_at, updated_at
      )
      SELECT
        t.id,
        s.taxon_name,  -- 暂用学名，后续被 fetch-chinese-names.js 覆盖
        s.taxon_name,
        s.plant_name_id,
        s.taxon_rank,
        s.taxon_status,
        s.family,
        s.genus,
        NOW(),
        NOW()
      FROM stg_wcvp_names s
      INNER JOIN taxa t ON t.taxon_rank = 'species' AND t.scientific_name = s.taxon_name
      WHERE LOWER(s.taxon_rank) = 'species'
        AND LOWER(s.taxon_status) = 'accepted'
        AND s.plant_name_id IS NOT NULL
      GROUP BY s.plant_name_id
    `);
    const [[p_cnt]] = await connection.query('SELECT COUNT(*) as cnt FROM plants');
    console.log(`  ✓ ${p_cnt.cnt} plants inserted`);

    // Phase 3: 简化 distributions（可选，仅需要基本的分布链接）
    console.log('\nPhase 3: Populating plant_distributions...');
    const [[d_check]] = await connection.query('SELECT COUNT(*) as cnt FROM stg_wcvp_distribution LIMIT 1');
    
    if (d_check) {
      const [distRes] = await connection.query(`
        INSERT INTO plant_distributions (
          plant_id, taxon_id, wcvp_plant_name_id, scientific_name,
          area_code_l1, area_code_l2, area_code_l3, area_name,
          continent, occurrence_status, introduced, extinct, data_source
        )
        SELECT
          p.id,
          p.taxon_id,
          d.plant_name_id,
          p.scientific_name,
          d.continent_code_l1,
          d.region_code_l2,
          d.area_code_l3,
          d.area_name_l3,
          d.continent,
          CASE 
            WHEN d.location_doubtful = 1 THEN 'doubtful'
            WHEN d.extinct = 1 THEN 'extinct'
            WHEN d.introduced = 1 THEN 'introduced'
            ELSE 'native'
          END,
          d.introduced,
          d.extinct,
          'WCVP'
        FROM stg_wcvp_distribution d
        INNER JOIN plants p ON p.wcvp_plant_name_id = d.plant_name_id
        WHERE d.area_code_l3 IS NOT NULL AND d.area_code_l3 <> ''
      `);
      const [[dist_cnt]] = await connection.query('SELECT COUNT(*) as cnt FROM plant_distributions');
      console.log(`  ✓ ${dist_cnt.cnt} distributions inserted`);
    } else {
      console.log('  ⚠ No distribution data in staging table');
    }

    // 最终摘要
    console.log('\n' + '='.repeat(50));
    console.log('=== IMPORT SUMMARY ===');
    console.log('='.repeat(50));
    
    const [[summary]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM taxa WHERE taxon_rank='family') AS families,
        (SELECT COUNT(*) FROM taxa WHERE taxon_rank='genus') AS genera,
        (SELECT COUNT(*) FROM taxa WHERE taxon_rank='species') AS species_taxa,
        (SELECT COUNT(*) FROM plants) AS plants_total,
        (SELECT COUNT(*) FROM plant_distributions) AS distributions_total,
        (SELECT COUNT(*) FROM plants WHERE chinese_name REGEXP '[一-龥]') AS with_chinese
    `);

    console.log(`
  Families:        ${summary.families}
  Genera:          ${summary.genera}
  Species (taxa):  ${summary.species_taxa}
  Plants:          ${summary.plants_total}
  Distributions:   ${summary.distributions_total}
  With Chinese:    ${summary.with_chinese}
    `);

    console.log('✓ Import completed successfully!');
    console.log('\nNext step: npm run fetch:chinese-names');

  } catch (err) {
    console.error('\n✗ Import failed:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  });
}

module.exports = { main };
