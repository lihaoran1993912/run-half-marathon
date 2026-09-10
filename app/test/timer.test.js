import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, stateAt, formatClock, frameCues, elapsedFrom, metroTimes } from '../src/timer.js';

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

test('elapsedFrom：没开始是 0', () => {
  assert.equal(elapsedFrom(null, 1000), 0);
  assert.equal(elapsedFrom({ startMs: 0, running: false }, 1000), 0);
});

test('elapsedFrom：运行中按 now 算', () => {
  const sess = { startMs: 1000, pausedAccumMs: 0, pauseStartMs: 0, running: true };
  assert.equal(elapsedFrom(sess, 1000), 0);
  assert.equal(elapsedFrom(sess, 11000), 10);
});

test('elapsedFrom：暂停中冻结在按下暂停那一刻', () => {
  const sess = { startMs: 1000, pausedAccumMs: 0, pauseStartMs: 9000, running: false };
  assert.equal(elapsedFrom(sess, 999999), 8); // now 被忽略
});

test('elapsedFrom：继续后扣掉累计暂停时长', () => {
  // 1s 开始 → 9s 暂停（过了 8s）→ 12s 继续（暂停了 3s）→ 22s
  const sess = { startMs: 1000, pausedAccumMs: 3000, pauseStartMs: 0, running: true };
  assert.equal(elapsedFrom(sess, 22000), 18); // (22-1-3)
});

test('elapsedFrom：多次暂停累加（startMs=0 是「没开始」的哨兵值）', () => {
  assert.equal(elapsedFrom({ startMs: 0, pausedAccumMs: 5000, running: true }, 30000), 0);
  const sess = { startMs: 1000, pausedAccumMs: 5000, pauseStartMs: 0, running: true };
  assert.equal(elapsedFrom(sess, 31000), 25);
});

test('elapsedFrom：时钟回拨也不会变负', () => {
  const sess = { startMs: 10000, pausedAccumMs: 0, pauseStartMs: 0, running: true };
  assert.equal(elapsedFrom(sess, 5000), 0);
});

test('metroTimes：首次（nextScheduled=0）从 now+0.06 起，排满 horizon', () => {
  const { times, next } = metroTimes(10, 0, 1 / 3); // 180bpm ≈ 0.333s
  assert.equal(times[0], 10.06);
  // horizon 0.15 → 10.06 一个就超了
  assert.deepEqual(times, [10.06]);
  assert.ok(Math.abs(next - (10.06 + 1 / 3)) < 1e-9);
});

test('metroTimes：正常推进，接着上次的 next', () => {
  const { times, next } = metroTimes(10, 10.05, 0.05); // 间隔小，一轮排好几个
  assert.equal(times[0], 10.05);
  assert.ok(times.every((t) => t >= 10 && t < 10.15));
  assert.ok(times.length >= 2);
  assert.ok(next >= 10.15);
});

test('metroTimes：nextScheduled 落后于 now（后台回来 / ctx 刚 resume）→ 从 now 重新起，不排到过去', () => {
  const { times } = metroTimes(100, 3.2, 1 / 3); // 上次排到 3.2，现在已经 100
  assert.ok(times.every((t) => t >= 100));
  assert.equal(times[0], 100.06);
});

test('metroTimes：一个都不排时也返回合理的 next', () => {
  const { times, next } = metroTimes(10, 10.5, 1 / 3); // next 在 horizon 之外
  assert.deepEqual(times, []);
  assert.equal(next, 10.5);
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
