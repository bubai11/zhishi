const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const ProtectedAreas = sequelize.define('ProtectedAreas', {
  site_id: { type: DataTypes.BIGINT, primaryKey: true },
  site_pid: { type: DataTypes.BIGINT },
  source_type: { type: DataTypes.STRING(20) },
  site_type: { type: DataTypes.STRING(20) },
  name_eng: { type: DataTypes.STRING(255) },
  name_local: { type: DataTypes.STRING(255) },
  designation: { type: DataTypes.STRING(255) },
  designation_eng: { type: DataTypes.STRING(255) },
  designation_type: { type: DataTypes.STRING(50) },
  iucn_category: { type: DataTypes.STRING(20) },
  international_criteria: { type: DataTypes.STRING(255) },
  realm: { type: DataTypes.STRING(50) },
  rep_m_area: { type: DataTypes.DECIMAL(16, 6) },
  gis_m_area: { type: DataTypes.DECIMAL(16, 6) },
  rep_area: { type: DataTypes.DECIMAL(16, 6) },
  gis_area: { type: DataTypes.DECIMAL(16, 6) },
  no_take: { type: DataTypes.STRING(50) },
  no_take_area: { type: DataTypes.DECIMAL(16, 6) },
  status: { type: DataTypes.STRING(50) },
  status_year: { type: DataTypes.INTEGER },
  governance_type: { type: DataTypes.STRING(255) },
  governance_subtype: { type: DataTypes.STRING(255) },
  ownership_type: { type: DataTypes.STRING(255) },
  ownership_subtype: { type: DataTypes.STRING(255) },
  management_authority: { type: DataTypes.STRING(255) },
  management_plan: { type: DataTypes.TEXT },
  verification_status: { type: DataTypes.STRING(100) },
  metadata_id: { type: DataTypes.BIGINT },
  parent_iso3: { type: DataTypes.STRING(50) },
  iso3: { type: DataTypes.STRING(50) },
  supplemental_info: { type: DataTypes.TEXT },
  conservation_objective: { type: DataTypes.TEXT },
  inland_waters: { type: DataTypes.STRING(100) },
  oecm_assessment: { type: DataTypes.STRING(100) },
  data_source: { type: DataTypes.STRING(100), defaultValue: 'WDPA_WDOECM_Mar2026_Public_all_csv' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'protected_areas',
  timestamps: false
});

module.exports = ProtectedAreas;
