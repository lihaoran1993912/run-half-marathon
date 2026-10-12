import test from 'node:test';
import assert from 'node:assert/strict';
import { formToSession, sanitizeSession, sessionToForm, sessionSummary, painText } from '../src/session.js';

const blank = { minutes: '', rpe: '', painScore: '', painArea: '', note: '' };

test('全空 → 没有数据（null），不算错', () => {
  assert.deepEqual(formToSession(blank), { session: null, errors: [] });
});

test('正常填：数字转好、文本去空格；全角数字也认', () => {
  const { session, errors } = formToSession({ minutes: '４２', rpe: '7', painScore: '0', painArea: '', note: '  硬拉很累 ' });
  assert.deepEqual(errors, []);
  assert.deepEqual(session, { minutes: 42, rpe: 7, painScore: 0, note: '硬拉很累' });
});

test('超范围 / 不是数字 → 报错，不保存', () => {
  const { session, errors } = formToSession({ ...blank, rpe: '11', painScore: 'abc', minutes: '0' });
  assert.equal(session, null);
  assert.equal(errors.length, 3);
});

test('sanitizeSession：坏字段丢掉，备注截到 200 字', () => {
  const s = sanitizeSession({ minutes: 40, rpe: 99, painScore: 3, painArea: '左膝', note: 'x'.repeat(300), junk: 1 });
  assert.deepEqual(Object.keys(s).sort(), ['minutes', 'note', 'painArea', 'painScore']);
  assert.equal(s.note.length, 200);
  assert.equal(sanitizeSession({ rpe: 99 }), null);
  assert.equal(sanitizeSession('x'), null);
});

test('回填表单再读回来，原样', () => {
  const s = { minutes: 38, rpe: 6, painScore: 2, painArea: '左膝外侧', note: '弓步时有感觉' };
  assert.deepEqual(formToSession(sessionToForm(s)).session, s);
  assert.deepEqual(sessionToForm(null), blank);
});

test('摘要和疼痛分开显示', () => {
  const s = { minutes: 38, rpe: 6, painScore: 2, painArea: '左膝外侧', note: '弓步时有感觉' };
  assert.equal(sessionSummary(s), '用时 38 分钟 · 体感 6/10');
  assert.equal(painText(s), '左膝外侧 2/10');
  assert.equal(painText({ painScore: 0 }), '不疼（0/10）');
  assert.equal(painText({ painScore: 4 }), '4/10（部位未填）');
  assert.equal(painText(null), '');
});
