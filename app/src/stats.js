// 统计数字 —— 纯函数，喂给顶部那排小字。
// state 形状同 progress.js：{ checkins: [{ seq, at }] }，at 是 'YYYY-MM-DD'。

const MS_PER_DAY = 86400000;

function shift(dateStr, deltaDays) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

// 整个计划的总跑量（分钟），null 记 0。
export function totalRunMinutes(plan) {
  return plan.reduce((sum, s) => sum + (s.runMin || 0), 0);
}

// 已打卡课次的累计跑量（分钟）。按 seq 去计划里查。
export function completedRunMinutes(plan, state) {
  const bySeq = new Map(plan.map((s) => [s.seq, s]));
  return state.checkins.reduce((sum, c) => {
    const s = bySeq.get(c.seq);
    return sum + (s && s.runMin ? s.runMin : 0);
  }, 0);
}

// 最近 N 天（含今天）里的打卡次数。
export function checkinsInLastDays(state, today, days) {
  const cutoff = shift(today, -(days - 1));
  return state.checkins.filter((c) => c.at >= cutoff && c.at <= today).length;
}

// 有训练的不同日期数（同一天做两次只算一天）。
export function distinctActiveDays(state) {
  return new Set(state.checkins.map((c) => c.at)).size;
}

// 从第一次打卡到今天的天数（含头尾）。没打过卡返回 0。
export function daysSinceStart(state, today) {
  if (state.checkins.length === 0) return 0;
  const first = new Date(state.checkins[0].at);
  return Math.floor((new Date(today) - first) / MS_PER_DAY) + 1;
}

// 平均每周打卡次数，保留 1 位小数。
export function avgPerWeek(state, today) {
  const days = daysSinceStart(state, today);
  if (days <= 0) return 0;
  return Number((state.checkins.length / (days / 7)).toFixed(1));
}
