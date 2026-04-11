const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantMedia = sequelize.define('PlantMedia', {
  plant_id: { type: DataTypes.INTEGER, primaryKey: true },
  media_asset_id: { type: DataTypes.INTEGER, primaryKey: true },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
  caption: { type: DataTypes.STRING(255) }
}, {
  tableName: 'plant_media',
  timestamps: false
});

module.exports = PlantMedia;
