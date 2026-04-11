const {
  sequelize,
  Quizzes,
  Questions,
  QuestionOptions,
  QuizAttempts,
  AttemptAnswers
} = require('../models');
const { normalizeQuizQuestion } = require('./frontendTransformers');

class QuizService {
  async listQuizzes() {
    return Quizzes.findAll({
      include: [{ model: Questions, as: 'questions', required: false }],
      order: [['id', 'ASC']]
    });
  }

  async getQuizById(id) {
    const quiz = await Quizzes.findByPk(id, {
      include: [
        {
          model: Questions,
          as: 'questions',
          required: false,
          include: [{ model: QuestionOptions, as: 'options', required: false }]
        }
      ]
    });

    if (!quiz) {
      throw new Error('测验不存在');
    }

    return {
      id: String(quiz.id),
      title: quiz.title,
      questions: (quiz.questions || []).map((question) => normalizeQuizQuestion(question))
    };
  }

  async createQuiz(payload) {
    const { title, scope, questions = [] } = payload;
    if (!title) {
      throw new Error('title 为必填项');
    }

    return sequelize.transaction(async (t) => {
      const quiz = await Quizzes.create({ title, scope: scope || null }, { transaction: t });

      for (const q of questions) {
        const question = await Questions.create(
          {
            quiz_id: quiz.id,
            type: q.type || 'single',
            stem: q.stem,
            explanation: q.explanation || null
          },
          { transaction: t }
        );

        if (Array.isArray(q.options) && q.options.length > 0) {
          const optionRows = q.options.map((op) => ({
            question_id: question.id,
            text: op.text,
            is_correct: Boolean(op.is_correct)
          }));
          await QuestionOptions.bulkCreate(optionRows, { transaction: t });
        }
      }

      return this.getQuizById(quiz.id);
    });
  }

  async submitAttempt(userId, quizId, payload) {
    const rawQuiz = await Quizzes.findByPk(quizId, {
      include: [
        {
          model: Questions,
          as: 'questions',
          required: false,
          include: [{ model: QuestionOptions, as: 'options', required: false }]
        }
      ]
    });

    if (!rawQuiz) {
      throw new Error('测验不存在');
    }

    const answers = Array.isArray(payload.answers) ? payload.answers : [];
    if (answers.length === 0) {
      throw new Error('answers 不能为空');
    }

    const answerMap = new Map();
    answers.forEach((answer) => {
      answerMap.set(Number(answer.question_id), Number(answer.chosen_option_id));
    });

    return sequelize.transaction(async (t) => {
      const attempt = await QuizAttempts.create(
        {
          user_id: userId,
          quiz_id: Number(quizId),
          score: 0,
          started_at: new Date(),
          finished_at: new Date()
        },
        { transaction: t }
      );

      let correctCount = 0;
      const answerRows = [];

      for (const question of rawQuiz.questions || []) {
        const chosenOptionId = answerMap.get(Number(question.id));
        if (!chosenOptionId) continue;

        const sortedOptions = [...(question.options || [])].sort((a, b) => Number(a.id) - Number(b.id));
        const chosen = sortedOptions.find((option) => Number(option.id) === Number(chosenOptionId));
        if (!chosen) {
          throw new Error(`题目 ${question.id} 的 chosen_option_id 无效`);
        }
        const isCorrect = Boolean(chosen && chosen.is_correct);
        if (isCorrect) correctCount += 1;

        answerRows.push({
          attempt_id: attempt.id,
          question_id: question.id,
          chosen_option_id: chosenOptionId,
          is_correct: isCorrect
        });
      }

      if (answerRows.length > 0) {
        await AttemptAnswers.bulkCreate(answerRows, { transaction: t });
      }

      const percentage = Math.round((correctCount / Math.max((rawQuiz.questions || []).length, 1)) * 100);
      await attempt.update({ score: percentage, finished_at: new Date() }, { transaction: t });

      return {
        score: percentage,
        total: (rawQuiz.questions || []).length,
        correct_count: correctCount,
        results: (rawQuiz.questions || []).map((question) => {
          const sortedOptions = [...(question.options || [])].sort((a, b) => Number(a.id) - Number(b.id));
          const correctAnswer = sortedOptions.findIndex((option) => Boolean(option.is_correct));
          const chosenOptionId = answerMap.get(Number(question.id));
          const selectedAnswer = sortedOptions.findIndex((option) => Number(option.id) === Number(chosenOptionId));

          return {
            question_id: Number(question.id),
            correct: correctAnswer >= 0 && selectedAnswer === correctAnswer,
            correct_answer: correctAnswer,
            analysis: question.explanation || ''
          };
        })
      };
    });
  }

  async getMyAttempts(userId, quizId) {
    return QuizAttempts.findAll({
      where: { user_id: userId, quiz_id: Number(quizId) },
      include: [{ model: AttemptAnswers, as: 'answers', required: false }],
      order: [['id', 'DESC']]
    });
  }

  async getMyAttemptHistory(userId) {
    const rows = await QuizAttempts.findAll({
      where: { user_id: userId },
      include: [{ model: Quizzes, as: 'quiz', required: false }],
      order: [['finished_at', 'DESC']]
    });

    return rows.map((row) => ({
      date: row.finished_at || row.started_at,
      score: Number(row.score || 0),
      topic: row.quiz?.title || '综合植物知识'
    }));
  }
}

module.exports = new QuizService();
