import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSession } from '../src/segments.js';

test('走跑结合：（轻松跑 4 分钟 + 正常走 1 分钟）× 4', () => {
  const p = parseSession('（轻松跑 4 分钟 + 正常走 1 分钟）× 4');
  assert.equal(p.type, 'runwalk');
  assert.equal(p.reps, 4);
  assert.deepEqual(p.work, { label: '轻松跑', kind: 'run', sec: 240 });
  assert.deepEqual(p.rest, { label: '正常走', kind: 'walk', sec: 60 });
  assert.equal(p.segments.length, 8); // 4 组 × (跑 + 走)
  assert.deepEqual(p.segments[0], { label: '轻松跑', kind: 'run', sec: 240 });
  assert.deepEqual(p.segments[1], { label: '正常走', kind: 'walk', sec: 60 });
  assert.equal(p.segments[7].kind, 'walk');
  assert.equal(p.segments.reduce((s, x) => s + x.sec, 0), 4 * 300);
});

test('走跑结合：另一组数字', () => {
  const p = parseSession('（轻松跑 9 分钟 + 正常走 1 分钟）× 3');
  assert.equal(p.type, 'runwalk');
  assert.equal(p.reps, 3);
  assert.equal(p.work.sec, 540);
  assert.equal(p.segments.length, 6);
});

test('单段连续跑：轻松跑 30 分钟', () => {
  const p = parseSession('轻松跑 30 分钟');
  assert.equal(p.type, 'single');
  assert.equal(p.segments.length, 1);
  assert.deepEqual(p.segments[0], { label: '轻松跑', kind: 'run', sec: 1800 });
});

test('单段连续跑：马拉松心率跑 40 分钟', () => {
  const p = parseSession('马拉松心率跑 40 分钟');
  assert.equal(p.type, 'single');
  assert.equal(p.segments[0].sec, 2400);
  assert.equal(p.segments[0].kind, 'run');
});

test('含箭头的多段（节奏跑）→ freeform（组间休息计划没写死）', () => {
  const p = parseSession('轻松跑 10 分钟 →（节奏跑 4 分钟）× 5 → 轻松跑 5 分钟');
  assert.equal(p.type, 'freeform');
  assert.ok(p.reason);
});

test('含 200 米间歇 → freeform（按距离，没法计时）', () => {
  const p = parseSession('轻松跑 10 分钟 →（200 米间歇跑）× 4 → 轻松跑 10 分钟');
  assert.equal(p.type, 'freeform');
});

test('按公里 / 比赛日 → freeform', () => {
  assert.equal(parseSession('马拉松心率跑 7 千米').type, 'freeform');
  assert.equal(parseSession('比赛日 —— 半程马拉松，享受它！').type, 'freeform');
});

test('走跑结合的 work 标签含「跑」判为 run，含「走」判为 walk', () => {
  const p = parseSession('（轻松跑 5 分钟 + 正常走 1 分钟）× 5');
  assert.equal(p.work.kind, 'run');
  assert.equal(p.rest.kind, 'walk');
});
