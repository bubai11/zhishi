const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantEcology = sequelize.define('PlantEcology', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plant_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  light_tolerance: { type: DataTypes.INTEGER, defaultValue: 50 },
  drought_tolerance: { type: DataTypes.INTEGER, defaultValue: 50 },
  cold_tolerance: { type: DataTypes.INTEGER, defaultValue: 50 },
  shade_tolerance: { type: DataTypes.INTEGER, defaultValue: 50 },
  temperature_tolerance: { type: DataTypes.INTEGER, defaultValue: 50 },
  air_humidity: { type: DataTypes.INTEGER, defaultValue: 50 },
  disease_resistance: { type: DataTypes.INTEGER, defaultValue: 50 },
  growth_rate: { type: DataTypes.INTEGER, defaultValue: 50 },
  lifespan: { type: DataTypes.INTEGER, defaultValue: 50 },
  ecological_adaptability: { type: DataTypes.INTEGER, defaultValue: 50 },
  soil_requirement: { type: DataTypes.INTEGER, defaultValue: 50 },
  water_requirement: { type: DataTypes.INTEGER, defaultValue: 50 },
  data_source: { type: DataTypes.STRING(255) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'plant_ecology',
  timestamps: false
});

module.exports = PlantEcology;
