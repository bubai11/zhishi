const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const TaxonomyFeatures = sequelize.define('TaxonomyFeatures', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  taxon_id: { type: DataTypes.INTEGER, allowNull: false },
  feature_type: {
    type: DataTypes.ENUM('morphology', 'physiology', 'ecology', 'distribution', 'usage', 'conservation'),
    allowNull: false
  },
  feature_text: { type: DataTypes.TEXT },
  summary: { type: DataTypes.STRING(500) },
  icon: { type: DataTypes.STRING(100) },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'taxonomy_features',
  timestamps: false
});

module.exports = TaxonomyFeatures;
