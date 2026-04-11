const { Op, fn, col, QueryTypes } = require('sequelize');
const { ThreatenedSpecies, RedlistAlerts, Plants, Taxa, RedlistAlertUserState, sequelize } = require('../models');

function buildAlertTitle(alert) {
  const name = alert.plant?.chinese_name || alert.threatenedSpecies?.chinese_name || alert.scientific_name || '未命名物种';

  if (alert.change_type === 'upgraded') {
    return `${name} 风险升级预警`;
  }
  if (alert.change_type === 'downgraded') {
    return `${name} 等级调整提醒`;
  }
  if (alert.change_type === 'new_addition') {
    return `${name} 新增受胁预警`;
  }
  return `${name} 红色名录更新`;
}

class RedlistService {
  normalizeAlertFilters(params = {}) {
    const alertLevel = params.alertLevel ? String(params.alertLevel).trim().toLowerCase() : '';
    const changeType = params.changeType ? String(params.changeType).trim().toLowerCase() : '';

    return {
      alertLevel: ['high', 'medium', 'low'].includes(alertLevel) ? alertLevel : '',
      changeType: ['new_assessment', 'downgraded', 'upgraded', 'new_addition'].includes(changeType) ? changeType : ''
    };
  }

  async listThreatened(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;
    const category = params.category ? String(params.category).toUpperCase() : null;
    const keyword = String(params.keyword || '').trim();

    const where = {};
    if (category) where.red_list_category = category;
    if (keyword) {
      where[Op.or] = [
        { scientific_name: { [Op.like]: `%${keyword}%` } },
        { chinese_name: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { rows, count } = await ThreatenedSpecies.findAndCountAll({
      where,
      include: [
        { model: Plants, as: 'plant', required: false },
        { model: Taxa, as: 'taxon', required: false }
      ],
      order: [['red_list_category', 'ASC'], ['scientific_name', 'ASC']],
      offset,
      limit
    });

    return {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
      data: rows
    };
  }

  async listAlerts(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;
    const unreadOnly = String(params.unreadOnly || '').toLowerCase() === 'true';
    const { alertLevel, changeType } = this.normalizeAlertFilters(params);

    const where = {};
    if (unreadOnly) where.is_read = false;
    if (alertLevel) where.alert_level = alertLevel;
    if (changeType) where.change_type = changeType;

    const { rows, count } = await RedlistAlerts.findAndCountAll({
      where,
      include: [
        { model: ThreatenedSpecies, as: 'threatenedSpecies', required: false },
        { model: Plants, as: 'plant', required: false }
      ],
      order: [['alert_month', 'DESC'], ['id', 'DESC']],
      offset,
      limit
    });

    return {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
      data: rows.map((row) => {
        const plain = row.get({ plain: true });
        return {
          ...plain,
          title: buildAlertTitle(plain)
        };
      })
    };
  }

  async listAlertsForUser(userId, params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;
    const unreadOnly = String(params.unreadOnly || '').toLowerCase() === 'true';
    const includeDismissed = String(params.includeDismissed || '').toLowerCase() === 'true';
    const { alertLevel, changeType } = this.normalizeAlertFilters(params);

    const whereClauses = ['1=1'];
    const replacements = { userId, limit, offset };

    if (!includeDismissed) {
      whereClauses.push('COALESCE(state.is_dismissed, 0) = 0');
    }

    if (unreadOnly) {
      whereClauses.push('COALESCE(state.is_read, 0) = 0');
    }

    if (alertLevel) {
      whereClauses.push('a.alert_level = :alertLevel');
      replacements.alertLevel = alertLevel;
    }

    if (changeType) {
      whereClauses.push('a.change_type = :changeType');
      replacements.changeType = changeType;
    }

    const whereSql = whereClauses.join(' AND ');

    const rows = await sequelize.query(
      `
        SELECT
          a.id,
          a.alert_month,
          a.scientific_name,
          a.old_category,
          a.new_category,
          a.change_type,
          a.alert_reason,
          a.alert_level,
          a.plant_id,
          COALESCE(state.is_read, 0) AS is_read,
          COALESCE(state.is_dismissed, 0) AS is_dismissed,
          p.chinese_name AS plant_chinese_name,
          p.scientific_name AS plant_scientific_name,
          ts.red_list_category AS threatened_red_list_category,
          ts.chinese_name AS threatened_chinese_name
        FROM redlist_alerts a
        LEFT JOIN redlist_alert_user_state state
          ON state.alert_id = a.id AND state.user_id = :userId
        LEFT JOIN plants p ON p.id = a.plant_id
        LEFT JOIN threatened_species ts ON ts.id = a.threatened_species_id
        WHERE ${whereSql}
        ORDER BY a.alert_month DESC, a.id DESC
        LIMIT :limit OFFSET :offset
      `,
      {
        replacements,
        type: QueryTypes.SELECT
      }
    );

    const [countRow] = await sequelize.query(
      `
        SELECT COUNT(*) AS total
        FROM redlist_alerts a
        LEFT JOIN redlist_alert_user_state state
          ON state.alert_id = a.id AND state.user_id = :userId
        WHERE ${whereSql}
      `,
      {
        replacements: {
          userId,
          ...(alertLevel ? { alertLevel } : {}),
          ...(changeType ? { changeType } : {})
        },
        type: QueryTypes.SELECT
      }
    );

    const total = Number(countRow?.total || 0);

    return {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      data: rows.map((row) => ({
        id: row.id,
        title: buildAlertTitle({
          ...row,
          plant: { chinese_name: row.plant_chinese_name },
          threatenedSpecies: { chinese_name: row.threatened_chinese_name }
        }),
        alert_month: row.alert_month,
        scientific_name: row.scientific_name,
        old_category: row.old_category,
        new_category: row.new_category,
        change_type: row.change_type,
        alert_reason: row.alert_reason,
        alert_level: row.alert_level,
        plant_id: row.plant_id,
        is_read: Boolean(row.is_read),
        is_dismissed: Boolean(row.is_dismissed),
        plant: {
          chinese_name: row.plant_chinese_name,
          scientific_name: row.plant_scientific_name
        },
        threatenedSpecies: {
          chinese_name: row.threatened_chinese_name,
          red_list_category: row.threatened_red_list_category
        }
      }))
    };
  }

  async unreadCount(userId) {
    const [row] = await sequelize.query(
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
    );

    return { total: Number(row?.total || 0) };
  }

  async upsertUserState(userId, alertId, patch) {
    const alert = await RedlistAlerts.findByPk(Number(alertId));
    if (!alert) {
      throw new Error('预警不存在');
    }

    const [state] = await RedlistAlertUserState.findOrCreate({
      where: {
        user_id: userId,
        alert_id: Number(alertId)
      },
      defaults: {
        user_id: userId,
        alert_id: Number(alertId),
        is_read: false,
        is_dismissed: false
      }
    });

    await state.update({
      is_read: patch.is_read !== undefined ? patch.is_read : state.is_read,
      is_dismissed: patch.is_dismissed !== undefined ? patch.is_dismissed : state.is_dismissed
    });

    return {
      alert_id: Number(alertId),
      is_read: Boolean(state.is_read),
      is_dismissed: Boolean(state.is_dismissed)
    };
  }

  async markAlertRead(userId, alertId) {
    return this.upsertUserState(userId, alertId, { is_read: true });
  }

  async dismissAlert(userId, alertId) {
    return this.upsertUserState(userId, alertId, { is_read: true, is_dismissed: true });
  }

  async restoreAlert(userId, alertId) {
    return this.upsertUserState(userId, alertId, { is_read: false, is_dismissed: false });
  }

  async markAllRead(userId) {
    const alerts = await RedlistAlerts.findAll({ attributes: ['id'] });
    if (alerts.length === 0) {
      return { total: 0 };
    }

    const now = new Date();
    await RedlistAlertUserState.bulkCreate(
      alerts.map((alert) => ({
        user_id: userId,
        alert_id: alert.id,
        is_read: true,
        is_dismissed: false,
        created_at: now,
        updated_at: now
      })),
      {
        updateOnDuplicate: ['is_read', 'updated_at']
      }
    );

    return { total: alerts.length };
  }

  async detail(id) {
    const targetId = Number(id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw new Error('Invalid threatened species id');
    }

    const record = await ThreatenedSpecies.findByPk(targetId, {
      include: [
        { model: Plants, as: 'plant', required: false },
        { model: Taxa, as: 'taxon', required: false }
      ]
    });

    if (!record) {
      throw new Error('Threatened species not found');
    }

    return record;
  }

  async stats() {
    const total = await ThreatenedSpecies.count();
    const byCategory = await ThreatenedSpecies.findAll({
      attributes: ['red_list_category', [fn('COUNT', col('id')), 'count']],
      group: ['red_list_category'],
      order: [[col('count'), 'DESC']],
      raw: true
    });
    const byTrend = await ThreatenedSpecies.findAll({
      attributes: ['population_trend', [fn('COUNT', col('id')), 'count']],
      group: ['population_trend'],
      order: [[col('count'), 'DESC']],
      raw: true
    });

    return {
      total,
      byCategory,
      byTrend
    };
  }
}

module.exports = new RedlistService();
