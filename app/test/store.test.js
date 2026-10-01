import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY, BACKUP_KEY } from '../src/store.js';

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

test('exportJson 带版本号和时间戳', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  const blob = JSON.parse(store.exportJson());
  assert.equal(blob.app, 'marathon-checkin');
  assert.equal(blob.version, 1);
  assert.match(blob.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(blob.checkins, [{ seq: 1, at: '2026-09-10' }]);
});

test('importJson 兼容旧版裸 {checkins} 格式', () => {
  const store = createStore(fakeStorage());
  store.importJson('{"checkins":[{"seq":3,"at":"2026-09-15"}]}');
  assert.deepEqual(store.get().checkins, [{ seq: 3, at: '2026-09-15' }]);
});

test('markBackedUp 记下书签（打卡数 + 日期），并落盘', () => {
  const storage = fakeStorage();
  const store = createStore(storage);
  store.checkIn(1, '2026-09-10');
  store.checkIn(2, '2026-09-12');
  const snap = store.markBackedUp('2026-09-12');
  assert.deepEqual(snap.backup, { at: '2026-09-12', count: 2 });
  // 新建 store（模拟刷新）应读回同样的书签
  assert.deepEqual(createStore(storage).get().backup, { at: '2026-09-12', count: 2 });
});

test('全新 store 的备份书签是空的', () => {
  assert.deepEqual(createStore(fakeStorage()).get().backup, { at: null, count: 0 });
});

test('备份书签是坏数据时安全退回空书签', () => {
  assert.deepEqual(createStore(fakeStorage({ [BACKUP_KEY]: 'xxx' })).get().backup, { at: null, count: 0 });
  assert.deepEqual(createStore(fakeStorage({ [BACKUP_KEY]: '{"at":9,"count":"z"}' })).get().backup, { at: null, count: 0 });
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

// ── 跑步数据（run）+ 个人信息（profile）────────────────────────

const RUN = { distKm: 3.52, durationSec: 1570, avgHr: 148, maxHr: 162, cadence: 168, rpe: 4, note: '膝盖有点酸' };

test('setRun：给某次打卡挂上跑步数据，刷新后还在', () => {
  const storage = fakeStorage();
  const a = createStore(storage);
  a.checkIn(1, '2026-09-10');
  a.checkIn(2, '2026-09-12');
  a.setRun(0, RUN);
  const b = createStore(storage);
  assert.deepEqual(b.get().checkins[0], { seq: 1, at: '2026-09-10', run: RUN });
  assert.deepEqual(b.get().checkins[1], { seq: 2, at: '2026-09-12' });
});

test('setRun(null) 删掉数据；越界下标什么也不做', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  store.setRun(0, RUN);
  store.setRun(0, null);
  assert.deepEqual(store.get().checkins[0], { seq: 1, at: '2026-09-10' });
  store.setRun(5, RUN);
  assert.equal(store.get().checkins.length, 1);
});

test('setRun 存进去的坏字段会被清掉', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  store.setRun(0, { avgHr: 148, evil: '<script>', rpe: 99 });
  assert.deepEqual(store.get().checkins[0].run, { avgHr: 148 });
});

test('get() 返回的 run 是副本', () => {
  const store = createStore(fakeStorage());
  store.checkIn(1, '2026-09-10');
  store.setRun(0, RUN);
  store.get().checkins[0].run.avgHr = 999;
  assert.equal(store.get().checkins[0].run.avgHr, 148);
});

test('旧数据（没有 run 字段）照常读', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ checkins: [{ seq: 1, at: '2026-09-10' }] }) });
  assert.deepEqual(createStore(storage).get().checkins, [{ seq: 1, at: '2026-09-10' }]);
  assert.deepEqual(createStore(storage).get().profile, {});
});

test('setProfile：保存个人信息，刷新后还在；清空打卡不清个人信息', () => {
  const storage = fakeStorage();
  const a = createStore(storage);
  a.setProfile({ age: 33, restHr: 57 });
  a.checkIn(1, '2026-09-10');
  a.reset();
  assert.deepEqual(createStore(storage).get().profile, { age: 33, restHr: 57 });
});

test('导出带上 run 和 profile；导入后都回来', () => {
  const a = createStore(fakeStorage());
  a.checkIn(1, '2026-09-10');
  a.setRun(0, RUN);
  a.setProfile({ age: 33 });
  const b = createStore(fakeStorage());
  b.importJson(a.exportJson());
  assert.deepEqual(b.get().checkins[0].run, RUN);
  assert.deepEqual(b.get().profile, { age: 33 });
});

test('导入旧备份（没有 profile）时，保留本机已有的个人信息', () => {
  const store = createStore(fakeStorage());
  store.setProfile({ age: 33 });
  store.importJson(JSON.stringify({ checkins: [{ seq: 1, at: '2026-09-10' }] }));
  assert.deepEqual(store.get().profile, { age: 33 });
});
