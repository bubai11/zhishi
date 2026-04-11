const { MediaAssets, PlantMedia, Plants } = require('../models');

class MediaAssetService {
  async list(query = {}) {
    const { kind, plant_id } = query;

    const where = {};
    if (kind) where.kind = kind;

    if (plant_id) {
      return MediaAssets.findAll({
        where,
        include: [
          {
            model: PlantMedia,
            as: 'plantList',
            required: true,
            where: { plant_id: Number(plant_id) }
          }
        ],
        order: [['id', 'DESC']]
      });
    }

    return MediaAssets.findAll({
      where,
      include: [{ model: PlantMedia, as: 'plantList', required: false }],
      order: [['id', 'DESC']]
    });
  }

  async getById(id) {
    const media = await MediaAssets.findByPk(id, {
      include: [{ model: PlantMedia, as: 'plantList', required: false }]
    });
    if (!media) {
      throw new Error('媒体不存在');
    }
    return media;
  }

  async create(payload) {
    const { kind, storage_provider, object_key, url, width, height, metadata } = payload;
    if (!kind || !url) {
      throw new Error('kind 和 url 为必填项');
    }

    const created = await MediaAssets.create({
      kind,
      storage_provider: storage_provider || 'local',
      object_key: object_key || null,
      url,
      width: width || null,
      height: height || null,
      metadata: metadata || null
    });

    return this.getById(created.id);
  }

  async update(id, payload) {
    const media = await MediaAssets.findByPk(id);
    if (!media) {
      throw new Error('媒体不存在');
    }

    await media.update(payload);
    return this.getById(id);
  }

  async delete(id) {
    const media = await MediaAssets.findByPk(id);
    if (!media) {
      throw new Error('媒体不存在');
    }

    await PlantMedia.destroy({ where: { media_asset_id: Number(id) } });
    await media.destroy();
    return { id: Number(id), message: '删除成功' };
  }

  async bindToPlant(mediaId, payload) {
    const { plant_id, sort_order, caption } = payload;
    if (!plant_id) {
      throw new Error('plant_id 为必填项');
    }

    const media = await MediaAssets.findByPk(mediaId);
    if (!media) {
      throw new Error('媒体不存在');
    }

    const plant = await Plants.findByPk(plant_id);
    if (!plant) {
      throw new Error('植物不存在');
    }

    const [relation] = await PlantMedia.findOrCreate({
      where: { plant_id: Number(plant_id), media_asset_id: Number(mediaId) },
      defaults: {
        plant_id: Number(plant_id),
        media_asset_id: Number(mediaId),
        sort_order: sort_order || 0,
        caption: caption || null
      }
    });

    if (sort_order !== undefined || caption !== undefined) {
      await relation.update({
        sort_order: sort_order !== undefined ? sort_order : relation.sort_order,
        caption: caption !== undefined ? caption : relation.caption
      });
    }

    return relation;
  }

  async unbindFromPlant(mediaId, plantId) {
    const deleted = await PlantMedia.destroy({
      where: { media_asset_id: Number(mediaId), plant_id: Number(plantId) }
    });
    if (!deleted) {
      throw new Error('绑定关系不存在');
    }

    return { media_id: Number(mediaId), plant_id: Number(plantId), message: '解绑成功' };
  }
}

module.exports = new MediaAssetService();
