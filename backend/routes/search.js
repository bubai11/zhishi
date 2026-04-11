const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { searchPlantsQueryValidator, searchSuggestQueryValidator } = require('../middleware/validate');

// GET /api/search/plants?q=&page=&limit=&sort=&taxonId=
router.get('/plants', searchPlantsQueryValidator, searchController.searchPlants.bind(searchController));

// GET /api/search/suggest?q=&limit=
router.get('/suggest', searchSuggestQueryValidator, searchController.suggest.bind(searchController));

module.exports = router;
