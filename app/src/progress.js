// 进度计算 —— 全是纯函数，不碰 DOM、不碰存储，方便测试。
//
// state 的形状：{ checkins: [{ seq, at }, ...] }
//   - checkins 按「完成的先后顺序」排列
//   - checkins.length 就是「指针」：已经完成了多少次
//   - at 是打卡日期，'YYYY-MM-DD' 字符串
//
// 顺延模型：下一课永远是「计划里的第 (已完成数 + 1) 项」，
// 跟具体哪天、跳过几天、打卡记录里存的是哪个 seq 都无关。

const MS_PER_DAY = 86400000;

export function doneCount(state) {
  return state.checkins.length;
}

export function nextSession(plan, state) {
  const i = state.checkins.length;
  return i < plan.length ? plan[i] : null;
}

export function isComplete(plan, state) {
  return state.checkins.length >= plan.length;
}

export function progressPercent(plan, state) {
  if (plan.length === 0) return 0;
  return Math.round((state.checkins.length / plan.length) * 100);
}

export function currentWeek(plan, state) {
  const next = nextSession(plan, state);
  if (next) return next.week;
  return plan.length ? plan[plan.length - 1].week : 0;
}

// 当前周（= 下一课所在的周）完成了几次、共几次。
export function weekProgress(plan, state) {
  const week = currentWeek(plan, state);
  const inWeek = plan.filter((s) => s.week === week);
  if (inWeek.length === 0) return { week, done: 0, total: 0 };
  const firstSeq = inWeek[0].seq;
  const done = Math.max(0, Math.min(inWeek.length, state.checkins.length - (firstSeq - 1)));
  return { week, done, total: inWeek.length };
}

// 给计划里每一次训练加上状态：done（是否完成）、at（完成日期，未完成为 null）、isNext（是不是下一课）。
// 顺延模型下 checkins[i] 恰好对应 plan[i]，直接按下标配。
export function annotatePlan(plan, state) {
  const done = state.checkins.length;
  return plan.map((s, i) => ({
    ...s,
    done: i < done,
    at: i < done ? state.checkins[i].at : null,
    isNext: i === done,
  }));
}

// 最近完成的 n 次，最新在前。每项带上计划里的信息 + 完成日期。
export function recentCheckins(plan, state, n = 5) {
  const done = state.checkins.length;
  const out = [];
  for (let i = done - 1; i >= 0 && out.length < n; i--) {
    const s = plan[i] || {};
    out.push({ seq: s.seq ?? state.checkins[i].seq, week: s.week ?? null, detail: s.detail ?? '', at: state.checkins[i].at });
  }
  return out;
}

// 按「最近的实际打卡节奏」外推完成日期。数据不足或已完成时返回 null。
export function estimateFinishDate(plan, state, today) {
  const done = state.checkins.length;
  const left = plan.length - done;
  if (left <= 0) return null;
  if (done < 2) return null;

  const first = new Date(state.checkins[0].at);
  const last = new Date(state.checkins[done - 1].at);
  const spanDays = Math.max(1, (last - first) / MS_PER_DAY);
  const perDay = (done - 1) / spanDays;
  if (perDay <= 0) return null;

  const daysLeft = Math.ceil(left / perDay);
  const finish = new Date(today);
  finish.setDate(finish.getDate() + daysLeft);
  return finish.toISOString().slice(0, 10);
}
