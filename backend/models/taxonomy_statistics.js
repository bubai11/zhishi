const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const TaxonomyStatistics = sequelize.define('TaxonomyStatistics', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  taxon_id: { type: DataTypes.INTEGER, allowNull: false },
  total_species: { type: DataTypes.INTEGER, defaultValue: 0 },
  total_genera: { type: DataTypes.INTEGER, defaultValue: 0 },
  total_families: { type: DataTypes.INTEGER, defaultValue: 0 },
  child_taxa_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  known_ratio: { type: DataTypes.DECIMAL(10, 8), defaultValue: 0 },
  global_rank: { type: DataTypes.STRING(20) },
  endemic_species: { type: DataTypes.INTEGER, defaultValue: 0 },
  threatened_species: { type: DataTypes.INTEGER, defaultValue: 0 },
  statistics_year: { type: DataTypes.INTEGER, defaultValue: 2025 },
  data_source: { type: DataTypes.STRING(100) },
  calculated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'taxonomy_statistics',
  timestamps: false
});

module.exports = TaxonomyStatistics;
