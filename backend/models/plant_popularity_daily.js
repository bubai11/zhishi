const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantPopularityDaily = sequelize.define('PlantPopularityDaily', {
  date: { type: DataTypes.DATEONLY, primaryKey: true },
  plant_id: { type: DataTypes.INTEGER, primaryKey: true },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  favorites: { type: DataTypes.INTEGER, defaultValue: 0 },
  score: { type: DataTypes.FLOAT }
}, {
  tableName: 'plant_popularity_daily',
  timestamps: false
});

module.exports = PlantPopularityDaily;
