const mysql = require('mysql2/promise');
const cfg = require('../config/config').development;

(async () => {
  const conn = await mysql.createConnection({
    host: cfg.host,
    user: cfg.username,
    password: cfg.password,
    database: process.env.WCVP_DB_NAME || cfg.database
  });

  const [r1] = await conn.query(
    "SELECT COUNT(*) AS cnt FROM plants WHERE scientific_name REGEXP ' [xX×] ' AND chinese_name REGEXP '[一-龥]' AND chinese_name <> scientific_name"
  );
  const [r2] = await conn.query(
    "SELECT COUNT(*) AS cnt FROM plants WHERE chinese_name REGEXP '[一-龥]' AND chinese_name <> scientific_name"
  );

  console.log({
    hybridWithChinese: r1[0].cnt,
    totalWithChinese: r2[0].cnt
  });

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
