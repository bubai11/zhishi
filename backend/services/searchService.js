const { Op, Sequelize, QueryTypes } = require('sequelize');
const { Plants, sequelize } = require('../models');
const { mapPlantCard } = require('./frontendTransformers');

const SEARCH_RESULT_CACHE = new Map();
const SEARCH_RESULT_CACHE_TTL_MS = 45 * 1000;

function escapeLikeText(value = '') {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function toSqlStringLiteral(value = '') {
  return sequelize.escape(String(value));
}

class SearchService {
  async searchPlants(params = {}) {
    const q = String(params.q || '').trim();
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 10));
    const sort = String(params.sort || 'relevance').toLowerCase();
    const familyFilter = String(params.family || '').trim();
    const genusFilter = String(params.genus || '').trim();
    const divisionFilter = String(params.division || '').trim();
    const taxonId = params.taxonId !== undefined && params.taxonId !== ''
      ? Number(params.taxonId)
      : null;

    const cacheKey = JSON.stringify({
      q,
      page,
      limit,
      sort,
      familyFilter,
      genusFilter,
      divisionFilter,
      taxonId
    });
    const cached = SEARCH_RESULT_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < SEARCH_RESULT_CACHE_TTL_MS) {
      return {
        ...cached.data,
        meta: {
          ...cached.data.meta,
          tookMs: 0
        }
      };
    }

    const exactFastMode = q && !taxonId && !familyFilter && !genusFilter && !divisionFilter && (q.includes(' ') || q.length >= 4);
    if (exactFastMode) {
      const exactRows = await sequelize.query(
        `
          SELECT
            p.id,
            p.chinese_name,
            p.scientific_name,
            p.cover_image,
            p.short_desc,
            p.category,
            p.wcvp_family,
            tf.chinese_name AS family_chinese_name,
            p.wcvp_genus,
            p.created_at,
            p.updated_at,
            CASE
              WHEN p.chinese_name = :q THEN 100
              WHEN p.scientific_name = :q THEN 95
              ELSE 0
            END AS text_score
          FROM plants p
          LEFT JOIN (
            SELECT scientific_name, MIN(NULLIF(chinese_name, '')) AS chinese_name
            FROM taxa
            WHERE taxon_rank = 'family'
            GROUP BY scientific_name
          ) tf ON tf.scientific_name = p.wcvp_family
          WHERE p.chinese_name = :q OR p.scientific_name = :q
          ORDER BY text_score DESC, p.id ASC
          LIMIT :limit OFFSET :offset
        `,
        {
          replacements: {
            q,
            limit,
            offset: (page - 1) * limit
          },
          type: QueryTypes.SELECT
        }
      );

      if (exactRows.length > 0) {
        const result = {
          list: exactRows.map((row) => mapPlantCard(row)),
          pagination: {
            total: exactRows.length,
            page,
            limit,
            pages: Math.ceil(exactRows.length / limit)
          },
          meta: {
            query: q,
            sort,
            tookMs: 0,
            hitCount: exactRows.length
          }
        };

        SEARCH_RESULT_CACHE.set(cacheKey, {
          cachedAt: Date.now(),
          data: result
        });

        return result;
      }
    }

    const offset = (page - 1) * limit;
    const escapedQ = escapeLikeText(q);
    const prefixPattern = `${escapedQ}%`;
    const containsPattern = `%${escapedQ}%`;
    const isShortKeyword = q.length > 0 && q.length < 2;
    const useTaxonAliasSearch = !isShortKeyword;
    const useContainsMatch = q.length >= 2;
    const shortKeywordFastMode = isShortKeyword && !divisionFilter && !taxonId && !familyFilter && !genusFilter;
    const replacements = {
      q,
      qPrefix: prefixPattern,
      queryLimit: limit,
      limit,
      offset
    };

    if (shortKeywordFastMode) {
      replacements.queryLimit = limit + 1;
    }

    let shortAliasFamilyScientificNames = [];
    let shortAliasGenusScientificNames = [];

    if (isShortKeyword) {
      const aliasRows = await sequelize.query(
        `
          SELECT scientific_name, taxon_rank
          FROM taxa
          WHERE taxon_rank IN ('family', 'genus')
            AND chinese_name LIKE :qPrefix ESCAPE '\\\\'
          GROUP BY scientific_name, taxon_rank
          LIMIT 40
        `,
        {
          replacements: { qPrefix: prefixPattern },
          type: QueryTypes.SELECT
        }
      );

      shortAliasFamilyScientificNames = aliasRows
        .filter((row) => row.taxon_rank === 'family')
        .map((row) => row.scientific_name)
        .filter(Boolean);
      shortAliasGenusScientificNames = aliasRows
        .filter((row) => row.taxon_rank === 'genus')
        .map((row) => row.scientific_name)
        .filter(Boolean);
    }

    const whereClauses = ['('];
    if (shortKeywordFastMode) {
      whereClauses.push(
        'p.chinese_name = :q',
        'OR p.scientific_name = :q',
        'OR p.wcvp_family = :q',
        'OR p.wcvp_genus = :q',
        "OR p.chinese_name LIKE :qPrefix ESCAPE '\\\\'",
        "OR p.scientific_name LIKE :qPrefix ESCAPE '\\\\'"
      );

      if (shortAliasFamilyScientificNames.length) {
        replacements.shortAliasFamilies = shortAliasFamilyScientificNames;
        whereClauses.push('OR p.wcvp_family IN (:shortAliasFamilies)');
      }
      if (shortAliasGenusScientificNames.length) {
        replacements.shortAliasGenera = shortAliasGenusScientificNames;
        whereClauses.push('OR p.wcvp_genus IN (:shortAliasGenera)');
      }
    } else {
      whereClauses.push(
        'p.chinese_name = :q',
        'OR p.scientific_name = :q',
        'OR p.wcvp_family = :q',
        'OR p.wcvp_genus = :q',
        "OR p.chinese_name LIKE :qPrefix ESCAPE '\\\\'",
        "OR p.scientific_name LIKE :qPrefix ESCAPE '\\\\'",
        "OR p.wcvp_family LIKE :qPrefix ESCAPE '\\\\'",
        "OR p.wcvp_genus LIKE :qPrefix ESCAPE '\\\\'"
      );

      if (useTaxonAliasSearch) {
        whereClauses.push(
          'OR tf.chinese_name = :q',
          'OR tg.chinese_name = :q',
          "OR tf.chinese_name LIKE :qPrefix ESCAPE '\\\\'",
          "OR tg.chinese_name LIKE :qPrefix ESCAPE '\\\\'"
        );
      }

      if (isShortKeyword) {
        if (shortAliasFamilyScientificNames.length) {
          replacements.shortAliasFamilies = shortAliasFamilyScientificNames;
          whereClauses.push('OR p.wcvp_family IN (:shortAliasFamilies)');
        }
        if (shortAliasGenusScientificNames.length) {
          replacements.shortAliasGenera = shortAliasGenusScientificNames;
          whereClauses.push('OR p.wcvp_genus IN (:shortAliasGenera)');
        }
      }

      if (useContainsMatch) {
        replacements.qContains = containsPattern;
        whereClauses.push(
          "OR p.chinese_name LIKE :qContains ESCAPE '\\\\'",
          "OR p.scientific_name LIKE :qContains ESCAPE '\\\\'",
          "OR p.wcvp_family LIKE :qContains ESCAPE '\\\\'",
          "OR p.wcvp_genus LIKE :qContains ESCAPE '\\\\'",
          "OR p.short_desc LIKE :qContains ESCAPE '\\\\'"
        );

        if (useTaxonAliasSearch) {
          whereClauses.push(
            "OR tf.chinese_name LIKE :qContains ESCAPE '\\\\'",
            "OR tg.chinese_name LIKE :qContains ESCAPE '\\\\'"
          );
        }
      }
    }

    whereClauses.push(')');

    if (taxonId) {
      replacements.taxonId = taxonId;
      whereClauses.push('AND p.taxon_id = :taxonId');
    }

    if (familyFilter) {
      replacements.family = familyFilter;
      whereClauses.push('AND p.wcvp_family = :family');
    }

    if (genusFilter) {
      replacements.genus = genusFilter;
      whereClauses.push('AND p.wcvp_genus = :genus');
    }

    if (divisionFilter) {
      replacements.division = divisionFilter;
      whereClauses.push('AND (dt.scientific_name = :division OR dt.chinese_name = :division)');
    }

    const shortAliasFamilyScoreSql = shortAliasFamilyScientificNames.length ? 'WHEN p.wcvp_family IN (:shortAliasFamilies) THEN 72' : '';
    const shortAliasGenusScoreSql = shortAliasGenusScientificNames.length ? 'WHEN p.wcvp_genus IN (:shortAliasGenera) THEN 74' : '';

    const textScoreSql = shortKeywordFastMode
      ? `
          CASE
            WHEN p.chinese_name = :q THEN 100
            WHEN p.scientific_name = :q THEN 95
            ${shortAliasGenusScoreSql}
            ${shortAliasFamilyScoreSql}
            WHEN p.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 82
            WHEN p.scientific_name LIKE :qPrefix ESCAPE '\\\\' THEN 72
            ELSE 0
          END
        `
      : useContainsMatch
      ? `
          CASE
            WHEN p.chinese_name = :q THEN 100
            WHEN p.scientific_name = :q THEN 95
            ${useTaxonAliasSearch ? 'WHEN tf.chinese_name = :q THEN 92' : ''}
            ${useTaxonAliasSearch ? 'WHEN tg.chinese_name = :q THEN 90' : ''}
            WHEN p.wcvp_family = :q THEN 88
            WHEN p.wcvp_genus = :q THEN 86
            ${shortAliasFamilyScoreSql}
            ${shortAliasGenusScoreSql}
            WHEN p.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 80
            WHEN p.scientific_name LIKE :qPrefix ESCAPE '\\\\' THEN 70
            ${useTaxonAliasSearch ? "WHEN tf.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 68" : ''}
            ${useTaxonAliasSearch ? "WHEN tg.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 66" : ''}
            WHEN p.wcvp_family LIKE :qPrefix ESCAPE '\\\\' THEN 64
            WHEN p.wcvp_genus LIKE :qPrefix ESCAPE '\\\\' THEN 62
            WHEN p.chinese_name LIKE :qContains ESCAPE '\\\\' THEN 50
            WHEN p.scientific_name LIKE :qContains ESCAPE '\\\\' THEN 40
            ${useTaxonAliasSearch ? "WHEN tf.chinese_name LIKE :qContains ESCAPE '\\\\' THEN 38" : ''}
            ${useTaxonAliasSearch ? "WHEN tg.chinese_name LIKE :qContains ESCAPE '\\\\' THEN 36" : ''}
            WHEN p.wcvp_family LIKE :qContains ESCAPE '\\\\' THEN 34
            WHEN p.wcvp_genus LIKE :qContains ESCAPE '\\\\' THEN 32
            WHEN p.short_desc LIKE :qContains ESCAPE '\\\\' THEN 20
            ELSE 0
          END
        `
      : `
          CASE
            WHEN p.chinese_name = :q THEN 100
            WHEN p.scientific_name = :q THEN 95
            ${useTaxonAliasSearch ? 'WHEN tf.chinese_name = :q THEN 92' : ''}
            ${useTaxonAliasSearch ? 'WHEN tg.chinese_name = :q THEN 90' : ''}
            WHEN p.wcvp_family = :q THEN 88
            WHEN p.wcvp_genus = :q THEN 86
            ${shortAliasFamilyScoreSql}
            ${shortAliasGenusScoreSql}
            WHEN p.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 80
            WHEN p.scientific_name LIKE :qPrefix ESCAPE '\\\\' THEN 70
            ${useTaxonAliasSearch ? "WHEN tf.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 68" : ''}
            ${useTaxonAliasSearch ? "WHEN tg.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 66" : ''}
            WHEN p.wcvp_family LIKE :qPrefix ESCAPE '\\\\' THEN 64
            WHEN p.wcvp_genus LIKE :qPrefix ESCAPE '\\\\' THEN 62
            ELSE 0
          END
        `;

    const usePopularityJoin = !shortKeywordFastMode && (sort === 'popular' || (sort === 'relevance' && !isShortKeyword));
    const popularityJoinSql = usePopularityJoin
      ? `
          LEFT JOIN (
            SELECT plant_id, SUM(score) AS popularity_score
            FROM plant_popularity_daily
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY plant_id
          ) pp ON pp.plant_id = p.id
        `
      : '';
    const familyJoinSql = useTaxonAliasSearch
      ? `
          LEFT JOIN (
            SELECT scientific_name, MIN(NULLIF(chinese_name, '')) AS chinese_name
            FROM taxa
            WHERE taxon_rank = 'family'
            GROUP BY scientific_name
          ) tf ON tf.scientific_name = p.wcvp_family
        `
      : '';
    const genusJoinSql = useTaxonAliasSearch
      ? `
          LEFT JOIN (
            SELECT scientific_name, MIN(NULLIF(chinese_name, '')) AS chinese_name
            FROM taxa
            WHERE taxon_rank = 'genus'
            GROUP BY scientific_name
          ) tg ON tg.scientific_name = p.wcvp_genus
        `
      : '';
    const divisionJoinSql = divisionFilter
      ? `
          LEFT JOIN taxa ds ON ds.id = p.taxon_id
          LEFT JOIN taxa dg ON dg.id = ds.parent_id
          LEFT JOIN taxa df ON df.id = dg.parent_id
          LEFT JOIN taxa dord ON dord.id = df.parent_id
          LEFT JOIN taxa dcls ON dcls.id = dord.parent_id
          LEFT JOIN taxa dsp ON dsp.id = dcls.parent_id AND dsp.taxon_rank = 'subphylum'
          LEFT JOIN taxa dt ON dt.id = CASE WHEN dsp.id IS NOT NULL THEN dsp.parent_id ELSE dcls.parent_id END
        `
      : '';

    const hybridPrioritySql = "CASE WHEN p.scientific_name LIKE '%×%' OR p.chinese_name LIKE '%杂交%' THEN 1 ELSE 0 END";
    const relevanceScoreSql = usePopularityJoin
      ? `((${textScoreSql}) * 1000 + COALESCE(pp.popularity_score, 0))`
      : `(${textScoreSql})`;
    const orderSql = sort === 'popular'
      ? `ORDER BY ${hybridPrioritySql} ASC, COALESCE(pp.popularity_score, 0) DESC, text_score DESC, p.id DESC`
      : sort === 'latest'
        ? `ORDER BY ${hybridPrioritySql} ASC, p.created_at DESC, text_score DESC, p.id DESC`
        : sort === 'alpha'
          ? `ORDER BY ${hybridPrioritySql} ASC, text_score DESC, p.scientific_name ASC, p.id ASC`
          : `ORDER BY ${hybridPrioritySql} ASC, ${relevanceScoreSql} DESC, p.created_at DESC, p.id DESC`;

    const rows = await sequelize.query(
      `
        SELECT
          p.id,
          p.chinese_name,
          p.scientific_name,
          p.cover_image,
          p.short_desc,
          p.category,
          p.wcvp_family,
          ${useTaxonAliasSearch ? 'tf.chinese_name' : 'NULL'} AS family_chinese_name,
          p.wcvp_genus,
          p.created_at,
          p.updated_at,
          ${textScoreSql} AS text_score
        FROM plants p
        ${familyJoinSql}
        ${genusJoinSql}
        ${divisionJoinSql}
        ${popularityJoinSql}
        WHERE ${whereClauses.join(' ')}
        ${orderSql}
        LIMIT :queryLimit OFFSET :offset
      `,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    let total = 0;
    const effectiveRows = shortKeywordFastMode ? rows.slice(0, limit) : rows;

    if (shortKeywordFastMode) {
      const hasMore = rows.length > limit;
      total = hasMore ? (offset + limit + 1) : (offset + effectiveRows.length);
    } else {
      const [countRow] = await sequelize.query(
        `
          SELECT COUNT(*) AS total
          FROM plants p
          ${familyJoinSql}
          ${genusJoinSql}
          ${divisionJoinSql}
          WHERE ${whereClauses.join(' ')}
        `,
        {
          replacements,
          type: QueryTypes.SELECT
        }
      );
      total = Number(countRow?.total || 0);
    }

    const result = {
      list: effectiveRows.map((row) => mapPlantCard(row)),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      meta: {
        query: q,
        sort,
        tookMs: 0,
        hitCount: total
      }
    };

    SEARCH_RESULT_CACHE.set(cacheKey, {
      cachedAt: Date.now(),
      data: result
    });

    if (SEARCH_RESULT_CACHE.size > 500) {
      const firstKey = SEARCH_RESULT_CACHE.keys().next().value;
      if (firstKey) {
        SEARCH_RESULT_CACHE.delete(firstKey);
      }
    }

    return result;
  }

  async suggestPlants(params = {}) {
    const q = String(params.q || '').trim();
    const limit = Math.min(20, Math.max(1, Number(params.limit) || 8));
    const escapedQ = escapeLikeText(q);
    const prefixQ = `${q}%`;
    const containsQ = `%${q}%`;
    const prefixQSql = toSqlStringLiteral(prefixQ);
    const containsQSql = toSqlStringLiteral(`%${escapedQ}%`);

    const items = await Plants.findAll({
      attributes: ['id', 'chinese_name', 'scientific_name', 'wcvp_family', 'wcvp_genus'],
      where: {
        [Op.or]: [
          { chinese_name: { [Op.like]: prefixQ } },
          { scientific_name: { [Op.like]: prefixQ } },
          { chinese_name: { [Op.like]: containsQ } },
          { scientific_name: { [Op.like]: containsQ } }
        ]
      },
      order: [
        [
          Sequelize.literal(`
            CASE
              WHEN scientific_name LIKE '%×%' OR chinese_name LIKE '%杂交%' THEN 10
              ELSE 0
            END
            + CASE
              WHEN chinese_name LIKE ${prefixQSql} ESCAPE '\\\\' THEN 1
              WHEN scientific_name LIKE ${prefixQSql} ESCAPE '\\\\' THEN 2
              WHEN chinese_name LIKE ${containsQSql} ESCAPE '\\\\' THEN 3
              ELSE 4
            END
          `),
          'ASC'
        ],
        ['id', 'DESC']
      ],
      limit: limit * 2
    });

    const suggestions = [];
    const seen = new Set();

    const pushCandidates = (plain) => {
      const candidates = [plain.chinese_name, plain.scientific_name].filter(Boolean);
      for (const text of candidates) {
        const key = String(text).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push({
          plant_id: plain.id,
          text,
          type: text === plain.chinese_name ? 'chinese_name' : 'scientific_name'
        });
        if (suggestions.length >= limit) {
          return true;
        }
      }
      return false;
    };

    for (const item of items) {
      const plain = item.get({ plain: true });
      if (pushCandidates(plain)) {
        return { suggestions };
      }
    }

    if (q.length === 1 && suggestions.length < limit) {
      const aliasRows = await sequelize.query(
        `
          SELECT scientific_name, taxon_rank
          FROM taxa
          WHERE taxon_rank IN ('family', 'genus')
            AND chinese_name LIKE :qPrefix ESCAPE '\\\\'
          GROUP BY scientific_name, taxon_rank
          LIMIT 20
        `,
        {
          replacements: { qPrefix: `${escapeLikeText(q)}%` },
          type: QueryTypes.SELECT
        }
      );

      const familyNames = aliasRows
        .filter((row) => row.taxon_rank === 'family')
        .map((row) => row.scientific_name)
        .filter(Boolean);
      const genusNames = aliasRows
        .filter((row) => row.taxon_rank === 'genus')
        .map((row) => row.scientific_name)
        .filter(Boolean);

      if (familyNames.length || genusNames.length) {
        const expandedItems = await Plants.findAll({
          attributes: ['id', 'chinese_name', 'scientific_name', 'wcvp_family', 'wcvp_genus'],
          where: {
            [Op.or]: [
              ...(familyNames.length ? [{ wcvp_family: { [Op.in]: familyNames } }] : []),
              ...(genusNames.length ? [{ wcvp_genus: { [Op.in]: genusNames } }] : [])
            ]
          },
          order: [
            [
              Sequelize.literal("CASE WHEN scientific_name LIKE '%×%' OR chinese_name LIKE '%杂交%' THEN 1 ELSE 0 END"),
              'ASC'
            ],
            ['id', 'DESC']
          ],
          limit: limit * 2
        });

        for (const item of expandedItems) {
          const plain = item.get({ plain: true });
          if (pushCandidates(plain)) {
            return { suggestions };
          }
        }
      }
    }

    return { suggestions };
  }
}

module.exports = new SearchService();
