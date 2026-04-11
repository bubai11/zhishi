const express = require('express');
const router = express.Router();
const redlistController = require('../controllers/redlistController');
const authMiddleware = require('../middleware/auth');

router.get('/threatened-species', redlistController.threatenedList.bind(redlistController));
router.get('/threatened-species/stats', redlistController.threatenedStats.bind(redlistController));
router.get('/threatened-species/:id', redlistController.threatenedDetail.bind(redlistController));
router.get('/alerts/me', authMiddleware, redlistController.myAlertList.bind(redlistController));
router.get('/alerts/unread-count', authMiddleware, redlistController.unreadCount.bind(redlistController));
router.post('/alerts/read-all', authMiddleware, redlistController.markAllRead.bind(redlistController));
router.post('/alerts/:id/read', authMiddleware, redlistController.markRead.bind(redlistController));
router.post('/alerts/:id/dismiss', authMiddleware, redlistController.dismiss.bind(redlistController));
router.post('/alerts/:id/restore', authMiddleware, redlistController.restore.bind(redlistController));
router.get('/alerts', redlistController.alertList.bind(redlistController));

module.exports = router;
