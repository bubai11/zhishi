const express = require('express');
const router = express.Router();
const plantController = require('../controllers/plantController');

router.get('/', plantController.list.bind(plantController));
router.get('/stats', plantController.stats.bind(plantController));
router.get('/analytics/summary', plantController.analyticsSummary.bind(plantController));
router.get('/:id', plantController.getById.bind(plantController));
router.get('/:id/distributions', plantController.getDistributions.bind(plantController));
router.get('/:id/observations', plantController.getObservations.bind(plantController));
router.post('/', plantController.create.bind(plantController));
router.put('/:id', plantController.update.bind(plantController));
router.delete('/:id', plantController.delete.bind(plantController));

module.exports = router;
