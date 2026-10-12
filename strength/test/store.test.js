import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY, DRAFT_KEY } from '../src/store.js';

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

const items = { goblet: { level: 5, reps: [12, 11], rir: 2 }, deadbug: { level: 3, reps: [8, 8], rir: null } };

test('finish 存一次训练，刷新后还在；徒手动作的 level 被清成 null', () => {
  const storage = fakeStorage();
  createStore(storage).finish({ seq: 1, at: '2026-10-12', items });
  const logs = createStore(storage).get().logs;
  assert.equal(logs.length, 1);
  assert.deepEqual(logs[0].items.goblet, { level: 5, reps: [12, 11], rir: 2 });
  assert.equal(logs[0].items.deadbug.level, null);
});

test('连点两下（seq 重复）只记一次', () => {
  const s = createStore(fakeStorage());
  s.finish({ seq: 1, at: '2026-10-12', items });
  s.finish({ seq: 1, at: '2026-10-12', items });
  assert.equal(s.get().logs.length, 1);
});

test('未知动作、空组、非法次数被丢掉', () => {
  const s = createStore(fakeStorage());
  s.finish({ seq: 1, at: 'x', items: { bogus: { level: 1, reps: [5] }, rdl: { level: 4, reps: [] }, row: { level: 7, reps: [10, -1, 1.5, 9] } } });
  assert.deepEqual(s.get().logs[0].items, { row: { level: 7, reps: [10, 9], rir: null } });
});

test('草稿：保存后刷新还在；完成训练后清掉', () => {
  const storage = fakeStorage();
  const a = createStore(storage);
  a.saveDraft({ seq: 1, legLite: true, items: { goblet: { level: 5, reps: [12] } } });
  const b = createStore(storage);
  assert.equal(b.getDraft(1).legLite, true);
  assert.equal(b.getDraft(2), null);
  b.finish({ seq: 1, at: '2026-10-12', items });
  assert.equal(createStore(storage).getDraft(1), null);
  assert.equal(storage.getItem(DRAFT_KEY), null);
});

test('坏数据不崩，当成空', () => {
  assert.deepEqual(createStore(fakeStorage({ [STORAGE_KEY]: '{oops' })).get().logs, []);
});

test('reset 清记录、保留设置；导出再导入原样恢复', () => {
  const s = createStore(fakeStorage());
  s.setSettings({ handleKg: 0.5, bodyKg: 71, junk: 1 });
  s.finish({ seq: 1, at: '2026-10-12', items });
  const text = s.exportJson();
  s.reset();
  assert.equal(s.get().logs.length, 0);
  assert.deepEqual(s.get().settings, { handleKg: 0.5, bodyKg: 71 });
  s.importJson(text);
  assert.equal(s.get().logs.length, 1);
  assert.throws(() => s.importJson('{"a":1}'));
});

test('感受：完成时一起存；之后可以补填、修改、删掉；坏数据被清掉', () => {
  const storage = fakeStorage();
  const s = createStore(storage);
  s.finish({ seq: 1, at: '2026-10-12', items, session: { minutes: 40, rpe: 99, note: '累' } });
  assert.deepEqual(createStore(storage).get().logs[0].session, { minutes: 40, note: '累' });
  s.setSession(0, { painScore: 2, painArea: '左膝' });
  assert.deepEqual(createStore(storage).get().logs[0].session, { painScore: 2, painArea: '左膝' });
  s.setSession(0, null);
  assert.equal(createStore(storage).get().logs[0].session, undefined);
  s.setSession(5, { rpe: 3 }); // 不存在的下标，不崩
  assert.equal(s.get().logs.length, 1);
});

test('备份书签：记下日期和当时的次数，刷新后还在；清空记录后书签也清掉', () => {
  const storage = fakeStorage();
  const s = createStore(storage);
  assert.deepEqual(s.get().backup, { at: null, count: 0 });
  s.finish({ seq: 1, at: '2026-10-12', items });
  s.markBackedUp('2026-10-12');
  assert.deepEqual(createStore(storage).get().backup, { at: '2026-10-12', count: 1 });
  s.reset();
  assert.deepEqual(createStore(storage).get().backup, { at: null, count: 0 });
});
