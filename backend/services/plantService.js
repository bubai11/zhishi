const {
  sequelize,
  Plants,
  PlantDetail,
  Taxa,
  PlantObservations,
  PlantMedia,
  MediaAssets,
  PlantEcology,
  ThreatenedSpecies,
  BrowseEvents,
  ProtectedAreas
} = require('../models');
const { Op, QueryTypes } = require('sequelize');
const {
  mapPlantCard,
  formatIucnCategory,
  formatTaxonLabel
} = require('./frontendTransformers');

function escapeLikeText(value = '') {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

class PlantService {
  async getTaxonomyChain(taxonId) {
    if (!taxonId) {
      return [];
    }

    const chain = await sequelize.query(
      `
        WITH RECURSIVE taxonomy_chain AS (
          SELECT id, parent_id, taxon_rank, scientific_name, chinese_name, 0 AS depth
          FROM taxa
          WHERE id = :taxonId
          UNION ALL
          SELECT parent.id, parent.parent_id, parent.taxon_rank, parent.scientific_name, parent.chinese_name, child.depth + 1 AS depth
          FROM taxa parent
          INNER JOIN taxonomy_chain child ON parent.id = child.parent_id
        )
        SELECT id, parent_id, taxon_rank, scientific_name, chinese_name
        FROM taxonomy_chain
        ORDER BY depth ASC
      `,
      {
        replacements: { taxonId: Number(taxonId) },
        type: QueryTypes.SELECT
      }
    );

    return chain;
  }

  buildTaxonomyPayload(chain, plant) {
    const byRank = Object.fromEntries(chain.map((item) => [item.taxon_rank, item]));
    return {
      kingdom: formatTaxonLabel(byRank.kingdom),
      phylum: formatTaxonLabel(byRank.phylum),
      subphylum: formatTaxonLabel(byRank.subphylum),
      class: formatTaxonLabel(byRank.class),
      order: formatTaxonLabel(byRank.order),
      family: formatTaxonLabel(byRank.family),
      genus: formatTaxonLabel(byRank.genus),
      lineage: [
        formatTaxonLabel(byRank.kingdom),
        formatTaxonLabel(byRank.phylum),
        formatTaxonLabel(byRank.subphylum),
        formatTaxonLabel(byRank.class),
        formatTaxonLabel(byRank.order),
        formatTaxonLabel(byRank.family),
        formatTaxonLabel(byRank.genus)
      ].filter(Boolean),
      species: plant.scientific_name && plant.chinese_name && plant.chinese_name !== plant.scientific_name
        ? `${plant.chinese_name} (${plant.scientific_name})`
        : plant.scientific_name || plant.chinese_name || null
    };
  }

  async getAllPlants(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params.pageSize || params.limit) || 20));
    const offset = (page - 1) * pageSize;
    const keyword = String(params.q || params.keyword || '').trim();
    const sort = String(params.sort || 'latest').toLowerCase();
    const replacements = {
      limit: pageSize,
      offset
    };
    const whereClauses = [];
    let matchRankSql = '4';

    if (keyword) {
      const escapedKeyword = escapeLikeText(keyword);
      const prefixPattern = `${escapedKeyword}%`;
      const containsPattern = `%${escapedKeyword}%`;
      const useContainsMatch = keyword.length >= 3;

      replacements.keywordExact = keyword;
      replacements.keywordPrefix = prefixPattern;

      const keywordClauses = [
        "p.chinese_name = :keywordExact",
        "p.scientific_name = :keywordExact",
        "p.chinese_name LIKE :keywordPrefix ESCAPE '\\\\'",
        "p.scientific_name LIKE :keywordPrefix ESCAPE '\\\\'"
      ];

      if (useContainsMatch) {
        replacements.keywordContains = containsPattern;
        keywordClauses.push(
          "p.chinese_name LIKE :keywordContains ESCAPE '\\\\'",
          "p.scientific_name LIKE :keywordContains ESCAPE '\\\\'"
        );
      }

      whereClauses.push(`(${keywordClauses.join(' OR ')})`);

      matchRankSql = useContainsMatch
        ? `
            CASE
              WHEN p.chinese_name = :keywordExact THEN 0
              WHEN p.scientific_name = :keywordExact THEN 1
              WHEN p.chinese_name LIKE :keywordPrefix ESCAPE '\\\\' THEN 2
              WHEN p.scientific_name LIKE :keywordPrefix ESCAPE '\\\\' THEN 3
              WHEN p.chinese_name LIKE :keywordContains ESCAPE '\\\\' THEN 4
              WHEN p.scientific_name LIKE :keywordContains ESCAPE '\\\\' THEN 5
              ELSE 6
            END
          `
        : `
            CASE
              WHEN p.chinese_name = :keywordExact THEN 0
              WHEN p.scientific_name = :keywordExact THEN 1
              WHEN p.chinese_name LIKE :keywordPrefix ESCAPE '\\\\' THEN 2
              WHEN p.scientific_name LIKE :keywordPrefix ESCAPE '\\\\' THEN 3
              ELSE 4
            END
          `;
    }

    if (params.family) {
      replacements.family = params.family;
      whereClauses.push('p.wcvp_family = :family');
    }

    if (params.genus) {
      replacements.genus = params.genus;
      whereClauses.push('p.wcvp_genus = :genus');
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const usePopularityJoin = sort === 'popular';
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
    const familyJoinSql = `
        LEFT JOIN (
          SELECT scientific_name, MIN(NULLIF(chinese_name, '')) AS chinese_name
          FROM taxa
          WHERE taxon_rank = 'family'
          GROUP BY scientific_name
        ) tf ON tf.scientific_name = p.wcvp_family
      `;

    const orderSql = sort === 'popular'
      ? 'ORDER BY COALESCE(pp.popularity_score, 0) DESC, p.id DESC'
      : sort === 'alpha'
        ? 'ORDER BY match_rank ASC, p.scientific_name ASC, p.id ASC'
        : keyword
          ? 'ORDER BY match_rank ASC, p.created_at DESC, p.id DESC'
          : 'ORDER BY p.created_at DESC, p.id DESC';

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
          ${usePopularityJoin ? 'COALESCE(pp.popularity_score, 0)' : '0'} AS popularity_score,
          ${matchRankSql} AS match_rank
        FROM plants p
        ${familyJoinSql}
        ${popularityJoinSql}
        ${whereSql}
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
        ${whereSql}
      `,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    return {
      list: rows.map((row) => mapPlantCard(row)),
      total: Number(countRow?.total || 0),
      page,
      pageSize
    };
  }

  async getPlantById(id) {
    const plant = await Plants.findByPk(id, {
      include: [
        { model: PlantDetail, as: 'detail', required: false },
        { model: Taxa, as: 'taxon', required: false },
        { model: PlantEcology, as: 'ecology', required: false },
        { model: ThreatenedSpecies, as: 'threatenedSpecies', required: false },
        {
          model: PlantMedia,
          as: 'mediaList',
          required: false,
          include: [{ model: MediaAssets, as: 'media', required: false }]
        }
      ]
    });

    if (!plant) {
      throw new Error('植物不存在');
    }

    const plainPlant = plant.get({ plain: true });
    const [taxonomyChain, observationCount] = await Promise.all([
      this.getTaxonomyChain(plainPlant.taxon_id),
      PlantObservations.count({ where: { plant_id: id } })
    ]);
    const taxonomy = this.buildTaxonomyPayload(taxonomyChain, plainPlant);
    const genusTaxon = taxonomyChain.find((item) => item.taxon_rank === 'genus');
    const familyTaxon = taxonomyChain.find((item) => item.taxon_rank === 'family');

    const mediaItems = (plainPlant.mediaList || [])
      .map((item) => ({
        ...item.media,
        sort_order: item.sort_order
      }))
      .filter(Boolean)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));

    const images = mediaItems
      .filter((item) => item.kind === 'image' && item.url)
      .map((item) => item.url);
    const modelAsset = mediaItems.find((item) => item.kind === 'model' && item.url);
    const threat = (plainPlant.threatenedSpecies || [])[0];

    return {
      id: String(plainPlant.id),
      chinese_name: plainPlant.chinese_name || plainPlant.scientific_name || '',
      scientific_name: plainPlant.scientific_name || '',
      family_name: formatTaxonLabel(familyTaxon) || plainPlant.wcvp_family || '',
      genus_name: formatTaxonLabel(genusTaxon) || plainPlant.wcvp_genus || '',
      cover_image: plainPlant.cover_image || images[0] || null,
      taxonomy,
      images,
      model_url: modelAsset?.url || null,
      ecology: {
        light: plainPlant.ecology?.light_tolerance ?? plainPlant.ecology?.shade_tolerance ?? 50,
        water: plainPlant.ecology?.water_requirement ?? 50,
        temperature: plainPlant.ecology?.temperature_tolerance ?? plainPlant.ecology?.cold_tolerance ?? 50,
        air: plainPlant.ecology?.air_humidity ?? plainPlant.ecology?.ecological_adaptability ?? 50
      },
      detail: {
        intro: plainPlant.detail?.intro || '',
        morphology: plainPlant.detail?.morphology || '',
        ecology_importance: plainPlant.detail?.habitat || plainPlant.detail?.uses || '',
        distribution_text: plainPlant.detail?.distribution || ''
      },
      observation_count: observationCount,
      conservation_status: formatIucnCategory(threat?.red_list_category),
      iucn_category: threat?.red_list_category || null,
      translation_source: plainPlant.translation_source || null,
      translation_confidence: plainPlant.translation_confidence || 0
    };
  }

  async getPlantStats() {
    const [totalSpecies, totalImages, activeUsers] = await Promise.all([
      Plants.count({ where: { chinese_name: { [Op.ne]: '' } } }),
      MediaAssets.count(),
      BrowseEvents.count({
        distinct: true,
        col: 'user_id',
        where: {
          occurred_at: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return {
      total_species: totalSpecies,
      total_images: totalImages,
      active_users: activeUsers
    };
  }

  async getAnalyticsSummary() {
    const now = new Date();
    const currentPeriodStart = new Date(now);
    currentPeriodStart.setFullYear(currentPeriodStart.getFullYear() - 1);
    const previousPeriodStart = new Date(currentPeriodStart);
    previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);

    const [totalSpecies, criticalRegionsRows, threatenedCount, protectedAreas, currentPeriodAdds, previousPeriodAdds] = await Promise.all([
      Plants.count(),
      sequelize.query(
        `
          SELECT COUNT(*) AS total
          FROM (
            SELECT area_code_l3
            FROM plant_distributions
            GROUP BY area_code_l3
            HAVING COUNT(DISTINCT plant_id) >= 10
          ) hotspot_regions
        `,
        { type: QueryTypes.SELECT }
      ),
      ThreatenedSpecies.count({
        where: { red_list_category: { [Op.in]: ['CR', 'EN', 'VU'] } }
      }),
      ProtectedAreas.count(),
      Plants.count({
        where: {
          created_at: {
            [Op.gte]: currentPeriodStart,
            [Op.lt]: now
          }
        }
      }),
      Plants.count({
        where: {
          created_at: {
            [Op.gte]: previousPeriodStart,
            [Op.lt]: currentPeriodStart
          }
        }
      })
    ]);

    const growthRateValue = previousPeriodAdds > 0
      ? ((currentPeriodAdds - previousPeriodAdds) / previousPeriodAdds) * 100
      : currentPeriodAdds > 0
        ? 100
        : 0;
    const annualGrowthRate = `${growthRateValue >= 0 ? '+' : ''}${growthRateValue.toFixed(1)}%`;

    return {
      total_species: totalSpecies,
      critical_regions: Number(criticalRegionsRows[0]?.total || 0),
      annual_growth_rate: annualGrowthRate,
      protected_areas: protectedAreas
    };
  }

  async createPlant(data) {
    const { chinese_name, scientific_name, taxon_id, cover_image, short_desc, ...detailData } = data;

    const plant = await Plants.create({
      chinese_name,
      scientific_name,
      taxon_id,
      cover_image,
      short_desc
    });

    if (Object.keys(detailData).length > 0) {
      await PlantDetail.create({
        plant_id: plant.id,
        ...detailData
      });
    }

    return this.getPlantById(plant.id);
  }

  async updatePlant(id, data) {
    const { intro, morphology, lifecycle, habitat, distribution, uses, extra, ...plantData } = data;

    const plant = await Plants.findByPk(id);
    if (!plant) {
      throw new Error('植物不存在');
    }

    await plant.update(plantData);

    const detailData = { intro, morphology, lifecycle, habitat, distribution, uses, extra };
    const hasDetail = Object.values(detailData).some((value) => value !== undefined);

    if (hasDetail) {
      const detail = await PlantDetail.findByPk(id);
      if (!detail) {
        await PlantDetail.create({ plant_id: id, ...detailData });
      } else {
        await detail.update(detailData);
      }
    }

    return this.getPlantById(id);
  }

  async deletePlant(id) {
    const plant = await Plants.findByPk(id);
    if (!plant) {
      throw new Error('植物不存在');
    }

    await PlantDetail.destroy({ where: { plant_id: id } });
    await plant.destroy();

    return { id, message: '删除成功' };
  }

  async getPlantObservations(id) {
    const plant = await Plants.findByPk(id);
    if (!plant) {
      throw new Error('植物不存在');
    }

    return PlantObservations.findAll({
      where: { plant_id: id },
      attributes: ['id', 'plant_id', 'plant_name', 'latitude', 'longitude', 'count', 'altitude', 'observation_date', 'description']
    });
  }
}

module.exports = new PlantService();
