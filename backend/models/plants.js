const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Plants = sequelize.define('Plants', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  taxon_id: { type: DataTypes.INTEGER, allowNull: false },
  chinese_name: { type: DataTypes.STRING(100), allowNull: false, defaultValue: '' },
  translation_source: { type: DataTypes.STRING(20) },
  translation_confidence: { type: DataTypes.TINYINT, defaultValue: 0 },
  scientific_name: { type: DataTypes.STRING(200) },
  cover_image: { type: DataTypes.STRING(255) },
  short_desc: { type: DataTypes.STRING(500) },
  category: { type: DataTypes.STRING(50) },
  wcvp_plant_name_id: { type: DataTypes.STRING(50) },
  wcvp_taxon_rank: { type: DataTypes.STRING(30) },
  wcvp_taxon_status: { type: DataTypes.STRING(30) },
  wcvp_family: { type: DataTypes.STRING(100) },
  wcvp_genus: { type: DataTypes.STRING(100) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'plants',
  timestamps: true,
  underscored: true
});

module.exports = Plants;
