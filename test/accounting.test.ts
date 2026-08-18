import test from 'node:test';
import assert from 'node:assert/strict';
import { validateJournal } from '../src/accounting.js';

test('balanced journal passes', () => {
  assert.doesNotThrow(() => validateJournal([
    {accountId:'00000000-0000-0000-0000-000000000001', debit:100, credit:0},
    {accountId:'00000000-0000-0000-0000-000000000002', debit:0, credit:100}
  ]));
});

test('unbalanced journal fails', () => {
  assert.throws(() => validateJournal([
    {accountId:'00000000-0000-0000-0000-000000000001', debit:100, credit:0},
    {accountId:'00000000-0000-0000-0000-000000000002', debit:0, credit:99}
  ]), /unbalanced/);
});

test('mixed debit and credit on one line fails', () => {
  assert.throws(() => validateJournal([
    {accountId:'00000000-0000-0000-0000-000000000001', debit:100, credit:10},
    {accountId:'00000000-0000-0000-0000-000000000002', debit:0, credit:90}
  ]));
});
