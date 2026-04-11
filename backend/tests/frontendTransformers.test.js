const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatIucnCategory,
  formatTaxonLabel,
  normalizeQuizQuestion
} = require('../services/frontendTransformers');

test('formatIucnCategory maps LC to localized label', () => {
  assert.equal(formatIucnCategory('LC'), '无危 (LC)');
});

test('formatTaxonLabel combines chinese and scientific names', () => {
  assert.equal(
    formatTaxonLabel({ chinese_name: '蔷薇科', scientific_name: 'Rosaceae' }),
    '蔷薇科 (Rosaceae)'
  );
});

test('normalizeQuizQuestion flattens options and answer index', () => {
  const result = normalizeQuizQuestion({
    id: 1,
    stem: 'Which plant is known as a living fossil?',
    explanation: 'Ginkgo biloba is often described as a living fossil.',
    options: [
      { id: 2, text: 'Ginkgo biloba', is_correct: true },
      { id: 1, text: 'Monstera deliciosa', is_correct: false }
    ]
  }, true);

  assert.deepEqual(result, {
    id: 1,
    question: 'Which plant is known as a living fossil?',
    options: ['Monstera deliciosa', 'Ginkgo biloba'],
    option_ids: [1, 2],
    correct_answer: 1,
    analysis: 'Ginkgo biloba is often described as a living fossil.'
  });
});
