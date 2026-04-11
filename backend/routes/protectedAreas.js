const express = require('express');
const router = express.Router();
const controller = require('../controllers/protectedAreaController');

router.get('/', controller.list.bind(controller));
router.get('/stats', controller.stats.bind(controller));
router.get('/:siteId', controller.detail.bind(controller));

module.exports = router;
