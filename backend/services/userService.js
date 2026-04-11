const { User, Favorites, UserAchievements, QuizAttempts, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

class UserService {
  async getProfile(userId) {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'email', 'avatar', 'level', 'points', 'bio']
    });

    if (!user) {
      throw new Error('用户不存在');
    }

    return {
      id: String(user.id),
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      level: Number(user.level || 1),
      points: Number(user.points || 0),
      bio: user.bio || ''
    };
  }

  async getStats(userId) {
    const [favoritesCount, badgesUnlocked, attempts, unreadRows] = await Promise.all([
      Favorites.count({ where: { user_id: userId } }),
      UserAchievements.count({ where: { user_id: userId } }),
      QuizAttempts.findAll({ where: { user_id: userId }, attributes: ['score', 'finished_at', 'started_at'] }),
      sequelize.query(
        `
          SELECT COUNT(*) AS total
          FROM redlist_alerts a
          LEFT JOIN redlist_alert_user_state state
            ON state.alert_id = a.id AND state.user_id = :userId
          WHERE COALESCE(state.is_read, 0) = 0
            AND COALESCE(state.is_dismissed, 0) = 0
        `,
        {
          replacements: { userId },
          type: QueryTypes.SELECT
        }
      )
    ]);

    const avgQuizScore = attempts.length
      ? Math.round(attempts.reduce((sum, item) => sum + Number(item.score || 0), 0) / attempts.length)
      : 0;

    const uniqueDates = [...new Set(
      attempts
        .map((item) => item.finished_at || item.started_at)
        .filter(Boolean)
        .map((value) => new Date(value).toISOString().slice(0, 10))
    )].sort().reverse();

    let streakDays = 0;
    const cursor = new Date();
    for (const dateText of uniqueDates) {
      const current = cursor.toISOString().slice(0, 10);
      if (dateText !== current) break;
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      avg_quiz_score: avgQuizScore,
      streak_days: streakDays,
      badges_unlocked: badgesUnlocked,
      favorites_count: favoritesCount,
      notes_count: 0,
      notifications_count: Number(unreadRows[0]?.total || 0)
    };
  }

  async getAchievements(userId) {
    const rows = await UserAchievements.findAll({
      where: { user_id: userId },
      attributes: ['name', 'icon', 'earned_at'],
      order: [['earned_at', 'DESC']]
    });

    return rows.map((row) => ({
      name: row.name,
      icon: row.icon,
      earned_at: row.earned_at
    }));
  }
}

module.exports = new UserService();
