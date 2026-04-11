const { BrowseEvents, Plants, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

class BrowseEventService {
  async getMyEvents(userId, page = 1, limit = 20) {
    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Number(limit) || 20);
    const offset = (currentPage - 1) * pageSize;

    const rows = await sequelize.query(
      `
        SELECT
          b.plant_id,
          COALESCE(p.chinese_name, p.scientific_name) AS plant_name,
          MAX(b.occurred_at) AS last_viewed_at,
          COUNT(*) AS view_count
        FROM browse_events b
        LEFT JOIN plants p ON p.id = b.plant_id
        WHERE b.user_id = :userId
        GROUP BY b.plant_id, COALESCE(p.chinese_name, p.scientific_name)
        ORDER BY last_viewed_at DESC
        LIMIT :limit OFFSET :offset
      `,
      {
        replacements: { userId, limit: pageSize, offset },
        type: QueryTypes.SELECT
      }
    );

    const countRows = await sequelize.query(
      `
        SELECT COUNT(DISTINCT plant_id) AS total
        FROM browse_events
        WHERE user_id = :userId
      `,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    const total = Number(countRows[0]?.total || 0);

    return {
      total,
      page: currentPage,
      limit: pageSize,
      pages: Math.ceil(total / pageSize),
      data: rows.map((row) => ({
        plant_id: String(row.plant_id),
        plant_name: row.plant_name,
        last_viewed_at: row.last_viewed_at,
        view_count: Number(row.view_count || 0)
      }))
    };
  }

  async getWeeklyStats(userId) {
    const rows = await sequelize.query(
      `
        SELECT DATE(occurred_at) AS day_key, COUNT(*) AS value
        FROM browse_events
        WHERE user_id = :userId
          AND occurred_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(occurred_at)
        ORDER BY day_key ASC
      `,
      { replacements: { userId }, type: QueryTypes.SELECT }
    );

    const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const byDay = new Map(rows.map((row) => [new Date(row.day_key).toISOString().slice(0, 10), Number(row.value || 0)]));
    const result = [];
    const today = new Date();

    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      const key = date.toISOString().slice(0, 10);
      const weekday = (date.getDay() + 6) % 7;
      result.push({
        day: labels[weekday],
        value: byDay.get(key) || 0
      });
    }

    return result;
  }

  async createEvent(userId, data) {
    const { plant_id, source, duration, occurred_at } = data;
    if (!plant_id) {
      throw new Error('plant_id 为必填项');
    }

    const plant = await Plants.findByPk(plant_id);
    if (!plant) {
      throw new Error('植物不存在');
    }

    return BrowseEvents.create({
      user_id: userId,
      plant_id: Number(plant_id),
      source: source || 'web',
      duration: duration || 0,
      occurred_at: occurred_at || new Date()
    });
  }

  async deleteEvent(userId, id) {
    const deleted = await BrowseEvents.destroy({ where: { id: Number(id), user_id: userId } });
    if (!deleted) {
      throw new Error('浏览记录不存在');
    }

    return { id: Number(id), message: '删除成功' };
  }
}

module.exports = new BrowseEventService();
