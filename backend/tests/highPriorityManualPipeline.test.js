const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyReason,
  shouldApply,
  parseCsvLine,
  toCsvLine
} = require('../scripts/high-priority-manual-pipeline');

test('parseCsvLine and toCsvLine round-trip quoted values', () => {
  const input = ['Rosa chinensis', 'Rosaceae', 'Rosa', 'note,with,comma', '""quoted""'];
  const csv = toCsvLine(input);
  assert.deepEqual(parseCsvLine(csv), input);
});

test('classifyReason prefers existing REVIEW_HIGH note', () => {
  const reason = classifyReason({
    scientific_name: 'Random species',
    note: 'REVIEW_HIGH: existing note'
  });

  assert.equal(reason, 'existing REVIEW_HIGH note');
});

test('classifyReason detects high-priority epithet pattern', () => {
  const reason = classifyReason({
    scientific_name: 'Lasianthus chinensis',
    note: ''
  });

  assert.equal(reason, 'high-priority epithet pattern');
});

test('shouldApply only accepts approved Chinese review rows', () => {
  assert.equal(
    shouldApply({
      chinese_name: '龙船花',
      review_status: 'APPROVED',
      apply_to_pending: 'Y'
    }),
    true
  );

  assert.equal(
    shouldApply({
      chinese_name: 'Ixora chinensis',
      review_status: 'APPROVED',
      apply_to_pending: 'Y'
    }),
    false
  );

  assert.equal(
    shouldApply({
      chinese_name: '龙船花',
      review_status: 'PENDING',
      apply_to_pending: 'Y'
    }),
    false
  );
});
