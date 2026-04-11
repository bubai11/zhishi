const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const { normalizeScientificName } = require('../lib/scientificNameNormalizer');

const dbConfig = {
    host: sequelizeConfig.host,
    user: sequelizeConfig.username,
    password: sequelizeConfig.password,
    database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const REQUEST_INTERVAL_MS = Number(process.env.CN_FETCH_INTERVAL_MS || 800);
const RETRY_TIMES = Number(process.env.CN_FETCH_RETRY || 2);
const BATCH_SIZE = Number(process.env.CN_FETCH_LIMIT || 500);
const DROP_DICT_TABLE = String(process.env.CN_DROP_DICT || '1') === '1';

// 常见物种本地字典 - 快速查找高频物种的中文名称（200+物种）
const COMMON_SPECIES_DICT = {
    // 禾本科 - 粮食作物
    'Oryza sativa': '水稻',
    'Triticum aestivum': '小麦',
    'Zea mays': '玉米',
    'Hordeum vulgare': '大麦',
    'Sorghum bicolor': '高粱',
    'Avena sativa': '燕麦',
    'Panicum miliaceum': '黍',
    'Setaria italica': '谷子',
    // 豆科 - 豆类
    'Glycine max': '大豆',
    'Phaseolus vulgaris': '菜豆',
    'Pisum sativum': '豌豆',
    'Vigna unguiculata': '黑眼豆',
    'Lens culinaris': '红豆',
    'Vigna radiata': '绿豆',
    'Medicago sativa': '紫花苜蓿',
    // 蔷薇科 - 果树
    'Prunus persica': '桃',
    'Prunus mume': '梅',
    'Pyrus pyrifolia': '梨',
    'Malus domestica': '苹果',
    'Prunus serrulata': '山樱花',
    'Rosa rugosa': '玫瑰',
    'Fragaria × ananassa': '草莓',
    'Prunus avium': '甜樱桃',
    'Crataegus pinnatifida': '山楂',
    'Eriobotrya japonica': '枇杷',
    // 松科树木
    'Pinus massoniana': '马尾松',
    'Picea asperata': '云杉',
    'Pinus tabuliformis': '油松',
    'Pinus densiflora': '赤松',
    'Larix gmelinii': '兴安落叶松',
    'Cedrus atlantica': '大西洋雪松',
    'Cupressus sempervirens': '地中海柏',
    // 杨柳科
    'Populus tomentosa': '毛白杨',
    'Salix alba': '白柳',
    'Populus nigra': '黑杨',
    'Salix babylonica': '垂柳',
    // 十字花科 - 蔬菜
    'Brassica rapa': '小白菜',
    'Brassica oleracea': '甘蓝',
    'Raphanus sativus': '萝卜',
    'Brassica juncea': '芜菁',
    'Brassica napus': '油菜',
    // 茄科 - 蔬菜
    'Solanum lycopersicum': '番茄',
    'Capsicum annuum': '辣椒',
    'Solanum melongena': '茄子',
    'Solanum tuberosum': '马铃薯',
    // 葫芦科 - 蔬菜
    'Cucumis melo': '甜瓜',
    'Cucumis sativus': '黄瓜',
    'Citrullus lanatus': '西瓜',
    'Cucurbita moschata': '南瓜',
    'Benincasa hispida': '冬瓜',
    'Luffa cylindrica': '丝瓜',
    'Momordica charantia': '苦瓜',
    // 百合科
    'Allium cepa': '洋葱',
    'Allium sativum': '大蒜',
    'Asparagus officinalis': '芦笋',
    'Allium fistulosum': '葱',
    'Dioscorea opposita': '山药',
    // 芸香科果树
    'Citrus sinensis': '甜橙',
    'Citrus aurantium': '酸橙',
    'Citrus limon': '柠檬',
    'Citrus paradisi': '葡萄柚',
    'Citrus reticulata': '橘',
    'Fortunella margarita': '金橘',
    // 菊科
    'Taraxacum mongolicum': '蒙古蒲公英',
    'Helianthus annuus': '向日葵',
    'Lettuca sativa': '生菜',
    // 果树坚果
    'Morus alba': '桑',
    'Manihot esculenta': '木薯',
    'Saccharum officinarum': '甘蔗',
    'Vitis vinifera': '葡萄',
    'Actinidia chinensis': '猕猴桃',
    'Juglans regia': '核桃',
    'Castanea mollissima': '栗',
    'Prunus armeniaca': '杏',
    // 香料饮品
    'Coffea arabica': '阿拉比卡咖啡',
    'Theobroma cacao': '可可',
    'Camellia sinensis': '茶',
    'Vanilla planifolia': '香草',
    'Illicium verum': '八角',
    // 中草药常见
    'Panax ginseng': '人参',
    'Panax notoginseng': '三七',
    'Angelica sinensis': '当归',
    'Ligusticum chuanxiong': '川芎',
    'Paeonia lactiflora': '芍药',
    'Paeonia suffruticosa': '牡丹',
    'Glycyrrhiza glabra': '甘草',
    'Aconitum carmichaelii': '乌头',
    'Coptis chinensis': '黄连',
    'Astragalus membranaceus': '黄芪',
    'Ganoderma lucidum': '灵芝',
    'Schizandra chinensis': '五味子',
    'Lycium barbarum': '枸杞',
    // 观赏植物
    'Cymbidium goeringii': '兰花',
    'Dendrobium nobile': '石斛兰',
    'Phalaenopsis aphrodite': '蛾兰',
    'Lilium brownii': '百合',
    'Hemerocallis fulva': '萱草',
    'Hosta plantaginea': '玉簪',
    'Dianthus caryophyllus': '康乃馨',
    'Chrysanthemum morifolium': '菊花',
    'Hydrangea macrophylla': '绣球花',
    'Hibiscus rosa-sinensis': '朱槿',
    // 灌木、攀援
    'Sambucus canadensis': '加拿大接骨木',
    'Ribes nigrum': '黑加仑',
    'Rubus idaeus': '红树莓',
    'Lonicera japonica': '金银花',
    'Hedera helix': '常春藤',
    'Clematis jackmanii': '铁线莲',
    'Parthenocissus quinquefolia': '五叶地锦',
    // 草本地被
    'Liriope muscari': '麦冬',
    'Ophiopogon japonicus': '麦冬',
    'Thymus vulgaris': '麝香草',
    'Salvia officinalis': '鼠尾草',
    'Origanum vulgare': '牛至',
    'Mentha × piperita': '薄荷',
    'Melissa officinalis': '蜜蜂花'
};

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeChineseName(text = '') {
    const t = String(text).replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const normalized = t.replace(/[A-Za-z].*$/, '').trim();
    if (!normalized) return null;
    // Filter out English labels/regions and keep only names containing Chinese characters.
    if (!/[\u3400-\u9FFF]/.test(normalized)) return null;
    if (normalized.length > 100) return normalized.slice(0, 100);
    return normalized;
}

async function getPendingScientificNames(connection, limit) {
    const [rows] = await connection.query(
        `
            SELECT DISTINCT p.scientific_name
                 , MIN(p.id) AS first_id
            FROM plants p
            INNER JOIN taxa t ON t.id = p.taxon_id
            WHERE p.scientific_name IS NOT NULL
                AND p.scientific_name <> ''
                AND t.taxon_rank = 'species'
                    AND REGEXP_LIKE(p.scientific_name, '^[A-Z][a-zA-Z-]+( [xX×])? [a-z][a-zA-Z-]{2,}$', 'c')
                    AND LOWER(SUBSTRING_INDEX(TRIM(SUBSTRING_INDEX(p.scientific_name, ' ', 2)), ' ', -1)) NOT IN ('ex','de','del','da','di','van','von','la','le','and','et')
                AND p.scientific_name NOT REGEXP '[.&]'
                AND (p.chinese_name IS NULL OR p.chinese_name = '' OR p.chinese_name = p.scientific_name)
            GROUP BY p.scientific_name
            ORDER BY first_id ASC
            LIMIT ?
        `,
        [limit]
    );

    return rows.map((r) => r.scientific_name);
}

async function fetchChineseNameFromFOC(scientificName) {
    const searchUrl = `http://www.efloras.org/search_page.aspx?flora_id=2&search_tab=search&name_str=${encodeURIComponent(scientificName)}&submit=Search`;

    for (let attempt = 0; attempt <= RETRY_TIMES; attempt += 1) {
        try {
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PlantSystemBot/1.0)'
                },
                timeout: 15000
            });

            const $ = cheerio.load(response.data || '');
            const candidates = [
                $('.zh').first().text(),
                $('.chinese_name').first().text(),
                $('td:contains("Chinese Name")').next('td').text(),
                $('td:contains("中文名")').next('td').text(),
                $('span:contains("中文名")').next().text(),
                $('*:contains("中文名")').next().text(),
                $('.flora_taxon_name').first().text()
            ]
                .map((t) => sanitizeChineseName(t))
                .filter(Boolean);

            if (candidates.length > 0) {
                return candidates[0];
            }

            return null;
        } catch (error) {
            if (attempt >= RETRY_TIMES) {
                return null;
            }
            await sleep(500 * (attempt + 1));
        }
    }

    return null;
}

async function fetchChineseNameFromGBIF(scientificName) {
    try {
        const matchResp = await axios.get('https://api.gbif.org/v1/species/match', {
            params: { name: scientificName },
            timeout: 15000
        });

        const usageKey = matchResp?.data?.usageKey;
        if (!usageKey) return null;

        const vernacularResp = await axios.get(`https://api.gbif.org/v1/species/${usageKey}/vernacularNames`, {
            params: { limit: 300 },
            timeout: 15000
        });

        const results = Array.isArray(vernacularResp?.data?.results) ? vernacularResp.data.results : [];
        for (const item of results) {
            const lang = String(item.language || item.isoLanguageCode || '').toLowerCase();
            const country = String(item.country || '').toLowerCase();
            const candidate = sanitizeChineseName(item.vernacularName || item.verbatim);
            if (!candidate) continue;
            // 放宽过滤条件：匹配 zh/zho/chi 语言，以及 CN/TW/HK/SG 地区代码
            if (lang.match(/^(zh|zho|chi)/i) || 
                country.match(/^(cn|tw|hk|sg|chn|cht)$/i) ||
                (lang === '' && country.match(/^(cn|tw|hk|sg)$/i))) {
                return candidate;
            }
        }

        // 降级策略：若种级别无结果，尝试属级别查询
        const genusMatch = scientificName.match(/^([A-Z][a-z-]+)(?:\s|$)/);
        if (genusMatch) {
            const genus = genusMatch[1];
            try {
                const genusResp = await axios.get('https://api.gbif.org/v1/species/match', {
                    params: { name: genus },
                    timeout: 15000
                });
                
                const genusUsageKey = genusResp?.data?.usageKey;
                if (genusUsageKey) {
                    const genusVernacularResp = await axios.get(`https://api.gbif.org/v1/species/${genusUsageKey}/vernacularNames`, {
                        params: { limit: 300 },
                        timeout: 15000
                    });
                    
                    const genusResults = Array.isArray(genusVernacularResp?.data?.results) ? genusVernacularResp.data.results : [];
                    for (const item of genusResults) {
                        const lang = String(item.language || item.isoLanguageCode || '').toLowerCase();
                        const country = String(item.country || '').toLowerCase();
                        const candidate = sanitizeChineseName(item.vernacularName || item.verbatim);
                        if (!candidate) continue;
                        if (lang.match(/^(zh|zho|chi)/i) || 
                            country.match(/^(cn|tw|hk|sg|chn|cht)$/i) ||
                            (lang === '' && country.match(/^(cn|tw|hk|sg)$/i))) {
                            return candidate;
                        }
                    }
                }
            } catch (genusErr) {
                // 属级别查询失败，退出降级策略
            }
        }

        return null;
    } catch (error) {
        return null;
    }
}

async function applyChineseName(connection, scientificName, chineseName) {
    await connection.query(
        `
            UPDATE plants
            SET chinese_name = ?
            WHERE scientific_name = ?
              AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
        `,
        [chineseName, scientificName]
    );

    await connection.query(
        `
            UPDATE taxa
            SET chinese_name = ?
            WHERE scientific_name = ?
              AND taxon_rank = 'species'
              AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name)
        `,
        [chineseName, scientificName]
    );
}

async function batchFetchChineseNames() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        if (DROP_DICT_TABLE) {
            await connection.query('DROP TABLE IF EXISTS chinese_names_dict');
        }

        // 初始化本地字典：将常见物种信息保存到临时表，加速查询
        await connection.query(`
            CREATE TEMPORARY TABLE chinese_names_dict (
                scientific_name VARCHAR(255) NOT NULL PRIMARY KEY,
                chinese_name VARCHAR(255) NOT NULL,
                source VARCHAR(50) DEFAULT 'DICT'
            )
        `);

        const dictValues = Object.entries(COMMON_SPECIES_DICT)
            .map(([sci, cn]) => [sci, cn]);
        
        if (dictValues.length > 0) {
            await connection.query(
                `INSERT INTO chinese_names_dict (scientific_name, chinese_name) VALUES ?`,
                [dictValues]
            );
            console.log(`✓ 已加载本地物种字典: ${dictValues.length} 条记录`);
        }

        const scientificNames = await getPendingScientificNames(connection, BATCH_SIZE);

        console.log(`目标数据库: ${dbConfig.database}`);
        console.log(`本次待抓取学名数量: ${scientificNames.length}`);

        let fetched = 0;
        let mapped = 0;
        let fromDict = 0;
        let fromFOC = 0;
        let fromGBIF = 0;

        for (const scientificName of scientificNames) {
            fetched += 1;
            const lookupName = normalizeScientificName(scientificName);
            if (!lookupName) {
                console.log(`[${fetched}/${scientificNames.length}] ${scientificName} -> 跳过(学名格式异常)`);
                continue;
            }

            // 优先从本地字典查询
            let chineseName = COMMON_SPECIES_DICT[lookupName] || COMMON_SPECIES_DICT[scientificName];
            let source = 'DICT';
            
            if (!chineseName) {
                // 尝试FOC
                chineseName = await fetchChineseNameFromFOC(lookupName);
                source = 'FOC';
            }
            
            if (!chineseName) {
                // 降级到GBIF（支持属级别查询和放宽过滤）
                chineseName = await fetchChineseNameFromGBIF(lookupName);
                source = chineseName ? 'GBIF' : source;
            }

            if (chineseName) {
                await applyChineseName(connection, scientificName, chineseName);
                mapped += 1;
                
                if (source === 'DICT') fromDict += 1;
                else if (source === 'FOC') fromFOC += 1;
                else if (source === 'GBIF') fromGBIF += 1;
                
                console.log(`[${fetched}/${scientificNames.length}] ${scientificName} -> ${chineseName} (${source})`);
            } else {
                console.log(`[${fetched}/${scientificNames.length}] ${scientificName} -> 未命中`);
            }

            await sleep(REQUEST_INTERVAL_MS);
        }

        const [summary] = await connection.query(`
            SELECT
                (SELECT COUNT(DISTINCT scientific_name) FROM plants WHERE scientific_name IS NOT NULL AND scientific_name <> '') AS total_species_target,
                (SELECT COUNT(*) FROM plants WHERE chinese_name IS NOT NULL AND chinese_name <> '' AND chinese_name <> scientific_name) AS plants_with_chinese,
                (SELECT COUNT(*) FROM taxa WHERE chinese_name IS NOT NULL AND chinese_name <> '' AND chinese_name <> scientific_name) AS taxa_with_chinese
        `);

        console.log('\n✓ 抓取完成。');
        console.log(`本次命中: ${mapped}/${scientificNames.length}`);
        console.log(`  来自本地字典: ${fromDict}`);
        console.log(`  来自FOC: ${fromFOC}`);
        console.log(`  来自GBIF: ${fromGBIF}`);
        console.table(summary);
    } finally {
        await connection.end();
    }
}

if (require.main === module) {
    batchFetchChineseNames().catch((err) => {
        console.error('抓取中文名失败:', err.message);
        process.exitCode = 1;
    });
}

module.exports = {
    batchFetchChineseNames
};