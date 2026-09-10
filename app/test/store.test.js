import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../src/store.js';

// 内存版 localStorage 替身
function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _dump: () => Object.fromEntries(map),
  };
}

test('新 store：没有任何打卡', () => {
  const store = createStore(fakeStorage());
  assert.deepEqual(store.get().checkins, []);
});

test('checkIn 追加一条并落盘；新建的 store 能读到', () => {
  const storage = fakeStorage();
  const a = createStore(storage);
  a.checkIn(1, '2026-09-10');
  a.checkIn(2, '2026-09-12');

  const b = createStore(storage); // 模拟刷新页面
  assert.deepEqual(b.get().checkins, [
    { seq: 1, at: '2026-09-10' },
    { seq: 2, at: '2026-09-12' },
  ]);
});

test('get() 返回副本，外部改动不影响内部状态', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  store.get().checkins.push({ seq: 999, at: 'x' });
  assert.equal(store.get().checkins.length, 1);
});

test('undoLast 撤销最近一次', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  store.checkIn(2, '2026-09-12');
  store.undoLast();
  assert.deepEqual(store.get().checkins, [{ seq: 1, at: '2026-09-10' }]);
  store.undoLast();
  store.undoLast(); // 空了再撤也不报错
  assert.deepEqual(store.get().checkins, []);
});

test('setDate 改某条打卡的日期', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  store.checkIn(2, '2026-09-12');
  store.setDate(0, '2026-09-09');
  assert.equal(store.get().checkins[0].at, '2026-09-09');
});

test('reset 清空', () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  store.checkIn(1, '2026-09-10');
  store.reset();
  assert.deepEqual(store.get().checkins, []);
  assert.deepEqual(createStore(storage).get().checkins, []);
});

test('存储里是坏数据时，安全退回空状态，不抛异常', () => {
  assert.deepEqual(createStore(fakeStorage({ [STORAGE_KEY]: 'not json' })).get().checkins, []);
  assert.deepEqual(createStore(fakeStorage({ [STORAGE_KEY]: '{"checkins":"nope"}' })).get().checkins, []);
  assert.deepEqual(createStore(fakeStorage({ [STORAGE_KEY]: '{"x":1}' })).get().checkins, []);
});

test('读取时过滤掉格式不对的打卡条目', () => {
  const raw = JSON.stringify({ checkins: [{ seq: 1, at: '2026-09-10' }, { seq: 'x', at: 'y' }, { at: 'z' }, null] });
  const store = createStore(fakeStorage({ [STORAGE_KEY]: raw }));
  assert.deepEqual(store.get().checkins, [{ seq: 1, at: '2026-09-10' }]);
});

test('exportJson / importJson 往返', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  store.checkIn(2, '2026-09-12');
  const backup = store.exportJson();

  const restored = createStore(fakeStorage());
  restored.importJson(backup);
  assert.deepEqual(restored.get().checkins, store.get().checkins);
});

test('importJson 遇到非法内容抛错，且不改动原状态', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  assert.throws(() => store.importJson('garbage'));
  assert.throws(() => store.importJson('{"checkins":123}'));
  assert.deepEqual(store.get().checkins, [{ seq: 1, at: '2026-09-10' }]);
});

test('落盘失败（存储抛异常）时，checkIn 仍返回内存里的最新状态，不崩', () => {
  const flaky = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceeded'); },
    removeItem: () => {},
  };
  const store = createStore(flaky);
  const res = store.checkIn(1, '2026-09-10');
  assert.deepEqual(res.checkins, [{ seq: 1, at: '2026-09-10' }]);
});
