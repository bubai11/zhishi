const favoriteService = require('../services/favoriteService');

class FavoriteController {
  async myList(req, res) {
    try {
      const userId = req.user.id;
      const data = await favoriteService.getMyFavorites(userId);
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async status(req, res) {
    try {
      const userId = req.user.id;
      const { plantId } = req.params;
      const data = await favoriteService.getFavoriteStatus(userId, plantId);
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async create(req, res) {
    try {
      const userId = req.user.id;
      const { plant_id } = req.body;
      const data = await favoriteService.addFavorite(userId, plant_id);
      res.status(201).json({ code: 201, message: '收藏成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '收藏失败' });
    }
  }

  async delete(req, res) {
    try {
      const userId = req.user.id;
      const { plantId } = req.params;
      const data = await favoriteService.removeFavorite(userId, plantId);
      res.json({ code: 200, message: '取消收藏成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '取消收藏失败' });
    }
  }
}

module.exports = new FavoriteController();
