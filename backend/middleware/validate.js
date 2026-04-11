function fail(res, message) {
  return res.status(400).json({ code: 400, message });
}

function requireBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object') {
    return fail(res, '请求体不能为空');
  }
  return next();
}

function validateCreateMediaPayload(payload) {
  if (!payload || typeof payload !== 'object') return '请求体不能为空';
  if (!payload.kind) return 'kind 为必填项';
  if (!['image', 'model', 'video'].includes(payload.kind)) return 'kind 只能是 image/model/video';
  if (!payload.url || typeof payload.url !== 'string') return 'url 为必填字符串';
  return null;
}

function validateCreateQuizPayload(payload) {
  if (!payload || typeof payload !== 'object') return '请求体不能为空';
  if (!payload.title || typeof payload.title !== 'string') return 'title 为必填字符串';
  if (payload.questions !== undefined && !Array.isArray(payload.questions)) return 'questions 必须是数组';
  if (Array.isArray(payload.questions)) {
    for (const q of payload.questions) {
      if (!q.stem || typeof q.stem !== 'string') return '每道题都必须包含 stem';
      if (q.options !== undefined && !Array.isArray(q.options)) return 'options 必须是数组';
    }
  }
  return null;
}

function validateSubmitAttemptPayload(payload) {
  if (!payload || typeof payload !== 'object') return '请求体不能为空';
  if (!Array.isArray(payload.answers) || payload.answers.length === 0) return 'answers 不能为空数组';
  for (const a of payload.answers) {
    if (!a.question_id || !a.chosen_option_id) return 'answers 中每项都必须包含 question_id 和 chosen_option_id';
  }
  return null;
}

function validateBrowseEventPayload(payload) {
  if (!payload || typeof payload !== 'object') return '请求体不能为空';
  if (!payload.plant_id) return 'plant_id 为必填项';
  return null;
}

function mediaCreateValidator(req, res, next) {
  const msg = validateCreateMediaPayload(req.body);
  if (msg) return fail(res, msg);
  return next();
}

function quizCreateValidator(req, res, next) {
  const msg = validateCreateQuizPayload(req.body);
  if (msg) return fail(res, msg);
  return next();
}

function quizSubmitValidator(req, res, next) {
  const msg = validateSubmitAttemptPayload(req.body);
  if (msg) return fail(res, msg);
  return next();
}

function browseEventCreateValidator(req, res, next) {
  const msg = validateBrowseEventPayload(req.body);
  if (msg) return fail(res, msg);
  return next();
}

function validateSearchPlantsQuery(query) {
  const q = (query.q || '').toString().trim();
  if (!q) return 'q 为必填查询参数';
  if (q.length > 100) return 'q 长度不能超过 100';

  const page = query.page !== undefined ? Number(query.page) : 1;
  const limit = query.limit !== undefined ? Number(query.limit) : 10;
  const sort = query.sort !== undefined ? String(query.sort) : 'relevance';

  if (!Number.isInteger(page) || page < 1) return 'page 必须是大于等于 1 的整数';
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return 'limit 必须是 1 到 50 之间的整数';
  if (!['relevance', 'popular', 'latest', 'alpha'].includes(sort)) return 'sort 只能是 relevance/popular/latest/alpha';

  if (query.taxonId !== undefined && query.taxonId !== '') {
    const taxonId = Number(query.taxonId);
    if (!Number.isInteger(taxonId) || taxonId < 1) return 'taxonId 必须是正整数';
  }

  return null;
}

function validateSearchSuggestQuery(query) {
  const q = (query.q || '').toString().trim();
  if (!q) return 'q 为必填查询参数';
  if (q.length < 1 || q.length > 30) return 'q 长度必须在 1 到 30 之间';

  const limit = query.limit !== undefined ? Number(query.limit) : 8;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) return 'limit 必须是 1 到 20 之间的整数';

  return null;
}

function searchPlantsQueryValidator(req, res, next) {
  const msg = validateSearchPlantsQuery(req.query || {});
  if (msg) return fail(res, msg);
  return next();
}

function searchSuggestQueryValidator(req, res, next) {
  const msg = validateSearchSuggestQuery(req.query || {});
  if (msg) return fail(res, msg);
  return next();
}

module.exports = {
  requireBody,
  mediaCreateValidator,
  quizCreateValidator,
  quizSubmitValidator,
  browseEventCreateValidator,
  searchPlantsQueryValidator,
  searchSuggestQueryValidator,
  validateCreateMediaPayload,
  validateCreateQuizPayload,
  validateSubmitAttemptPayload,
  validateBrowseEventPayload,
  validateSearchPlantsQuery,
  validateSearchSuggestQuery
};
