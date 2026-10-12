import test from 'node:test';
import assert from 'node:assert/strict';
import { levels, describeLevel, MAX_LEVEL, clampLevel } from '../src/gear.js';
import { PLAN, EXERCISES, applyLegLite } from '../src/plan.js';
import { recommend, nextSession, percent, lastEntry, bests } from '../src/progress.js';
import { proteinTarget, powderFor } from '../src/nutrition.js';

// ── gear ──
test('三片 2/1.5/1.25 每边对称装，能拼出 8 档（含空手柄），一只最重 9.5 kg 片重', () => {
  const kg = levels().map((l) => l.kg);
  assert.deepEqual(kg, [0, 2.5, 3, 4, 5.5, 6.5, 7, 9.5]);
  assert.equal(MAX_LEVEL, 7);
});

test('设置了手柄重量，每档都加上手柄', () => {
  assert.deepEqual(levels(0.5).map((l) => l.kg), [0.5, 3, 3.5, 4.5, 6, 7, 7.5, 10]);
});

test('describeLevel 说清楚每边装哪几片', () => {
  assert.equal(describeLevel(5, 0.5), '每边 2 + 1.25 · 7 kg/只');
  assert.equal(describeLevel(0), '空手柄 · 片重 0 kg/只');
  assert.equal(clampLevel(99), 7);
  assert.equal(clampLevel(-1), 0);
});

// ── plan ──
test('计划 16 周 × 2 = 32 次，A/B 轮换，seq 连续', () => {
  assert.equal(PLAN.length, 32);
  PLAN.forEach((s, i) => {
    assert.equal(s.seq, i + 1);
    assert.equal(s.kind, i % 2 === 0 ? 'A' : 'B');
  });
});

test('计划里的动作都在动作库里，起始档位合法', () => {
  for (const s of PLAN) for (const it of s.items) assert.ok(EXERCISES[it.id], it.id);
  for (const ex of Object.values(EXERCISES)) {
    assert.ok(ex.min < ex.max);
    assert.ok(ex.start >= 0 && ex.start <= MAX_LEVEL);
  }
});

test('减量周（4/8/12）组数比前一周少；选做动作只在建立期以后、非减量周出现', () => {
  for (const wk of [4, 8, 12]) {
    const d = PLAN.find((s) => s.week === wk);
    const prev = PLAN.find((s) => s.week === wk - 1);
    assert.ok(d.deload);
    assert.ok(d.items[0].sets < prev.items[0].sets || prev.items[0].sets === 2 && d.items[0].sets === 1);
    assert.ok(!d.items.some((it) => it.id === 'lateral' || it.id === 'curl'));
  }
  assert.ok(!PLAN[0].items.some((it) => it.id === 'lateral'));
  assert.ok(PLAN.find((s) => s.week === 5).items.some((it) => it.id === 'lateral'));
});

test('赛前最后一周没有任何下肢动作', () => {
  for (const s of PLAN.filter((s) => s.week === 16)) {
    assert.ok(s.items.length > 0);
    assert.ok(s.items.every((it) => EXERCISES[it.id].region !== 'leg'));
  }
});

test('腿部减量：只减下肢，最少留 1 组', () => {
  const items = [{ id: 'goblet', sets: 3 }, { id: 'floorpress', sets: 3 }, { id: 'calf', sets: 1 }];
  assert.deepEqual(applyLegLite(items, true), [{ id: 'goblet', sets: 2 }, { id: 'floorpress', sets: 3 }, { id: 'calf', sets: 1 }]);
  assert.deepEqual(applyLegLite(items, false), items);
});

// ── progress ──
const log = (seq, items, at = '2026-10-1' + seq) => ({ seq, at, items });

test('没做过：用动作库的起始档位、目标是区间下限', () => {
  const r = recommend('goblet', []);
  assert.equal(r.level, EXERCISES.goblet.start);
  assert.equal(r.target, EXERCISES.goblet.min);
});

test('每组都做到上限 → 加一档，次数回到下限', () => {
  const logs = [log(1, { rdl: { level: 4, reps: [15, 15], rir: 2 } })];
  const r = recommend('rdl', logs);
  assert.equal(r.level, 5);
  assert.equal(r.target, 10);
});

test('做到上限但最后一组彻底力竭（RIR 0）→ 不加重', () => {
  const logs = [log(1, { rdl: { level: 4, reps: [15, 15], rir: 0 } })];
  assert.equal(recommend('rdl', logs).level, 4);
});

test('已经最重档还做到上限 → 不能再加，给加难度的办法', () => {
  const logs = [log(1, { row: { level: 7, reps: [15, 15, 15], rir: 2 } })];
  const r = recommend('row', logs);
  assert.equal(r.level, 7);
  assert.equal(r.note, EXERCISES.row.maxTip);
});

test('多数组没到下限 → 减一档', () => {
  const logs = [log(1, { floorpress: { level: 5, reps: [9, 6, 5], rir: 0 } })];
  assert.equal(recommend('floorpress', logs).level, 4);
});

test('中间情况 → 同重量，目标 = 上次最少那组 + 1', () => {
  const logs = [log(1, { goblet: { level: 5, reps: [14, 12], rir: 2 } })];
  const r = recommend('goblet', logs);
  assert.equal(r.level, 5);
  assert.equal(r.target, 13);
});

test('减量周只保持，不加重', () => {
  const logs = [log(1, { rdl: { level: 4, reps: [15, 15], rir: 2 } })];
  assert.equal(recommend('rdl', logs, { deload: true }).level, 4);
});

test('徒手动作：level 一直是 null，做到上限给进阶办法', () => {
  const logs = [log(1, { sideplank: { level: null, reps: [45, 45], rir: 2 } })];
  const r = recommend('sideplank', logs);
  assert.equal(r.level, null);
  assert.equal(r.note, EXERCISES.sideplank.maxTip);
});

test('lastEntry 找该动作最近一次（跳过没做这个动作的课）', () => {
  const logs = [
    log(1, { calf: { level: 3, reps: [12], rir: 3 } }),
    log(2, { lunge: { level: 4, reps: [8], rir: 3 } }),
  ];
  assert.equal(lastEntry(logs, 'calf').level, 3);
  assert.equal(lastEntry(logs, 'goblet'), null);
});

test('nextSession / percent 按顺序走', () => {
  assert.equal(nextSession([]).seq, 1);
  assert.equal(nextSession([log(1, {})]).seq, 2);
  assert.equal(percent(PLAN.map((s) => log(s.seq, {}))), 100);
  assert.equal(nextSession(PLAN.map((s) => log(s.seq, {}))), null);
});

test('bests：更重的档位优先，同档取次数多的', () => {
  const logs = [
    log(1, { rdl: { level: 4, reps: [15, 15], rir: 2 } }),
    log(2, { rdl: { level: 5, reps: [10, 9], rir: 2 } }),
  ];
  assert.deepEqual(bests(logs).rdl, { level: 5, reps: 10, at: logs[1].at });
});

// ── nutrition ──
test('71 kg：每天 99–114 g 蛋白质；补 25 g 蛋白约 30 g 粉', () => {
  assert.deepEqual(proteinTarget(71), { low: 99, high: 114 });
  assert.equal(powderFor(25), 30);
  assert.equal(proteinTarget(undefined), null);
});
