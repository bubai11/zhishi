const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const RedlistAlertUserState = sequelize.define('RedlistAlertUserState', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  alert_id: { type: DataTypes.INTEGER, allowNull: false },
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_dismissed: { type: DataTypes.BOOLEAN, defaultValue: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'redlist_alert_user_state',
  timestamps: false
});

module.exports = RedlistAlertUserState;
