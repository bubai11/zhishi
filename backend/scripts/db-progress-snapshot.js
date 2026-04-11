const mysql = require('mysql2/promise');
const cfg = require('../config/config').development;

(async () => {
    const conn = await mysql.createConnection({
        host: cfg.host,
        user: cfg.username,
        password: cfg.password,
        database: cfg.database
    });

    const [rows] = await conn.query(`
        SELECT
            (SELECT COUNT(*) FROM stg_wcvp_names) AS stg_names,
            (SELECT COUNT(*) FROM stg_wcvp_distribution) AS stg_dist,
            (SELECT COUNT(*) FROM taxa) AS taxa_cnt,
            (SELECT COUNT(*) FROM plants) AS plants_cnt,
            (SELECT COUNT(*) FROM plant_distributions) AS plant_dist_cnt,
            (SELECT COUNT(DISTINCT scientific_name)
             FROM plants
             WHERE chinese_name REGEXP '[一-龥]' AND chinese_name <> scientific_name) AS mapped_species,
            (SELECT COUNT(DISTINCT scientific_name)
             FROM plants
             WHERE scientific_name IS NOT NULL AND scientific_name <> '') AS total_species
    `);

    console.log(rows[0]);
    await conn.end();
})();
