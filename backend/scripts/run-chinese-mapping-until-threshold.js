const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const { batchFetchChineseNames } = require('./fetch-chinese-names');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const TARGET_COVERAGE = Number(process.env.CN_TARGET_COVERAGE || 0.15);
const MAX_ROUNDS = Number(process.env.CN_MAX_ROUNDS || 5);
const FETCH_LIMIT_PER_ROUND = Number(process.env.CN_FETCH_LIMIT || 1000);

async function getCoverage(connection) {
  const [rows] = await connection.query(`
    SELECT
      (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE scientific_name IS NOT NULL AND scientific_name <> '') AS total_targets,
      (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE chinese_name IS NOT NULL AND chinese_name <> '' AND chinese_name <> scientific_name AND chinese_name REGEXP '[一-龥]') AS plants_mapped,
      (SELECT COUNT(*) FROM plants WHERE chinese_name IS NOT NULL AND chinese_name <> '' AND chinese_name <> scientific_name) AS plants_with_chinese,
      (SELECT COUNT(*) FROM taxa WHERE chinese_name IS NOT NULL AND chinese_name <> '' AND chinese_name <> scientific_name) AS taxa_with_chinese
  `);

  const data = rows[0] || {};
  const totalTargets = Number(data.total_targets || 0);
  const plantsMapped = Number(data.plants_mapped || 0);
  const coverage = totalTargets > 0 ? plantsMapped / totalTargets : 0;

  return {
    totalTargets,
    plantsMapped,
    coverage,
    plantsWithChinese: Number(data.plants_with_chinese || 0),
    taxaWithChinese: Number(data.taxa_with_chinese || 0)
  };
}

async function main() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    process.env.CN_FETCH_LIMIT = String(FETCH_LIMIT_PER_ROUND);

    const reports = [];

    let current = await getCoverage(connection);
    reports.push({ round: 0, ...current });

    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      if (current.coverage >= TARGET_COVERAGE) break;

      console.log(`开始第 ${round} 轮抓取，目标覆盖率: ${(TARGET_COVERAGE * 100).toFixed(2)}%`);
      await batchFetchChineseNames();

      current = await getCoverage(connection);
      reports.push({ round, ...current });

      console.log(`第 ${round} 轮后覆盖率: ${(current.coverage * 100).toFixed(4)}%`);
    }

    console.log('中文映射覆盖率报告:');
    console.table(
      reports.map((r) => ({
        round: r.round,
        total_targets: r.totalTargets,
        plants_mapped: r.plantsMapped,
        coverage_pct: (r.coverage * 100).toFixed(4),
        plants_with_chinese: r.plantsWithChinese,
        taxa_with_chinese: r.taxaWithChinese
      }))
    );
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('中文映射批跑失败:', err.message);
  if (err && err.stack) {
    console.error(err.stack);
  }
  process.exitCode = 1;
});
