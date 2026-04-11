const { Op, fn, col } = require('sequelize');
const { ProtectedAreas } = require('../models');

class ProtectedAreaService {
  async list(params = {}) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;
    const keyword = String(params.keyword || '').trim();
    const iso3 = String(params.iso3 || '').trim().toUpperCase();
    const siteType = String(params.siteType || '').trim().toUpperCase();
    const iucnCategory = String(params.iucnCategory || '').trim();
    const status = String(params.status || '').trim();
    const realm = String(params.realm || '').trim();

    const where = {};
    if (iso3) where.iso3 = iso3;
    if (siteType) where.site_type = siteType;
    if (iucnCategory) where.iucn_category = iucnCategory;
    if (status) where.status = status;
    if (realm) where.realm = realm;
    if (keyword) {
      where[Op.or] = [
        { name_eng: { [Op.like]: `%${keyword}%` } },
        { name_local: { [Op.like]: `%${keyword}%` } },
        { designation: { [Op.like]: `%${keyword}%` } },
        { designation_eng: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const { rows, count } = await ProtectedAreas.findAndCountAll({
      where,
      order: [['site_id', 'ASC']],
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

  async detail(siteId) {
    const id = Number(siteId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Invalid site_id');
    }

    const record = await ProtectedAreas.findByPk(id);
    if (!record) {
      throw new Error('Protected area not found');
    }

    return record;
  }

  async stats(params = {}) {
    const iso3 = String(params.iso3 || '').trim().toUpperCase();
    const siteType = String(params.siteType || '').trim().toUpperCase();
    const where = {};
    if (iso3) where.iso3 = iso3;
    if (siteType) where.site_type = siteType;

    const total = await ProtectedAreas.count({ where });
    const byCategory = await ProtectedAreas.findAll({
      attributes: ['iucn_category', [fn('COUNT', col('site_id')), 'count']],
      where,
      group: ['iucn_category'],
      order: [[col('count'), 'DESC']],
      raw: true
    });
    const byType = await ProtectedAreas.findAll({
      attributes: ['site_type', [fn('COUNT', col('site_id')), 'count']],
      where,
      group: ['site_type'],
      order: [[col('count'), 'DESC']],
      raw: true
    });
    const byRealm = await ProtectedAreas.findAll({
      attributes: ['realm', [fn('COUNT', col('site_id')), 'count']],
      where,
      group: ['realm'],
      order: [[col('count'), 'DESC']],
      raw: true
    });

    return {
      total,
      byCategory,
      byType,
      byRealm
    };
  }
}

module.exports = new ProtectedAreaService();
