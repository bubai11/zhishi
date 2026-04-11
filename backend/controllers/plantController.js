const plantService = require('../services/plantService');

class PlantController {
  async list(req, res) {
    try {
      const result = await plantService.getAllPlants(req.query || {});
      res.json({ code: 200, message: 'success', data: result });
    } catch (err) {
      res.status(500).json({ code: 500, message: err.message || '获取失败' });
    }
  }

  async stats(req, res) {
    try {
      const data = await plantService.getPlantStats();
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(500).json({ code: 500, message: err.message || '获取失败' });
    }
  }

  async analyticsSummary(req, res) {
    try {
      const data = await plantService.getAnalyticsSummary();
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(500).json({ code: 500, message: err.message || '获取失败' });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const plant = await plantService.getPlantById(id);
      res.json({ code: 200, message: 'success', data: plant });
    } catch (err) {
      res.status(404).json({ code: 404, message: err.message || '获取失败' });
    }
  }

  async create(req, res) {
    try {
      const plant = await plantService.createPlant(req.body);
      res.status(201).json({ code: 201, message: 'success', data: plant });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '创建失败' });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const plant = await plantService.updatePlant(id, req.body);
      res.json({ code: 200, message: 'success', data: plant });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '更新失败' });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await plantService.deletePlant(id);
      res.json({ code: 200, message: 'success', data: result });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '删除失败' });
    }
  }

  async getObservations(req, res) {
    try {
      const { id } = req.params;
      const observations = await plantService.getPlantObservations(id);
      res.json({ code: 200, message: 'success', data: observations });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }
}

module.exports = new PlantController();
