const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Taxa = sequelize.define('Taxa', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  taxon_rank: {
    type: DataTypes.ENUM('kingdom', 'phylum', 'subphylum', 'class', 'order', 'family', 'genus', 'species'),
    allowNull: false
  },
  parent_id: { type: DataTypes.INTEGER },
  scientific_name: { type: DataTypes.STRING(100) },
  common_name: { type: DataTypes.STRING(200) },
  chinese_name: { type: DataTypes.STRING(100) },
  description: { type: DataTypes.TEXT },
  key_features: { type: DataTypes.TEXT },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'taxa',
  timestamps: false
});

module.exports = Taxa;
