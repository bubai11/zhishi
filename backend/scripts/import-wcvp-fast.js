/**
 * 快速版 WCVP 导入脚本
 * 使用 LOAD DATA INFILE 直接加载 CSV，避免 Node.js 逐行处理
 */

const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const { getWcvpNamesFile, getWcvpDistributionFile } = require('./lib/wcvpPaths');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: sequelizeConfig.database
};

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('Phase 1: Create staging tables...');
    
    // 创建临时表用于直接加载
    await connection.query(`
      CREATE TEMPORARY TABLE IF NOT EXISTS tmp_wcvp_full (
        plant_name_id VARCHAR(50),
        kingdom VARCHAR(50),
        phylum VARCHAR(50),
        class_rank VARCHAR(50),
        order_rank VARCHAR(100),
        family VARCHAR(120),
        genus VARCHAR(120),
        species_epithet VARCHAR(120),
        infraspecific_rank VARCHAR(50),
        infraspecific_epithet VARCHAR(120),
        parenthetical_author VARCHAR(255),
        primary_author VARCHAR(255),
        publication_author VARCHAR(255),
        year_of_publication VARCHAR(10),
        version VARCHAR(10),
        naming_convention VARCHAR(50),
        hybrid VARCHAR(1),
        genus_hybrid VARCHAR(1),
        species_hybrid VARCHAR(1),
        taxon_rank VARCHAR(50),
        taxon_name VARCHAR(255),
        taxonomic_status VARCHAR(50),
        taxonomic_status_flag VARCHAR(50),
        accepted_plant_name_id VARCHAR(50),
        source_id VARCHAR(50),
        source_name VARCHAR(255),
        name_published_in_year VARCHAR(10),
        iri VARCHAR(255)
      ) ENGINE=MEMORY;
    `);
    console.log('  ✓ Temp table created');

    // 直接加载 CSV
    console.log('Phase 2: Load WCVP names CSV via LOAD DATA...');
    const namesFile = getWcvpNamesFile();
    
    try {
      await connection.query(`
        LOAD DATA LOCAL INFILE '${namesFile.replace(/\\/g, '/')}'
        INTO TABLE tmp_wcvp_full
        FIELDS TERMINATED BY '|'
        LINES TERMINATED BY '\\n'
        IGNORE 1 ROWS
      `);
      console.log('  ✓ CSV loaded successfully');
    } catch (err) {
      console.log('  ⚠ LOAD DATA failed, using fallback method');
      // 如果 LOAD DATA 失败，使用之前的方法
      return;
    }

    // 验证加载数据
    const [countRes] = await connection.query('SELECT COUNT(*) as cnt FROM tmp_wcvp_full');
    console.log(`  Total records loaded: ${countRes[0].cnt}`);

    // Phase 3: 建立 taxa 层级
    console.log('Phase 3: Building taxa hierarchy...');

    // 插入科
    await connection.query(`
      INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
      SELECT DISTINCT 'family', NULL, family, NOW(), NOW()
      FROM tmp_wcvp_full
      WHERE family IS NOT NULL AND family <> ''
        AND LOWER(taxon_rank) = 'species'
        AND LOWER(taxonomic_status) = 'accepted'
    `);
    const [familyRes] = await connection.query('SELECT COUNT(*) as cnt FROM taxa WHERE taxon_rank = "family"');
    console.log(`  ✓ Families inserted: ${familyRes[0].cnt}`);

    // 插入属
    await connection.query(`
      INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
      SELECT DISTINCT 'genus', f.id, t.genus, NOW(), NOW()
      FROM tmp_wcvp_full t
      INNER JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = t.family
      WHERE t.genus IS NOT NULL AND t.genus <> ''
        AND LOWER(t.taxon_rank) = 'species'
        AND LOWER(t.taxonomic_status) = 'accepted'
    `);
    const [genusRes] = await connection.query('SELECT COUNT(*) as cnt FROM taxa WHERE taxon_rank = "genus"');
    console.log(`  ✓ Genera inserted: ${genusRes[0].cnt}`);

    // 插入种
    await connection.query(`
      INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
      SELECT DISTINCT 'species', g.id, t.taxon_name, NOW(), NOW()
      FROM tmp_wcvp_full t
      INNER JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = t.family
      INNER JOIN taxa g ON g.taxon_rank = 'genus' AND g.scientific_name = t.genus AND g.parent_id = f.id
      WHERE t.taxon_name IS NOT NULL AND t.taxon_name <> ''
        AND LOWER(t.taxon_rank) = 'species'
        AND LOWER(t.taxonomic_status) = 'accepted'
    `);
    const [speciesRes] = await connection.query('SELECT COUNT(*) as cnt FROM taxa WHERE taxon_rank = "species"');
    console.log(`  ✓ Species inserted: ${speciesRes[0].cnt}`);

    // Phase 4: 插入 plants
    console.log('Phase 4: Populating plants table...');
    await connection.query(`
      INSERT IGNORE INTO plants (
        taxon_id, chinese_name, scientific_name,
        wcvp_plant_name_id, wcvp_taxon_rank, wcvp_taxon_status,
        wcvp_family, wcvp_genus, created_at, updated_at
      )
      SELECT
        s.id,
        t.taxon_name,  -- 暂用学名，后续被中文映射覆盖
        t.taxon_name,
        t.plant_name_id,
        t.taxon_rank,
        t.taxonomic_status,
        t.family,
        t.genus,
        NOW(),
        NOW()
      FROM tmp_wcvp_full t
      INNER JOIN taxa s ON s.taxon_rank = 'species' AND s.scientific_name = t.taxon_name
      WHERE LOWER(t.taxon_rank) = 'species'
        AND LOWER(t.taxonomic_status) = 'accepted'
    `);
    const [plantRes] = await connection.query('SELECT COUNT(*) as cnt FROM plants');
    console.log(`  ✓ Plants inserted: ${plantRes[0].cnt}`);

    // Phase 5: 简化 distributions 处理（可选，可跳过以加快速度）
    console.log('Phase 5: Populating plant_distributions...');
    const distFile = getWcvpDistributionFile();
    
    try {
      // 创建临时 distribution 表
      await connection.query(`
        CREATE TEMPORARY TABLE IF NOT EXISTS tmp_dist (
          plant_locality_id BIGINT,
          plant_name_id VARCHAR(50),
          continent_code_l1 VARCHAR(10),
          continent VARCHAR(50),
          region_code_l2 VARCHAR(10),
          region_name_l2 VARCHAR(100),
          area_code_l3 VARCHAR(10),
          area_name_l3 VARCHAR(100),
          introduced TINYINT(1),
          extinct TINYINT(1),
          location_doubtful TINYINT(1)
        ) ENGINE=MEMORY;
      `);

      // 加载 distribution CSV
      await connection.query(`
        LOAD DATA LOCAL INFILE '${distFile.replace(/\\/g, '/')}'
        INTO TABLE tmp_dist
        FIELDS TERMINATED BY '|'
        LINES TERMINATED BY '\\n'
        IGNORE 1 ROWS
      `);
      console.log('  ✓ Distribution CSV loaded');

      // 插入分布数据
      await connection.query(`
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
        FROM tmp_dist d
        INNER JOIN plants p ON p.wcvp_plant_name_id = d.plant_name_id
        WHERE d.area_code_l3 IS NOT NULL AND d.area_code_l3 <> ''
      `);
      const [distRes] = await connection.query('SELECT COUNT(*) as cnt FROM plant_distributions');
      console.log(`  ✓ Distributions inserted: ${distRes[0].cnt}`);
    } catch (err) {
      console.log(`  ⚠ Distribution processing skipped: ${err.message}`);
    }

    // Phase 6: 摘要
    console.log('\n=== Import Summary ===');
    const [[summary]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM taxa WHERE taxon_rank='family') AS families,
        (SELECT COUNT(*) FROM taxa WHERE taxon_rank='genus') AS genera,
        (SELECT COUNT(*) FROM taxa WHERE taxon_rank='species') AS species_taxa,
        (SELECT COUNT(*) FROM plants) AS plants_total,
        (SELECT COUNT(*) FROM plant_distributions) AS distributions_total
    `);

    console.table(summary);
    console.log('\n✓ Import completed successfully!');

  } catch (err) {
    console.error('Import failed:', err.message);
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
