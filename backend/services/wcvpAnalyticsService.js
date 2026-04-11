const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');

class WcvpAnalyticsService {
  async heatmap(params = {}) {
    const limit = Math.min(2000, Math.max(10, Number(params.limit) || 500));
    const rows = await sequelize.query(
      `
      SELECT
        d.area_code_l3,
        COALESCE(d.area_name, r.area_name_l3) AS area_name,
        COUNT(DISTINCT d.plant_id) AS species_count,
        SUM(CASE WHEN d.occurrence_status = 'introduced' THEN 1 ELSE 0 END) AS introduced_count,
        SUM(CASE WHEN d.occurrence_status = 'native' THEN 1 ELSE 0 END) AS native_count
      FROM plant_distributions d
      LEFT JOIN wgsrpd_regions r ON r.area_code_l3 = d.area_code_l3
      GROUP BY d.area_code_l3, COALESCE(d.area_name, r.area_name_l3)
      ORDER BY species_count DESC
      LIMIT :limit
      `,
      { replacements: { limit }, type: QueryTypes.SELECT }
    );

    return rows.map((row) => ({
      region: row.area_name || row.area_code_l3,
      density_label: Number(row.species_count || 0) >= 850
        ? `高 (${row.species_count}+ 种/km²)`
        : `中 (${row.species_count} 种/km²)`,
      species_count: Number(row.species_count || 0),
      trend: Number(row.introduced_count || 0) > Number(row.native_count || 0)
        ? '上升'
        : Number(row.introduced_count || 0) === Number(row.native_count || 0)
          ? '稳定'
          : '下降'
    }));
  }

  async diversityBy(params = {}) {
    const groupBy = String(params.groupBy || 'family').toLowerCase();

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
        COALESCE(f.scientific_name, 'UNKNOWN_FAMILY') AS label,
        COUNT(DISTINCT p.id) AS species_count
      FROM plants p
      INNER JOIN taxa s ON s.id = p.taxon_id AND s.taxon_rank = 'species'
      LEFT JOIN taxa g ON g.id = s.parent_id AND g.taxon_rank = 'genus'
      LEFT JOIN taxa f ON f.id = g.parent_id AND f.taxon_rank = 'family'
      GROUP BY COALESCE(f.scientific_name, 'UNKNOWN_FAMILY')
      ORDER BY species_count DESC
      `,
      { type: QueryTypes.SELECT }
    );

    const total = rows.reduce((sum, row) => sum + Number(row.species_count || 0), 0) || 1;
    return rows.map((row) => ({
      name: row.label,
      percentage: Number(((Number(row.species_count || 0) / total) * 100).toFixed(2))
    }));
  }

  async hotspots(params = {}) {
    const limit = Math.min(200, Math.max(5, Number(params.limit) || 30));
    return sequelize.query(
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
    );
  }
}

module.exports = new WcvpAnalyticsService();
