const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;
const coreDict = require('../data/core_plants_dict');
const genusMapping = require('../data/genus_mapping');
const {
  parseScientificName,
  normalizeScientificName,
  getScientificNameLookupCandidates
} = require('../lib/scientificNameNormalizer');

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

const DATA_DIR = path.join(__dirname, '..', 'data');
const PENDING_TEMPLATE = path.join(DATA_DIR, 'cn-pending-template.csv');
const CURRENT_MAPPED = path.join(DATA_DIR, 'cn-mapped-current.csv');

function isRemoteEnabled() {
  return String(process.env.CN_ENABLE_REMOTE || '0') === '1';
}

function getRequestIntervalMs() {
  return Number(process.env.CN_FETCH_INTERVAL_MS || 500);
}

function getRemoteTimeoutMs() {
  return Number(process.env.CN_REMOTE_TIMEOUT_MS || 12000);
}

function hasChinese(text) {
  return /[\u3400-\u9FFF]/.test(String(text || ''));
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeChineseName(text = '') {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (!hasChinese(normalized)) return null;
  return normalized.slice(0, 100);
}

function sanitizeText(text = '') {
  return String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

function extractSection(text, startLabel, endLabels = []) {
  const normalizedText = sanitizeText(text);
  if (!normalizedText) return null;
  const startIndex = normalizedText.indexOf(startLabel);
  if (startIndex < 0) return null;

  const fromStart = normalizedText.slice(startIndex + startLabel.length);
  let endIndex = fromStart.length;
  for (const label of endLabels) {
    const idx = fromStart.indexOf(label);
    if (idx >= 0 && idx < endIndex) {
      endIndex = idx;
    }
  }

  return sanitizeText(fromStart.slice(0, endIndex));
}

class ChineseNameService {
  constructor() {
    this.manualMap = null;
  }

  async getConnection() {
    return mysql.createConnection(dbConfig);
  }

  async ensureInfrastructure() {
    const conn = await this.getConnection();
    try {
      const hasTranslationSource = await this.hasColumn(conn, 'plants', 'translation_source');
      const hasTranslationConfidence = await this.hasColumn(conn, 'plants', 'translation_confidence');

      if (!hasTranslationSource) {
        try {
          await conn.query(`
            ALTER TABLE plants
            ADD COLUMN translation_source VARCHAR(20) NULL AFTER chinese_name
          `);
        } catch (error) {
          if (!String(error.message).includes('Duplicate column name')) throw error;
        }
      }

      if (!hasTranslationConfidence) {
        try {
          await conn.query(`
            ALTER TABLE plants
            ADD COLUMN translation_confidence TINYINT DEFAULT 0 AFTER translation_source
          `);
        } catch (error) {
          if (!String(error.message).includes('Duplicate column name')) throw error;
        }
      }

      await conn.query(`
        CREATE TABLE IF NOT EXISTS chinese_name_cache (
          id INT NOT NULL AUTO_INCREMENT,
          scientific_name VARCHAR(200) NOT NULL,
          chinese_name VARCHAR(100) NOT NULL,
          source VARCHAR(20) NOT NULL,
          confidence TINYINT DEFAULT 80,
          hit_count INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uk_scientific (scientific_name),
          INDEX idx_chinese (chinese_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
      `);

      await conn.query(`
        UPDATE plants
        SET translation_source = COALESCE(translation_source, 'legacy'),
            translation_confidence = CASE
              WHEN COALESCE(translation_confidence, 0) = 0 THEN 100
              ELSE translation_confidence
            END
        WHERE chinese_name REGEXP '[一-龥]'
          AND chinese_name <> scientific_name
          AND (translation_source IS NULL OR translation_source = '')
      `);
    } finally {
      await conn.end();
    }
  }

  async hasColumn(conn, tableName, columnName) {
    const [rows] = await conn.query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `, [tableName, columnName]);
    return rows.length > 0;
  }

  loadManualMap() {
    if (this.manualMap) return this.manualMap;

    const mapping = new Map();
    for (const [key, value] of Object.entries(coreDict.exactSpecies || {})) {
      if (hasChinese(value)) mapping.set(key, { chineseName: value, source: 'manual', confidence: 100 });
    }

    const loadCsv = (filePath, sourceFallback) => {
      if (!fs.existsSync(filePath)) return;
      const text = fs.readFileSync(filePath, 'utf8');
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return;
      const header = parseCsvLine(lines[0]);
      const sciIdx = header.indexOf('scientific_name');
      const cnIdx = header.indexOf('chinese_name');
      const srcIdx = header.indexOf('source');
      if (sciIdx < 0 || cnIdx < 0) return;

      for (let i = 1; i < lines.length; i += 1) {
        const cols = parseCsvLine(lines[i]);
        const scientificName = String(cols[sciIdx] || '').trim();
        const chineseName = String(cols[cnIdx] || '').trim();
        const source = String(srcIdx >= 0 ? cols[srcIdx] || '' : '').trim() || sourceFallback;
        if (!scientificName || !hasChinese(chineseName)) continue;
        const confidence = source === 'MANUAL' || source === 'CURRENT_DB' ? 100 : 95;
        mapping.set(scientificName, {
          chineseName,
          source: 'manual',
          confidence
        });
      }
    };

    loadCsv(CURRENT_MAPPED, 'CURRENT_DB');
    loadCsv(PENDING_TEMPLATE, 'MANUAL');
    this.manualMap = mapping;
    return mapping;
  }

  async checkCache(scientificName, conn) {
    const [rows] = await conn.query(
      'SELECT chinese_name, source, confidence FROM chinese_name_cache WHERE scientific_name = ? LIMIT 1',
      [scientificName]
    );

    if (!rows.length) return null;

    await conn.query(
      'UPDATE chinese_name_cache SET hit_count = hit_count + 1 WHERE scientific_name = ?',
      [scientificName]
    );

    return {
      chineseName: rows[0].chinese_name,
      source: rows[0].source,
      confidence: rows[0].confidence
    };
  }

  checkCoreDict(scientificName) {
    const map = this.loadManualMap();
    const candidates = getScientificNameLookupCandidates(scientificName);
    for (const key of candidates) {
      const match = map.get(key);
      if (match) return match;
    }
    return null;
  }

  extractIPlantChineseNameFromHtml(html, scientificName) {
    const normalizedScientificName = String(scientificName || '').replace(/\s+/g, ' ').trim();
    if (!html) return null;

    const scriptMatch =
      html.match(/var\s+spcname\s*=\s*"([^"]+)"/i) ||
      html.match(/var\s+spcname\s*=\s*'([^']+)'/i);

    const scriptedName = sanitizeChineseName(scriptMatch?.[1] || '');
    if (scriptedName) return scriptedName;

    const $ = cheerio.load(html);
    const title = $('title').text().replace(/\s+/g, ' ').trim();
    if (title) {
      const escapedScientificName = normalizedScientificName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titleMatch = title.match(new RegExp(`^(.*?)\\s+${escapedScientificName}\\s*\\|`, 'i'));
      const titleName = sanitizeChineseName(titleMatch?.[1] || '');
      if (titleName) return titleName;
    }

    const h1Name = sanitizeChineseName($('h1').first().text());
    if (h1Name) return h1Name;

    return null;
  }

  extractIPlantMediaCandidates($, scientificName, chineseName) {
    const out = [];

    $('img').each((_, el) => {
      const src = $(el).attr('src');
      const alt = sanitizeText($(el).attr('alt'));
      const title = sanitizeText($(el).attr('title'));
      const normalizedSrc = sanitizeText(src);
      if (!normalizedSrc) return;
      if (normalizedSrc.startsWith('/images/')) return;
      if (!/\.(jpg|jpeg|png)$/i.test(normalizedSrc)) return;

      const evidence = [alt, title].filter(Boolean).join(' ');
      if (evidence && (evidence.includes(scientificName) || (chineseName && evidence.includes(chineseName)))) {
        out.push({
          url: normalizedSrc.startsWith('http') ? normalizedSrc : `https://www.iplant.cn${normalizedSrc}`,
          alt,
          title
        });
      }
    });

    return out;
  }

  extractIPlantLinkedScientificNamesFromHtml(html) {
    const matches = Array.from(
      String(html || '').matchAll(/info\/([A-Z][A-Za-z0-9._%-]+(?:(?:%20|\s+)[A-Za-z0-9._%-]+)+)/g)
    );

    return matches
      .map((match) => {
        try {
          return decodeURIComponent(match[1]).replace(/\s+/g, ' ').trim();
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .filter((value, index, arr) => arr.indexOf(value) === index);
  }

  extractIPlantProfileFromHtml(html, scientificName, sourceUrl) {
    const normalizedScientificName = sanitizeText(scientificName);
    const chineseName = this.extractIPlantChineseNameFromHtml(html, normalizedScientificName);
    const externalIdMatch =
      html.match(/var\s+spno\s*=\s*"([^"]+)"/i) ||
      html.match(/var\s+spno\s*=\s*'([^']+)'/i);
    const externalId = sanitizeText(externalIdMatch?.[1]);

    const $ = cheerio.load(html);
    const bodyText = sanitizeText($('body').text()) || '';
    const aliasesBlock = extractSection(bodyText, '俗名：', ['异名：', '名称分类', '物种保护', '分类信息']);
    const synonymBlock = extractSection(bodyText, '异名：', ['名称分类', '物种保护', '分类信息']);

    const aliases = (aliasesBlock || '')
      .split(/[、,，;；]/)
      .map((item) => sanitizeText(item))
      .filter(Boolean);

    const synonymMatches = Array.from((synonymBlock || '').matchAll(/[A-Z][a-zA-Z-]+(?:\s+[a-z][a-zA-Z-]+)+/g));
    const synonyms = synonymMatches
      .map((match) => sanitizeText(match[0]))
      .filter(Boolean);
    const acceptedNameMatch = html.match(/正名是：.*?<a[^>]+href=['"]\/info\/([^'"]+)['"][^>]*>/i);
    const acceptedName = sanitizeText(
      acceptedNameMatch?.[1]
        ? decodeURIComponent(acceptedNameMatch[1]).replace(/\s+/g, ' ').trim()
        : null
    );

    const mediaCandidates = this.extractIPlantMediaCandidates($, normalizedScientificName, chineseName);
    const intro = chineseName
      ? sanitizeText(
          `${chineseName}（${normalizedScientificName}）${aliases.length ? `，俗名：${aliases.join('、')}` : ''}`
        )
      : null;

    return {
      provider: 'iplant',
      sourceType: 'info_page',
      externalId,
      sourceUrl,
      scientificName: normalizedScientificName,
      chineseName,
      aliases,
      synonyms,
      intro,
      mediaCandidates,
      linkedScientificNames: [
        ...(acceptedName ? [acceptedName] : []),
        ...this.extractIPlantLinkedScientificNamesFromHtml(html)
      ].filter((value, index, arr) => value && arr.indexOf(value) === index),
      payload: {
        title: sanitizeText($('title').text()),
        aliases,
        synonyms,
        mediaCandidates
      }
    };
  }

  async fetchChineseName(scientificName) {
    if (!isRemoteEnabled()) return null;

    const normalizedScientificName = String(scientificName || '').replace(/\s+/g, ' ').trim();
    if (!normalizedScientificName) return null;

    const targets = [
      `https://www.iplant.cn/info/${encodeURIComponent(normalizedScientificName)}`,
      `http://www.iplant.cn/info/${encodeURIComponent(normalizedScientificName)}`
    ];

    for (const url of targets) {
      try {
        const response = await axios.get(url, {
          timeout: getRemoteTimeoutMs(),
          headers: { 'User-Agent': 'Mozilla/5.0' },
          validateStatus: (status) => status >= 200 && status < 500
        });

        if (response.status === 404 || typeof response.data !== 'string') {
          continue;
        }

        const chineseName = this.extractIPlantChineseNameFromHtml(response.data, normalizedScientificName);
        if (chineseName) {
          return {
            chineseName,
            source: 'iplant',
            confidence: 96
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  async fetchIPlantProfileDirect(scientificName) {
    const normalizedScientificName = sanitizeText(scientificName);
    if (!normalizedScientificName) return null;

    const targets = [
      `https://www.iplant.cn/info/${encodeURIComponent(normalizedScientificName)}`,
      `http://www.iplant.cn/info/${encodeURIComponent(normalizedScientificName)}`
    ];

    for (const url of targets) {
      try {
        const response = await axios.get(url, {
          timeout: getRemoteTimeoutMs(),
          headers: { 'User-Agent': 'Mozilla/5.0' },
          validateStatus: (status) => status >= 200 && status < 500
        });

        if (response.status === 404 || typeof response.data !== 'string') {
          continue;
        }

        return this.extractIPlantProfileFromHtml(response.data, normalizedScientificName, url);
      } catch {
        continue;
      }
    }

    return null;
  }

  async fetchIPlantProfile(scientificName, visited = new Set()) {
    if (!isRemoteEnabled()) return null;

    const normalizedScientificName = sanitizeText(scientificName);
    if (!normalizedScientificName || visited.has(normalizedScientificName)) return null;
    visited.add(normalizedScientificName);

    const directProfile = await this.fetchIPlantProfileDirect(normalizedScientificName);
    if (!directProfile) return null;

    if (directProfile.chineseName) {
      return directProfile;
    }

    const candidates = [
      ...(directProfile.linkedScientificNames || []),
      ...(directProfile.synonyms || [])
    ]
      .map((item) => sanitizeText(item))
      .filter(Boolean)
      .filter((item) => item !== normalizedScientificName)
      .filter((value, index, arr) => arr.indexOf(value) === index);

    for (const candidate of candidates) {
      const fallbackProfile = await this.fetchIPlantProfile(candidate, visited);
      if (!fallbackProfile?.chineseName) continue;

      const mergedSynonyms = [
        ...(fallbackProfile.synonyms || []),
        normalizedScientificName,
        ...(directProfile.synonyms || [])
      ]
        .map((item) => sanitizeText(item))
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index);

      return {
        ...fallbackProfile,
        sourceType: 'accepted_name_fallback',
        payload: {
          ...(fallbackProfile.payload || {}),
          requestedScientificName: normalizedScientificName,
          fallbackFrom: normalizedScientificName,
          fallbackCandidate: candidate
        },
        synonyms: mergedSynonyms
      };
    }

    if (directProfile.aliases?.length || directProfile.synonyms?.length) {
      return directProfile;
    }

    return null;
  }

  applyRules(scientificName) {
    const parsed = parseScientificName(scientificName);
    if (!parsed) return null;

    const normalized = parsed.canonical;

    if (genusMapping.specialSpeciesMap[normalized]) {
      return {
        chineseName: genusMapping.specialSpeciesMap[normalized],
        source: 'rule',
        confidence: 90
      };
    }

    const genus = parsed.genus;
    const epithet = parsed.species;
    const genusCn = genusMapping.genusMap[genus];
    if (!genusCn) return null;

    if (epithet && genusMapping.epithetMap[epithet]) {
      return {
        chineseName: `${genusCn} (${genusMapping.epithetMap[epithet]})`,
        source: 'rule',
        confidence: 70
      };
    }

    return {
      chineseName: genusCn,
      source: 'rule',
      confidence: 80
    };
  }

  async queryIPlant(scientificName) {
    return this.fetchChineseName(scientificName);
  }

  async queryGbif(scientificName) {
    if (!isRemoteEnabled()) return null;

    try {
      const matchResp = await axios.get('https://api.gbif.org/v1/species/match', {
        params: { name: scientificName },
        timeout: getRemoteTimeoutMs(),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const usageKey = matchResp?.data?.usageKey;
      if (!usageKey) return null;

      const vernacularResp = await axios.get(`https://api.gbif.org/v1/species/${usageKey}/vernacularNames`, {
        params: { limit: 300 },
        timeout: getRemoteTimeoutMs(),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const candidates = Array.isArray(vernacularResp?.data?.results) ? vernacularResp.data.results : [];
      for (const item of candidates) {
        const lang = String(item.language || item.isoLanguageCode || '').toLowerCase();
        const country = String(item.country || '').toLowerCase();
        const candidate = sanitizeChineseName(item.vernacularName || item.verbatim || '');
        if (!candidate) continue;
        if (
          /^(zh|zho|chi)/i.test(lang) ||
          /^(cn|tw|hk|sg|chn|cht)$/i.test(country) ||
          (lang === '' && /^(cn|tw|hk|sg)$/i.test(country))
        ) {
          return { chineseName: candidate, source: 'gbif', confidence: 92 };
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async saveCache(scientificName, chineseName, source, confidence, conn) {
    await conn.query(`
      INSERT INTO chinese_name_cache (scientific_name, chinese_name, source, confidence)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        chinese_name = VALUES(chinese_name),
        source = VALUES(source),
        confidence = VALUES(confidence),
        updated_at = NOW()
    `, [scientificName, chineseName, source, confidence]);
  }

  async applyManualMappings() {
    await this.ensureInfrastructure();

    const conn = await this.getConnection();
    try {
      const map = this.loadManualMap();
      let plantsUpdated = 0;
      let taxaUpdated = 0;
      let cacheUpdated = 0;

      for (const [scientificName, entry] of map.entries()) {
        const applied = await this.applyChineseName(
          scientificName,
          entry.chineseName,
          'manual',
          entry.confidence,
          conn
        );
        await this.saveCache(scientificName, entry.chineseName, 'manual', entry.confidence, conn);
        plantsUpdated += applied.plantsUpdated;
        taxaUpdated += applied.taxaUpdated;
        cacheUpdated += 1;
      }

      return { manualEntries: map.size, plantsUpdated, taxaUpdated, cacheUpdated };
    } finally {
      await conn.end();
    }
  }

  async getChineseName(scientificName, conn) {
    const lookupCandidates = getScientificNameLookupCandidates(scientificName);
    const cacheKey = normalizeScientificName(scientificName) || String(scientificName || '').replace(/\s+/g, ' ').trim();

    for (const candidate of lookupCandidates) {
      const cached = await this.checkCache(candidate, conn);
      if (cached) return cached;
    }

    const core = this.checkCoreDict(scientificName);
    if (core) {
      await this.saveCache(cacheKey, core.chineseName, core.source, core.confidence, conn);
      return core;
    }

    const lookupName = normalizeScientificName(scientificName) || scientificName;
    const apiResult = await this.queryIPlant(lookupName);
    if (apiResult) {
      await this.saveCache(cacheKey, apiResult.chineseName, apiResult.source, apiResult.confidence, conn);
      return apiResult;
    }

    const gbifResult = await this.queryGbif(lookupName);
    if (gbifResult) {
      await this.saveCache(cacheKey, gbifResult.chineseName, gbifResult.source, gbifResult.confidence, conn);
      return gbifResult;
    }

    const ruleResult = this.applyRules(lookupName);
    if (ruleResult?.chineseName) {
      await this.saveCache(cacheKey, ruleResult.chineseName, ruleResult.source, ruleResult.confidence, conn);
      return ruleResult;
    }

    return { chineseName: null, source: 'none', confidence: 0 };
  }

  async applyChineseName(scientificName, chineseName, source, confidence, conn) {
    const [plantResult] = await conn.query(`
      UPDATE plants
      SET chinese_name = ?,
          translation_source = ?,
          translation_confidence = ?
      WHERE scientific_name = ?
        AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name OR chinese_name NOT REGEXP '[一-龥]')
    `, [chineseName, source, confidence, scientificName]);

    const [taxaResult] = await conn.query(`
      UPDATE taxa
      SET chinese_name = ?
      WHERE scientific_name = ?
        AND taxon_rank = 'species'
        AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name OR chinese_name NOT REGEXP '[一-龥]')
    `, [chineseName, scientificName]);

    return {
      plantsUpdated: Number(plantResult.affectedRows || 0),
      taxaUpdated: Number(taxaResult.affectedRows || 0)
    };
  }

  async batchUpdatePlants(limit = 100, lastCursor = 0) {
    await this.ensureInfrastructure();

    const conn = await this.getConnection();
    try {
      const [plants] = await conn.query(`
        SELECT scientific_name, MIN(id) AS first_id
        FROM plants
        WHERE scientific_name IS NOT NULL
          AND scientific_name <> ''
          AND id > ?
          AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name OR chinese_name NOT REGEXP '[一-龥]')
        GROUP BY scientific_name
        ORDER BY first_id ASC
        LIMIT ?
      `, [lastCursor, limit]);

      let updated = 0;
      let taxaUpdated = 0;
      const failed = [];
      const bySource = { manual: 0, iplant: 0, gbif: 0, rule: 0, none: 0 };
      let nextCursor = lastCursor;

      for (let i = 0; i < plants.length; i += 1) {
        const scientificName = plants[i].scientific_name;
        nextCursor = Math.max(nextCursor, Number(plants[i].first_id || lastCursor));
        const result = await this.getChineseName(scientificName, conn);
        if (result.chineseName) {
          const applied = await this.applyChineseName(
            scientificName,
            result.chineseName,
            result.source,
            result.confidence,
            conn
          );
          updated += applied.plantsUpdated;
          taxaUpdated += applied.taxaUpdated;
          bySource[result.source] = (bySource[result.source] || 0) + 1;
        } else {
          failed.push(scientificName);
          bySource.none += 1;
        }

        if (isRemoteEnabled()) {
          await sleep(getRequestIntervalMs());
        }
      }

      return {
        total: plants.length,
        updated,
        taxaUpdated,
        failed,
        bySource,
        nextCursor
      };
    } finally {
      await conn.end();
    }
  }

  async getUnmatchedPlants(limit = 100) {
    const conn = await this.getConnection();
    try {
      const [rows] = await conn.query(`
        SELECT id, scientific_name, wcvp_family AS family, wcvp_genus AS genus
        FROM plants
        WHERE scientific_name IS NOT NULL
          AND scientific_name <> ''
          AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name OR chinese_name NOT REGEXP '[一-龥]')
        ORDER BY id ASC
        LIMIT ?
      `, [limit]);
      return rows;
    } finally {
      await conn.end();
    }
  }

  async getStatistics() {
    const conn = await this.getConnection();
    try {
      const [rows] = await conn.query(`
        SELECT
          COUNT(DISTINCT scientific_name) AS total,
          COUNT(DISTINCT CASE WHEN chinese_name REGEXP '[一-龥]' AND chinese_name <> scientific_name THEN scientific_name END) AS matched,
          COUNT(DISTINCT CASE WHEN scientific_name IS NOT NULL AND scientific_name <> '' AND (chinese_name IS NULL OR chinese_name = '' OR chinese_name = scientific_name OR chinese_name NOT REGEXP '[一-龥]') THEN scientific_name END) AS unmatched
        FROM plants
        WHERE scientific_name IS NOT NULL AND scientific_name <> ''
      `);

      const [bySource] = await conn.query(`
        SELECT translation_source, COUNT(*) AS count
        FROM plants
        WHERE chinese_name REGEXP '[一-龥]'
          AND chinese_name <> scientific_name
        GROUP BY translation_source
        ORDER BY count DESC
      `);

      return {
        total: Number(rows[0].total || 0),
        matched: Number(rows[0].matched || 0),
        unmatched: Number(rows[0].unmatched || 0),
        bySource
      };
    } finally {
      await conn.end();
    }
  }
}

module.exports = new ChineseNameService();
