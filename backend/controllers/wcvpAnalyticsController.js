const analyticsService = require('../services/wcvpAnalyticsService');

class WcvpAnalyticsController {
  async heatmap(req, res) {
    try {
      const data = await analyticsService.heatmap(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async diversity(req, res) {
    try {
      const data = await analyticsService.diversityBy(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async hotspots(req, res) {
    try {
      const data = await analyticsService.hotspots(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async regionProtectionSummary(req, res) {
    try {
      const data = await analyticsService.regionProtectionSummary(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }
}

module.exports = new WcvpAnalyticsController();
