const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const PlantDetail = sequelize.define('PlantDetail', {
  plant_id: { type: DataTypes.INTEGER, primaryKey: true },
  intro: { type: DataTypes.TEXT },
  morphology: { type: DataTypes.TEXT },
  lifecycle: { type: DataTypes.TEXT },
  habitat: { type: DataTypes.TEXT },
  distribution: { type: DataTypes.TEXT },
  uses: { type: DataTypes.TEXT },
  extra: { type: DataTypes.JSON },
  data_source: { type: DataTypes.STRING(50) },
  source_url: { type: DataTypes.STRING(255) },
  fetched_at: { type: DataTypes.DATE }
}, {
  tableName: 'plant_detail',
  timestamps: false
});

module.exports = PlantDetail;
