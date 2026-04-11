const { Op, Sequelize, QueryTypes } = require('sequelize');
const { Plants, sequelize } = require('../models');
const { mapPlantCard } = require('./frontendTransformers');

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
    const taxonId = params.taxonId !== undefined && params.taxonId !== ''
      ? Number(params.taxonId)
      : null;

    const offset = (page - 1) * limit;
    const escapedQ = escapeLikeText(q);
    const prefixPattern = `${escapedQ}%`;
    const containsPattern = `%${escapedQ}%`;
    const useContainsMatch = q.length >= 3;
    const replacements = {
      q,
      qPrefix: prefixPattern,
      limit,
      offset
    };
    const whereClauses = [
      '(',
      'p.chinese_name = :q',
      'OR p.scientific_name = :q',
      "OR p.chinese_name LIKE :qPrefix ESCAPE '\\\\'",
      "OR p.scientific_name LIKE :qPrefix ESCAPE '\\\\'"
    ];

    if (useContainsMatch) {
      replacements.qContains = containsPattern;
      whereClauses.push(
        "OR p.chinese_name LIKE :qContains ESCAPE '\\\\'",
        "OR p.scientific_name LIKE :qContains ESCAPE '\\\\'",
        "OR p.short_desc LIKE :qContains ESCAPE '\\\\'"
      );
    }

    whereClauses.push(')');

    if (taxonId) {
      replacements.taxonId = taxonId;
      whereClauses.push('AND p.taxon_id = :taxonId');
    }

    const textScoreSql = useContainsMatch
      ? `
          CASE
            WHEN p.chinese_name = :q THEN 100
            WHEN p.scientific_name = :q THEN 95
            WHEN p.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 80
            WHEN p.scientific_name LIKE :qPrefix ESCAPE '\\\\' THEN 70
            WHEN p.chinese_name LIKE :qContains ESCAPE '\\\\' THEN 50
            WHEN p.scientific_name LIKE :qContains ESCAPE '\\\\' THEN 40
            WHEN p.short_desc LIKE :qContains ESCAPE '\\\\' THEN 20
            ELSE 0
          END
        `
      : `
          CASE
            WHEN p.chinese_name = :q THEN 100
            WHEN p.scientific_name = :q THEN 95
            WHEN p.chinese_name LIKE :qPrefix ESCAPE '\\\\' THEN 80
            WHEN p.scientific_name LIKE :qPrefix ESCAPE '\\\\' THEN 70
            ELSE 0
          END
        `;

    const popularityJoinSql = sort === 'popular' || sort === 'relevance'
      ? `
          LEFT JOIN (
            SELECT plant_id, SUM(score) AS popularity_score
            FROM plant_popularity_daily
            WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY plant_id
          ) pp ON pp.plant_id = p.id
        `
      : '';
    const familyJoinSql = `
        LEFT JOIN (
          SELECT scientific_name, MIN(NULLIF(chinese_name, '')) AS chinese_name
          FROM taxa
          WHERE taxon_rank = 'family'
          GROUP BY scientific_name
        ) tf ON tf.scientific_name = p.wcvp_family
      `;

    const orderSql = sort === 'popular'
      ? 'ORDER BY COALESCE(pp.popularity_score, 0) DESC, text_score DESC, p.id DESC'
      : sort === 'latest'
        ? 'ORDER BY p.created_at DESC, text_score DESC, p.id DESC'
        : sort === 'alpha'
          ? 'ORDER BY text_score DESC, p.scientific_name ASC, p.id ASC'
          : `ORDER BY ((${textScoreSql}) * 1000 + COALESCE(pp.popularity_score, 0)) DESC, p.created_at DESC, p.id DESC`;

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
          tf.chinese_name AS family_chinese_name,
          p.wcvp_genus,
          p.created_at,
          p.updated_at,
          ${textScoreSql} AS text_score
        FROM plants p
        ${familyJoinSql}
        ${popularityJoinSql}
        WHERE ${whereClauses.join(' ')}
        ${orderSql}
        LIMIT :limit OFFSET :offset
      `,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    const [countRow] = await sequelize.query(
      `
        SELECT COUNT(*) AS total
        FROM plants p
        WHERE ${whereClauses.join(' ')}
      `,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    const total = Number(countRow?.total || 0);

    return {
      list: rows.map((row) => mapPlantCard(row)),
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
      attributes: ['id', 'chinese_name', 'scientific_name'],
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
              WHEN chinese_name LIKE ${prefixQSql} ESCAPE '\\' THEN 1
              WHEN scientific_name LIKE ${prefixQSql} ESCAPE '\\' THEN 2
              WHEN chinese_name LIKE ${containsQSql} ESCAPE '\\' THEN 3
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

    for (const item of items) {
      const plain = item.get({ plain: true });
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
          return { suggestions };
        }
      }
    }

    return { suggestions };
  }
}

module.exports = new SearchService();
