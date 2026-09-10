// 训练计划数据 —— 5 个月 / 20 周 / 共 63 次训练。
//
// 打卡规则（用户定的）：不按日历强制，按顺序完成；忙了就顺延，
// 只要把 63 次训练做完就算达标。所以程序里「进度」= 已完成次数 / 63，
// 「接下来」= 第一个还没打卡的训练。
//
// 每次训练都包含三段：跑前动态伸展 → 主课 → 跑后静态拉伸。
// runMin 是「主课里轻松跑 / 节奏跑 / 心率跑的大致分钟数」，只用来做「累计跑量」这个统计，
// 纯冲刺测试（200 米 / 1600 米）和按公里数、比赛日计的课次记为 null，不进这个统计。

export const WARMUP = '跑前动态伸展';
export const COOLDOWN = '跑后静态拉伸';

// 每个元素是一周。数组顺序 = 周次（第 1 周 … 第 20 周）。
const WEEKS = [
  // ── 第一个月：走跑结合（run-walk） ───────────────────────────
  {
    month: 1, weekOfMonth: 1, phase: '走跑结合', recovery: false,
    focus: '关注跑姿是不是「重力跑」，以及心率有没有保持在轻松跑区间。跑起来心率会缓慢升高，2—3 分钟才到轻松跑强度；不要因为心率上升慢就跑太快，跑到没力气就不是轻松跑了。',
    sessions: [
      { day: '周二', detail: '（轻松跑 4 分钟 + 正常走 1 分钟）× 4', runMin: 16 },
      { day: '周四', detail: '（轻松跑 5 分钟 + 正常走 1 分钟）× 4', runMin: 20 },
      { day: '周六', detail: '（轻松跑 5 分钟 + 正常走 1 分钟）× 5', runMin: 25 },
    ],
  },
  {
    month: 1, weekOfMonth: 2, phase: '走跑结合', recovery: false,
    focus: '单次跑步时间在慢慢加长，仍然关注姿势和心率。',
    sessions: [
      { day: '周二', detail: '（轻松跑 7 分钟 + 正常走 1 分钟）× 3', runMin: 21 },
      { day: '周四', detail: '（轻松跑 8 分钟 + 正常走 1 分钟）× 3', runMin: 24 },
      { day: '周六', detail: '（轻松跑 9 分钟 + 正常走 1 分钟）× 3', runMin: 27 },
    ],
  },
  {
    month: 1, weekOfMonth: 3, phase: '走跑结合', recovery: false,
    focus: '本周是第一个月训练量最高的一周。只要关注点在姿势和心率上，还是能轻松完成。下周是恢复周。',
    sessions: [
      { day: '周二', detail: '（轻松跑 11 分钟 + 正常走 1 分钟）× 2', runMin: 22 },
      { day: '周四', detail: '（轻松跑 13 分钟 + 正常走 1 分钟）× 2', runMin: 26 },
      { day: '周六', detail: '（轻松跑 15 分钟 + 正常走 1 分钟）× 2', runMin: 30 },
    ],
  },
  {
    month: 1, weekOfMonth: 4, phase: '走跑结合', recovery: true,
    focus: '减量、恢复周。前三周完成得很好，这周降低运动量让身体恢复。运动量和上周接近，如果跑起来感觉更轻松，说明身体在进步。',
    sessions: [
      { day: '周二', detail: '（轻松跑 11 分钟 + 正常走 1 分钟）× 2', runMin: 22 },
      { day: '周四', detail: '（轻松跑 12 分钟 + 正常走 1 分钟）× 2', runMin: 24 },
      { day: '周六', detail: '（轻松跑 10 分钟 + 正常走 1 分钟）× 3', runMin: 30 },
    ],
  },

  // ── 第二个月：连续轻松跑 ─────────────────────────────────────
  {
    month: 2, weekOfMonth: 1, phase: '连续轻松跑', recovery: false,
    focus: '本周目标是长时间连续跑，中间不再有走的时间。',
    sessions: [
      { day: '周二', detail: '轻松跑 30 分钟', runMin: 30 },
      { day: '周四', detail: '轻松跑 20 分钟', runMin: 20 },
      { day: '周六', detail: '轻松跑 30 分钟', runMin: 30 },
    ],
  },
  {
    month: 2, weekOfMonth: 2, phase: '连续轻松跑', recovery: false,
    focus: '在姿势和心率的基础上，本周开始关注步频，提高到 170 步/分钟以上，最好 180 左右。重点是「拉起」这个动作的速度，拉起越快，脚落地越轻。',
    sessions: [
      { day: '周二', detail: '轻松跑 30 分钟', runMin: 30 },
      { day: '周四', detail: '轻松跑 30 分钟', runMin: 30 },
      { day: '周六', detail: '轻松跑 40 分钟', runMin: 40 },
    ],
  },
  {
    month: 2, weekOfMonth: 3, phase: '连续轻松跑', recovery: false,
    focus: '本月连续跑时间最长的一周，现在已经可以跑很久、很远了。',
    sessions: [
      { day: '周二', detail: '轻松跑 40 分钟', runMin: 40 },
      { day: '周四', detail: '轻松跑 35 分钟', runMin: 35 },
      { day: '周六', detail: '轻松跑 45 分钟', runMin: 45 },
    ],
  },
  {
    month: 2, weekOfMonth: 4, phase: '连续轻松跑', recovery: true,
    focus: '减量、恢复周。周末有 1 个 200 米计时测试，自己记录下最快速度用时。',
    sessions: [
      { day: '周二', detail: '轻松跑 30 分钟', runMin: 30 },
      { day: '周四', detail: '轻松跑 35 分钟', runMin: 35 },
      { day: '周六', detail: '（200 米最快速度测试）× 2 → 轻松跑 20 分钟', runMin: 20 },
    ],
  },

  // ── 第三个月：间歇跑 / 提速 ─────────────────────────────────
  {
    month: 3, weekOfMonth: 1, phase: '间歇跑', recovery: false,
    focus: '本月开始提速训练，加入间歇跑。每个 200 米跑完，身体恢复后再跑下一个，组间休息 1—3 分钟。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 4 → 轻松跑 10 分钟', runMin: 24 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 5 → 轻松跑 10 分钟', runMin: 25 },
      { day: '周六', detail: '轻松跑 40 分钟', runMin: 40 },
    ],
  },
  {
    month: 3, weekOfMonth: 2, phase: '间歇跑', recovery: false,
    focus: '本周间歇跑强度和上周相同。控制好时间，在「轻松的上限」完成。同样的时间如果感觉更轻松，说明身体在进步。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 4 → 轻松跑 10 分钟', runMin: 24 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 5 → 轻松跑 10 分钟', runMin: 25 },
      { day: '周六', detail: '轻松跑 45 分钟', runMin: 45 },
    ],
  },
  {
    month: 3, weekOfMonth: 3, phase: '间歇跑', recovery: false,
    focus: '本月间歇跑强度最高的一周，还是要控制时间，在轻松的上限完成。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 6 → 轻松跑 5 分钟', runMin: 21 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 6 → 轻松跑 5 分钟', runMin: 21 },
      { day: '周六', detail: '轻松跑 45 分钟', runMin: 45 },
    ],
  },
  {
    month: 3, weekOfMonth: 4, phase: '间歇跑', recovery: true,
    focus: '减量、恢复周。本周有两个测试：200 米看有没有进步；1600 米为下个月的节奏跑配速做准备，记录下用时。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 4 → 轻松跑 10 分钟', runMin: 24 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米最快速度测试）× 5 → 轻松跑 20 分钟', runMin: 30 },
      { day: '周六', detail: '轻松跑 10 分钟 →（1600 米最快速度测试）× 1 → 轻松跑 10 分钟', runMin: 20 },
    ],
  },

  // ── 第四个月：节奏跑（本月训练强度最大，每周 4 练） ──────────
  {
    month: 4, weekOfMonth: 1, phase: '节奏跑', recovery: false,
    focus: '本月开始节奏跑。经过上月的间歇跑，提速会比较轻松。节奏跑看的是能不能长时间把速度维持在对应配速区间。本月强度最大，注意休息和恢复。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（节奏跑 3 分钟）× 6 → 轻松跑 5 分钟', runMin: 33 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 6 → 轻松跑 10 分钟', runMin: 26 },
      { day: '周五', detail: '轻松跑 10 分钟 →（节奏跑 4 分钟）× 5 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周日', detail: '轻松跑 45 分钟', runMin: 45 },
    ],
  },
  {
    month: 4, weekOfMonth: 2, phase: '节奏跑', recovery: false,
    focus: '本周间歇跑强度和上周相同；节奏跑控制好时间，在轻松的上限完成。同样的时间如果感觉更轻松，说明身体在进步。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（节奏跑 4 分钟）× 5 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 6 → 轻松跑 10 分钟', runMin: 26 },
      { day: '周五', detail: '轻松跑 10 分钟 →（节奏跑 4 分钟）× 5', runMin: 30 },
      { day: '周日', detail: '轻松跑 45 分钟', runMin: 45 },
    ],
  },
  {
    month: 4, weekOfMonth: 3, phase: '节奏跑', recovery: false,
    focus: '这几个月里训练强度最高的一周，安排好休息和恢复。下周是休息、恢复周。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（节奏跑 5 分钟）× 4 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 6 → 轻松跑 10 分钟', runMin: 26 },
      { day: '周五', detail: '轻松跑 10 分钟 →（节奏跑 5 分钟）× 4 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周日', detail: '轻松跑 45 分钟', runMin: 45 },
    ],
  },
  {
    month: 4, weekOfMonth: 4, phase: '节奏跑', recovery: true,
    focus: '减量、恢复周。前三周完成得很好，这周降低运动量。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '轻松跑 10 分钟 →（节奏跑 4 分钟）× 5 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周四', detail: '轻松跑 10 分钟 →（200 米间歇跑）× 4 → 轻松跑 10 分钟', runMin: 24 },
      { day: '周日', detail: '轻松跑 50 分钟', runMin: 50 },
    ],
  },

  // ── 第五个月：马拉松心率跑 + 比赛 ──────────────────────────
  {
    month: 5, weekOfMonth: 1, phase: '马拉松心率跑', recovery: false,
    focus: '本周开始「马拉松心率跑」，把心率控制在马拉松心率区间即可。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '马拉松心率跑 40 分钟', runMin: 40 },
      { day: '周四', detail: '轻松跑 10 分钟 →（节奏跑 4 分钟）× 5 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周六', detail: '马拉松心率跑 50 分钟', runMin: 50 },
    ],
  },
  {
    month: 5, weekOfMonth: 2, phase: '马拉松心率跑', recovery: false,
    focus: '马拉松心率跑时间继续增加。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '马拉松心率跑 50 分钟', runMin: 50 },
      { day: '周四', detail: '轻松跑 10 分钟 →（节奏跑 4 分钟）× 5 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周六', detail: '马拉松心率跑 60 分钟', runMin: 60 },
    ],
  },
  {
    month: 5, weekOfMonth: 3, phase: '马拉松心率跑', recovery: false,
    focus: '为准备最后一周的比赛日，本周开始降强度，给身体留出恢复时间。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '马拉松心率跑 40 分钟', runMin: 40 },
      { day: '周四', detail: '轻松跑 10 分钟 →（节奏跑 4 分钟）× 5 → 轻松跑 5 分钟', runMin: 35 },
      { day: '周六', detail: '马拉松心率跑 7 千米', runMin: null },
    ],
  },
  {
    month: 5, weekOfMonth: 4, phase: '减量 + 比赛', recovery: true,
    focus: '训练强度继续降低，比赛日就会有好状态。节奏跑组间休息 1—2 分钟。',
    sessions: [
      { day: '周二', detail: '马拉松心率跑 30 分钟', runMin: 30 },
      { day: '周四', detail: '轻松跑 10 分钟 →（节奏跑 3 分钟）× 5 → 轻松跑 5 分钟', runMin: 30 },
      { day: '周六 / 周日', detail: '比赛日 —— 半程马拉松，享受它！', runMin: null, race: true },
    ],
  },
];

/**
 * 把「按周」的数据摊平成「按次」的有序数组，并补上 seq / warmup / cooldown 等字段。
 * @param {typeof WEEKS} weeks
 * @returns {Array<object>} 每次训练一个对象，seq 从 1 递增
 */
export function buildPlan(weeks = WEEKS) {
  const plan = [];
  let seq = 0;
  weeks.forEach((w, weekIndex) => {
    w.sessions.forEach((s) => {
      seq += 1;
      plan.push({
        seq,
        week: weekIndex + 1,
        month: w.month,
        weekOfMonth: w.weekOfMonth,
        phase: w.phase,
        recovery: w.recovery,
        day: s.day,
        warmup: WARMUP,
        cooldown: COOLDOWN,
        detail: s.detail,
        focus: w.focus,
        runMin: s.runMin ?? null,
        race: s.race === true,
      });
    });
  });
  return plan;
}

export const PLAN = buildPlan();
export const TOTAL_SESSIONS = PLAN.length;
export const TOTAL_WEEKS = WEEKS.length;
