// 训练记录的存取，通过注入的 storage 落盘（浏览器里是 localStorage，测试里是内存替身）。
//
// 主数据：{ logs: [log...], settings: { handleKg, bodyKg } }   log 的形状见 progress.js
// 草稿（练到一半的输入，刷新 / 切出去不丢）：{ seq, legLite, items, sessionForm }

import { EXERCISES } from './plan.js';
import { clampLevel } from './gear.js';
import { sanitizeSession } from './session.js';

export const STORAGE_KEY = 'dumbbell-strength-v1';
export const DRAFT_KEY = 'dumbbell-strength-draft-v1';

const emptyState = () => ({ logs: [], settings: {} });

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : undefined);

export function sanitizeSettings(s) {
  const out = {};
  if (!s || typeof s !== 'object') return out;
  const h = num(s.handleKg, 0, 5);
  const b = num(s.bodyKg, 30, 200);
  if (h !== undefined) out.handleKg = h;
  if (b !== undefined) out.bodyKg = b;
  return out;
}

// 只留认识的动作；每组次数取 0–300 的整数；空的动作丢掉。
export function sanitizeItems(items) {
  const out = {};
  if (!items || typeof items !== 'object') return out;
  for (const [id, e] of Object.entries(items)) {
    const ex = EXERCISES[id];
    if (!ex || !e || !Array.isArray(e.reps)) continue;
    const reps = e.reps.filter((r) => Number.isInteger(r) && r >= 0 && r <= 300);
    if (!reps.length) continue;
    out[id] = {
      level: ex.load === 'bw' ? null : clampLevel(e.level),
      reps,
      rir: Number.isInteger(e.rir) && e.rir >= 0 && e.rir <= 5 ? e.rir : null,
    };
  }
  return out;
}

function cleanLog(l) {
  if (!l || !Number.isInteger(l.seq) || typeof l.at !== 'string' || !l.at) return null;
  const log = { seq: l.seq, at: l.at, items: sanitizeItems(l.items) };
  if (l.legLite === true) log.legLite = true;
  const session = sanitizeSession(l.session);
  if (session) log.session = session;
  return log;
}

function extractLogs(parsed) {
  if (!parsed || !Array.isArray(parsed.logs)) return null;
  return parsed.logs.map(cleanLog).filter(Boolean);
}

const copyLog = (l) => JSON.parse(JSON.stringify(l));

export function createStore(storage) {
  let state = read();
  let draft = readDraft();

  function read() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      const logs = extractLogs(parsed);
      return logs ? { logs, settings: sanitizeSettings(parsed.settings) } : emptyState();
    } catch {
      return emptyState();
    }
  }

  function readDraft() {
    try {
      const d = JSON.parse(storage.getItem(DRAFT_KEY) || 'null');
      if (!d || !Number.isInteger(d.seq) || typeof d.items !== 'object') return null;
      return d;
    } catch {
      return null;
    }
  }

  function persist() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 写满 / 隐私模式：内存里还在 */ }
  }
  function persistDraft() {
    try {
      if (draft) storage.setItem(DRAFT_KEY, JSON.stringify(draft));
      else storage.removeItem(DRAFT_KEY);
    } catch { /* 同上 */ }
  }

  const snapshot = () => ({ logs: state.logs.map(copyLog), settings: { ...state.settings } });

  return {
    get: snapshot,

    // 完成一次训练。seq 必须正好是下一次（防止连点两下记成两次）。
    finish({ seq, at, items, legLite, session }) {
      if (seq !== state.logs.length + 1) return snapshot();
      const log = cleanLog({ seq, at, items, legLite, session });
      if (log) {
        state.logs.push(log);
        persist();
        draft = null;
        persistDraft();
      }
      return snapshot();
    },

    // 补填 / 修改 / 删掉（null）某次训练的感受。
    setSession(index, session) {
      const log = state.logs[index];
      if (!log) return snapshot();
      const clean = sanitizeSession(session);
      if (clean) log.session = clean;
      else delete log.session;
      persist();
      return snapshot();
    },

    undoLast() {
      state.logs.pop();
      persist();
      return snapshot();
    },

    setSettings(s) {
      state.settings = sanitizeSettings(s);
      persist();
      return snapshot();
    },

    getDraft(seq) {
      return draft && draft.seq === seq ? JSON.parse(JSON.stringify(draft)) : null;
    },
    saveDraft(d) {
      draft = JSON.parse(JSON.stringify(d));
      persistDraft();
    },
    clearDraft() {
      draft = null;
      persistDraft();
    },

    // 清空记录，保留设置。
    reset() {
      state = { logs: [], settings: state.settings };
      draft = null;
      persist();
      persistDraft();
      return snapshot();
    },

    exportJson() {
      return JSON.stringify(
        { app: 'dumbbell-strength', version: 1, exportedAt: new Date().toISOString(), logs: state.logs, settings: state.settings },
        null,
        2,
      );
    },

    importJson(text) {
      const parsed = JSON.parse(text);
      const logs = extractLogs(parsed);
      if (!logs) throw new Error('备份格式不对：缺少 logs 列表');
      state = { logs, settings: parsed.settings ? sanitizeSettings(parsed.settings) : state.settings };
      persist();
      return snapshot();
    },
  };
}
