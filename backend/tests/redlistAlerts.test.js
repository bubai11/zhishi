const test = require('node:test');
const assert = require('node:assert/strict');

const {
  determineAlertChangeType,
  determineAlertLevel,
  buildAlertReason
} = require('../scripts/import-iucn-redlist');

test('determineAlertChangeType marks first threatened assessment as new_addition', () => {
  assert.equal(determineAlertChangeType(null, 'EN'), 'new_addition');
});

test('determineAlertChangeType marks first non-threatened assessment as new_assessment', () => {
  assert.equal(determineAlertChangeType(null, 'LC'), 'new_assessment');
});

test('determineAlertChangeType detects risk upgrade', () => {
  assert.equal(determineAlertChangeType('VU', 'EN'), 'upgraded');
});

test('determineAlertChangeType detects risk downgrade', () => {
  assert.equal(determineAlertChangeType('CR', 'VU'), 'downgraded');
});

test('determineAlertLevel marks CR as high', () => {
  assert.equal(determineAlertLevel('EN', 'CR', 'upgraded'), 'high');
});

test('buildAlertReason includes category transition for upgrades', () => {
  const reason = buildAlertReason('Abies alba', 'VU', 'EN', 'upgraded');
  assert.match(reason, /VU/);
  assert.match(reason, /EN/);
});
