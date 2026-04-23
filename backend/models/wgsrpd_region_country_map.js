const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const WgsrpdRegionCountryMap = sequelize.define('WgsrpdRegionCountryMap', {
  area_code_l3: { type: DataTypes.STRING(10), primaryKey: true },
  area_name: { type: DataTypes.STRING(100) },
  iso3: { type: DataTypes.STRING(3), primaryKey: true },
  country_name: { type: DataTypes.STRING(100) },
  mapping_source: { type: DataTypes.STRING(100), defaultValue: 'WGSRPD_ISO3_MANUAL_MAP' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'wgsrpd_region_country_map',
  timestamps: false
});

module.exports = WgsrpdRegionCountryMap;
