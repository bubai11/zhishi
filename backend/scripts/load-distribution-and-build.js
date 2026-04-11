#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: sequelizeConfig.database
};

const { getWcvpDistributionFile } = require('./lib/wcvpPaths');
const DIST_FILE = getWcvpDistributionFile();
const BATCH_SIZE = 10000;

async function bulkInsert(connection, rows) {
  if (!rows.length) return;
  const sql = `
    INSERT INTO stg_wcvp_distribution (
      plant_locality_id, plant_name_id, continent_code_l1, continent,
      region_code_l2, region_name_l2, area_code_l3, area_name_l3,
      introduced, extinct, location_doubtful
    ) VALUES ${rows.map(() => '(?,?,?,?,?,?,?,?,?,?,?)').join(',')}
    ON DUPLICATE KEY UPDATE
      plant_name_id = VALUES(plant_name_id),
      continent_code_l1 = VALUES(continent_code_l1),
      continent = VALUES(continent),
      region_code_l2 = VALUES(region_code_l2),
      region_name_l2 = VALUES(region_name_l2),
      area_code_l3 = VALUES(area_code_l3),
      area_name_l3 = VALUES(area_name_l3),
      introduced = VALUES(introduced),
      extinct = VALUES(extinct),
      location_doubtful = VALUES(location_doubtful)
  `;
  await connection.query(sql, rows.flat());
}

async function loadDistributionCSV(connection) {
  if (!fs.existsSync(DIST_FILE)) {
    throw new Error(`Distribution CSV not found: ${DIST_FILE}`);
  }

  console.log(`Loading distribution CSV: ${DIST_FILE}`);

  let lineNo = 0;
  let inserted = 0;
  let rows = [];

  const rl = readline.createInterface({
    input: fs.createReadStream(DIST_FILE),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    lineNo += 1;
    if (lineNo === 1 || !line) continue;

    const c = line.split('|');
    rows.push([
      c[0] || null,
      c[1] || null,
      c[2] || null,
      c[3] || null,
      c[4] || null,
      c[5] || null,
      c[6] || null,
      c[7] || null,
      c[8] ? Number(c[8]) : 0,
      c[9] ? Number(c[9]) : 0,
      c[10] ? Number(c[10]) : 0
    ]);

    if (rows.length >= BATCH_SIZE) {
      await bulkInsert(connection, rows);
      inserted += rows.length;
      if (inserted % 100000 === 0) {
        console.log(`  staged ${inserted} rows`);
      }
      rows = [];
    }
  }

  if (rows.length) {
    await bulkInsert(connection, rows);
    inserted += rows.length;
  }

  console.log(`Distribution staged rows processed: ${inserted}`);
}

async function buildPlantDistributions(connection) {
  console.log('Building plant_distributions from staging...');
  await connection.query('DELETE FROM plant_distributions');

  const sql = `
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
    ON DUPLICATE KEY UPDATE
      area_name = VALUES(area_name),
      continent = VALUES(continent),
      introduced = VALUES(introduced),
      extinct = VALUES(extinct)
  `;

  await connection.query(sql);
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    await connection.query('TRUNCATE TABLE stg_wcvp_distribution');
    await loadDistributionCSV(connection);
    await buildPlantDistributions(connection);

    const [[summary]] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM stg_wcvp_distribution) AS stg_distribution_rows,
        (SELECT COUNT(*) FROM plant_distributions) AS plant_distribution_rows
    `);

    console.log('Summary:', summary);
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
}
