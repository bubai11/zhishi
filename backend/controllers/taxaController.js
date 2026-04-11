const taxaService = require('../services/taxaService');

class TaxaController {
  async list(req, res) {
    try {
      const data = await taxaService.getTaxaList(req.query);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async tree(req, res) {
    try {
      const data = await taxaService.getTaxaTree();
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async children(req, res) {
    try {
      const { parentId } = req.query;
      const data = await taxaService.getTaxaChildren(parentId);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async families(req, res) {
    try {
      const data = await taxaService.getFamilies();
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async genera(req, res) {
    try {
      const { id } = req.params;
      const { limit = 10 } = req.query;
      const data = await taxaService.getFeaturedGenera(id, limit);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const data = await taxaService.getTaxonById(id);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(404).json({ code: 404, message: err.message || '获取失败' });
    }
  }

  async create(req, res) {
    try {
      const data = await taxaService.createTaxon(req.body);
      res.status(201).json({ code: 201, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '创建失败' });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const data = await taxaService.updateTaxon(id, req.body);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '更新失败' });
    }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const data = await taxaService.deleteTaxon(id);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '删除失败' });
    }
  }
}

module.exports = new TaxaController();
