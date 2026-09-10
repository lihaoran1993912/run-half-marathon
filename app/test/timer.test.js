import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, stateAt, formatClock, frameCues } from '../src/timer.js';

const segs = [
  { label: '跑', kind: 'run', sec: 240 },
  { label: '走', kind: 'walk', sec: 60 },
  { label: '跑', kind: 'run', sec: 240 },
  { label: '走', kind: 'walk', sec: 60 },
];

test('buildTimeline：累计边界和总时长', () => {
  const t = buildTimeline(segs);
  assert.deepEqual(t.bounds, [240, 300, 540, 600]);
  assert.equal(t.total, 600);
});

test('stateAt：开跑那一刻', () => {
  const s = stateAt(segs, 0);
  assert.equal(s.done, false);
  assert.equal(s.index, 0);
  assert.equal(s.kind, 'run');
  assert.equal(s.segRemaining, 240);
  assert.equal(s.segTotal, 240);
  assert.equal(s.totalRemaining, 600);
  assert.equal(s.totalElapsed, 0);
});

test('stateAt：第一段跑到一半', () => {
  const s = stateAt(segs, 100);
  assert.equal(s.index, 0);
  assert.equal(s.segRemaining, 140);
  assert.equal(s.totalElapsed, 100);
  assert.equal(s.totalRemaining, 500);
});

test('stateAt：正好跨到走的那一段', () => {
  const s = stateAt(segs, 240);
  assert.equal(s.index, 1);
  assert.equal(s.kind, 'walk');
  assert.equal(s.segRemaining, 60);
});

test('stateAt：第 3 段（第二次跑）', () => {
  const s = stateAt(segs, 350);
  assert.equal(s.index, 2);
  assert.equal(s.kind, 'run');
  assert.equal(s.segRemaining, 190); // 540 - 350
});

test('stateAt：跑完', () => {
  const s = stateAt(segs, 600);
  assert.equal(s.done, true);
  assert.equal(s.index, 4);
  assert.equal(s.kind, '');
  assert.equal(s.segRemaining, 0);
  assert.equal(s.totalRemaining, 0);
  assert.equal(s.totalElapsed, 600);
});

test('stateAt：超时也算跑完，数值被夹住', () => {
  const s = stateAt(segs, 9999);
  assert.equal(s.done, true);
  assert.equal(s.totalElapsed, 600);
  assert.equal(s.totalRemaining, 0);
});

test('stateAt：负的 elapsed 当 0 处理', () => {
  const s = stateAt(segs, -5);
  assert.equal(s.index, 0);
  assert.equal(s.totalElapsed, 0);
});

test('stateAt：小数秒', () => {
  const s = stateAt(segs, 239.4);
  assert.equal(s.index, 0);
  assert.ok(Math.abs(s.segRemaining - 0.6) < 1e-9);
});

test('frameCues：第一帧不发切换音', () => {
  const r = frameCues({ index: -1, tick: -1 }, stateAt(segs, 0));
  assert.deepEqual(r.cues, []);
  assert.equal(r.index, 0);
});

test('frameCues：跑→走 发 walk，走→跑 发 run', () => {
  assert.deepEqual(frameCues({ index: 0, tick: -1 }, stateAt(segs, 240)).cues, ['walk']);
  assert.deepEqual(frameCues({ index: 1, tick: -1 }, stateAt(segs, 300)).cues, ['run']);
});

test('frameCues：跑完发 done', () => {
  assert.deepEqual(frameCues({ index: 2, tick: -1 }, stateAt(segs, 600)).cues, ['done']);
});

test('frameCues：段末 3 秒每秒一声 tick，同一秒不重复', () => {
  const a = frameCues({ index: 0, tick: -1 }, stateAt(segs, 237.5)); // 剩 2.5 → ceil 3
  assert.deepEqual(a.cues, ['tick']);
  assert.equal(a.tick, 3);
  const b = frameCues({ index: 0, tick: 3 }, stateAt(segs, 237.6)); // 还在这一秒
  assert.deepEqual(b.cues, []);
  const c = frameCues({ index: 0, tick: 3 }, stateAt(segs, 238.5)); // 剩 1.5 → ceil 2
  assert.deepEqual(c.cues, ['tick']);
  assert.equal(c.tick, 2);
});

test('frameCues：离段末还远时 tick 归位', () => {
  assert.equal(frameCues({ index: 0, tick: 2 }, stateAt(segs, 100)).tick, -1);
});

test('frameCues：切换与 tick 可同帧一起发', () => {
  // 从第 1 段末尾直接跨到第 2 段，且第 2 段是 60s——不会同时读秒；构造一个短段场景
  const shortSegs = [{ label: '跑', kind: 'run', sec: 5 }, { label: '走', kind: 'walk', sec: 5 }];
  const r = frameCues({ index: 0, tick: -1 }, stateAt(shortSegs, 5)); // 进入走，剩 5 → 不 tick
  assert.deepEqual(r.cues, ['walk']);
  const r2 = frameCues({ index: 1, tick: -1 }, stateAt(shortSegs, 7)); // 走段剩 3 → tick
  assert.deepEqual(r2.cues, ['tick']);
});

test('formatClock：M:SS，向上取整，不为负', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(5), '0:05');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(600), '10:00');
  assert.equal(formatClock(0.3), '0:01');
  assert.equal(formatClock(-3), '0:00');
  assert.equal(formatClock(3599), '59:59');
});
