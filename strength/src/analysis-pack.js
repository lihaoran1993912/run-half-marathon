// 生成「分析包」：一段纯文本，把计划 + 每个动作的实际重量和次数 + 感受 + 分析要求拼在一起，
// 复制后粘贴给 Claude。App 本身不做分析。纯函数，有测试。

import { EXERCISES, PLAN, TOTAL_WEEKS } from './plan.js';
import { levels, fmtKg } from './gear.js';
import { sessionSummary, painText } from './session.js';

const MS_PER_DAY = 86400000;

export const SCOPES = {
  last: '最近 1 次',
  recent4w: '最近 4 周',
  all: '全部',
};

// 选出要放进分析包的记录下标（按完成顺序，从早到晚）。
export function selectForPack(logs, scope, today) {
  const all = logs.map((_, i) => i);
  if (!all.length) return [];
  if (scope === 'last') return [all.length - 1];
  if (scope === 'recent4w') {
    const t = new Date(today).getTime();
    return all.filter((i) => (t - new Date(logs[i].at).getTime()) / MS_PER_DAY < 28);
  }
  return all;
}

const exName = (ex) => ex.name.replace('（选做）', '');

function itemLine(id, e, planned, handleKg) {
  const ex = EXERCISES[id];
  if (!ex) return null;
  const unit = ex.unit === 'sec' ? '秒' : '个';
  const w = e.level == null ? '徒手' : `${fmtKg(levels(handleKg)[e.level].kg)} kg`;
  const plan = planned ? `计划 ${planned.sets} 组 × ${ex.min}–${ex.max}${ex.each ? ' 每边' : ''}` : '计划外';
  const rir = e.rir == null ? '' : `，最后一组还能做 ${e.rir === 3 ? '3+' : e.rir} 个`;
  return `  - ${exName(ex)}：${w} × ${e.reps.join('/')} ${unit}（${plan}${rir}）`;
}

export function buildPack({ logs, settings = {}, scope = 'recent4w', today, plan = PLAN }) {
  const handleKg = settings.handleKg || 0;
  const done = logs.length;
  const next = done < plan.length ? plan[done] : null;
  const picked = selectForPack(logs, scope, today);
  const out = [];

  out.push('# 哑铃力量训练数据分析请求', '');
  out.push('## 我的基本情况');
  out.push(`- 体重：${settings.bodyKg === undefined ? '未填' : `${settings.bodyKg} kg`}；手柄重量：${settings.handleKg === undefined ? '未称（下面的重量不含手柄）' : `${settings.handleKg} kg`}`);
  out.push('- 器材：家里一对可拆哑铃，每边 2 + 1.5 + 1.25 kg 三片，一只最重约 10 kg');
  out.push('- 同时在练半马（跑一休一），力量放在不跑步的日子，每周 2 次；目标是跑步不受伤 + 塑形');
  out.push('- 左膝以前隐痛过');
  out.push('');

  out.push('## 计划和进度');
  out.push(`- 计划：${TOTAL_WEEKS} 周 / ${plan.length} 次，A、B 课轮换，按顺序做，忙了顺延（不按日历）`);
  out.push('- 四个阶段：适应（1–4 周）→ 建立（5–8）→ 强化（9–12）→ 维持（13–16），第 4/8/12 周减量');
  out.push('- 重量规则：每组都做到区间上限 → 下次加一档；多数组没到下限 → 减一档');
  out.push(`- 进度：已完成 ${done} / ${plan.length} 次`);
  if (next) out.push(`- 下一次：第 ${next.seq} 次 · 第 ${next.week} 周 · ${next.phaseName}${next.deload ? '（减量周）' : ''} · ${next.title}`);
  else out.push(`- ${plan.length} 次已全部完成`);
  out.push('');

  const withSession = picked.filter((i) => logs[i].session).length;
  out.push(`## 训练记录（${SCOPES[scope] || scope}：共 ${picked.length} 次，其中 ${withSession} 次填了感受）`);
  if (!picked.length) out.push('', '这个范围内没有训练记录。');

  for (const i of picked) {
    const l = logs[i];
    const p = plan[l.seq - 1];
    out.push('', `**第 ${l.seq} 次 · ${l.at}**${p ? ` · 第 ${p.week} 周 ${p.phaseName}${p.deload ? '（减量周）' : ''} · ${p.kind} 课` : ''}${l.legLite ? ' · 腿部减量（第二天有强度跑）' : ''}`);
    if (p) out.push(`- 这次要求：每组做完还能再做 ${p.rir} 个左右`);
    out.push('- 动作（重量是一只哑铃的重量，次数是每组实际做的）：');
    for (const [id, e] of Object.entries(l.items)) {
      const planned = p && p.items.find((it) => it.id === id);
      const line = itemLine(id, e, planned, handleKg);
      if (line) out.push(line);
    }
    if (l.session) {
      const summary = sessionSummary(l.session);
      const pain = painText(l.session);
      if (summary) out.push(`- 感受：${summary}`);
      if (pain) out.push(`- 疼痛：${pain}`);
      if (l.session.note) out.push(`- 备注：${l.session.note}`);
    } else {
      out.push('- 只记了动作，没填感受');
    }
  }
  out.push('');

  out.push('## 说明');
  out.push('- 「体感」是 1–10 分的整体吃力程度（1 很轻松，10 拼尽全力）；「疼痛」是 0–10 分（0 不疼）');
  out.push('- 「还能做几个」是每个动作最后一组做完时的自我估计');
  out.push('');

  out.push('## 请帮我分析');
  if (picked.some((i) => logs[i].session?.painScore > 0)) {
    out.push('⚠️ 这段时间有疼痛记录，请优先判断要不要调整或暂停训练（特别是下肢动作）、什么情况该去看医生。');
  }
  out.push('1. 重量合不合适：哪些动作太轻、哪些太重，跟「还能做几个」的要求对不对得上');
  out.push('2. 趋势：重量和次数有没有在涨，有没有停滞或倒退的动作');
  out.push('3. 跟跑步的配合：有没有练太累、影响跑步的信号');
  out.push(next ? `4. 下一次（第 ${next.seq} 次 · ${next.title}）的 1–3 条具体建议` : '4. 接下来保持的 1–3 条具体建议');
  out.push('');
  out.push('请用中文、少用术语，必须用术语时附一句解释。数据不够下结论的地方直接说，不要硬猜。');

  return out.join('\n');
}
