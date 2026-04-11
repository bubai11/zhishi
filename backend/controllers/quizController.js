const quizService = require('../services/quizService');

class QuizController {
  async list(req, res) {
    try {
      const data = await quizService.listQuizzes();
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const data = await quizService.getQuizById(id);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(404).json({ code: 404, message: err.message || '获取失败' });
    }
  }

  async create(req, res) {
    try {
      const data = await quizService.createQuiz(req.body);
      res.status(201).json({ code: 201, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '创建失败' });
    }
  }

  async submitAttempt(req, res) {
    try {
      const { id } = req.params;
      const data = await quizService.submitAttempt(req.user.id, id, req.body || {});
      res.status(201).json({ code: 201, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '提交失败' });
    }
  }

  async myAttempts(req, res) {
    try {
      const { id } = req.params;
      const data = await quizService.getMyAttempts(req.user.id, id);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }

  async myAttemptHistory(req, res) {
    try {
      const data = await quizService.getMyAttemptHistory(req.user.id);
      res.json({ code: 200, message: 'success', data });
    } catch (err) {
      res.status(400).json({ code: 400, message: err.message || '获取失败' });
    }
  }
}

module.exports = new QuizController();
