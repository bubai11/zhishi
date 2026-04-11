const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'cn-pending-template.csv');

const MANUAL_MAP = {
    'Phyllostachys edulis': '毛竹',
    'Cedrus deodara': '喜马拉雅雪松',
    'Magnolia denudata': '玉兰',
    'Liriodendron chinense': '鹅掌楸',
    'Arachis hypogaea': '花生',
    'Albizia julibrissin': '合欢',
    'Artemisia annua': '黄花蒿',
    'Arabidopsis thaliana': '拟南芥',
    'Daucus carota': '胡萝卜',
    'Apium graveolens': '芹菜',
    'Coriandrum sativum': '芫荽',
    'Foeniculum vulgare': '茴香',
    'Homonoia retusa': '水锦树',
    'Howea belmoreana': '贝尔莫尔椰子',
    'Howea forsteriana': '肯氏椰子',
    'Hura polyandra': '沙盒树',
    'Anoectochilus formosanus': '台湾金线莲',
    'Anoectochilus emeiensis': '峨眉金线莲',
    'Anoectochilus roxburghii': '金线莲',
    'Anoectochilus zhejiangensis': '浙江金线莲',
    'Hyophorbe lagenicaulis': '瓶干榈',
    'Hyophorbe verschaffeltii': '纺锤棕',
    'Hyophorbe amaricaulis': '毛里求斯瓶干榈',
    'Hyphaene dichotoma': '二叉棕',
    'Hyphaene compressa': '压缩二叉棕',
    'Hyphaene petersiana': '彼得二叉棕',
    'Isochilus aurantiacus': '橙花等唇兰',
    'Ixora aciculiflora': '针花龙船花',
    'Ixora chinensis': '龙船花',
    'Livistona chinensis': '蒲葵',
    'Mosla japonica': '日本香薷',
    'Nauclea officinalis': '胆木',
    'Leucas chinensis': '野芝麻',
    'Isodon japonicus': '日本香茶菜',
    'Isodon rubescens': '冬凌草',
    'Isodon rugosus': '皱叶香茶菜',
    'Isotria verticillata': '轮叶异蕊兰',
    'Ixora auriculata': '耳叶龙船花',
    'Ixora auricularis': '耳状龙船花'
};

function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuote && line[i + 1] === '"') {
                cur += '"';
                i += 1;
            } else {
                inQuote = !inQuote;
            }
        } else if (ch === ',' && !inQuote) {
            out.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    out.push(cur);
    return out;
}

function toCsvLine(cols) {
    return cols
        .map((v) => {
            const s = String(v ?? '');
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        })
        .join(',');
}

function main() {
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split(/\r?\n/);
    if (lines.length <= 1) {
        console.log('模板为空，无需处理。');
        return;
    }

    const header = parseCsvLine(lines[0]);
    const sciIdx = header.indexOf('scientific_name');
    const cnIdx = header.indexOf('chinese_name');
    const sourceIdx = header.indexOf('source');

    if (sciIdx < 0 || cnIdx < 0 || sourceIdx < 0) {
        throw new Error('CSV 缺少必要字段 scientific_name/chinese_name/source');
    }

    let updated = 0;
    const out = [lines[0]];

    for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line) {
            out.push(line);
            continue;
        }

        const cols = parseCsvLine(line);
        const sci = (cols[sciIdx] || '').trim();
        const cn = (cols[cnIdx] || '').trim();
        const mapped = MANUAL_MAP[sci];

        if (mapped && !cn) {
            cols[cnIdx] = mapped;
            cols[sourceIdx] = 'MANUAL';
            updated += 1;
        }

        out.push(toCsvLine(cols));
    }

    fs.writeFileSync(CSV_PATH, out.join('\n'), 'utf8');
    console.log(`完成模板自动补全: ${updated} 条`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('补全失败:', err.message);
        process.exitCode = 1;
    }
}
