const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const ThreatenedSpecies = sequelize.define('ThreatenedSpecies', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plant_id: { type: DataTypes.INTEGER },
  taxon_id: { type: DataTypes.INTEGER },
  scientific_name: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  chinese_name: { type: DataTypes.STRING(100) },
  red_list_category: {
    type: DataTypes.ENUM('EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD'),
    allowNull: false
  },
  criteria: { type: DataTypes.STRING(50) },
  population_trend: {
    type: DataTypes.ENUM('increasing', 'decreasing', 'stable', 'unknown'),
    defaultValue: 'unknown'
  },
  assessment_date: { type: DataTypes.DATEONLY },
  last_assessed: { type: DataTypes.DATEONLY },
  threats: { type: DataTypes.TEXT },
  conservation_actions: { type: DataTypes.TEXT },
  habitat: { type: DataTypes.TEXT },
  range_description: { type: DataTypes.TEXT },
  iucn_id: { type: DataTypes.STRING(50) },
  iucn_url: { type: DataTypes.STRING(255) },
  data_source: { type: DataTypes.STRING(100), defaultValue: 'IUCN' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'threatened_species',
  timestamps: false
});

module.exports = ThreatenedSpecies;
