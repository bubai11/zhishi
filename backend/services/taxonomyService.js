const { QueryTypes } = require('sequelize');
const {
  sequelize,
  Taxa,
  TaxonomyStatistics,
  TaxonomyFeatures
} = require('../models');

const TOTAL_KNOWN_PLANTS = 391000;

class TaxonomyService {
  async getSpeciesCountRecursive(taxonId) {
    const rows = await sequelize.query(
      `
      WITH RECURSIVE taxon_tree AS (
        SELECT id, taxon_rank
        FROM taxa
        WHERE id = :taxonId

        UNION ALL

        SELECT t.id, t.taxon_rank
        FROM taxa t
        INNER JOIN taxon_tree tt ON t.parent_id = tt.id
      )
      SELECT COUNT(*) AS total_species
      FROM taxon_tree
      WHERE taxon_rank = 'species'
      `,
      {
        replacements: { taxonId: Number(taxonId) },
        type: QueryTypes.SELECT
      }
    );

    return Number(rows[0]?.total_species || 0);
  }

  async getChildTaxaCount(taxonId) {
    return Taxa.count({ where: { parent_id: Number(taxonId) } });
  }

  async getTaxonStatistics(taxonId) {
    const id = Number(taxonId);
    if (!id || Number.isNaN(id)) {
      throw new Error('分类 ID 非法');
    }

    const taxon = await Taxa.findByPk(id);
    if (!taxon) {
      throw new Error('分类不存在');
    }

    const [speciesCount, childCount, storedStats, featureList] = await Promise.all([
      this.getSpeciesCountRecursive(id),
      this.getChildTaxaCount(id),
      TaxonomyStatistics.findOne({ where: { taxon_id: id } }),
      TaxonomyFeatures.findAll({
        where: { taxon_id: id },
        attributes: ['id', 'feature_type', 'feature_text']
      })
    ]);

    const computedKnownRatio = speciesCount / TOTAL_KNOWN_PLANTS;

    const statistics = {
      total_species: storedStats ? Number(storedStats.total_species) || speciesCount : speciesCount,
      child_taxa_count: storedStats ? Number(storedStats.child_taxa_count) || childCount : childCount,
      known_ratio: storedStats ? Number(storedStats.known_ratio) || computedKnownRatio : computedKnownRatio,
      global_rank: storedStats ? storedStats.global_rank || null : null,
      updated_at: storedStats ? storedStats.updated_at : null
    };

    return {
      taxon,
      statistics,
      features: featureList,
      meta: {
        total_known_plants: TOTAL_KNOWN_PLANTS,
        ratio_percent: Number((statistics.known_ratio * 100).toFixed(2))
      }
    };
  }

  async getTreeWithStats(parentId = null) {
    const where = {};
    if (parentId === null || parentId === undefined || parentId === '') {
      where.parent_id = null;
    } else {
      where.parent_id = Number(parentId);
    }

    const children = await Taxa.findAll({
      where,
      attributes: ['id', 'taxon_rank', 'scientific_name', 'chinese_name'],
      order: [['id', 'ASC']]
    });

    const enrichedChildren = await Promise.all(
      children.map(async (child) => {
        const speciesCount = await this.getSpeciesCountRecursive(child.id);
        const childCount = await this.getChildTaxaCount(child.id);
        const ratio = speciesCount / TOTAL_KNOWN_PLANTS;

        return {
          ...child.get({ plain: true }),
          speciesCount,
          childCount,
          ratio: Number((ratio * 100).toFixed(2)),
          hasChildren: childCount > 0
        };
      })
    );

    return enrichedChildren;
  }
}

module.exports = new TaxonomyService();
