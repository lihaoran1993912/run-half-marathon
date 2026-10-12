// 哑铃力量训练计划 —— 16 周 / 每周 2 次（A、B 轮换）/ 共 32 次。
//
// 跟半马打卡一样：不按日历，按顺序做，忙了顺延；next = PLAN[已完成次数]。
// 放在「不跑步的那天」做；第二天如果是间歇 / 节奏 / 长距离，就打开「腿部减量」。
//
// 设计依据（写给以后的自己）：
// - 增肌对次数不挑：每组 6–30 次只要接近力竭，效果差不多。家里哑铃最重一只约 10 kg，
//   所以下肢走「多次数 + 单腿动作 + 放慢节奏」的路子，而不是追大重量。
// - RIR =「这组做完还能再做几个」。新手从 3 开始，逐步逼近 1。
// - 双重递进：同一重量先把次数做到区间上限，再加一档重量、次数回到下限。
// - 每 4 周一次减量周，跟跑步计划的恢复周节奏一致。
// - 跑者重点：单腿稳定（后撤步、单腿硬拉）、小腿跟腱（提踵）、核心抗旋转（死虫、侧平板）。

// ── 动作库 ──────────────────────────────────────────────
// load: 'one' 一只哑铃 / 'two' 两只 / 'bw' 徒手
// unit: 'reps' 个 / 'sec' 秒；each: 左右各做一遍
// start: 第一次建议的档位（gear.js 的 level），rest: 组间休息秒数
export const EXERCISES = {
  goblet: {
    name: '高脚杯深蹲', region: 'leg', load: 'one', unit: 'reps', each: false,
    min: 10, max: 20, rest: 90, start: 5,
    cues: [
      '双手竖着捧住一只哑铃的一端，贴在胸前',
      '脚略宽于肩、脚尖微微朝外',
      '屁股往后往下坐，膝盖和脚尖同一个方向，不往里扣',
      '蹲到大腿接近水平（在不疼的范围内），脚跟踩实站起',
    ],
    knee: '膝盖不舒服：身后放把椅子，坐到椅子上再站起来，只做不疼的深度',
    maxTip: '已经是最重档：改成两手各握一只放在肩前（双哑铃前蹲），或下蹲用 3 秒、底部停 1 秒',
  },
  rdl: {
    name: '哑铃罗马尼亚硬拉', region: 'leg', load: 'two', unit: 'reps', each: false,
    min: 10, max: 15, rest: 90, start: 6,
    cues: [
      '两手各握一只哑铃，垂在大腿前',
      '膝盖微屈后就固定住，全程不再弯更多',
      '屁股往后推，哑铃贴着腿往下滑到小腿中段，背始终平直',
      '大腿后侧有明显拉伸感后，夹紧屁股站直',
    ],
    knee: '这个动作膝盖基本不受力；腰不舒服就缩小幅度、哑铃只放到膝盖下方',
    maxTip: '已经是最重档：下放用 3 秒，或换成单腿版本',
  },
  floorpress: {
    name: '地板卧推', region: 'upper', load: 'two', unit: 'reps', each: false,
    min: 8, max: 15, rest: 75, start: 5,
    cues: [
      '仰卧屈膝，两手各握哑铃举在胸口上方',
      '慢慢放下，大臂碰到地面时停一下',
      '手肘和身体夹角约 45°，不要张成「T」字',
      '推起时呼气',
    ],
    maxTip: '已经是最重档：大臂贴地停 2 秒再推，或做完后补一组俯卧撑',
  },
  row: {
    name: '单臂哑铃划船', region: 'upper', load: 'one', unit: 'reps', each: true,
    min: 8, max: 15, rest: 60, start: 7,
    cues: [
      '一手一膝撑在椅子或床边，背放平',
      '把哑铃往髋部方向拉，手肘贴着身体走',
      '顶端夹一下肩胛骨、停 1 秒，再慢慢放下',
    ],
    maxTip: '已经是最重档：顶端停 2 秒、下放 3 秒',
  },
  calf: {
    name: '单腿提踵', region: 'leg', load: 'one', unit: 'reps', each: true,
    min: 12, max: 20, rest: 45, start: 3,
    cues: [
      '单脚前脚掌站在台阶边，同侧手拿哑铃，另一手扶墙',
      '膝盖伸直，脚跟尽量抬高，顶端停 1 秒',
      '慢慢放下，让脚跟低于台阶，小腿有拉伸感',
      '跑者重点动作：练小腿和跟腱的耐受力',
    ],
    maxTip: '已经是最重档：顶端停 2 秒、下放 3 秒',
  },
  deadbug: {
    name: '死虫', region: 'core', load: 'bw', unit: 'reps', each: true,
    min: 6, max: 12, rest: 45, start: 0,
    cues: [
      '仰卧，手臂朝天，屈髋屈膝成 90°',
      '腰背压实地面，全程不离开',
      '对侧手脚慢慢伸远，呼气，收回来换另一侧',
    ],
    maxTip: '做到上限了：双手捧一只哑铃朝天做，或伸出去后停 2 秒',
  },
  lunge: {
    name: '后撤步弓步', region: 'leg', load: 'two', unit: 'reps', each: true,
    min: 8, max: 15, rest: 90, start: 4,
    cues: [
      '两手各握一只哑铃，垂在身体两侧',
      '一脚向后撤一大步，后膝向下接近地面',
      '前脚全脚掌踩实，前膝对准脚尖，不往里扣',
      '用前脚发力站回原位',
    ],
    knee: '后撤步本来就比向前弓步对膝盖友好；还不舒服就缩小下蹲幅度',
    maxTip: '已经是最重档：改成保加利亚分腿蹲（后脚搭在椅子上）',
  },
  slrdl: {
    name: '单腿罗马尼亚硬拉', region: 'leg', load: 'one', unit: 'reps', each: true,
    min: 8, max: 12, rest: 60, start: 3,
    cues: [
      '支撑腿膝盖微屈；支撑腿的对侧手拿哑铃',
      '上身前倾、另一条腿向后抬，身体像跷跷板一样成一条线',
      '髋部保持水平，不往外翻',
      '站不稳可以用空手扶墙，练的是臀部，不是平衡表演',
    ],
    maxTip: '已经是最重档：下放 3 秒，或底部停 1 秒',
  },
  ohp: {
    name: '站姿哑铃推举', region: 'upper', load: 'two', unit: 'reps', each: false,
    min: 8, max: 15, rest: 75, start: 3,
    cues: [
      '收紧肚子和屁股，身体不往后仰',
      '哑铃从肩膀推到头顶，手臂伸直',
      '慢慢落回肩膀高度',
    ],
    maxTip: '已经是最重档：改成单臂推举，或下放用 3 秒',
  },
  bentrow: {
    name: '俯身双臂划船', region: 'upper', load: 'two', unit: 'reps', each: false,
    min: 10, max: 15, rest: 60, start: 5,
    cues: [
      '两手各握哑铃，屈髋上身前倾约 45°，背平',
      '两只哑铃往肚脐方向拉，手肘向后',
      '顶端夹肩胛骨，慢放',
    ],
    maxTip: '已经是最重档：顶端停 2 秒、下放 3 秒',
  },
  sideplank: {
    name: '侧平板支撑', region: 'core', load: 'bw', unit: 'sec', each: true,
    min: 20, max: 45, rest: 30, start: 0,
    cues: [
      '手肘撑在肩膀正下方',
      '从头到脚一条直线，髋部不往下掉',
      '正常呼吸，不憋气',
    ],
    maxTip: '做到上限了：上面那条腿抬起来，或改成侧平板上下抬髋',
  },
  lateral: {
    name: '侧平举（选做）', region: 'upper', load: 'two', unit: 'reps', each: false,
    min: 12, max: 20, rest: 45, start: 1,
    cues: [
      '手肘微屈，向两侧抬到和肩同高',
      '不耸肩，用肩膀而不是甩身体',
      '慢慢放下：让肩膀看起来更宽、更有线条',
    ],
    maxTip: '已经是最重档：顶端停 1 秒，下放 3 秒',
  },
  curl: {
    name: '锤式弯举（选做）', region: 'upper', load: 'two', unit: 'reps', each: false,
    min: 10, max: 15, rest: 45, start: 3,
    cues: [
      '掌心相对握住哑铃',
      '大臂贴着身体不动，只弯小臂',
      '慢慢放下，不甩',
    ],
    maxTip: '已经是最重档：下放用 3 秒',
  },
};

export const WARMUP = [
  '原地踏步或开合跳 2 分钟',
  '徒手臀桥 × 10',
  '徒手深蹲 × 10（慢）',
  '后撤步 每边 × 5',
  '手臂绕环、扩胸 各 10 次',
];

export const COOLDOWN = '练完拉伸 5 分钟：大腿前侧、大腿后侧、小腿、胸口各 30 秒';

const A = ['goblet', 'rdl', 'floorpress', 'row', 'calf', 'deadbug'];
const B = ['lunge', 'slrdl', 'ohp', 'bentrow', 'calf', 'sideplank'];
const ADDON = { A: 'lateral', B: 'curl' };

export const PHASES = [
  {
    id: 1, name: '适应期', weeks: [1, 4], sets: 2, rir: 3,
    note: '学动作、找重量。每组做完「还能再做 3 个左右」就停。肌肉酸胀正常；关节疼不正常，要停。',
  },
  {
    id: 2, name: '建立期', weeks: [5, 8], sets: 3, rir: 2,
    note: '每组做到「还剩 2 个左右」。同一重量每组都做到上限，下次就加一档。',
  },
  {
    id: 3, name: '强化期', weeks: [9, 12], sets: 3, rir: 1,
    note: '每组做到「还剩 1–2 个」，最后一组最接近做不动——这是真正长肌肉、出线条的阶段。',
  },
  {
    id: 4, name: '维持期', weeks: [13, 16], sets: 2, rir: 2,
    note: '跑步进入节奏跑、心率跑，跑量最大。力量只求维持：组数减少、重量不降，别把腿练累。',
  },
];

export const TOTAL_WEEKS = 16;

export function phaseOf(week) {
  return PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]);
}

export function buildPlan() {
  const plan = [];
  let seq = 0;
  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    const phase = phaseOf(week);
    const deload = week % 4 === 0 && week !== TOTAL_WEEKS;
    const raceWeek = week === TOTAL_WEEKS;
    for (const kind of ['A', 'B']) {
      seq++;
      let sets = phase.sets;
      let rir = phase.rir;
      if (deload) { sets = Math.max(1, sets - 1); rir = 3; }
      const ids = [...(kind === 'A' ? A : B)];
      if (phase.id >= 2 && !deload && !raceWeek) ids.push(ADDON[kind]);
      let items = ids.map((id) => ({ id, sets }));
      let note = phase.note;
      if (deload) note = '减量周：组数少一组、重量不加，让身体吸收前三周的训练。跟跑步的恢复周同步。';
      if (raceWeek) {
        items = items.filter((it) => EXERCISES[it.id].region !== 'leg');
        note = '赛前一周：下肢全部不练，上肢和核心轻松做，留着腿去比赛。';
      }
      plan.push({
        seq, week, kind, phase: phase.id, phaseName: phase.name, deload, raceWeek, rir, note,
        title: kind === 'A' ? 'A 课 · 深蹲 + 硬拉 + 卧推 + 划船' : 'B 课 · 单腿 + 推举 + 划船',
        items,
      });
    }
  }
  return plan;
}

export const PLAN = buildPlan();

// 「明天有间歇 / 节奏 / 长距离跑」时打开：下肢每个动作少做一组（至少留 1 组）。
export function applyLegLite(items, on) {
  if (!on) return items.map((it) => ({ ...it }));
  return items.map((it) =>
    EXERCISES[it.id].region === 'leg' ? { ...it, sets: Math.max(1, it.sets - 1) } : { ...it },
  );
}
