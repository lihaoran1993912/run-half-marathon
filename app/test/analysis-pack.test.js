import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAN } from '../src/plan.js';
import { selectForPack, buildPack } from '../src/analysis-pack.js';

const PROFILE = { age: 33, restHr: 57, easyLow: 134, easyHigh: 153, heightCm: 172, weightKg: 71, injuries: '无' };

// 造 n 条打卡，日期从 start 起每隔 gap 天一条
function checkins(n, start = '2026-09-01', gap = 2) {
  const out = [];
  const d = new Date(start);
  for (let i = 0; i < n; i++) {
    out.push({ seq: i + 1, at: d.toISOString().slice(0, 10) });
    d.setDate(d.getDate() + gap);
  }
  return out;
}

test('selectForPack：last = 只要最后一次', () => {
  assert.deepEqual(selectForPack({ checkins: checkins(5) }, 'last', '2026-09-30'), [4]);
});

test('selectForPack：all = 全部，按完成顺序', () => {
  assert.deepEqual(selectForPack({ checkins: checkins(3) }, 'all', '2026-09-30'), [0, 1, 2]);
});

test('selectForPack：recent4w = 今天往前 28 天内（含今天）', () => {
  const state = { checkins: [
    { seq: 1, at: '2026-09-02' }, // 28 天前，不算
    { seq: 2, at: '2026-09-03' }, // 27 天前，算
    { seq: 3, at: '2026-09-30' },
  ] };
  assert.deepEqual(selectForPack(state, 'recent4w', '2026-09-30'), [1, 2]);
});

test('selectForPack：没有打卡 → 空', () => {
  assert.deepEqual(selectForPack({ checkins: [] }, 'last', '2026-09-30'), []);
});

test('buildPack：基本信息、进度、下一课都在', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(3) }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.match(text, /33 岁/);
  assert.match(text, /172 cm/);
  assert.match(text, /71 kg/);
  assert.match(text, /静息心率 57/);
  assert.match(text, /134[–-]153/);
  assert.match(text, /最大心率：未实测/);
  assert.match(text, /伤病史：无/);
  assert.match(text, /已完成 3 \/ 63/);
  // 下一课 = 第 4 次（第 2 周周二）
  assert.match(text, /第 4 次/);
  assert.match(text, /轻松跑 7 分钟 \+ 正常走 1 分钟/);
});

test('buildPack：每次课都把计划和实际数据放一起', () => {
  const cs = checkins(2);
  cs[0].run = { distKm: 3.1, durationSec: 1500, avgHr: 150, maxHr: 165, cadence: 166, rpe: 5, note: '有点热' };
  const text = buildPack({ plan: PLAN, state: { checkins: cs }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.match(text, /第 1 次 · 2026-09-01/);
  assert.match(text, /计划：（轻松跑 4 分钟 \+ 正常走 1 分钟）× 4/);
  assert.match(text, /3\.1 km · 25:00 · 配速 8'04"\/km · 心率 150\/165 · 步频 166 · 体感 5\/10/);
  assert.match(text, /备注：有点热/);
  // 第 2 次没填数据
  assert.match(text, /第 2 次[\s\S]*只打了卡，没有记录数据/);
});

test('buildPack：同一周的「教练的话」只出现一次', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(3) }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  const focus = PLAN[0].focus;
  assert.equal(text.split(focus).length - 1, 1);
});

test('buildPack：恢复周有标注', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(10, '2026-08-01') }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.match(text, /第 4 周（减量\/恢复周）/);
});

test('buildPack：有走跑结合课时，提醒平均心率/配速含走路段', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(1) }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.match(text, /走跑结合.*走路/);
});

test('buildPack：没有走跑结合课时，不出那条提醒', () => {
  const state = { checkins: checkins(14, '2026-09-01', 1) }; // 第 13、14 次在第 5 周（连续轻松跑）
  const text = buildPack({ plan: PLAN, state, profile: PROFILE, scope: 'last', today: '2026-09-30' });
  assert.doesNotMatch(text, /走跑结合.*走路/);
});

test('buildPack：结尾有分析要求和截图说明', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(3) }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  for (const w of ['计划执行', '趋势', '风险', '建议', '截图', '中文']) assert.match(text, new RegExp(w));
});

test('buildPack：基本信息没填的项写「未填」', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(1) }, profile: {}, scope: 'all', today: '2026-09-30' });
  assert.match(text, /年龄：未填/);
  assert.match(text, /轻松跑心率区间：未填/);
});

test('buildPack：选中范围里一条都没有 → 明确说没有记录', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(2, '2026-01-01') }, profile: PROFILE, scope: 'recent4w', today: '2026-09-30' });
  assert.match(text, /这个范围内没有打卡记录/);
});

test('buildPack：63 次全部完成时不再写「下一次」', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(63, '2026-01-01', 1) }, profile: PROFILE, scope: 'last', today: '2026-09-30' });
  assert.match(text, /63 次已全部完成/);
  assert.doesNotMatch(text, /下一次/);
});

// ── 海拔 + 疼痛 ────────────────────────

test('buildPack：填了常住海拔就写上；高海拔提醒心率偏高', () => {
  const text = buildPack({ plan: PLAN, state: { checkins: checkins(1) }, profile: { ...PROFILE, altitudeM: 2270 }, scope: 'all', today: '2026-09-30' });
  assert.match(text, /常住海拔：约 2270 米/);
  assert.match(text, /高海拔.*心率/);
});

test('buildPack：低海拔不出高海拔提醒；没填写「未填」', () => {
  const low = buildPack({ plan: PLAN, state: { checkins: checkins(1) }, profile: { ...PROFILE, altitudeM: 50 }, scope: 'all', today: '2026-09-30' });
  assert.match(low, /常住海拔：约 50 米/);
  assert.doesNotMatch(low, /高海拔/);
  const none = buildPack({ plan: PLAN, state: { checkins: checkins(1) }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.match(none, /常住海拔：未填/);
});

test('buildPack：疼痛单独一行，排在备注前', () => {
  const cs = checkins(1);
  cs[0].run = { avgHr: 136, painScore: 3, painArea: '左膝外侧', note: '隐隐的' };
  const text = buildPack({ plan: PLAN, state: { checkins: cs }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.match(text, /- 疼痛：左膝外侧 3\/10\n- 备注：隐隐的/);
});

test('buildPack：选中的记录里有疼痛 > 0，分析要求里点名先看疼痛', () => {
  const cs = checkins(2);
  cs[1].run = { painScore: 2, painArea: '左膝' };
  const text = buildPack({ plan: PLAN, state: { checkins: cs }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.match(text, /有疼痛记录.*优先/);
  const clean = buildPack({ plan: PLAN, state: { checkins: checkins(2) }, profile: PROFILE, scope: 'all', today: '2026-09-30' });
  assert.doesNotMatch(clean, /有疼痛记录/);
});
