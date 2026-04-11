const searchService = require('../services/searchService');

class SearchController {
  async searchPlants(req, res) {
    const startedAt = Date.now();
    try {
      const data = await searchService.searchPlants(req.query || {});
      data.meta.tookMs = Date.now() - startedAt;
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '搜索失败' });
    }
  }

  async suggest(req, res) {
    try {
      const data = await searchService.suggestPlants(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取建议失败' });
    }
  }
}

module.exports = new SearchController();
