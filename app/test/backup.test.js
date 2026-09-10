import test from 'node:test';
import assert from 'node:assert/strict';
import { unbackedUpCount, daysSinceBackup, backupDue } from '../src/backup.js';

const snap = (n, backup) => ({
  checkins: Array.from({ length: n }, (_, i) => ({ seq: i + 1, at: '2026-09-10' })),
  backup: backup || { at: null, count: 0 },
});

test('unbackedUpCount = 打卡数 - 上次备份时的打卡数', () => {
  assert.equal(unbackedUpCount(snap(0)), 0);
  assert.equal(unbackedUpCount(snap(5)), 5);
  assert.equal(unbackedUpCount(snap(8, { at: '2026-09-01', count: 5 })), 3);
  assert.equal(unbackedUpCount(snap(5, { at: '2026-09-01', count: 9 })), 0); // 不会为负
});

test('daysSinceBackup：没备份过是 Infinity', () => {
  assert.equal(daysSinceBackup(snap(3), '2026-09-20'), Infinity);
  assert.equal(daysSinceBackup(snap(3, { at: '2026-09-10', count: 3 }), '2026-09-20'), 10);
});

test('backupDue：没有待备份的打卡 → 不弹', () => {
  assert.equal(backupDue(snap(0), '2026-09-20').due, false);
  assert.equal(backupDue(snap(5, { at: '2026-09-19', count: 5 }), '2026-09-20').due, false);
});

test('backupDue：待备份达到 6 次 → 弹（reason=count）', () => {
  const r = backupDue(snap(6), '2026-09-20');
  assert.equal(r.due, true);
  assert.equal(r.reason, 'count');
  assert.equal(r.pending, 6);
});

test('backupDue：只有几次但距上次备份超过 14 天 → 弹（reason=days）', () => {
  const r = backupDue(snap(3, { at: '2026-09-01', count: 1 }), '2026-09-20');
  assert.equal(r.due, true);
  assert.equal(r.reason, 'days');
  assert.equal(r.pending, 2);
});

test('backupDue：从没备份过 + 打卡没到 6 次 → 先不唠叨', () => {
  assert.equal(backupDue(snap(2), '2026-09-20').due, false);
  assert.equal(backupDue(snap(6), '2026-09-20').due, true); // 到 6 次才弹
});

test('backupDue：阈值可调', () => {
  assert.equal(backupDue(snap(3), '2026-09-20', { everyCheckins: 10, everyDays: 999 }).due, false);
  assert.equal(backupDue(snap(3), '2026-09-20', { everyCheckins: 3 }).due, true);
});
