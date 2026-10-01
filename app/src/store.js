// 打卡记录的存取。所有「会变的状态」都收在这里，
// 通过一个注入的 storage（浏览器里是 localStorage，测试里是内存替身）落盘。
//
// 主数据很小：{ checkins: [{ seq, at, run? }], profile }
//   seq     —— 计划里的第几次训练（1 起）
//   at      —— 打卡日期 'YYYY-MM-DD'
//   run     —— 这次的实际跑步数据，含疼痛（可选，形状见 runlog.js）
//   profile —— 个人基本信息（形状见 profile.js），清空打卡时保留
//
// 另存一份「上次备份」的书签（设备本地，不进导出内容）：
//   { at: 'YYYY-MM-DD' | null, count: number }

import { sanitizeRun } from './runlog.js';
import { sanitizeProfile } from './profile.js';

export const STORAGE_KEY = 'marathon-checkin-v1';
export const BACKUP_KEY = 'marathon-checkin-backup-v1';
export const EXPORT_VERSION = 1;

const emptyState = () => ({ checkins: [], profile: {} });
const emptyBackup = () => ({ at: null, count: 0 });

function isValidCheckin(c) {
  return c && Number.isInteger(c.seq) && typeof c.at === 'string' && c.at.length > 0;
}

// 只留认识的字段；run 不合法就整个丢掉（打卡本身保留）。
function cleanCheckin(c) {
  const run = sanitizeRun(c.run);
  return run ? { seq: c.seq, at: c.at, run } : { seq: c.seq, at: c.at };
}

// 从任意形状的备份对象里取出 checkins（兼容旧的裸 {checkins:[...]} 和新的带版本号的）。
function extractCheckins(parsed) {
  if (!parsed || !Array.isArray(parsed.checkins)) return null;
  return parsed.checkins.filter(isValidCheckin).map(cleanCheckin);
}

const copyCheckin = (c) => (c.run ? { ...c, run: { ...c.run } } : { ...c });

export function createStore(storage) {
  let state = readState();
  let backup = readBackup();

  function readState() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      const list = extractCheckins(parsed);
      return list ? { checkins: list, profile: sanitizeProfile(parsed.profile) } : emptyState();
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
      checkins: state.checkins.map(copyCheckin),
      profile: { ...state.profile },
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

    // 给第 index 次打卡挂上 / 换掉跑步数据；run 为 null（或清洗后为空）就删掉。
    setRun(index, run) {
      const c = state.checkins[index];
      if (c) {
        const clean = sanitizeRun(run);
        if (clean) c.run = clean;
        else delete c.run;
        persist();
      }
      return snapshot();
    },

    setProfile(profile) {
      state.profile = sanitizeProfile(profile);
      persist();
      return snapshot();
    },

    // 清空打卡记录，但保留个人信息（那不是「打卡记录」）。
    reset() {
      state = { ...emptyState(), profile: state.profile };
      persist();
      return snapshot();
    },

    // 导出内容带上版本号和时间；不含设备本地的备份书签。
    exportJson() {
      return JSON.stringify(
        { app: 'marathon-checkin', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), checkins: state.checkins, profile: state.profile },
        null,
        2,
      );
    },

    importJson(text) {
      const parsed = JSON.parse(text); // 非 JSON 会在这里抛
      const list = extractCheckins(parsed);
      if (!list) throw new Error('备份格式不对：缺少 checkins 列表');
      // 旧备份没有 profile：保留本机已有的
      state = { checkins: list, profile: parsed.profile ? sanitizeProfile(parsed.profile) : state.profile };
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
