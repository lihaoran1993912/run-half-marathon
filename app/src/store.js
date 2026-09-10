// 打卡记录的存取。所有「会变的状态」都收在这里，
// 通过一个注入的 storage（浏览器里是 localStorage，测试里是内存替身）落盘。
//
// 存的东西很小：{ checkins: [{ seq, at }] }
//   seq —— 计划里的第几次训练（1 起）
//   at  —— 打卡日期 'YYYY-MM-DD'

export const STORAGE_KEY = 'marathon-checkin-v1';

const emptyState = () => ({ checkins: [] });

function isValidCheckin(c) {
  return c && Number.isInteger(c.seq) && typeof c.at === 'string' && c.at.length > 0;
}

export function createStore(storage) {
  let state = readFromStorage();

  function readFromStorage() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.checkins)) return emptyState();
      return { checkins: parsed.checkins.filter(isValidCheckin) };
    } catch {
      return emptyState();
    }
  }

  function persist() {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储写满 / 隐私模式禁写：内存里的状态还在，静默即可。
    }
  }

  function snapshot() {
    return { checkins: state.checkins.map((c) => ({ ...c })) };
  }

  return {
    get: snapshot,

    checkIn(seq, at) {
      state.checkins.push({ seq, at });
      persist();
      return snapshot();
    },

    undoLast() {
      state.checkins.pop();
      persist();
      return snapshot();
    },

    setDate(index, at) {
      if (state.checkins[index]) {
        state.checkins[index].at = at;
        persist();
      }
      return snapshot();
    },

    reset() {
      state = emptyState();
      persist();
      return snapshot();
    },

    exportJson() {
      return JSON.stringify(state, null, 2);
    },

    importJson(text) {
      const parsed = JSON.parse(text); // 非 JSON 会在这里抛
      if (!parsed || !Array.isArray(parsed.checkins)) {
        throw new Error('备份格式不对：缺少 checkins 列表');
      }
      state = { checkins: parsed.checkins.filter(isValidCheckin) };
      persist();
      return snapshot();
    },
  };
}
