const express = require('express');
const router = express.Router();
const taxaController = require('../controllers/taxaController');

router.get('/', taxaController.list.bind(taxaController));
router.get('/tree/children', taxaController.children.bind(taxaController));
router.get('/tree', taxaController.tree.bind(taxaController));
router.get('/search', taxaController.search.bind(taxaController));
router.get('/families', taxaController.families.bind(taxaController));
router.get('/:id/genera', taxaController.genera.bind(taxaController));
router.get('/:id', taxaController.getById.bind(taxaController));
router.post('/', taxaController.create.bind(taxaController));
router.put('/:id', taxaController.update.bind(taxaController));
router.delete('/:id', taxaController.delete.bind(taxaController));

module.exports = router;
