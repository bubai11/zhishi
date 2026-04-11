const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/profile', authMiddleware, userController.profile);
router.get('/stats', authMiddleware, userController.stats);
router.get('/achievements', authMiddleware, userController.achievements);

module.exports = router;
