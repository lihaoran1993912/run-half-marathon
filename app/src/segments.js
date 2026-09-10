// 把一次训练的文字（plan.js 里的 detail）解析成「能自动计时的段落」。
//
// 只有两种情形能干净地自动计时：
//   runwalk —— （X跑 a 分钟 + Y走 b 分钟）× n     （走跑结合，跑和走都写死了时间）
//   single  —— 单段「…… c 分钟」的连续跑
// 其它（节奏跑/间歇跑的组间休息计划只写了「1—2 分钟」没定死、200 米按距离、
// 按公里、比赛日）一律 freeform：计时器不自动跑，让用户照文字来 / 当秒表用。

const RUNWALK = /^（\s*(.+?)\s*(\d+)\s*分钟\s*\+\s*(.+?)\s*(\d+)\s*分钟\s*）\s*×\s*(\d+)\s*$/;
const SINGLE = /^([^（）×→]+?)\s*(\d+)\s*分钟\s*$/;

function kindOf(label) {
  if (/走/.test(label)) return 'walk';
  return 'run';
}

export function parseSession(detail) {
  const text = String(detail).trim();

  const rw = text.match(RUNWALK);
  if (rw) {
    const work = { label: rw[1].trim(), kind: kindOf(rw[1]), sec: Number(rw[2]) * 60 };
    const rest = { label: rw[3].trim(), kind: kindOf(rw[3]), sec: Number(rw[4]) * 60 };
    const reps = Number(rw[5]);
    const segments = [];
    for (let i = 0; i < reps; i++) segments.push({ ...work }, { ...rest });
    return { type: 'runwalk', reps, work, rest, segments };
  }

  const sg = text.match(SINGLE);
  if (sg) {
    return {
      type: 'single',
      segments: [{ label: sg[1].trim(), kind: kindOf(sg[1]), sec: Number(sg[2]) * 60 }],
    };
  }

  return { type: 'freeform', reason: '含按距离 / 自定义组间休息 / 比赛日的部分，不适合自动计时' };
}
