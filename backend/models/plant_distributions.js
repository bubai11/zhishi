const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantDistributions = sequelize.define('PlantDistributions', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plant_id: { type: DataTypes.INTEGER },
  taxon_id: { type: DataTypes.INTEGER },
  wcvp_plant_name_id: { type: DataTypes.STRING(50) },
  scientific_name: { type: DataTypes.STRING(200) },
  area_code_l1: { type: DataTypes.STRING(10) },
  area_code_l2: { type: DataTypes.STRING(10) },
  area_code_l3: { type: DataTypes.STRING(10), allowNull: false },
  area_name: { type: DataTypes.STRING(100) },
  continent: { type: DataTypes.STRING(50) },
  country_code: { type: DataTypes.STRING(10) },
  occurrence_status: {
    type: DataTypes.ENUM('native', 'introduced', 'extinct', 'doubtful'),
    defaultValue: 'native'
  },
  introduced: { type: DataTypes.BOOLEAN, defaultValue: false },
  extinct: { type: DataTypes.BOOLEAN, defaultValue: false },
  latitude: { type: DataTypes.DECIMAL(10, 6) },
  longitude: { type: DataTypes.DECIMAL(11, 6) },
  data_source: { type: DataTypes.STRING(50), defaultValue: 'WCVP' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'plant_distributions',
  timestamps: false
});

module.exports = PlantDistributions;
