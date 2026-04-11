const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { normalizeScientificName } = require('../lib/scientificNameNormalizer');

const CSV_PATH = path.join(__dirname, '..', 'data', 'cn-pending-template.csv');
const LIMIT = Number(process.env.CN_GBIF_FILL_LIMIT || 300);
const INTERVAL_MS = Number(process.env.CN_GBIF_FILL_INTERVAL_MS || 250);
const REQUEST_TIMEOUT_MS = Number(process.env.CN_GBIF_TIMEOUT_MS || 5000);
const LOG_EVERY = Number(process.env.CN_GBIF_LOG_EVERY || 20);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function sanitizeChineseName(text) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return null;
    const cleaned = t.replace(/[A-Za-z].*$/, '').trim();
    if (!cleaned) return null;
    if (!/[\u3400-\u9FFF]/.test(cleaned)) return null;
    return cleaned.slice(0, 100);
}

function getPriorityScore(scientificName) {
    const n = String(scientificName || '').toLowerCase();
    let score = 0;
    if (/chinensis|japonica|officinalis|sinensis|indica/.test(n)) score += 10;
    if (/^ixora\s|^isodon\s|^leucas\s|^mosla\s|^nauclea\s|^livistona\s/.test(n)) score += 6;
    if (/^homalomena\s|^hyptis\s|^houstonia\s|^isidorea\s/.test(n)) score -= 4;
    return score;
}

function isStrictZhRecord(item) {
    const lang = String(item.language || item.isoLanguageCode || '').toLowerCase();
    const country = String(item.country || '').toLowerCase();
    if (/^(zh|zho|chi)/.test(lang)) return true;
    if (/^(cn|tw|hk|sg|chn)$/.test(country)) return true;
    return false;
}

async function fetchGbifStrictChinese(scientificName) {
    try {
        const match = await axios.get('https://api.gbif.org/v1/species/match', {
            params: { name: scientificName },
            timeout: REQUEST_TIMEOUT_MS
        });

        const usageKey = match?.data?.usageKey;
        if (!usageKey) return null;

        const vernacular = await axios.get(`https://api.gbif.org/v1/species/${usageKey}/vernacularNames`, {
            params: { limit: 300 },
            timeout: REQUEST_TIMEOUT_MS
        });

        const results = Array.isArray(vernacular?.data?.results) ? vernacular.data.results : [];
        const candidates = [];
        for (const item of results) {
            if (!isStrictZhRecord(item)) continue;
            const candidate = sanitizeChineseName(item.vernacularName || item.verbatim);
            if (candidate) candidates.push(candidate);
        }

        if (candidates.length === 0) return null;

        // 保守模式：只接受最高频候选
        const freq = new Map();
        for (const c of candidates) {
            freq.set(c, (freq.get(c) || 0) + 1);
        }
        let best = null;
        let bestCount = -1;
        for (const [name, count] of freq.entries()) {
            if (count > bestCount) {
                best = name;
                bestCount = count;
            }
        }
        return best;
    } catch (e) {
        return null;
    }
}

async function main() {
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    const lines = content.split(/\r?\n/);
    if (lines.length <= 1) {
        console.log('模板为空。');
        return;
    }

    const header = parseCsvLine(lines[0]);
    const sciIdx = header.indexOf('scientific_name');
    const cnIdx = header.indexOf('chinese_name');
    const sourceIdx = header.indexOf('source');
    if (sciIdx < 0 || cnIdx < 0 || sourceIdx < 0) {
        throw new Error('CSV 缺少 scientific_name/chinese_name/source');
    }

    const parsed = [header, ...lines.slice(1).map(parseCsvLine)];
    const candidates = [];
    for (let i = 1; i < parsed.length; i += 1) {
        const cols = parsed[i];
        if (!cols || cols.length === 0) continue;
        const cn = (cols[cnIdx] || '').trim();
        if (!cn) {
            const scientificName = (cols[sciIdx] || '').trim();
            candidates.push({ i, scientificName, score: getPriorityScore(scientificName) });
        }
    }

    candidates.sort((a, b) => b.score - a.score || a.i - b.i);
    const targetIndices = candidates.slice(0, LIMIT).map((x) => x.i);

    let scanned = 0;
    let updated = 0;

    for (const i of targetIndices) {
        scanned += 1;
        if (scanned % LOG_EVERY === 0) {
            console.log(`进度: ${scanned}/${targetIndices.length}, 当前新增: ${updated}`);
        }
        const cols = parsed[i];
        const scientificName = (cols[sciIdx] || '').trim();
        const normalized = normalizeScientificName(scientificName);
        if (!normalized) continue;

        const cn = await fetchGbifStrictChinese(normalized);
        if (cn) {
            cols[cnIdx] = cn;
            cols[sourceIdx] = 'GBIF';
            updated += 1;
            console.log(`[${scanned}/${targetIndices.length}] ${scientificName} -> ${cn} (GBIF)`);
        }

        await sleep(INTERVAL_MS);
    }

    const out = [toCsvLine(parsed[0])];
    for (let i = 1; i < parsed.length; i += 1) {
        out.push(toCsvLine(parsed[i] || []));
    }
    fs.writeFileSync(CSV_PATH, out.join('\n'), 'utf8');

    console.log(`完成 GBIF 严格补全: 扫描 ${targetIndices.length} 条，新增 ${updated} 条`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('GBIF 严格补全失败:', err.message);
        process.exitCode = 1;
    });
}
