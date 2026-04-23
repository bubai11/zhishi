const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { Taxa, Plants, sequelize } = require('../models');
const { formatTaxonLabel } = require('./frontendTransformers');

function normalizeTaxonText(value) {
  return String(value || '').trim();
}

function pickPreferredChineseName(names = []) {
  return names
    .map((name) => normalizeTaxonText(name))
    .find((name) => name && /[\u4e00-\u9fff]/.test(name)) || '';
}

const RANK_LABELS = {
  kingdom: '界',
  phylum: '门',
  subphylum: '亚门',
  class: '纲',
  order: '目',
  family: '科',
  genus: '属',
  species: '种'
};

function rankSortSql(alias = 't') {
  return `FIELD(${alias}.taxon_rank, 'kingdom', 'phylum', 'subphylum', 'class', 'order', 'family', 'genus', 'species')`;
}

function resolveRankKeyword(keyword) {
  const normalized = normalizeTaxonText(keyword).toLowerCase();
  const rankMap = new Map([
    ['界', 'kingdom'],
    ['kingdom', 'kingdom'],
    ['门', 'phylum'],
    ['phylum', 'phylum'],
    ['亚门', 'subphylum'],
    ['subphylum', 'subphylum'],
    ['纲', 'class'],
    ['class', 'class'],
    ['目', 'order'],
    ['order', 'order'],
    ['科', 'family'],
    ['family', 'family'],
    ['属', 'genus'],
    ['genus', 'genus'],
    ['种', 'species'],
    ['species', 'species']
  ]);

  return rankMap.get(normalized) || '';
}

function buildTaxonDescription(row) {
  const rankLabel = RANK_LABELS[row.taxon_rank] || row.taxon_rank;
  const displayName = normalizeTaxonText(row.chinese_name) || normalizeTaxonText(row.scientific_name) || '该节点';
  const scientificName = normalizeTaxonText(row.scientific_name);
  const description = normalizeTaxonText(row.description);

  if (description) {
    return description;
  }

  if (row.has_children) {
    return `${displayName}是分类系统中的${rankLabel}级节点，可继续展开查看下一级分类。${scientificName ? `当前学名为 ${scientificName}。` : ''}`;
  }

  return `${displayName}是分类系统中的${rankLabel}级节点，当前数据中暂未收录它的下一级分类。${scientificName ? `当前学名为 ${scientificName}。` : ''}`;
}

class TaxaService {
  async getTaxaList(query = {}) {
    const { rank, parent_id, keyword } = query;
    const where = {};

    if (rank) where.taxon_rank = rank;
    if (parent_id !== undefined && parent_id !== '') where.parent_id = Number(parent_id);
    if (keyword) {
      where[Op.or] = [
        { chinese_name: { [Op.like]: `%${keyword}%` } },
        { scientific_name: { [Op.like]: `%${keyword}%` } }
      ];
    }

    return Taxa.findAll({
      where,
      order: [['taxon_rank', 'ASC'], ['id', 'ASC']]
    });
  }

  async getTaxaTree() {
    const all = await Taxa.findAll({ order: [['id', 'ASC']] });
    const byParent = new Map();
    const byId = new Map();

    all.forEach((item) => {
      const plain = item.get({ plain: true });
      plain.children = [];
      byId.set(plain.id, plain);
      const key = plain.parent_id || 0;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(plain);
    });

    byId.forEach((node) => {
      node.children = byParent.get(node.id) || [];
    });

    return byParent.get(0) || [];
  }

  async getTaxaChildren(parentId) {
    const hasParent = parentId !== undefined && parentId !== null && String(parentId) !== '';
    const replacements = hasParent ? { parentId: Number(parentId) } : {};
    const whereSql = hasParent ? 't.parent_id = :parentId' : 't.parent_id IS NULL';

    const rows = await sequelize.query(
      `
        SELECT
          t.id,
          t.parent_id,
          t.taxon_rank,
          t.scientific_name,
          t.chinese_name,
          t.description,
          EXISTS (
            SELECT 1
            FROM taxa child
            WHERE child.parent_id = t.id
            LIMIT 1
          ) AS has_children
        FROM taxa t
        WHERE ${whereSql}
        ORDER BY ${rankSortSql('t')} ASC, COALESCE(NULLIF(t.chinese_name, ''), t.scientific_name) ASC, t.id ASC
      `,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    return rows.map((row) => ({
      id: String(row.id),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      name: row.chinese_name || row.scientific_name,
      rank: row.taxon_rank,
      scientific_name: row.scientific_name,
      description: buildTaxonDescription(row),
      has_children: Boolean(row.has_children)
    }));
  }

  async searchTaxa(query = {}) {
    const keyword = normalizeTaxonText(query.q || query.keyword);
    const limit = Math.max(1, Math.min(30, Number(query.limit) || 12));
    const rankKeyword = resolveRankKeyword(keyword);

    if (!keyword) {
      return { total: 0, list: [] };
    }

    const rows = rankKeyword
      ? await sequelize.query(
        `
          SELECT
            t.id,
            t.parent_id,
            t.taxon_rank,
            t.scientific_name,
            t.chinese_name,
            t.description,
            COALESCE(NULLIF(t.chinese_name, ''), t.scientific_name) AS matched_name,
            'taxon' AS match_source,
            EXISTS (
              SELECT 1
              FROM taxa child
              WHERE child.parent_id = t.id
              LIMIT 1
            ) AS has_children,
            0 AS relevance
          FROM taxa t
          WHERE t.taxon_rank = :rankKeyword
          ORDER BY COALESCE(NULLIF(t.chinese_name, ''), t.scientific_name) ASC, t.id ASC
          LIMIT :limit
        `,
        {
          replacements: { rankKeyword, limit },
          type: QueryTypes.SELECT
        }
      )
      : await sequelize.query(
        `
          SELECT *
          FROM (
            SELECT
              t.id,
              t.parent_id,
              t.taxon_rank,
              t.scientific_name,
              t.chinese_name,
              t.description,
              COALESCE(NULLIF(t.chinese_name, ''), t.scientific_name) AS matched_name,
              'taxon' AS match_source,
              EXISTS (
                SELECT 1
                FROM taxa child
                WHERE child.parent_id = t.id
                LIMIT 1
              ) AS has_children,
              CASE
                WHEN t.chinese_name = :keyword THEN 0
                WHEN t.scientific_name = :keyword THEN 1
                WHEN t.chinese_name LIKE :keyword THEN 2
                ELSE 3
              END AS relevance
            FROM taxa t
            WHERE t.chinese_name LIKE :keyword
               OR t.scientific_name LIKE :keyword

            UNION ALL

            SELECT
              t.id,
              t.parent_id,
              t.taxon_rank,
              t.scientific_name,
              t.chinese_name,
              t.description,
              COALESCE(NULLIF(p.chinese_name, ''), p.scientific_name, t.scientific_name) AS matched_name,
              'plant' AS match_source,
              EXISTS (
                SELECT 1
                FROM taxa child
                WHERE child.parent_id = t.id
                LIMIT 1
              ) AS has_children,
              CASE
                WHEN p.chinese_name = :keyword THEN 0
                WHEN p.scientific_name = :keyword THEN 1
                WHEN p.chinese_name LIKE :keyword THEN 2
                ELSE 3
              END AS relevance
            FROM plants p
            INNER JOIN taxa t ON t.id = p.taxon_id
            WHERE p.chinese_name LIKE :keyword
               OR p.scientific_name LIKE :keyword
          ) matched
          ORDER BY relevance ASC, ${rankSortSql('matched')} DESC, matched_name ASC, id ASC
          LIMIT :limit
        `,
        {
          replacements: {
            keyword: `%${keyword}%`,
            limit
          },
          type: QueryTypes.SELECT
        }
      );

    const byId = new Map();
    rows.forEach((row) => {
      if (!byId.has(row.id)) {
        byId.set(row.id, row);
      }
    });

    const list = [];
    for (const row of byId.values()) {
      const path = await this.getTaxonPath(row.id);
      list.push({
        id: String(row.id),
        parent_id: row.parent_id ? String(row.parent_id) : null,
        name: row.chinese_name || row.matched_name || row.scientific_name,
        rank: row.taxon_rank,
        scientific_name: row.scientific_name,
        description: buildTaxonDescription(row),
        has_children: Boolean(row.has_children),
        matched_name: row.matched_name,
        match_source: row.match_source,
        path
      });
    }

    return {
      total: list.length,
      list
    };
  }

  async getTaxonPath(taxonId) {
    const path = [];
    const visited = new Set();
    let currentId = Number(taxonId);

    while (Number.isInteger(currentId) && currentId > 0 && !visited.has(currentId)) {
      visited.add(currentId);
      const row = await Taxa.findByPk(currentId, {
        attributes: ['id', 'parent_id', 'taxon_rank', 'scientific_name', 'chinese_name', 'description']
      });

      if (!row) break;

      const plain = row.get({ plain: true });
      path.unshift({
        id: String(plain.id),
        parent_id: plain.parent_id ? String(plain.parent_id) : null,
        name: plain.chinese_name || plain.scientific_name,
        rank: plain.taxon_rank,
        scientific_name: plain.scientific_name
      });
      currentId = Number(plain.parent_id);
    }

    return path;
  }

  async getFamilies() {
    const [families, familyCounts] = await Promise.all([
      Taxa.findAll({
        where: { taxon_rank: 'family' },
        attributes: ['id', 'chinese_name', 'scientific_name'],
        order: [['scientific_name', 'ASC']]
      }),
      Plants.findAll({
        attributes: [
          'wcvp_family',
          [fn('COUNT', col('id')), 'species_count']
        ],
        where: {
          wcvp_family: {
            [Op.not]: null,
            [Op.ne]: ''
          }
        },
        group: ['wcvp_family']
      })
    ]);

    const countByFamily = new Map(
      familyCounts.map((row) => [
        normalizeTaxonText(row.get('wcvp_family')),
        Number(row.get('species_count') || 0)
      ])
    );

    const familyMetaByScientificName = new Map();

    families.forEach((family) => {
      const plain = family.get({ plain: true });
      const scientificName = normalizeTaxonText(plain.scientific_name);
      if (!scientificName) {
        return;
      }

      const current = familyMetaByScientificName.get(scientificName) || {
        chineseNames: [],
        scientific_name: scientificName
      };

      if (plain.chinese_name) {
        current.chineseNames.push(plain.chinese_name);
      }

      familyMetaByScientificName.set(scientificName, current);
    });

    const result = Array.from(countByFamily.entries()).map(([scientificName, speciesCount]) => {
      const meta = familyMetaByScientificName.get(scientificName);
      const chineseName = pickPreferredChineseName(meta?.chineseNames || []);

      return {
        id: scientificName,
        name: chineseName || scientificName,
        chinese_name: chineseName || null,
        scientific_name: scientificName,
        species_count: speciesCount
      };
    });

    return result.sort((a, b) => {
      if (b.species_count !== a.species_count) {
        return b.species_count - a.species_count;
      }
      return a.scientific_name.localeCompare(b.scientific_name);
    });
  }

  async getFeaturedGenera(taxonId, limit = 10) {
    const taxonKey = normalizeTaxonText(taxonId);
    const numericTaxonId = Number(taxonKey);
    const parent = Number.isInteger(numericTaxonId) && numericTaxonId > 0
      ? await Taxa.findByPk(numericTaxonId)
      : await Taxa.findOne({
        where: {
          taxon_rank: 'family',
          scientific_name: taxonKey
        },
        order: [['id', 'ASC']]
      });

    if (!parent) {
      throw new Error('Taxon not found');
    }

    const genera = await Taxa.findAll({
      where: {
        taxon_rank: 'genus',
        ...(parent.taxon_rank === 'family' ? { parent_id: Number(parent.id) } : {})
      },
      order: [['scientific_name', 'ASC']],
      limit: Math.max(1, Math.min(50, Number(limit) || 10))
    });

    const generaNames = genera.map((genus) => genus.scientific_name).filter(Boolean);
    const plants = generaNames.length > 0
      ? await Plants.findAll({
        where: { wcvp_genus: { [Op.in]: generaNames } },
        attributes: ['id', 'wcvp_genus', 'cover_image'],
        order: [
          [literal("CASE WHEN cover_image IS NULL OR cover_image = '' THEN 1 ELSE 0 END"), 'ASC'],
          ['id', 'ASC']
        ]
      })
      : [];

    const coverByGenus = new Map();
    const speciesCountByGenus = new Map();
    plants.forEach((plant) => {
      const plain = plant.get({ plain: true });
      speciesCountByGenus.set(plain.wcvp_genus, Number(speciesCountByGenus.get(plain.wcvp_genus) || 0) + 1);
      if (!coverByGenus.has(plain.wcvp_genus)) {
        coverByGenus.set(plain.wcvp_genus, plain.cover_image || null);
      }
    });

    const list = genera.map((genus) => {
      const plainGenus = genus.get({ plain: true });
      return {
        id: String(plainGenus.id),
        name: formatTaxonLabel(plainGenus),
        scientific_name: plainGenus.scientific_name,
        family_name: formatTaxonLabel(parent),
        cover_image: coverByGenus.get(plainGenus.scientific_name) || null,
        species_count: Number(speciesCountByGenus.get(plainGenus.scientific_name) || 0)
      };
    });

    return {
      total: list.length,
      list: list.sort((a, b) => {
        if (b.species_count !== a.species_count) {
          return b.species_count - a.species_count;
        }
        return a.scientific_name.localeCompare(b.scientific_name);
      })
    };
  }

  async getTaxonById(id) {
    const taxon = await Taxa.findByPk(id, {
      include: [
        { model: Taxa, as: 'parent', required: false },
        { model: Taxa, as: 'children', required: false },
        { model: Plants, as: 'plants', required: false }
      ]
    });

    if (!taxon) {
      throw new Error('Taxon not found');
    }

    return taxon;
  }

  async createTaxon(data) {
    const { taxon_rank, parent_id, scientific_name, chinese_name } = data;

    if (!taxon_rank || !scientific_name || !chinese_name) {
      throw new Error('taxon_rank, scientific_name and chinese_name are required');
    }

    if (parent_id) {
      const parent = await Taxa.findByPk(parent_id);
      if (!parent) {
        throw new Error('Parent taxon not found');
      }
    }

    return Taxa.create({
      taxon_rank,
      parent_id: parent_id || null,
      scientific_name,
      chinese_name
    });
  }

  async updateTaxon(id, data) {
    const taxon = await Taxa.findByPk(id);
    if (!taxon) {
      throw new Error('Taxon not found');
    }

    if (data.parent_id !== undefined && data.parent_id !== null) {
      if (Number(data.parent_id) === Number(id)) {
        throw new Error('Parent taxon cannot be itself');
      }
      const parent = await Taxa.findByPk(data.parent_id);
      if (!parent) {
        throw new Error('Parent taxon not found');
      }
    }

    await taxon.update(data);
    return this.getTaxonById(id);
  }

  async deleteTaxon(id) {
    const taxon = await Taxa.findByPk(id);
    if (!taxon) {
      throw new Error('Taxon not found');
    }

    const childCount = await Taxa.count({ where: { parent_id: id } });
    if (childCount > 0) {
      throw new Error('Cannot delete a taxon that still has child taxa');
    }

    const plantCount = await Plants.count({ where: { taxon_id: id } });
    if (plantCount > 0) {
      throw new Error('Cannot delete a taxon that is still referenced by plants');
    }

    await taxon.destroy();
    return { id: Number(id), message: 'Deleted successfully' };
  }
}

module.exports = new TaxaService();
