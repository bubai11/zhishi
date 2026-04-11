const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Quizzes = sequelize.define('Quizzes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(255) },
  scope: { type: DataTypes.STRING(100) }
}, {
  tableName: 'quizzes',
  timestamps: false
});

module.exports = Quizzes;
