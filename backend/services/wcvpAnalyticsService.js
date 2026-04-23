const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const cache = require('../lib/serverCache');

const HEATMAP_TTL  = 60 * 60 * 1000;      // 1 小时
const DIVERSITY_TTL = 60 * 60 * 1000;     // 1 小时
const HOTSPOTS_TTL  = 60 * 60 * 1000;     // 1 小时

class WcvpAnalyticsService {
  async heatmap(params = {}) {
    const limit = Math.min(2000, Math.max(10, Number(params.limit) || 500));
    const cacheKey = `wcvp:heatmap:${limit}`;

    return cache.getOrSet(cacheKey, async () => {
      const rows = await sequelize.query(
        `
        SELECT
          rs.area_code_l3,
          rs.area_name,
          rs.species_count,
          rs.introduced_count,
          rs.native_count,
          COALESCE(hr.high_risk_species_count, 0) AS high_risk_species_count,
          COALESCE(pa.protected_area_count, 0) AS protected_area_count
        FROM (
          SELECT
            d.area_code_l3,
            COALESCE(d.area_name, r.area_name_l3) AS area_name,
            COUNT(DISTINCT d.plant_id) AS species_count,
            SUM(CASE WHEN d.occurrence_status = 'introduced' THEN 1 ELSE 0 END) AS introduced_count,
            SUM(CASE WHEN d.occurrence_status = 'native' THEN 1 ELSE 0 END) AS native_count
          FROM plant_distributions d
          LEFT JOIN wgsrpd_regions r ON r.area_code_l3 = d.area_code_l3
          GROUP BY d.area_code_l3, COALESCE(d.area_name, r.area_name_l3)
        ) rs
        LEFT JOIN (
          SELECT
            d.area_code_l3,
            COUNT(DISTINCT ts.plant_id) AS high_risk_species_count
          FROM plant_distributions d
          INNER JOIN threatened_species ts
            ON ts.plant_id = d.plant_id
            AND ts.red_list_category IN ('CR', 'EN', 'VU')
          GROUP BY d.area_code_l3
        ) hr ON hr.area_code_l3 = rs.area_code_l3
        LEFT JOIN (
          SELECT
            dc.area_code_l3,
            COUNT(DISTINCT p.site_id) AS protected_area_count
          FROM (
            SELECT DISTINCT area_code_l3, country_code
            FROM plant_distributions
            WHERE country_code IS NOT NULL AND country_code <> ''
            UNION
            SELECT DISTINCT area_code_l3, iso3 AS country_code
            FROM wgsrpd_region_country_map
          ) dc
          INNER JOIN protected_areas p
            ON p.iso3 = dc.country_code OR p.parent_iso3 = dc.country_code
          GROUP BY dc.area_code_l3
        ) pa ON pa.area_code_l3 = rs.area_code_l3
        ORDER BY rs.species_count DESC
        LIMIT :limit
        `,
        { replacements: { limit }, type: QueryTypes.SELECT }
      );

      return rows.map((row) => ({
        area_code_l3: row.area_code_l3,
        region: row.area_name || row.area_code_l3,
        density_label: Number(row.species_count || 0) >= 850
          ? `高 (${row.species_count}+ 物种记录)`
          : `中 (${row.species_count} 物种记录)`,
        species_count: Number(row.species_count || 0),
        introduced_count: Number(row.introduced_count || 0),
        native_count: Number(row.native_count || 0),
        high_risk_species_count: Number(row.high_risk_species_count || 0),
        protected_area_count: Number(row.protected_area_count || 0),
        trend: Number(row.introduced_count || 0) > Number(row.native_count || 0)
          ? '引种占优'
          : Number(row.introduced_count || 0) === Number(row.native_count || 0)
            ? '结构均衡'
            : '原生占优'
      }));
    }, HEATMAP_TTL);
  }

  async diversityBy(params = {}) {
    const groupBy = String(params.groupBy || 'family').toLowerCase();
    const cacheKey = `wcvp:diversity:${groupBy}`;

    return cache.getOrSet(cacheKey, async () => {
      if (groupBy === 'division' || groupBy === 'phylum') {
        const rows = await sequelize.query(
          `
            SELECT
              COALESCE(t.scientific_name, 'Unknown') AS scientific_name,
              COALESCE(t.chinese_name, t.scientific_name, 'Unknown') AS name,
              COUNT(DISTINCT p.id) AS species_count
            FROM plants p
            LEFT JOIN taxa s ON s.id = p.taxon_id
            LEFT JOIN taxa g ON g.id = s.parent_id
            LEFT JOIN taxa f ON f.id = g.parent_id
            LEFT JOIN taxa o ON o.id = f.parent_id
            LEFT JOIN taxa c ON c.id = o.parent_id
            LEFT JOIN taxa sp ON sp.id = c.parent_id AND sp.taxon_rank = 'subphylum'
            LEFT JOIN taxa t ON t.id = CASE WHEN sp.id IS NOT NULL THEN sp.parent_id ELSE c.parent_id END
            GROUP BY COALESCE(t.scientific_name, 'Unknown'), COALESCE(t.chinese_name, t.scientific_name, 'Unknown')
            ORDER BY species_count DESC
          `,
          { type: QueryTypes.SELECT }
        );

        const total = rows.reduce((sum, row) => sum + Number(row.species_count || 0), 0) || 1;
        return rows.map((row) => ({
          name: row.name,
          scientific_name: row.scientific_name,
          percentage: Number(((Number(row.species_count || 0) / total) * 100).toFixed(2))
        }));
      }

      const rows = await sequelize.query(
        `
        SELECT
          COALESCE(f.scientific_name, p.wcvp_family, 'UNKNOWN_FAMILY') AS scientific_name,
          COALESCE(NULLIF(f.chinese_name, ''), f.scientific_name, p.wcvp_family, 'UNKNOWN_FAMILY') AS name,
          COUNT(DISTINCT p.id) AS species_count
        FROM plants p
        LEFT JOIN taxa s ON s.id = p.taxon_id AND s.taxon_rank = 'species'
        LEFT JOIN taxa g ON g.id = s.parent_id AND g.taxon_rank = 'genus'
        LEFT JOIN taxa f ON f.id = g.parent_id AND f.taxon_rank = 'family'
        GROUP BY
          COALESCE(f.scientific_name, p.wcvp_family, 'UNKNOWN_FAMILY'),
          COALESCE(NULLIF(f.chinese_name, ''), f.scientific_name, p.wcvp_family, 'UNKNOWN_FAMILY')
        ORDER BY species_count DESC
        `,
        { type: QueryTypes.SELECT }
      );

      const total = rows.reduce((sum, row) => sum + Number(row.species_count || 0), 0) || 1;
      return rows.slice(0, 8).map((row) => ({
        name: row.name,
        scientific_name: row.scientific_name,
        count: Number(row.species_count || 0),
        percentage: Number(((Number(row.species_count || 0) / total) * 100).toFixed(2))
      }));
    }, DIVERSITY_TTL);
  }

  async hotspots(params = {}) {
    const limit = Math.min(200, Math.max(5, Number(params.limit) || 30));
    const cacheKey = `wcvp:hotspots:${limit}`;

    return cache.getOrSet(cacheKey, () => sequelize.query(
      `
      SELECT
        d.area_code_l3,
        COALESCE(d.area_name, r.area_name_l3) AS area_name,
        COUNT(DISTINCT d.plant_id) AS species_count,
        COUNT(*) AS occurrence_count
      FROM plant_distributions d
      LEFT JOIN wgsrpd_regions r ON r.area_code_l3 = d.area_code_l3
      GROUP BY d.area_code_l3, COALESCE(d.area_name, r.area_name_l3)
      ORDER BY species_count DESC, occurrence_count DESC
      LIMIT :limit
      `,
      { replacements: { limit }, type: QueryTypes.SELECT }
    ), HOTSPOTS_TTL);
  }

  async regionProtectionSummary(params = {}) {
    const areaCode = String(params.areaCode || params.area_code_l3 || '').trim();
    if (!areaCode) {
      throw new Error('areaCode is required');
    }

    const cacheKey = `wcvp:region-protection:${areaCode}`;
    return cache.getOrSet(cacheKey, async () => {
      const [regionRows, countryRows, threatRows, speciesRows, highRiskRows] = await Promise.all([
        sequelize.query(
          `
          SELECT
            d.area_code_l3,
            COALESCE(MAX(d.area_name), MAX(r.area_name_l3), d.area_code_l3) AS area_name,
            COUNT(DISTINCT d.plant_id) AS species_count
          FROM plant_distributions d
          LEFT JOIN wgsrpd_regions r ON r.area_code_l3 = d.area_code_l3
          WHERE d.area_code_l3 = :areaCode
          GROUP BY d.area_code_l3
          `,
          { replacements: { areaCode }, type: QueryTypes.SELECT }
        ),
        sequelize.query(
          `
          SELECT DISTINCT country_code
          FROM (
            SELECT country_code
            FROM plant_distributions
            WHERE area_code_l3 = :areaCode
              AND country_code IS NOT NULL
              AND country_code <> ''
            UNION
            SELECT iso3 AS country_code
            FROM wgsrpd_region_country_map
            WHERE area_code_l3 = :areaCode
          ) region_codes
          `,
          { replacements: { areaCode }, type: QueryTypes.SELECT }
        ),
        sequelize.query(
          `
          SELECT COUNT(DISTINCT ts.plant_id) AS high_risk_species_count
          FROM threatened_species ts
          INNER JOIN plant_distributions d ON d.plant_id = ts.plant_id
          WHERE d.area_code_l3 = :areaCode
            AND ts.red_list_category IN ('CR', 'EN', 'VU')
          `,
          { replacements: { areaCode }, type: QueryTypes.SELECT }
        ),
        sequelize.query(
          `
          SELECT DISTINCT
            p.id,
            p.chinese_name,
            p.scientific_name,
            p.wcvp_family,
            p.wcvp_genus,
            d.occurrence_status
          FROM plant_distributions d
          INNER JOIN plants p ON p.id = d.plant_id
          WHERE d.area_code_l3 = :areaCode
          ORDER BY p.scientific_name ASC
          LIMIT 8
          `,
          { replacements: { areaCode }, type: QueryTypes.SELECT }
        ),
        sequelize.query(
          `
          SELECT DISTINCT
            ts.id,
            ts.plant_id,
            COALESCE(ts.chinese_name, p.chinese_name) AS chinese_name,
            ts.scientific_name,
            ts.red_list_category,
            ts.population_trend,
            ts.conservation_actions
          FROM threatened_species ts
          INNER JOIN plant_distributions d ON d.plant_id = ts.plant_id
          LEFT JOIN plants p ON p.id = ts.plant_id
          WHERE d.area_code_l3 = :areaCode
            AND ts.red_list_category IN ('CR', 'EN', 'VU')
          ORDER BY FIELD(ts.red_list_category, 'CR', 'EN', 'VU'), ts.scientific_name ASC
          LIMIT 8
          `,
          { replacements: { areaCode }, type: QueryTypes.SELECT }
        )
      ]);

      const region = regionRows[0] || {};
      const countryCodes = countryRows.map((row) => row.country_code).filter(Boolean);
      let protectedAreaCount = 0;
      let protectedAreas = [];
      let categoryRows = [];

      if (countryCodes.length > 0) {
        const replacements = { countryCodes, limit: 5 };
        const [countRows, areaRows, groupedRows] = await Promise.all([
          sequelize.query(
            `
            SELECT COUNT(*) AS total
            FROM protected_areas
            WHERE iso3 IN (:countryCodes) OR parent_iso3 IN (:countryCodes)
            `,
            { replacements, type: QueryTypes.SELECT }
          ),
          sequelize.query(
            `
            SELECT site_id, name_eng, name_local, designation_eng, iucn_category, status, iso3, gis_area, rep_area
            FROM protected_areas
            WHERE iso3 IN (:countryCodes) OR parent_iso3 IN (:countryCodes)
            ORDER BY COALESCE(gis_area, rep_area, 0) DESC, site_id ASC
            LIMIT :limit
            `,
            { replacements, type: QueryTypes.SELECT }
          ),
          sequelize.query(
            `
            SELECT COALESCE(iucn_category, '未标注') AS iucn_category, COUNT(*) AS count
            FROM protected_areas
            WHERE iso3 IN (:countryCodes) OR parent_iso3 IN (:countryCodes)
            GROUP BY COALESCE(iucn_category, '未标注')
            ORDER BY count DESC
            LIMIT 6
            `,
            { replacements, type: QueryTypes.SELECT }
          )
        ]);

        protectedAreaCount = Number(countRows[0]?.total || 0);
        protectedAreas = areaRows;
        categoryRows = groupedRows.map((row) => ({
          iucn_category: row.iucn_category,
          count: Number(row.count || 0)
        }));
      }

      const highRiskSpeciesCount = Number(threatRows[0]?.high_risk_species_count || 0);
      const speciesCount = Number(region.species_count || 0);
      const protectionPrompt = protectedAreaCount === 0
        ? '该热点区域暂无可直接关联的保护地记录，建议结合保护地数据继续补充区域保护信息。'
        : highRiskSpeciesCount > 0
          ? '该热点区域同时存在较高物种记录量和受胁物种记录，可优先结合保护地信息开展科普展示。'
          : '该热点区域已关联保护地记录，可作为区域植物多样性与保护背景展示入口。';

      return {
        area_code_l3: areaCode,
        region: region.area_name || areaCode,
        species_count: speciesCount,
        country_codes: countryCodes,
        protected_area_count: protectedAreaCount,
        high_risk_species_count: highRiskSpeciesCount,
        protection_prompt: protectionPrompt,
        species_records: speciesRows.map((row) => ({
          id: row.id,
          chinese_name: row.chinese_name,
          scientific_name: row.scientific_name,
          family: row.wcvp_family,
          genus: row.wcvp_genus,
          occurrence_status: row.occurrence_status
        })),
        high_risk_species: highRiskRows.map((row) => ({
          id: row.id,
          plant_id: row.plant_id,
          chinese_name: row.chinese_name,
          scientific_name: row.scientific_name,
          red_list_category: row.red_list_category,
          population_trend: row.population_trend,
          conservation_actions: row.conservation_actions
        })),
        protected_areas: protectedAreas,
        protected_area_categories: categoryRows
      };
    }, HOTSPOTS_TTL);
  }
}

module.exports = new WcvpAnalyticsService();
