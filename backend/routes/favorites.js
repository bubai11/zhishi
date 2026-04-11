const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/favorites - 当前用户收藏列表
router.get('/', favoriteController.myList.bind(favoriteController));

// GET /api/favorites/status/:plantId - 当前用户是否已收藏某植物
router.get('/status/:plantId', favoriteController.status.bind(favoriteController));

// POST /api/favorites - 当前用户新增收藏
router.post('/', favoriteController.create.bind(favoriteController));

// DELETE /api/favorites/:plantId - 当前用户取消收藏
router.delete('/:plantId', favoriteController.delete.bind(favoriteController));

module.exports = router;
