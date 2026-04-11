const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'data', 'cn-pending-template.csv');
const OUT_PATH = path.join(__dirname, '..', 'data', 'cn-review-high.csv');

const HIGH_RX = /(chinensis|japonica|officinalis|sinensis|indica)/i;

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
    const header = parseCsvLine(lines[0] || '');

    const sciIdx = header.indexOf('scientific_name');
    const familyIdx = header.indexOf('family');
    const genusIdx = header.indexOf('genus');
    const cnIdx = header.indexOf('chinese_name');
    const noteIdx = header.indexOf('note');

    const outLines = [toCsvLine(['scientific_name', 'family', 'genus', 'current_note', 'review_reason'])];
    const rewritten = [lines[0]];

    let count = 0;

    for (let i = 1; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line) {
            rewritten.push(line);
            continue;
        }

        const cols = parseCsvLine(line);
        const sci = (cols[sciIdx] || '').trim();
        const family = (cols[familyIdx] || '').trim();
        const genus = (cols[genusIdx] || '').trim();
        const cn = (cols[cnIdx] || '').trim();
        const note = (cols[noteIdx] || '').trim();

        if (!cn && HIGH_RX.test(sci)) {
            const newNote = note
                ? `${note}; GBIF_CJK_0`
                : 'REVIEW_HIGH: likely CN-relevant epithet; GBIF_CJK_0';
            cols[noteIdx] = newNote;
            outLines.push(toCsvLine([sci, family, genus, note, 'high epithet + no GBIF CJK candidate']));
            count += 1;
        }

        rewritten.push(toCsvLine(cols));
    }

    fs.writeFileSync(CSV_PATH, rewritten.join('\n'), 'utf8');
    fs.writeFileSync(OUT_PATH, outLines.join('\n'), 'utf8');

    console.log(`已准备高优先审核队列: ${count} 条`);
    console.log(`输出: ${OUT_PATH}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('准备审核队列失败:', err.message);
        process.exitCode = 1;
    }
}
