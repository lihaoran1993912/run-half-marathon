// 生成「分析包」：一段纯文本，把计划课表 + 实际跑步数据 + 个人信息 + 分析要求拼在一起，
// 用户复制后粘贴给 Claude（可以再附几张健身 App 截图）。App 本身不做分析。纯函数，有测试。

import { runSummary, painText } from './runlog.js';

const MS_PER_DAY = 86400000;
const HIGH_ALTITUDE_M = 1500; // 一般认为 1500 米以上，海拔对心率 / 配速的影响就比较明显了

export const SCOPES = {
  last: '最近 1 次',
  recent4w: '最近 4 周',
  all: '全部',
};

// 选出要放进分析包的打卡下标（按完成顺序，从早到晚）。
export function selectForPack(state, scope, today) {
  const n = state.checkins.length;
  if (n === 0) return [];
  if (scope === 'last') return [n - 1];
  const all = state.checkins.map((_, i) => i);
  if (scope === 'recent4w') {
    const t = new Date(today).getTime();
    return all.filter((i) => (t - new Date(state.checkins[i].at).getTime()) / MS_PER_DAY < 28);
  }
  return all;
}

const isRunWalk = (s) => /正常走/.test(s.detail);

function profileLines(p) {
  const v = (x, unit = '') => (x === undefined ? '未填' : `${x}${unit}`);
  const zone = p.easyLow !== undefined && p.easyHigh !== undefined ? `${p.easyLow}–${p.easyHigh}（按书里公式算的）` : '未填';
  return [
    `- 年龄：${p.age === undefined ? '未填' : `${p.age} 岁`}；身高：${v(p.heightCm, ' cm')}；体重：${v(p.weightKg, ' kg')}`,
    `- 静息心率 ${v(p.restHr)}；轻松跑心率区间：${zone}`,
    `- 最大心率：${p.maxHr === undefined ? '未实测' : p.maxHr}`,
    `- 常住海拔：${p.altitudeM === undefined ? '未填' : `约 ${p.altitudeM} 米`}`,
    `- 伤病史：${p.injuries || '未填'}`,
  ];
}

export function buildPack({ plan, state, profile = {}, scope = 'recent4w', today }) {
  const done = state.checkins.length;
  const next = done < plan.length ? plan[done] : null;
  const picked = selectForPack(state, scope, today);
  const out = [];

  out.push('# 半马训练数据分析请求', '');
  out.push('## 我的基本信息', ...profileLines(profile), '');

  out.push('## 训练计划和进度');
  out.push(`- 计划：得到 App 的 20 周半马训练计划，共 ${plan.length} 次课，按顺序完成，忙了就顺延（不按日历）`);
  out.push(`- 进度：已完成 ${done} / ${plan.length} 次`);
  if (next) out.push(`- 下一次：第 ${next.seq} 次 · 第 ${next.week} 周 · ${next.phase}${next.recovery ? '（减量/恢复周）' : ''} · ${next.detail}`);
  else out.push(`- ${plan.length} 次已全部完成`);
  out.push('- 数据来源：Apple Watch，从健身 App 抄录；每次课前有动态伸展、课后有静态拉伸（不计入数据）');
  out.push('');

  const withData = picked.filter((i) => state.checkins[i].run).length;
  out.push(`## 训练记录（${SCOPES[scope] || scope}：共 ${picked.length} 次，其中 ${withData} 次有数据）`);
  if (picked.length === 0) out.push('', '这个范围内没有打卡记录。');

  let lastWeek = null;
  for (const i of picked) {
    const c = state.checkins[i];
    const s = plan[i] || { seq: c.seq, week: null, phase: '', detail: '' };
    if (s.week !== lastWeek) {
      out.push('', `### 第 ${s.week} 周${s.recovery ? '（减量/恢复周）' : ''} · ${s.phase}`);
      if (s.focus) out.push(`教练的话：${s.focus}`);
      lastWeek = s.week;
    }
    out.push('', `**第 ${s.seq} 次 · ${c.at}**`);
    out.push(`- 计划：${s.detail}${s.runMin ? `（计划跑 ${s.runMin} 分钟）` : ''}`);
    if (c.run) {
      const summary = runSummary(c.run);
      const { note } = c.run;
      const pain = painText(c.run);
      if (summary) out.push(`- 实际：${summary}`);
      if (pain) out.push(`- 疼痛：${pain}`);
      if (note) out.push(`- 备注：${note}`);
    } else {
      out.push('- 实际：只打了卡，没有记录数据');
    }
  }
  out.push('');

  out.push('## 说明');
  out.push('- 「体感」是 1–10 分的主观吃力程度（1 很轻松，10 拼尽全力）；「疼痛」是 0–10 分（0 不疼）');
  if (profile.altitudeM >= HIGH_ALTITUDE_M) {
    out.push(`- 我在高海拔（约 ${profile.altitudeM} 米）跑步，同样配速下心率会比平原高、配速会偏慢`);
  }
  if (picked.some((i) => plan[i] && isRunWalk(plan[i]))) {
    out.push('- 走跑结合的课，手表记录的平均心率和配速包含了走路的时间，比纯跑段要低/慢');
  }
  out.push('- 我可能会另外附上健身 App 截图（每公里分段配速、心率区间分布、心率曲线），请结合起来看');
  out.push('');

  out.push('## 请帮我分析');
  if (picked.some((i) => state.checkins[i].run?.painScore > 0)) {
    out.push('⚠️ 这段时间有疼痛记录，请优先判断要不要调整或暂停训练、什么情况该去看医生。');
  }
  out.push('1. 计划执行：实际做的和计划的差距（时长、走跑比例、心率是否在轻松跑区间、节奏跑/间歇跑强度是否到位）');
  out.push('2. 趋势：跨周看，同样配速下心率有没有下降、恢复周有没有真的减量、体感有没有变轻松');
  out.push('3. 风险信号：配速太快、心率太高、连续疲劳、受伤苗头');
  out.push(next
    ? `4. 下一次（第 ${next.seq} 次：${next.detail}）的 1–3 条具体建议`
    : '4. 接下来恢复和保持状态的 1–3 条具体建议');
  out.push('');
  out.push('请用中文、少用术语，必须用术语时附一句解释。数据不够下结论的地方直接说，不要硬猜。');

  return out.join('\n');
}
