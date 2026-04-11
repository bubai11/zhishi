const { DataTypes } = require('sequelize');
const { sequelize } = require('./index');

const QuizAttempts = sequelize.define('QuizAttempts', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER },
  quiz_id: { type: DataTypes.INTEGER },
  score: { type: DataTypes.INTEGER },
  started_at: { type: DataTypes.DATE },
  finished_at: { type: DataTypes.DATE }
}, {
  tableName: 'quiz_attempts',
  timestamps: false
});

module.exports = QuizAttempts;
