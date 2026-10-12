import test from 'node:test';
import assert from 'node:assert/strict';
import { backupDue } from '../src/backup.js';

const snap = (n, backup) => ({ logs: Array.from({ length: n }, (_, i) => ({ seq: i + 1 })), backup });

test('没有待备份的训练 → 不弹', () => {
  assert.equal(backupDue(snap(0), '2026-10-12').due, false);
  assert.equal(backupDue(snap(3, { at: '2026-01-01', count: 3 }), '2026-10-12').due, false);
});

test('从没备份过：练满 4 次（两周）才提醒，不一上手就唠叨', () => {
  assert.equal(backupDue(snap(3), '2026-10-12').due, false);
  assert.deepEqual(backupDue(snap(4), '2026-10-12'), { due: true, pending: 4, reason: 'count' });
});

test('备份过：新增不到 4 次，但距上次备份满 14 天 → 提醒', () => {
  const b = { at: '2026-10-01', count: 2 };
  assert.equal(backupDue(snap(3, b), '2026-10-14').due, false);
  assert.deepEqual(backupDue(snap(3, b), '2026-10-15'), { due: true, pending: 1, reason: 'days' });
});
