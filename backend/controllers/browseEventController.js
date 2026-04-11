const browseEventService = require('../services/browseEventService');

class BrowseEventController {
  async myList(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const data = await browseEventService.getMyEvents(req.user.id, page, limit);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async weeklyStats(req, res) {
    try {
      const data = await browseEventService.getWeeklyStats(req.user.id);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async create(req, res) {
    try {
      const data = await browseEventService.createEvent(req.user.id, req.body);
      res.status(201).json({ code: 201, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '创建失败' });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const data = await browseEventService.deleteEvent(req.user.id, id);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '删除失败' });
    }
  }
}

module.exports = new BrowseEventController();
