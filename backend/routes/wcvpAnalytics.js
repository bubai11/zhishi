const express = require('express');
const router = express.Router();
const controller = require('../controllers/wcvpAnalyticsController');

// GET /api/wcvp-analytics/heatmap?limit=
router.get('/heatmap', controller.heatmap.bind(controller));

// GET /api/wcvp-analytics/diversity?groupBy=family|continent
router.get('/diversity', controller.diversity.bind(controller));

// GET /api/wcvp-analytics/hotspots?limit=
router.get('/hotspots', controller.hotspots.bind(controller));

module.exports = router;
