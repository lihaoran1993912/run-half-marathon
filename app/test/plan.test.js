import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN, TOTAL_SESSIONS, TOTAL_WEEKS, buildPlan, WARMUP, COOLDOWN } from '../src/plan.js';

test('总量：20 周、63 次训练', () => {
  assert.equal(TOTAL_WEEKS, 20);
  assert.equal(TOTAL_SESSIONS, 63);
  assert.equal(PLAN.length, 63);
});

test('seq 从 1 连续递增到 63', () => {
  PLAN.forEach((s, i) => assert.equal(s.seq, i + 1));
});

test('每周次数：15 周 3 次 + 3 周 4 次（第四个月前三周）+ 2 周 3 次', () => {
  const byWeek = new Map();
  for (const s of PLAN) byWeek.set(s.week, (byWeek.get(s.week) || 0) + 1);
  assert.deepEqual([...byWeek.keys()].sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(byWeek.get(13), 4);
  assert.deepEqual(byWeek.get(14), 4);
  assert.deepEqual(byWeek.get(15), 4);
  assert.deepEqual(byWeek.get(16), 3);
});

test('每月的训练次数：12 / 12 / 12 / 15 / 12', () => {
  const byMonth = [0, 0, 0, 0, 0];
  for (const s of PLAN) byMonth[s.month - 1] += 1;
  assert.deepEqual(byMonth, [12, 12, 12, 15, 12]);
});

test('周 → 月 的映射正确（每月 4 周）', () => {
  for (const s of PLAN) {
    assert.equal(s.month, Math.ceil(s.week / 4), `第 ${s.week} 周应属于第 ${Math.ceil(s.week / 4)} 个月`);
  }
});

test('每月第 4 周是减量 / 恢复周，其余不是', () => {
  for (const s of PLAN) {
    assert.equal(s.recovery, s.weekOfMonth === 4, `第 ${s.week} 周 recovery 标记不对`);
  }
});

test('每次训练都有完整字段', () => {
  for (const s of PLAN) {
    assert.ok(s.detail && s.detail.length > 0, `seq ${s.seq} 缺 detail`);
    assert.ok(s.focus && s.focus.length > 0, `seq ${s.seq} 缺 focus`);
    assert.ok(s.day && s.day.length > 0, `seq ${s.seq} 缺 day`);
    assert.equal(s.warmup, WARMUP);
    assert.equal(s.cooldown, COOLDOWN);
    assert.ok(s.runMin === null || (Number.isFinite(s.runMin) && s.runMin > 0), `seq ${s.seq} runMin 非法`);
  }
});

test('只有最后一次是比赛日', () => {
  const races = PLAN.filter((s) => s.race);
  assert.equal(races.length, 1);
  assert.equal(races[0].seq, 63);
  assert.match(races[0].detail, /比赛/);
});

test('按公里 / 比赛计的课次 runMin 记为 null（共 2 次）', () => {
  assert.equal(PLAN.filter((s) => s.runMin === null).length, 2);
});

test('累计跑量在合理范围（约 30 小时）', () => {
  const total = PLAN.reduce((sum, s) => sum + (s.runMin || 0), 0);
  assert.ok(total > 1500 && total < 2500, `累计 ${total} 分钟，超出预期范围`);
});

test('buildPlan 是纯函数：可传入自定义周数据', () => {
  const tiny = buildPlan([
    { month: 1, weekOfMonth: 1, phase: 'x', recovery: false, focus: 'f', sessions: [{ day: '周一', detail: 'd', runMin: 10 }] },
  ]);
  assert.equal(tiny.length, 1);
  assert.equal(tiny[0].seq, 1);
  assert.equal(tiny[0].week, 1);
  assert.equal(tiny[0].race, false);
});
