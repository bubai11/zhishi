const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateCreateMediaPayload,
  validateCreateQuizPayload,
  validateSubmitAttemptPayload,
  validateBrowseEventPayload,
  validateSearchPlantsQuery,
  validateSearchSuggestQuery
} = require('../middleware/validate');

test('validateCreateMediaPayload should reject invalid kind', () => {
  const msg = validateCreateMediaPayload({ kind: 'audio', url: 'https://x.com/a.png' });
  assert.equal(msg, 'kind 只能是 image/model/video');
});

test('validateCreateMediaPayload should pass valid payload', () => {
  const msg = validateCreateMediaPayload({ kind: 'image', url: 'https://x.com/a.png' });
  assert.equal(msg, null);
});

test('validateCreateQuizPayload should require title', () => {
  const msg = validateCreateQuizPayload({ scope: 'basic' });
  assert.equal(msg, 'title 为必填字符串');
});

test('validateCreateQuizPayload should validate question stem', () => {
  const msg = validateCreateQuizPayload({
    title: '测验',
    questions: [{}]
  });
  assert.equal(msg, '每道题都必须包含 stem');
});

test('validateSubmitAttemptPayload should validate answers', () => {
  const msg = validateSubmitAttemptPayload({ answers: [] });
  assert.equal(msg, 'answers 不能为空数组');
});

test('validateSubmitAttemptPayload should pass valid answers', () => {
  const msg = validateSubmitAttemptPayload({
    answers: [{ question_id: 1, chosen_option_id: 2 }]
  });
  assert.equal(msg, null);
});

test('validateBrowseEventPayload should require plant_id', () => {
  const msg = validateBrowseEventPayload({ source: 'detail' });
  assert.equal(msg, 'plant_id 为必填项');
});

test('validateBrowseEventPayload should pass valid payload', () => {
  const msg = validateBrowseEventPayload({ plant_id: 1, source: 'detail' });
  assert.equal(msg, null);
});

test('validateSearchPlantsQuery should require q', () => {
  const msg = validateSearchPlantsQuery({ page: 1, limit: 10 });
  assert.equal(msg, 'q 为必填查询参数');
});

test('validateSearchPlantsQuery should validate sort enum', () => {
  const msg = validateSearchPlantsQuery({ q: '梅花', sort: 'score' });
  assert.equal(msg, 'sort 只能是 relevance/popular/latest/alpha');
});

test('validateSearchPlantsQuery should pass valid query', () => {
  const msg = validateSearchPlantsQuery({ q: '梅花', page: 1, limit: 10, sort: 'relevance' });
  assert.equal(msg, null);
});

test('validateSearchSuggestQuery should validate q length', () => {
  const msg = validateSearchSuggestQuery({ q: '', limit: 5 });
  assert.equal(msg, 'q 为必填查询参数');
});

test('validateSearchSuggestQuery should pass valid query', () => {
  const msg = validateSearchSuggestQuery({ q: '梅', limit: 8 });
  assert.equal(msg, null);
});
