const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), unique: true },
  password: { type: DataTypes.STRING(255) },
  email: { type: DataTypes.STRING(100) },
  avatar: { type: DataTypes.STRING(255) },
  level: { type: DataTypes.INTEGER, defaultValue: 1 },
  points: { type: DataTypes.INTEGER, defaultValue: 0 },
  bio: { type: DataTypes.TEXT },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'users',
  timestamps: false
});

module.exports = User;
