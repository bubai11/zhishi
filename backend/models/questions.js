const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const Questions = sequelize.define('Questions', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quiz_id: { type: DataTypes.INTEGER },
  type: { type: DataTypes.STRING(50) },
  stem: { type: DataTypes.TEXT },
  explanation: { type: DataTypes.TEXT }
}, {
  tableName: 'questions',
  timestamps: false
});

module.exports = Questions;
