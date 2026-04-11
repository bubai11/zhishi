const mysql = require('mysql2/promise');
const config = require('../config/config').development;

const dbConfig = {
  host: config.host,
  user: config.username,
  password: config.password,
  database: process.env.WCVP_DB_NAME || config.database
};

function extractGenus(scientificName) {
  const match = scientificName.match(/^([A-Z][a-z]+)\s+/);
  return match ? match[1] : null;
}

function extractEpithet(scientificName) {
  // Extract the part after the hybrid marker (× or x)
  const match = scientificName.match(/[×xX]\s+([a-z]+)/);
  return match ? match[1] : null;
}

function generateChineseName(scientificName, genusMapping) {
  const genus = extractGenus(scientificName);
  const epithet = extractEpithet(scientificName);

  if (!genus) return null;

  // Get genus Chinese name from mapping
  const genusChineseName = genusMapping[genus] || genus;

  // Build normalized name with epithet suffix
  let chineseName = `${genusChineseName}杂交种`;
  
  if (epithet && epithet.length > 0) {
    // Truncate epithet to reasonable length (first 8 chars)
    const truncatedEpithet = epithet.slice(0, 8);
    chineseName += `(${truncatedEpithet})`;
  }

  return chineseName;
}

async function normalizeHybridChineseNames() {
  const conn = await mysql.createConnection(dbConfig);
  
  try {
    console.log('=== Phase 2 & 3: Plan B - Hybrid Chinese Name Normalization ===\n');
    console.log('Reading genus mapping...');
    const genusMapping = require('../data/genus_mapping');
    console.log(`Loaded ${Object.keys(genusMapping).length} genus mappings\n`);

    // Get all hybrids
    console.log('Fetching all hybrid plants...');
    const [hybrids] = await conn.query(`
      SELECT id, scientific_name, chinese_name
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
      ORDER BY scientific_name
    `);
    console.log(`Found ${hybrids.length} hybrids\n`);

    // Process updates
    let updated = 0;
    let skipped = 0;
    const updates = [];

    for (const record of hybrids) {
      const scientificName = record.scientific_name.trim();
      const newChineseName = generateChineseName(scientificName, genusMapping);

      if (!newChineseName) {
        skipped++;
        continue;
      }

      updates.push({
        id: record.id,
        old: record.chinese_name,
        new: newChineseName,
        changed: record.chinese_name !== newChineseName
      });

      if (updates.length >= 100) {
        // Batch update
        const stmt = 'UPDATE plants SET chinese_name = ?, translation_source = ?, translation_confidence = ? WHERE id = ?';
        for (const upd of updates) {
          await conn.execute(stmt, [upd.new, 'B_NORMALIZATION', 100, upd.id]);
        }
        updated += updates.filter(u => u.changed).length;
        updates.length = 0;
      }
    }

    // Final batch
    if (updates.length > 0) {
      const stmt = 'UPDATE plants SET chinese_name = ?, translation_source = ?, translation_confidence = ? WHERE id = ?';
      for (const upd of updates) {
        await conn.execute(stmt, [upd.new, 'B_NORMALIZATION', 100, upd.id]);
      }
      updated += updates.filter(u => u.changed).length;
    }

    console.log(`=== Normalization Complete ===`);
    console.log(`Updated: ${updated} records`);
    console.log(`Skipped: ${skipped} records\n`);

    // Verification
    console.log('=== Post-Normalization Verification ===\n');
    
    const [formatCheck] = await conn.query(`
      SELECT 
        CASE 
          WHEN chinese_name LIKE '%杂交种(%' THEN 'format_with_epithet'
          WHEN chinese_name LIKE '%杂交%' THEN 'format_plain'
          WHEN chinese_name REGEXP ' [×xX] ' THEN 'still_scientific'
          ELSE 'other'
        END as format,
        COUNT(*) as count
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
      GROUP BY format
    `);
    console.log(`Format distribution after normalization:`);
    for (const row of formatCheck) {
      console.log(`  - ${row.format}: ${row.count}`);
    }
    console.log();

    // Check high-repeat genera
    const [genusCheck] = await conn.query(`
      SELECT 
        SUBSTRING_INDEX(scientific_name, ' ', 1) as genus,
        COUNT(*) as count,
        COUNT(DISTINCT chinese_name) as unique_names,
        GROUP_CONCAT(DISTINCT chinese_name LIMIT 3 SEPARATOR ' | ') as samples
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
      GROUP BY genus
      HAVING count > 50
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log(`High-count genera (>50) - now with epithet distinction:`);
    for (const row of genusCheck) {
      console.log(`  - ${row.genus}: ${row.count} hybrids → ${row.unique_names} unique names`);
      console.log(`    Samples: ${row.samples.substring(0, 100)}...`);
    }
    console.log();

    // Sample display
    const [samples] = await conn.query(`
      SELECT scientific_name, chinese_name
      FROM plants
      WHERE scientific_name REGEXP ' [×xX] '
      ORDER BY RAND()
      LIMIT 8
    `);
    console.log(`=== Random Samples After Normalization ===\n`);
    for (const row of samples) {
      console.log(`${row.scientific_name.padEnd(35)} → ${row.chinese_name}`);
    }

  } finally {
    await conn.end();
  }
}

normalizeHybridChineseNames().catch((e) => {
  console.error(`Normalization failed: ${e.message}`);
  process.exitCode = 1;
});
