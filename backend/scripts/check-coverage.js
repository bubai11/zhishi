const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
    host: sequelizeConfig.host,
    user: sequelizeConfig.username,
    password: sequelizeConfig.password,
    database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

(async () => {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.query(`
        SELECT 
            (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE scientific_name IS NOT NULL AND scientific_name <> '') AS total,
            (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE chinese_name REGEXP '[一-龥]' AND chinese_name<>scientific_name) AS with_chinese,
            ROUND(100.0 * (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE chinese_name REGEXP '[一-龥]' AND chinese_name<>scientific_name) / (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE scientific_name IS NOT NULL AND scientific_name <> ''), 4) AS coverage_pct
    `);
    console.log('\n=== 中文名称覆盖率统计 ===');
    console.log(`总物种数: ${rows[0].total}`);
    console.log(`已映射中文: ${rows[0].with_chinese}`);
    console.log(`覆盖率: ${rows[0].coverage_pct}%`);
    
    // 获取来源统计
    const [sourceStats] = await conn.query(`
        SELECT 
            (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE chinese_name IN ('桃', '玫瑰', '梨', '水稻', '小麦', '玉米', '甘蔗', '大豆', '菜豆', '向日葵', '小白菜', '甘蓝')) AS from_dict,
            (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE chinese_name REGEXP '[一-龥]' AND chinese_name<>scientific_name AND chinese_name NOT IN ('桃', '玫瑰', '梨', '水稻', '小麦', '玉米', '甘蔗', '大豆', '菜豆', '向日葵', '小白菜', '甘蓝')) AS from_api
    `);
    console.log(`\n=== 映射来源 ===`);
    console.log(`本地字典: ${sourceStats[0].from_dict}`);
    console.log(`API映射: ${sourceStats[0].from_api}`);
    
    await conn.end();
})();
