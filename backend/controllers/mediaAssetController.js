const mediaAssetService = require('../services/mediaAssetService');

class MediaAssetController {
  async list(req, res) {
    try {
      const data = await mediaAssetService.list(req.query);
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async getById(req, res) {
    try {
      const data = await mediaAssetService.getById(req.params.id);
      res.json({ code: 200, message: '获取成功', data });
    } catch (err) {
      res.status(404).json({ code: 404, message: err.message || '获取失败' });
    }
  }

  async create(req, res) {
    try {
      const data = await mediaAssetService.create(req.body);
      res.status(201).json({ code: 201, message: '创建成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '创建失败' });
    }
  }

  async update(req, res) {
    try {
      const data = await mediaAssetService.update(req.params.id, req.body);
      res.json({ code: 200, message: '更新成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '更新失败' });
    }
  }

  async delete(req, res) {
    try {
      const data = await mediaAssetService.delete(req.params.id);
      res.json({ code: 200, message: '删除成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '删除失败' });
    }
  }

  async bind(req, res) {
    try {
      const data = await mediaAssetService.bindToPlant(req.params.id, req.body);
      res.status(201).json({ code: 201, message: '绑定成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '绑定失败' });
    }
  }

  async unbind(req, res) {
    try {
      const data = await mediaAssetService.unbindFromPlant(req.params.id, req.params.plantId);
      res.json({ code: 200, message: '解绑成功', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '解绑失败' });
    }
  }
}

module.exports = new MediaAssetController();
