const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantObservations = sequelize.define('PlantObservations', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plant_id: { type: DataTypes.INTEGER },
  plant_name: { type: DataTypes.STRING(100) },
  latitude: { type: DataTypes.DECIMAL(10, 6) },
  longitude: { type: DataTypes.DECIMAL(10, 6) },
  count: { type: DataTypes.INTEGER, defaultValue: 1 },
  altitude: { type: DataTypes.INTEGER },
  observation_date: { type: DataTypes.DATEONLY },
  description: { type: DataTypes.TEXT }
}, {
  tableName: 'plant_observations',
  timestamps: false
});

module.exports = PlantObservations;
