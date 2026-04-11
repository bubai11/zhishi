const redlistService = require('../services/redlistService');

class RedlistController {
  async threatenedList(req, res) {
    try {
      const data = await redlistService.listThreatened(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async threatenedDetail(req, res) {
    try {
      const data = await redlistService.detail(req.params.id);
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      const status = err.message === 'Threatened species not found' ? 404 : 400;
      res.status(status).json({ code: status, message: err.message || '获取失败' });
    }
  }

  async threatenedStats(req, res) {
    try {
      const data = await redlistService.stats();
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async alertList(req, res) {
    try {
      const data = await redlistService.listAlerts(req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async myAlertList(req, res) {
    try {
      const data = await redlistService.listAlertsForUser(req.user.id, req.query || {});
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async unreadCount(req, res) {
    try {
      const data = await redlistService.unreadCount(req.user.id);
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async markRead(req, res) {
    try {
      const data = await redlistService.markAlertRead(req.user.id, req.params.id);
      res.json({ code: 200, message: '已标记已读', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '操作失败' });
    }
  }

  async dismiss(req, res) {
    try {
      const data = await redlistService.dismissAlert(req.user.id, req.params.id);
      res.json({ code: 200, message: '已忽略预警', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '操作失败' });
    }
  }

  async restore(req, res) {
    try {
      const data = await redlistService.restoreAlert(req.user.id, req.params.id);
      res.json({ code: 200, message: '已恢复预警', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '操作失败' });
    }
  }

  async markAllRead(req, res) {
    try {
      const data = await redlistService.markAllRead(req.user.id);
      res.json({ code: 200, message: '已全部标记已读', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '操作失败' });
    }
  }
}

module.exports = new RedlistController();
