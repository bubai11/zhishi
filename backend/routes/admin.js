const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const ChineseNameService = require('../services/chineseNameService');
const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

router.get('/translation/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await ChineseNameService.getStatistics();
    res.json({ code: 200, data: stats });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message || '服务器错误' });
  }
});

router.get('/translation/unmatched', authMiddleware, async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 100;
    const plants = await ChineseNameService.getUnmatchedPlants(limit);
    res.json({ code: 200, data: plants });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message || '服务器错误' });
  }
});

router.post('/translation/update', authMiddleware, async (req, res) => {
  const { plantId, chineseName, source = 'manual' } = req.body || {};
  if (!plantId || !chineseName) {
    return res.status(400).json({ code: 400, message: '缺少必要参数' });
  }

  const conn = await mysql.createConnection(dbConfig);
  try {
    const [plantRows] = await conn.query('SELECT scientific_name FROM plants WHERE id = ? LIMIT 1', [plantId]);
    if (!plantRows.length) {
      return res.status(404).json({ code: 404, message: '植物不存在' });
    }

    const scientificName = plantRows[0].scientific_name;
    await ChineseNameService.ensureInfrastructure();
    await ChineseNameService.applyChineseName(scientificName, chineseName, source, 100, conn);
    await ChineseNameService.saveCache(scientificName, chineseName, source, 100, conn);

    return res.json({ code: 200, message: '更新成功' });
  } catch (error) {
    return res.status(500).json({ code: 500, message: error.message || '服务器错误' });
  } finally {
    await conn.end();
  }
});

module.exports = router;
