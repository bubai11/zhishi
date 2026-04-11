const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Favorites = sequelize.define('Favorites', {
  user_id: { type: DataTypes.INTEGER, primaryKey: true },
  plant_id: { type: DataTypes.INTEGER, primaryKey: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'favorites',
  timestamps: false
});

module.exports = Favorites;
