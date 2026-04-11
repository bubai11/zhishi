const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'cn-pending-template.csv');

const HIGH_PRIORITY_PATTERNS = [
    /chinensis/i,
    /japonica/i,
    /officinalis/i,
    /sinensis/i,
    /indica/i
];

const LOW_PRIORITY_GENERA = new Set([
    'Homalomena',
    'Houstonia',
    'Isidorea',
    'Hyptis',
    'Hypenia',
    'Anodendron'
]);

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
    const text = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) {
        console.log('模板为空。');
        return;
    }

    const header = parseCsvLine(lines[0]);
    const sciIdx = header.indexOf('scientific_name');
    const genusIdx = header.indexOf('genus');
    const cnIdx = header.indexOf('chinese_name');
    const noteIdx = header.indexOf('note');

    if (sciIdx < 0 || genusIdx < 0 || cnIdx < 0 || noteIdx < 0) {
        throw new Error('CSV 缺少 scientific_name/genus/chinese_name/note 列');
    }

    let high = 0;
    let low = 0;
    let skipped = 0;

    const out = [lines[0]];

    for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line) {
            out.push(line);
            continue;
        }

        const cols = parseCsvLine(line);
        const sci = (cols[sciIdx] || '').trim();
        const genus = (cols[genusIdx] || '').trim();
        const cn = (cols[cnIdx] || '').trim();
        const note = (cols[noteIdx] || '').trim();

        if (cn) {
            out.push(toCsvLine(cols));
            continue;
        }

        if (note) {
            skipped += 1;
            out.push(toCsvLine(cols));
            continue;
        }

        if (HIGH_PRIORITY_PATTERNS.some((r) => r.test(sci))) {
            cols[noteIdx] = 'REVIEW_HIGH: likely CN-relevant epithet';
            high += 1;
        } else if (LOW_PRIORITY_GENERA.has(genus)) {
            cols[noteIdx] = 'REVIEW_LOW: rare genus in current corpus';
            low += 1;
        }

        out.push(toCsvLine(cols));
    }

    fs.writeFileSync(CSV_PATH, out.join('\n'), 'utf8');
    console.log(`已标注 note: 高优先 ${high} 条, 低优先 ${low} 条, 已有note跳过 ${skipped} 条`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('标注失败:', err.message);
        process.exitCode = 1;
    }
}
