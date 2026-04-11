const { Favorites, Plants, Taxa, PlantDetail } = require('../models');

class FavoriteService {
  async getMyFavorites(userId) {
    return Favorites.findAll({
      where: { user_id: userId },
      include: [
        {
          model: Plants,
          as: 'plant',
          required: true,
          include: [
            { model: Taxa, as: 'taxon', required: false },
            { model: PlantDetail, as: 'detail', required: false }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });
  }

  async getFavoriteStatus(userId, plantId) {
    if (!plantId) {
      throw new Error('plant_id 为必填项');
    }

    const favorite = await Favorites.findOne({
      where: {
        user_id: userId,
        plant_id: Number(plantId)
      },
      attributes: ['plant_id']
    });

    return {
      plant_id: Number(plantId),
      is_favorite: Boolean(favorite)
    };
  }

  async addFavorite(userId, plantId) {
    if (!plantId) {
      throw new Error('plant_id 为必填项');
    }

    const plant = await Plants.findByPk(plantId);
    if (!plant) {
      throw new Error('植物不存在');
    }

    const [fav] = await Favorites.findOrCreate({
      where: { user_id: userId, plant_id: Number(plantId) },
      defaults: { user_id: userId, plant_id: Number(plantId) }
    });

    return fav;
  }

  async removeFavorite(userId, plantId) {
    const deleted = await Favorites.destroy({
      where: { user_id: userId, plant_id: Number(plantId) }
    });

    if (!deleted) {
      throw new Error('收藏记录不存在');
    }

    return { plant_id: Number(plantId), message: '已取消收藏' };
  }
}

module.exports = new FavoriteService();
