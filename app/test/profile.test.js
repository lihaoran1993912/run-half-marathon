import test from 'node:test';
import assert from 'node:assert/strict';
import { formToProfile, sanitizeProfile, profileToForm } from '../src/profile.js';

const blank = { age: '', restHr: '', easyLow: '', easyHigh: '', maxHr: '', heightCm: '', weightKg: '', altitudeM: '', injuries: '' };
const form = (o) => ({ ...blank, ...o });

test('formToProfile：正常填写', () => {
  const r = formToProfile(form({
    age: '33', restHr: '57', easyLow: '134', easyHigh: '153', heightCm: '172', weightKg: '71', injuries: '无',
  }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.profile, {
    age: 33, restHr: 57, easyLow: 134, easyHigh: 153, heightCm: 172, weightKg: 71, injuries: '无',
  });
});

test('formToProfile：全角数字也认', () => {
  assert.equal(formToProfile(form({ age: '３３' })).profile.age, 33);
});

test('formToProfile：体重可以带一位小数', () => {
  assert.equal(formToProfile(form({ weightKg: '70.5' })).profile.weightKg, 70.5);
});

test('formToProfile：全空 → 空对象，不报错', () => {
  assert.deepEqual(formToProfile(form({})), { profile: {}, errors: [] });
});

test('formToProfile：区间上下限填反了 → 报错', () => {
  const r = formToProfile(form({ easyLow: '153', easyHigh: '134' }));
  assert.equal(r.profile, null);
  assert.match(r.errors[0], /区间/);
});

test('formToProfile：离谱的数报错', () => {
  for (const [o, word] of [[{ age: '5' }, '年龄'], [{ restHr: '200' }, '静息心率'], [{ weightKg: 'x' }, '体重']]) {
    const r = formToProfile(form(o));
    assert.equal(r.profile, null);
    assert.match(r.errors[0], new RegExp(word));
  }
});

test('sanitizeProfile：坏字段丢掉；不是对象 → 空对象', () => {
  assert.deepEqual(sanitizeProfile({ age: 33, restHr: 'x', foo: 1 }), { age: 33 });
  assert.deepEqual(sanitizeProfile(null), {});
  assert.deepEqual(sanitizeProfile({ easyLow: 160, easyHigh: 140 }), {});
});

test('profileToForm ↔ formToProfile 来回不变', () => {
  const p = { age: 33, restHr: 57, easyLow: 134, easyHigh: 153, heightCm: 172, weightKg: 71, altitudeM: 2270, injuries: '无' };
  assert.deepEqual(formToProfile(profileToForm(p)).profile, p);
  assert.deepEqual(profileToForm({}), blank);
});

test('常住海拔：0–6000 米的整数；0（海边）也合法', () => {
  assert.equal(formToProfile(form({ altitudeM: '2270' })).profile.altitudeM, 2270);
  assert.equal(formToProfile(form({ altitudeM: '0' })).profile.altitudeM, 0);
  const r = formToProfile(form({ altitudeM: '9000' }));
  assert.equal(r.profile, null);
  assert.match(r.errors[0], /海拔/);
});
