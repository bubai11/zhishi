const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const QuestionOptions = sequelize.define('QuestionOptions', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  question_id: { type: DataTypes.INTEGER },
  text: { type: DataTypes.STRING(255) },
  is_correct: { type: DataTypes.BOOLEAN }
}, {
  tableName: 'question_options',
  timestamps: false
});

module.exports = QuestionOptions;
