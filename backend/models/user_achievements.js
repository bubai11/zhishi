const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const UserAchievements = sequelize.define('UserAchievements', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  icon: { type: DataTypes.STRING(20), allowNull: false },
  earned_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'user_achievements',
  timestamps: false
});

module.exports = UserAchievements;
