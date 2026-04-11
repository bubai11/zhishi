const protectedAreaService = require('../services/protectedAreaService');

class ProtectedAreaController {
  async list(req, res) {
    try {
      const data = await protectedAreaService.list(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async detail(req, res) {
    try {
      const data = await protectedAreaService.detail(req.params.siteId);
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      const status = err.message === 'Protected area not found' ? 404 : 400;
      res.status(status).json({ code: status, message: err.message || '获取失败' });
    }
  }

  async stats(req, res) {
    try {
      const data = await protectedAreaService.stats(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }
}

module.exports = new ProtectedAreaController();
