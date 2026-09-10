import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../src/plan.js';
import {
  totalRunMinutes,
  completedRunMinutes,
  checkinsInLastDays,
  distinctActiveDays,
  daysSinceStart,
  avgPerWeek,
} from '../src/stats.js';

const plan = buildPlan([
  { month: 1, weekOfMonth: 1, phase: 'p', recovery: false, focus: 'f', sessions: [
    { day: '一', detail: 'a', runMin: 10 },
    { day: '二', detail: 'b', runMin: 20 },
    { day: '三', detail: 'race', runMin: null, race: true },
  ] },
]);

test('totalRunMinutes 累加所有 runMin，null 记 0', () => {
  assert.equal(totalRunMinutes(plan), 30);
});

test('completedRunMinutes 只累加已打卡课次的 runMin', () => {
  assert.equal(completedRunMinutes(plan, { checkins: [] }), 0);
  assert.equal(completedRunMinutes(plan, { checkins: [{ seq: 1, at: '2026-09-10' }] }), 10);
  assert.equal(completedRunMinutes(plan, { checkins: [{ seq: 1, at: 'x' }, { seq: 2, at: 'x' }] }), 30);
  assert.equal(completedRunMinutes(plan, { checkins: [{ seq: 3, at: 'x' }] }), 0); // 比赛日 runMin=null
});

test('checkinsInLastDays 统计最近 N 天（含今天）的打卡数', () => {
  const s = { checkins: [
    { seq: 1, at: '2026-09-01' },
    { seq: 2, at: '2026-09-08' },
    { seq: 3, at: '2026-09-10' },
    { seq: 4, at: '2026-09-14' },
  ] };
  assert.equal(checkinsInLastDays(s, '2026-09-14', 7), 3);  // 窗口 09-08..09-14：09-08、09-10、09-14
  assert.equal(checkinsInLastDays(s, '2026-09-14', 1), 1);  // 只今天
  assert.equal(checkinsInLastDays(s, '2026-09-14', 30), 4);
});

test('distinctActiveDays 统计有训练的不同日期数', () => {
  const s = { checkins: [
    { seq: 1, at: '2026-09-10' },
    { seq: 2, at: '2026-09-10' }, // 同一天做两次
    { seq: 3, at: '2026-09-12' },
  ] };
  assert.equal(distinctActiveDays(s), 2);
  assert.equal(distinctActiveDays({ checkins: [] }), 0);
});

test('daysSinceStart = 从第一次打卡到今天的天数（含头尾）', () => {
  const s = { checkins: [{ seq: 1, at: '2026-09-10' }] };
  assert.equal(daysSinceStart(s, '2026-09-10'), 1);
  assert.equal(daysSinceStart(s, '2026-09-16'), 7);
  assert.equal(daysSinceStart({ checkins: [] }, '2026-09-16'), 0);
});

test('avgPerWeek = 平均每周打卡次数，保留 1 位小数', () => {
  const s = { checkins: [
    { seq: 1, at: '2026-09-10' },
    { seq: 2, at: '2026-09-12' },
    { seq: 3, at: '2026-09-14' },
  ] };
  // 09-10 到 09-16 共 7 天 = 1 周，3 次 → 3.0
  assert.equal(avgPerWeek(s, '2026-09-16'), 3);
  assert.equal(avgPerWeek({ checkins: [] }, '2026-09-16'), 0);
});
