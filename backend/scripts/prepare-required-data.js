const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
    host: sequelizeConfig.host,
    user: sequelizeConfig.username,
    password: sequelizeConfig.password,
    database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const OUT_DIR = path.join(__dirname, '..', 'data');
const TOP_PENDING_LIMIT = Number(process.env.CN_PENDING_EXPORT_LIMIT || 2000);

function csvEscape(value) {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function writeCsv(filePath, headers, rows) {
    const lines = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => csvEscape(row[h])).join(','));
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const connection = await mysql.createConnection(dbConfig);

    try {
        const [summaryRows] = await connection.query(`
            SELECT
                (SELECT COUNT(DISTINCT scientific_name)
                 FROM plants
                 WHERE scientific_name IS NOT NULL AND scientific_name <> '') AS total_species,
                (SELECT COUNT(DISTINCT scientific_name)
                 FROM plants
                 WHERE chinese_name REGEXP '[一-龥]' AND chinese_name <> scientific_name) AS mapped_species,
                (SELECT COUNT(DISTINCT scientific_name)
                 FROM plants
                 WHERE (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
                   AND scientific_name IS NOT NULL
                   AND scientific_name <> '') AS pending_species
        `);

        const [pendingRows] = await connection.query(
            `
            SELECT
                p.scientific_name,
                MIN(p.wcvp_family) AS family,
                MIN(p.wcvp_genus) AS genus,
                COUNT(*) AS plant_rows,
                MIN(p.id) AS first_plant_id,
                '' AS chinese_name,
                'TODO' AS source,
                '' AS note
            FROM plants p
            INNER JOIN taxa t ON t.id = p.taxon_id
            WHERE p.scientific_name IS NOT NULL
              AND p.scientific_name <> ''
              AND t.taxon_rank = 'species'
              AND (p.chinese_name IS NULL OR p.chinese_name = '' OR p.chinese_name = p.scientific_name)
              AND REGEXP_LIKE(p.scientific_name, '^[A-Z][a-zA-Z-]+( [xX×])? [a-z][a-zA-Z-]{2,}$', 'c')
            GROUP BY p.scientific_name
            ORDER BY plant_rows DESC, first_plant_id ASC
            LIMIT ?
            `,
            [TOP_PENDING_LIMIT]
        );

        const [mappedRows] = await connection.query(`
            SELECT DISTINCT
                p.scientific_name,
                p.chinese_name,
                MIN(p.wcvp_family) AS family,
                MIN(p.wcvp_genus) AS genus,
                'CURRENT_DB' AS source
            FROM plants p
            WHERE p.chinese_name REGEXP '[一-龥]'
              AND p.chinese_name <> p.scientific_name
            GROUP BY p.scientific_name, p.chinese_name
            ORDER BY p.scientific_name
        `);

        const summaryPath = path.join(OUT_DIR, 'cn-data-summary.json');
        const pendingPath = path.join(OUT_DIR, 'cn-pending-template.csv');
        const mappedPath = path.join(OUT_DIR, 'cn-mapped-current.csv');

        const summary = {
            generated_at: new Date().toISOString(),
            database: dbConfig.database,
            total_species: summaryRows[0].total_species,
            mapped_species: summaryRows[0].mapped_species,
            pending_species: summaryRows[0].pending_species,
            pending_exported: pendingRows.length
        };

        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

        writeCsv(
            pendingPath,
            ['scientific_name', 'family', 'genus', 'plant_rows', 'first_plant_id', 'chinese_name', 'source', 'note'],
            pendingRows
        );

        writeCsv(
            mappedPath,
            ['scientific_name', 'chinese_name', 'family', 'genus', 'source'],
            mappedRows
        );

        console.log('已准备数据文件:');
        console.log(`- ${summaryPath}`);
        console.log(`- ${pendingPath}`);
        console.log(`- ${mappedPath}`);
        console.log('摘要:');
        console.log(summary);
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('准备数据失败:', err.message);
        process.exitCode = 1;
    });
}
