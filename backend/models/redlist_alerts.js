const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const RedlistAlerts = sequelize.define('RedlistAlerts', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  alert_month: { type: DataTypes.DATEONLY, allowNull: false },
  threatened_species_id: { type: DataTypes.INTEGER, allowNull: false },
  plant_id: { type: DataTypes.INTEGER },
  scientific_name: { type: DataTypes.STRING(200), allowNull: false },
  old_category: { type: DataTypes.STRING(20) },
  new_category: { type: DataTypes.STRING(20), allowNull: false },
  change_type: {
    type: DataTypes.ENUM('new_assessment', 'downgraded', 'upgraded', 'new_addition'),
    allowNull: false
  },
  alert_reason: { type: DataTypes.TEXT },
  alert_level: { type: DataTypes.ENUM('high', 'medium', 'low'), defaultValue: 'medium' },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_dismissed: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'redlist_alerts',
  timestamps: false
});

module.exports = RedlistAlerts;
