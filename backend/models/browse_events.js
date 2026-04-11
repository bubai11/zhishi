const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const BrowseEvents = sequelize.define('BrowseEvents', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER },
  plant_id: { type: DataTypes.INTEGER },
  occurred_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  source: { type: DataTypes.STRING(50) },
  duration: { type: DataTypes.INTEGER }
}, {
  tableName: 'browse_events',
  timestamps: false
});

module.exports = BrowseEvents;
