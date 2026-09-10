// 打卡记录的存取。所有「会变的状态」都收在这里，
// 通过一个注入的 storage（浏览器里是 localStorage，测试里是内存替身）落盘。
//
// 主数据很小：{ checkins: [{ seq, at }] }
//   seq —— 计划里的第几次训练（1 起）
//   at  —— 打卡日期 'YYYY-MM-DD'
//
// 另存一份「上次备份」的书签（设备本地，不进导出内容）：
//   { at: 'YYYY-MM-DD' | null, count: number }

export const STORAGE_KEY = 'marathon-checkin-v1';
export const BACKUP_KEY = 'marathon-checkin-backup-v1';
export const EXPORT_VERSION = 1;

const emptyState = () => ({ checkins: [] });
const emptyBackup = () => ({ at: null, count: 0 });

function isValidCheckin(c) {
  return c && Number.isInteger(c.seq) && typeof c.at === 'string' && c.at.length > 0;
}

// 从任意形状的备份对象里取出 checkins（兼容旧的裸 {checkins:[...]} 和新的带版本号的）。
function extractCheckins(parsed) {
  if (!parsed || !Array.isArray(parsed.checkins)) return null;
  return parsed.checkins.filter(isValidCheckin);
}

export function createStore(storage) {
  let state = readState();
  let backup = readBackup();

  function readState() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const list = extractCheckins(JSON.parse(raw));
      return list ? { checkins: list } : emptyState();
    } catch {
      return emptyState();
    }
  }

  function readBackup() {
    try {
      const raw = storage.getItem(BACKUP_KEY);
      if (!raw) return emptyBackup();
      const b = JSON.parse(raw);
      return {
        at: typeof b.at === 'string' ? b.at : null,
        count: Number.isInteger(b.count) ? b.count : 0,
      };
    } catch {
      return emptyBackup();
    }
  }

  function persist() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 写满 / 隐私模式：内存里还在 */ }
  }
  function persistBackup() {
    try { storage.setItem(BACKUP_KEY, JSON.stringify(backup)); } catch { /* 同上 */ }
  }

  function snapshot() {
    return {
      checkins: state.checkins.map((c) => ({ ...c })),
      backup: { ...backup },
    };
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

    // 导出内容带上版本号和时间；不含设备本地的备份书签。
    exportJson() {
      return JSON.stringify(
        { app: 'marathon-checkin', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), checkins: state.checkins },
        null,
        2,
      );
    },

    importJson(text) {
      const parsed = JSON.parse(text); // 非 JSON 会在这里抛
      const list = extractCheckins(parsed);
      if (!list) throw new Error('备份格式不对：缺少 checkins 列表');
      state = { checkins: list };
      persist();
      return snapshot();
    },

    // 用户确实把备份保存出去了（分享 / 复制 / 导出成功）后调一次，记下书签。
    markBackedUp(at) {
      backup = { at, count: state.checkins.length };
      persistBackup();
      return snapshot();
    },
  };
}
