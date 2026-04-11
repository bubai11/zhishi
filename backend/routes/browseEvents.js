const express = require('express');
const router = express.Router();
const browseEventController = require('../controllers/browseEventController');
const authMiddleware = require('../middleware/auth');
const { browseEventCreateValidator, requireBody } = require('../middleware/validate');

router.use(authMiddleware);
router.get('/', browseEventController.myList.bind(browseEventController));
router.get('/weekly-stats', browseEventController.weeklyStats.bind(browseEventController));
router.post('/', requireBody, browseEventCreateValidator, browseEventController.create.bind(browseEventController));
router.delete('/:id', browseEventController.delete.bind(browseEventController));

module.exports = router;
