const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const AttemptAnswers = sequelize.define('AttemptAnswers', {
  attempt_id: { type: DataTypes.INTEGER, primaryKey: true },
  question_id: { type: DataTypes.INTEGER, primaryKey: true },
  chosen_option_id: { type: DataTypes.INTEGER },
  is_correct: { type: DataTypes.BOOLEAN }
}, {
  tableName: 'attempt_answers',
  timestamps: false
});

module.exports = AttemptAnswers;
