const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantExternalSources = sequelize.define('PlantExternalSources', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plant_id: { type: DataTypes.INTEGER },
  taxon_id: { type: DataTypes.INTEGER },
  provider: { type: DataTypes.STRING(50), allowNull: false },
  source_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'info_page' },
  external_id: { type: DataTypes.STRING(100) },
  canonical_scientific_name: { type: DataTypes.STRING(200) },
  chinese_name: { type: DataTypes.STRING(100) },
  source_url: { type: DataTypes.STRING(255), allowNull: false },
  fetch_status: { type: DataTypes.ENUM('success', 'missing', 'error'), allowNull: false, defaultValue: 'success' },
  error_message: { type: DataTypes.STRING(500) },
  payload_json: { type: DataTypes.JSON },
  fetched_at: { type: DataTypes.DATE },
  last_success_at: { type: DataTypes.DATE },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'plant_external_sources',
  timestamps: true,
  underscored: true
});

module.exports = PlantExternalSources;
