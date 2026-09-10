import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlan } from '../src/plan.js';
import {
  doneCount,
  nextSession,
  isComplete,
  progressPercent,
  currentWeek,
  weekProgress,
  estimateFinishDate,
  annotatePlan,
  recentCheckins,
} from '../src/progress.js';

// 一个小计划：3 周，每周 2 次，共 6 次。
const plan = buildPlan([
  { month: 1, weekOfMonth: 1, phase: 'p', recovery: false, focus: 'f1', sessions: [{ day: '一', detail: 'a', runMin: 10 }, { day: '二', detail: 'b', runMin: 20 }] },
  { month: 1, weekOfMonth: 2, phase: 'p', recovery: false, focus: 'f2', sessions: [{ day: '一', detail: 'c', runMin: 30 }, { day: '二', detail: 'd', runMin: 40 }] },
  { month: 1, weekOfMonth: 3, phase: 'p', recovery: false, focus: 'f3', sessions: [{ day: '一', detail: 'e', runMin: 50 }, { day: '二', detail: 'g', runMin: 60 }] },
]);

const state = (...seqs) => ({ checkins: seqs.map((seq, i) => ({ seq, at: `2026-09-${String(10 + i).padStart(2, '0')}` })) });

test('doneCount = 已打卡次数', () => {
  assert.equal(doneCount(state()), 0);
  assert.equal(doneCount(state(1, 2, 3)), 3);
});

test('nextSession = 第一个没打卡的训练；全部完成后为 null', () => {
  assert.equal(nextSession(plan, state()).seq, 1);
  assert.equal(nextSession(plan, state(1, 2)).seq, 3);
  assert.equal(nextSession(plan, state(1, 2, 3, 4, 5, 6)), null);
});

test('nextSession 只看数量，不看打卡的是哪个 seq（顺延模型）', () => {
  // 就算打卡记录里 seq 乱七八糟，第 4 个「下一课」也是计划里的第 3 项
  assert.equal(nextSession(plan, { checkins: [{ seq: 9, at: 'x' }, { seq: 9, at: 'x' }] }).seq, 3);
});

test('isComplete', () => {
  assert.equal(isComplete(plan, state(1, 2, 3)), false);
  assert.equal(isComplete(plan, state(1, 2, 3, 4, 5, 6)), true);
});

test('progressPercent 四舍五入到整数', () => {
  assert.equal(progressPercent(plan, state()), 0);
  assert.equal(progressPercent(plan, state(1)), 17); // 1/6 = 16.67
  assert.equal(progressPercent(plan, state(1, 2, 3)), 50);
  assert.equal(progressPercent(plan, state(1, 2, 3, 4, 5, 6)), 100);
});

test('currentWeek = 下一课所在的周；全部完成后停在最后一周', () => {
  assert.equal(currentWeek(plan, state()), 1);
  assert.equal(currentWeek(plan, state(1, 2)), 2);
  assert.equal(currentWeek(plan, state(1, 2, 3)), 2);
  assert.equal(currentWeek(plan, state(1, 2, 3, 4)), 3);
  assert.equal(currentWeek(plan, state(1, 2, 3, 4, 5, 6)), 3);
});

test('weekProgress = 当前周完成了几次 / 共几次', () => {
  assert.deepEqual(weekProgress(plan, state()), { week: 1, done: 0, total: 2 });
  assert.deepEqual(weekProgress(plan, state(1)), { week: 1, done: 1, total: 2 });
  assert.deepEqual(weekProgress(plan, state(1, 2)), { week: 2, done: 0, total: 2 });
  assert.deepEqual(weekProgress(plan, state(1, 2, 3)), { week: 2, done: 1, total: 2 });
});

test('estimateFinishDate：打卡少于 2 次时返回 null（数据不足）', () => {
  assert.equal(estimateFinishDate(plan, state(), '2026-09-20'), null);
  assert.equal(estimateFinishDate(plan, state(1), '2026-09-20'), null);
});

test('estimateFinishDate：按实际节奏外推', () => {
  // 9-10 到 9-16 共 7 天做了 3 次 → 每天 (3-1)/6 ≈ 0.333 次；还剩 3 次 → 约 9 天
  const s = { checkins: [
    { seq: 1, at: '2026-09-10' },
    { seq: 2, at: '2026-09-13' },
    { seq: 3, at: '2026-09-16' },
  ] };
  assert.equal(estimateFinishDate(plan, s, '2026-09-16'), '2026-09-25');
});

test('estimateFinishDate：全部完成后返回 null', () => {
  assert.equal(estimateFinishDate(plan, state(1, 2, 3, 4, 5, 6), '2026-10-01'), null);
});

test('annotatePlan：给每次训练标 done / at / isNext', () => {
  const ann = annotatePlan(plan, state(1, 2));
  assert.equal(ann.length, plan.length);
  assert.equal(ann[0].done, true);
  assert.equal(ann[0].at, '2026-09-10');
  assert.equal(ann[1].done, true);
  assert.equal(ann[1].at, '2026-09-11');
  assert.equal(ann[2].done, false);
  assert.equal(ann[2].at, null);
  assert.equal(ann[2].isNext, true);
  assert.equal(ann[3].isNext, false);
  assert.equal(ann[0].detail, plan[0].detail); // 其余字段透传
});

test('annotatePlan：全部完成后没有 isNext', () => {
  const ann = annotatePlan(plan, state(1, 2, 3, 4, 5, 6));
  assert.equal(ann.every((s) => s.done), true);
  assert.equal(ann.some((s) => s.isNext), false);
});

test('recentCheckins：最新在前，带日期和计划信息', () => {
  const r = recentCheckins(plan, state(1, 2, 3, 4), 2);
  assert.equal(r.length, 2);
  assert.equal(r[0].seq, 4);
  assert.equal(r[0].at, '2026-09-13');
  assert.equal(r[0].detail, plan[3].detail);
  assert.equal(r[1].seq, 3);
});

test('recentCheckins：没打卡时返回空数组', () => {
  assert.deepEqual(recentCheckins(plan, state(), 5), []);
});
