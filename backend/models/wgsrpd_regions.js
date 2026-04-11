const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const WgsrpdRegions = sequelize.define('WgsrpdRegions', {
  area_code_l1: { type: DataTypes.STRING(10) },
  area_name_l1: { type: DataTypes.STRING(100) },
  area_code_l2: { type: DataTypes.STRING(10) },
  area_name_l2: { type: DataTypes.STRING(100) },
  area_code_l3: { type: DataTypes.STRING(10), primaryKey: true },
  area_name_l3: { type: DataTypes.STRING(100) },
  continent: { type: DataTypes.STRING(50) },
  latitude: { type: DataTypes.DECIMAL(10, 6) },
  longitude: { type: DataTypes.DECIMAL(11, 6) },
  country_code: { type: DataTypes.STRING(10) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'wgsrpd_regions',
  timestamps: false
});

module.exports = WgsrpdRegions;
