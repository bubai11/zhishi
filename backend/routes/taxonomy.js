const express = require('express');
const router = express.Router();
const taxonomyService = require('../services/taxonomyService');

/**
 * 获取分类树节点（支持懒加载）
 * GET /api/taxonomy/tree-with-stats?parentId=xxx
 */
router.get('/tree-with-stats', async (req, res) => {
  try {
    const { parentId = null } = req.query;
    const data = await taxonomyService.getTreeWithStats(parentId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取分类树失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

/**
 * 获取分类节点详情（含统计数据）
 * GET /api/taxonomy/:id/detail
 */
router.get('/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await taxonomyService.getTaxonStatistics(id);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取分类统计失败:', error);
    if ((error.message || '').includes('不存在') || (error.message || '').includes('非法')) {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: '服务器错误' });
  }
});

module.exports = router;
