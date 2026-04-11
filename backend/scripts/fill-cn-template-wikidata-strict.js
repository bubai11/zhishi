const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { normalizeScientificName } = require('../lib/scientificNameNormalizer');

const CSV_PATH = path.join(__dirname, '..', 'data', 'cn-pending-template.csv');
const LIMIT = Number(process.env.CN_WD_FILL_LIMIT || 300);
const INTERVAL_MS = Number(process.env.CN_WD_FILL_INTERVAL_MS || 120);
const REQUEST_TIMEOUT_MS = Number(process.env.CN_WD_TIMEOUT_MS || 7000);
const LOG_EVERY = Number(process.env.CN_WD_LOG_EVERY || 20);

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

function hasChinese(text) {
    return /[\u3400-\u9FFF]/.test(String(text || ''));
}

function getP225(entity) {
    const claims = entity?.claims || {};
    const p225 = claims.P225;
    if (!Array.isArray(p225) || p225.length === 0) return null;
    const val = p225[0]?.mainsnak?.datavalue?.value;
    if (typeof val === 'string') return val.trim();
    return null;
}

async function searchEntityIds(scientificName) {
    const resp = await axios.get('https://www.wikidata.org/w/api.php', {
        params: {
            action: 'wbsearchentities',
            format: 'json',
            language: 'en',
            uselang: 'en',
            type: 'item',
            search: scientificName,
            limit: 8
        },
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'User-Agent': 'PlantSystemBot/1.0 (Wikidata strict fill)' }
    });

    const arr = Array.isArray(resp?.data?.search) ? resp.data.search : [];
    return arr.map((x) => x.id).filter(Boolean);
}

async function fetchEntities(entityIds) {
    if (!entityIds.length) return {};
    const resp = await axios.get('https://www.wikidata.org/w/api.php', {
        params: {
            action: 'wbgetentities',
            format: 'json',
            props: 'labels|claims',
            languages: 'zh|en',
            ids: entityIds.join('|')
        },
        timeout: REQUEST_TIMEOUT_MS,
        headers: { 'User-Agent': 'PlantSystemBot/1.0 (Wikidata strict fill)' }
    });

    return resp?.data?.entities || {};
}

async function getStrictChineseNameFromWikidata(scientificName) {
    const normalized = normalizeScientificName(scientificName);
    if (!normalized) return null;

    try {
        const ids = await searchEntityIds(normalized);
        if (!ids.length) return null;

        const entities = await fetchEntities(ids);

        for (const id of ids) {
            const e = entities[id];
            if (!e) continue;

            const p225 = getP225(e);
            if (!p225 || p225 !== normalized) continue;

            const zh = e?.labels?.zh?.value || '';
            if (!hasChinese(zh)) continue;

            return zh.trim();
        }

        return null;
    } catch {
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
    const noteIdx = header.indexOf('note');

    if (sciIdx < 0 || cnIdx < 0 || sourceIdx < 0 || noteIdx < 0) {
        throw new Error('CSV 缺少 scientific_name/chinese_name/source/note');
    }

    const parsed = [header, ...lines.slice(1).map(parseCsvLine)];

    const target = [];
    for (let i = 1; i < parsed.length; i += 1) {
        const cols = parsed[i];
        if (!cols || cols.length === 0) continue;
        const cn = (cols[cnIdx] || '').trim();
        if (!cn) target.push(i);
        if (target.length >= LIMIT) break;
    }

    let scanned = 0;
    let updated = 0;

    for (const rowIdx of target) {
        scanned += 1;
        const cols = parsed[rowIdx];
        const scientificName = (cols[sciIdx] || '').trim();

        const cn = await getStrictChineseNameFromWikidata(scientificName);
        if (cn) {
            cols[cnIdx] = cn;
            cols[sourceIdx] = 'WIKIDATA';
            const oldNote = (cols[noteIdx] || '').trim();
            cols[noteIdx] = oldNote ? `${oldNote}; WD_STRICT_OK` : 'WD_STRICT_OK';
            updated += 1;
            console.log(`[${scanned}/${target.length}] ${scientificName} -> ${cn} (WIKIDATA)`);
        }

        if (scanned % LOG_EVERY === 0) {
            console.log(`进度: ${scanned}/${target.length}, 当前新增: ${updated}`);
        }

        await sleep(INTERVAL_MS);
    }

    const out = [toCsvLine(parsed[0])];
    for (let i = 1; i < parsed.length; i += 1) {
        out.push(toCsvLine(parsed[i] || []));
    }

    fs.writeFileSync(CSV_PATH, out.join('\n'), 'utf8');
    console.log(`完成 Wikidata 严格补全: 扫描 ${target.length} 条，新增 ${updated} 条`);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('Wikidata 严格补全失败:', err.message);
        process.exitCode = 1;
    });
}
