import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formToRun, sanitizeRun, runToForm,
  paceSecPerKm, formatPace, formatDuration, runSummary,
} from '../src/runlog.js';

const blank = { distKm: '', durMin: '', durSec: '', avgHr: '', maxHr: '', cadence: '', rpe: '', note: '' };
const form = (o) => ({ ...blank, ...o });

test('formToRun：7 项都填，得到一条完整记录', () => {
  const r = formToRun(form({
    distKm: '3.52', durMin: '26', durSec: '10', avgHr: '148', maxHr: '162', cadence: '168', rpe: '4', note: ' 膝盖有点酸 ',
  }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.run, {
    distKm: 3.52, durationSec: 1570, avgHr: 148, maxHr: 162, cadence: 168, rpe: 4, note: '膝盖有点酸',
  });
});

test('formToRun：全空 = 没有数据，不算错', () => {
  assert.deepEqual(formToRun(form({})), { run: null, errors: [] });
});

test('formToRun：只填一部分也行，没填的项不出现', () => {
  const r = formToRun(form({ avgHr: '150', rpe: '5' }));
  assert.deepEqual(r, { run: { avgHr: 150, rpe: 5 }, errors: [] });
});

test('formToRun：时长只填分钟，秒按 0 算；只填秒也行', () => {
  assert.equal(formToRun(form({ durMin: '30' })).run.durationSec, 1800);
  assert.equal(formToRun(form({ durSec: '45' })).run.durationSec, 45);
});

test('formToRun：比赛日能超过 60 分钟', () => {
  assert.equal(formToRun(form({ durMin: '135', durSec: '5' })).run.durationSec, 8105);
});

test('formToRun：全角数字、中文逗号小数点也认（中文输入法常见）', () => {
  const r = formToRun(form({ distKm: '３，５', avgHr: '１４８' }));
  assert.deepEqual(r.errors, []);
  assert.equal(r.run.distKm, 3.5);
  assert.equal(r.run.avgHr, 148);
});

test('formToRun：距离保留两位小数', () => {
  assert.equal(formToRun(form({ distKm: '3.456' })).run.distKm, 3.46);
});

test('formToRun：明显填错的给出中文错误，不产出记录', () => {
  const cases = [
    [{ distKm: 'abc' }, '距离'],
    [{ distKm: '0' }, '距离'],
    [{ distKm: '100' }, '距离'],
    [{ durSec: '75' }, '秒'],
    [{ durMin: '-3' }, '分钟'],
    [{ avgHr: '30' }, '平均心率'],
    [{ maxHr: '260' }, '最高心率'],
    [{ cadence: '50' }, '步频'],
    [{ rpe: '11' }, '体感'],
    [{ rpe: '3.5' }, '体感'],
  ];
  for (const [o, word] of cases) {
    const r = formToRun(form(o));
    assert.equal(r.run, null, JSON.stringify(o));
    assert.equal(r.errors.length, 1, JSON.stringify(o));
    assert.match(r.errors[0], new RegExp(word), JSON.stringify(o));
  }
});

test('formToRun：最高心率比平均心率还低 → 报错', () => {
  const r = formToRun(form({ avgHr: '150', maxHr: '140' }));
  assert.equal(r.run, null);
  assert.match(r.errors[0], /最高心率.*平均心率/);
});

test('formToRun：备注太长截到 200 字', () => {
  assert.equal(formToRun(form({ note: '啊'.repeat(300) })).run.note.length, 200);
});

test('sanitizeRun：从存储读回时，丢掉坏字段、保留好字段', () => {
  assert.deepEqual(
    sanitizeRun({ distKm: 5, durationSec: 'x', avgHr: 999, rpe: 6, hacked: 1, note: 3 }),
    { distKm: 5, rpe: 6 },
  );
  assert.equal(sanitizeRun({}), null);
  assert.equal(sanitizeRun(null), null);
  assert.equal(sanitizeRun('nope'), null);
});

test('sanitizeRun：最高心率低于平均心率时丢掉最高心率', () => {
  assert.deepEqual(sanitizeRun({ avgHr: 150, maxHr: 140 }), { avgHr: 150 });
});

test('runToForm ↔ formToRun 来回一趟不变（编辑时回填表单）', () => {
  const run = { distKm: 5.2, durationSec: 2125, avgHr: 145, maxHr: 158, cadence: 172, rpe: 3, note: '风大' };
  const f = runToForm(run);
  assert.equal(f.durMin, '35');
  assert.equal(f.durSec, '25');
  assert.deepEqual(formToRun(f).run, run);
  assert.deepEqual(runToForm(null), blank);
});

test('配速 = 时长 / 距离，缺一个就是 null', () => {
  assert.equal(paceSecPerKm({ distKm: 4, durationSec: 1800 }), 450);
  assert.equal(paceSecPerKm({ distKm: 4 }), null);
  assert.equal(paceSecPerKm({ durationSec: 1800 }), null);
  assert.equal(paceSecPerKm(null), null);
});

test('格式化：配速 7\'30"、时长 26:10 / 1:05:03', () => {
  assert.equal(formatPace(450), '7\'30"');
  assert.equal(formatPace(365.6), '6\'06"');
  assert.equal(formatDuration(1570), '26:10');
  assert.equal(formatDuration(3903), '1:05:03');
});

test('runSummary：一行摘要，只列填了的项', () => {
  assert.equal(
    runSummary({ distKm: 3.52, durationSec: 1570, avgHr: 148, maxHr: 162, cadence: 168, rpe: 4 }),
    '3.52 km · 26:10 · 配速 7\'26"/km · 心率 148/162 · 步频 168 · 体感 4/10',
  );
  assert.equal(runSummary({ avgHr: 150 }), '平均心率 150');
  assert.equal(runSummary(null), '');
});
