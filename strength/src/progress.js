// 进度 + 「这次该用多重」的建议。全是纯函数，方便测试。
//
// 一次训练记录 log 的形状（store.js 负责存）：
//   { seq, at: 'YYYY-MM-DD', legLite?: true,
//     items: { [动作id]: { level: number|null, reps: [每组做了几个], rir: number|null } } }
//   徒手动作 level 为 null；计时动作 reps 里存的是秒数。

import { EXERCISES, PLAN } from './plan.js';
import { MAX_LEVEL, clampLevel } from './gear.js';

export function nextSession(logs, plan = PLAN) {
  return plan[logs.length] || null;
}

export function percent(logs, plan = PLAN) {
  return Math.round((Math.min(logs.length, plan.length) / plan.length) * 100);
}

// 这个动作最近一次的记录（没做过就是 null）。
export function lastEntry(logs, id) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const e = logs[i].items && logs[i].items[id];
    if (e && Array.isArray(e.reps) && e.reps.length) return { ...e, at: logs[i].at };
  }
  return null;
}

// 双重递进：
//   全部组都做到上限（且没有做到彻底力竭）→ 加一档、次数回到下限
//   一半以上的组没到下限 → 减一档
//   其他 → 同重量，目标比上次最少那组多 1 个
// deload（减量周）只保持，不加重。
export function recommend(id, logs, { deload = false } = {}) {
  const ex = EXERCISES[id];
  const last = lastEntry(logs, id);
  const weighted = ex.load !== 'bw';
  const unit = ex.unit === 'sec' ? '秒' : '个';

  if (!last) {
    return {
      level: weighted ? ex.start : null,
      target: ex.min,
      note: weighted
        ? '第一次做：先用建议重量，做完第一组觉得太轻或太重就调一档'
        : '第一次做：先找准动作，做到区间下限就行',
    };
  }

  const level = weighted ? clampLevel(last.level ?? ex.start) : null;
  const reps = last.reps;
  const minDone = Math.min(...reps);
  const allTop = reps.every((r) => r >= ex.max);
  const lowCount = reps.filter((r) => r < ex.min).length;
  const failed = last.rir === 0;

  if (deload) {
    return { level, target: Math.min(minDone, ex.max), note: '减量周：重量和次数都不加，轻松完成' };
  }

  if (allTop && !failed) {
    if (weighted && level < MAX_LEVEL) {
      return { level: level + 1, target: ex.min, note: `上次每组都做到 ${ex.max}${unit}，加一档重量，次数从 ${ex.min} 重新开始` };
    }
    return { level, target: ex.max, note: ex.maxTip };
  }

  if (lowCount * 2 > reps.length) {
    if (weighted && level > 0) {
      return { level: level - 1, target: ex.min, note: `上次多数组没到 ${ex.min}${unit}，减一档，先把次数做够` };
    }
    return { level, target: ex.min, note: `上次多数组没到 ${ex.min}${unit}，这次先做够下限` };
  }

  const target = Math.min(ex.max, Math.max(ex.min, minDone + 1));
  return { level, target, note: `同重量，每组争取做到 ${target}${unit}（上次最少一组 ${minDone}${unit}）` };
}

// 「本周」= 按顺序算出来的周次（跟半马打卡一样不看日历）。
export function currentWeek(logs, plan = PLAN) {
  const s = nextSession(logs, plan);
  return s ? s.week : plan[plan.length - 1].week;
}

// 每个动作的「最好成绩」：最重的档位里做得最多的一组。用来在历史里看进步。
export function bests(logs) {
  const out = {};
  for (const log of logs) {
    for (const [id, e] of Object.entries(log.items || {})) {
      if (!e || !Array.isArray(e.reps) || !e.reps.length) continue;
      const lv = e.level ?? -1;
      const top = Math.max(...e.reps);
      const cur = out[id];
      if (!cur || lv > cur.level || (lv === cur.level && top > cur.reps)) {
        out[id] = { level: lv, reps: top, at: log.at };
      }
    }
  }
  return out;
}
