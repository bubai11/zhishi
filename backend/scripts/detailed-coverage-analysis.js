const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
    host: sequelizeConfig.host,
    user: sequelizeConfig.username,
    password: sequelizeConfig.password,
    database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

// 本地字典中的物种列表（从fetch-chinese-names.js复制）
const DICT_SPECIES = [
    'Oryza sativa', 'Triticum aestivum', 'Zea mays', 'Hordeum vulgare', 'Sorghum bicolor',
    'Avena sativa', 'Panicum miliaceum', 'Setaria italica',
    'Glycine max', 'Phaseolus vulgaris', 'Pisum sativum', 'Vigna unguiculata',
    'Lens culinaris', 'Vigna radiata', 'Medicago sativa',
    'Prunus persica', 'Prunus mume', 'Pyrus pyrifolia', 'Malus domestica', 
    'Prunus serrulata', 'Rosa rugosa', 'Fragaria × ananassa', 'Prunus avium',
    'Crataegus pinnatifida', 'Eriobotrya japonica',
    'Pinus massoniana', 'Picea asperata', 'Pinus tabuliformis', 'Pinus densiflora',
    'Larix gmelinii', 'Cedrus atlantica', 'Cupressus sempervirens',
    'Populus tomentosa', 'Salix alba', 'Populus nigra', 'Salix babylonica',
    'Brassica rapa', 'Brassica oleracea', 'Raphanus sativus', 'Brassica juncea',
    'Brassica napus',
    'Solanum lycopersicum', 'Capsicum annuum', 'Solanum melongena', 'Solanum tuberosum',
    'Cucumis melo', 'Cucumis sativus', 'Citrullus lanatus', 'Cucurbita moschata',
    'Benincasa hispida', 'Luffa cylindrica', 'Momordica charantia',
    'Allium cepa', 'Allium sativum', 'Asparagus officinalis', 'Allium fistulosum',
    'Dioscorea opposita',
    'Citrus sinensis', 'Citrus aurantium', 'Citrus limon', 'Citrus paradisi',
    'Citrus reticulata', 'Fortunella margarita',
    'Taraxacum mongolicum', 'Helianthus annuus', 'Lettuca sativa',
    'Morus alba', 'Manihot esculenta', 'Saccharum officinarum', 'Vitis vinifera',
    'Actinidia chinensis', 'Juglans regia', 'Castanea mollissima', 'Prunus armeniaca',
    'Coffea arabica', 'Theobroma cacao', 'Camellia sinensis', 'Vanilla planifolia',
    'Illicium verum',
    'Panax ginseng', 'Panax notoginseng', 'Angelica sinensis', 'Ligusticum chuanxiong',
    'Paeonia lactiflora', 'Paeonia suffruticosa', 'Glycyrrhiza glabra',
    'Aconitum carmichaelii', 'Coptis chinensis', 'Astragalus membranaceus',
    'Ganoderma lucidum', 'Schizandra chinensis', 'Lycium barbarum',
    'Cymbidium goeringii', 'Dendrobium nobile', 'Phalaenopsis aphrodite',
    'Lilium brownii', 'Hemerocallis fulva', 'Hosta plantaginea', 'Dianthus caryophyllus',
    'Chrysanthemum morifolium', 'Hydrangea macrophylla', 'Hibiscus rosa-sinensis',
    'Sambucus canadensis', 'Ribes nigrum', 'Rubus idaeus', 'Lonicera japonica',
    'Hedera helix', 'Clematis jackmanii', 'Parthenocissus quinquefolia',
    'Liriope muscari', 'Ophiopogon japonicus', 'Thymus vulgaris', 'Salvia officinalis',
    'Origanum vulgare', 'Mentha × piperita', 'Melissa officinalis'
];

(async () => {
    const conn = await mysql.createConnection(dbConfig);
    
    // 获取基本统计
    const [stats] = await conn.query(`
        SELECT 
            (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE scientific_name IS NOT NULL AND scientific_name <> '') AS total,
            (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE chinese_name REGEXP '[一-龥]' AND chinese_name<>scientific_name) AS with_chinese
    `);
    
    // 检查字典物种中有多少被映射
    const placeholders = DICT_SPECIES.map(() => '?').join(',');
    const [dictStats] = await conn.query(`
        SELECT 
            COUNT(DISTINCT scientific_name) as total_in_db,
            COUNT(DISTINCT CASE WHEN chinese_name REGEXP '[一-龥]' AND chinese_name<>scientific_name THEN scientific_name END) as mapped_from_dict
        FROM plants 
        WHERE scientific_name IN (${placeholders})
    `, DICT_SPECIES);
    
    // 获取API映射的统计
    const [apiStats] = await conn.query(`
        SELECT 
            COUNT(DISTINCT scientific_name) as api_mapped,
            COUNT(DISTINCT CASE WHEN chinese_name IN (
                '梅', '山樱花', '马尾松', '云杉', '蒙古蒲公英', '梨'
            ) THEN scientific_name END) as from_gbif_only
        FROM plants
        WHERE chinese_name REGEXP '[一-龥]' AND chinese_name<>scientific_name
    `);
    
    const total = stats[0].total;
    const with_chinese = stats[0].with_chinese;
    const coverage_pct = (100.0 * with_chinese / total).toFixed(4);
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        中文名称映射详细分析报告                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    console.log('【整体覆盖率】');
    console.log(`  总物种数:        ${total.toLocaleString()}`);
    console.log(`  已映射中文:      ${with_chinese.toLocaleString()}`);
    console.log(`  覆盖率:          ${coverage_pct}%\n`);
    
    console.log('【本地字典效果】');
    console.log(`  字典包含物种:    ${DICT_SPECIES.length} 条`);
    console.log(`  DB中存在:        ${dictStats[0].total_in_db.toLocaleString()} 条`);
    console.log(`  已成功映射:      ${dictStats[0].mapped_from_dict} 条`);
    console.log(`  字典命中率:      ${(100.0 * dictStats[0].mapped_from_dict / dictStats[0].total_in_db).toFixed(2)}%\n`);
    
    console.log('【映射来源构成】');
    console.log(`  本地字典:        ${dictStats[0].mapped_from_dict} 条 (${(100.0 * dictStats[0].mapped_from_dict / with_chinese).toFixed(2)}%)`);
    console.log(`  API映射:         ${apiStats[0].api_mapped} 条 (${(100.0 * apiStats[0].api_mapped / with_chinese).toFixed(2)}%)\n`);
    
    // 获取一些映射成功的例子
    const [examples] = await conn.query(`
        SELECT DISTINCT scientific_name, chinese_name
        FROM plants
        WHERE chinese_name REGEXP '[一-龥]' AND chinese_name<>scientific_name
        LIMIT 30
    `);
    
    console.log('【映射成功的物种样例】');
    examples.forEach((row, idx) => {
        console.log(`  ${(idx+1).toString().padStart(2, ' ')}. ${row.scientific_name} → ${row.chinese_name}`);
    });
    
    console.log('\n');
    await conn.end();
})();
