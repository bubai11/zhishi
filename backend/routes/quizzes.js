const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middleware/auth');
const { quizCreateValidator, quizSubmitValidator, requireBody } = require('../middleware/validate');

router.get('/', quizController.list.bind(quizController));
router.get('/attempts/me', authMiddleware, quizController.myAttemptHistory.bind(quizController));
router.get('/:id', quizController.getById.bind(quizController));
router.post('/', requireBody, quizCreateValidator, quizController.create.bind(quizController));
router.post('/:id/attempts', authMiddleware, requireBody, quizSubmitValidator, quizController.submitAttempt.bind(quizController));
router.get('/:id/attempts/me', authMiddleware, quizController.myAttempts.bind(quizController));

module.exports = router;
