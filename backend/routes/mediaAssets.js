const express = require('express');
const router = express.Router();
const mediaAssetController = require('../controllers/mediaAssetController');
const { mediaCreateValidator, requireBody } = require('../middleware/validate');

// GET /api/media-assets - 媒体列表（可按 kind/plant_id 过滤）
router.get('/', mediaAssetController.list.bind(mediaAssetController));

// GET /api/media-assets/:id - 媒体详情
router.get('/:id', mediaAssetController.getById.bind(mediaAssetController));

// POST /api/media-assets - 创建媒体
router.post('/', requireBody, mediaCreateValidator, mediaAssetController.create.bind(mediaAssetController));

// PUT /api/media-assets/:id - 更新媒体
router.put('/:id', requireBody, mediaAssetController.update.bind(mediaAssetController));

// DELETE /api/media-assets/:id - 删除媒体
router.delete('/:id', mediaAssetController.delete.bind(mediaAssetController));

// POST /api/media-assets/:id/bind - 媒体绑定植物
router.post('/:id/bind', requireBody, mediaAssetController.bind.bind(mediaAssetController));

// DELETE /api/media-assets/:id/bind/:plantId - 媒体解绑植物
router.delete('/:id/bind/:plantId', mediaAssetController.unbind.bind(mediaAssetController));

module.exports = router;
