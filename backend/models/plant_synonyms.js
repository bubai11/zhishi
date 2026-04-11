const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantSynonyms = sequelize.define('PlantSynonyms', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plant_id: { type: DataTypes.INTEGER },
  taxon_id: { type: DataTypes.INTEGER },
  accepted_scientific_name: { type: DataTypes.STRING(200), allowNull: false },
  synonym_name: { type: DataTypes.STRING(200), allowNull: false },
  synonym_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'synonym' },
  language_code: { type: DataTypes.STRING(20) },
  source_provider: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'iplant' },
  source_url: { type: DataTypes.STRING(255) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'plant_synonyms',
  timestamps: true,
  underscored: true
});

module.exports = PlantSynonyms;
