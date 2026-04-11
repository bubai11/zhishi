const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const MediaAssets = sequelize.define('MediaAssets', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  kind: { type: DataTypes.ENUM('image', 'model', 'video') },
  storage_provider: { type: DataTypes.STRING(50) },
  object_key: { type: DataTypes.STRING(255) },
  url: { type: DataTypes.STRING(255) },
  width: { type: DataTypes.INTEGER },
  height: { type: DataTypes.INTEGER },
  metadata: { type: DataTypes.JSON }
}, {
  tableName: 'media_assets',
  timestamps: false
});

module.exports = MediaAssets;
