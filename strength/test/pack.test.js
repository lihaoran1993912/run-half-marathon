import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPack, selectForPack } from '../src/analysis-pack.js';

const log = (seq, at, extra = {}) => ({
  seq, at,
  items: { goblet: { level: 5, reps: [15, 13], rir: 3 }, rdl: { level: 6, reps: [10, 8], rir: 1 } },
  ...extra,
});

test('范围：最近 1 次 / 最近 4 周 / 全部', () => {
  const logs = [log(1, '2026-09-01'), log(2, '2026-10-01'), log(3, '2026-10-12')];
  assert.deepEqual(selectForPack(logs, 'last', '2026-10-12'), [2]);
  assert.deepEqual(selectForPack(logs, 'recent4w', '2026-10-12'), [1, 2]);
  assert.deepEqual(selectForPack(logs, 'all', '2026-10-12'), [0, 1, 2]);
  assert.deepEqual(selectForPack([], 'all', '2026-10-12'), []);
});

test('分析包写清每个动作：重量、每组次数、目标区间、还剩几个', () => {
  const text = buildPack({ logs: [log(1, '2026-10-12')], settings: { handleKg: 0.5, bodyKg: 71 }, scope: 'all', today: '2026-10-12' });
  assert.match(text, /体重：71 kg/);
  assert.match(text, /第 1 次 · 2026-10-12/);
  assert.match(text, /高脚杯深蹲：7 kg × 15\/13 个（计划 2 组 × 10–20，最后一组还能做 3\+ 个）/);
  assert.match(text, /哑铃罗马尼亚硬拉：7\.5 kg × 10\/8 个/);
  assert.match(text, /只记了动作，没填感受/);
  assert.match(text, /下一次：第 2 次/);
  assert.doesNotMatch(text, /⚠️/);
});

test('有感受和疼痛：单独列出，疼痛时要求优先判断', () => {
  const s = { minutes: 45, rpe: 8, painScore: 3, painArea: '左膝', note: '硬拉很累' };
  const text = buildPack({ logs: [log(1, '2026-10-12', { session: s, legLite: true })], settings: {}, scope: 'last', today: '2026-10-12' });
  assert.match(text, /感受：用时 45 分钟 · 体感 8\/10/);
  assert.match(text, /疼痛：左膝 3\/10/);
  assert.match(text, /备注：硬拉很累/);
  assert.match(text, /腿部减量/);
  assert.match(text, /体重：未填/);
  assert.match(text, /⚠️/);
});
