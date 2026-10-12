// 一次力量训练的整体感受（跟跑步 App 的「跑步数据」一个思路）。纯函数，有测试。
//
// session 的形状（每项都可以没有，没填就不出现）：
//   { minutes, rpe, painScore, painArea, note }
//   minutes   用时，分钟（热身到拉伸完）
//   rpe       体感 1–10（1 = 很轻松，10 = 拼尽全力）
//   painScore 疼痛 0–10（0 = 不疼）
//   painArea  疼痛部位 / 哪个动作疼，最多 60 字
//   note      备注，最多 200 字

const TEXTS = { painArea: 60, note: 200 };

const isIntIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

const RULES = {
  minutes: { label: '用时', ok: (v) => isIntIn(v, 1, 300), hint: '1–300 的整数' },
  rpe: { label: '体感', ok: (v) => isIntIn(v, 1, 10), hint: '1–10 的整数' },
  painScore: { label: '疼痛', ok: (v) => isIntIn(v, 0, 10), hint: '0–10 的整数' },
};

// 全角数字 / 中文句号 → 半角，再转数字。空串返回 undefined（= 没填）。
export function readNumber(s) {
  const t = String(s ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,。．]/g, '.')
    .trim();
  if (t === '') return undefined;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function formToSession(form) {
  const errors = [];
  const session = {};
  for (const [key, rule] of Object.entries(RULES)) {
    const v = readNumber(form[key]);
    if (v === undefined) continue;
    if (rule.ok(v)) session[key] = v;
    else errors.push(`${rule.label}填得不对（应为 ${rule.hint}）`);
  }
  for (const [key, max] of Object.entries(TEXTS)) {
    const t = cleanText(String(form[key] ?? ''), max);
    if (t) session[key] = t;
  }
  if (errors.length) return { session: null, errors };
  return { session: Object.keys(session).length ? session : null, errors: [] };
}

// 从存储 / 导入的备份里读回来时用：只留认识且合法的字段，一个都没有就是 null。
export function sanitizeSession(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const session = {};
  for (const [key, rule] of Object.entries(RULES)) {
    if (rule.ok(raw[key])) session[key] = raw[key];
  }
  for (const [key, max] of Object.entries(TEXTS)) {
    const t = cleanText(raw[key], max);
    if (t) session[key] = t;
  }
  return Object.keys(session).length ? session : null;
}

// 编辑已有数据时回填表单。
export function sessionToForm(session) {
  const s = session || {};
  const str = (v) => (v === undefined ? '' : String(v));
  return {
    minutes: str(s.minutes),
    rpe: str(s.rpe),
    painScore: str(s.painScore),
    painArea: s.painArea ?? '',
    note: s.note ?? '',
  };
}

// 一行摘要：「用时 38 分钟 · 体感 6/10」
export function sessionSummary(session) {
  if (!session) return '';
  const parts = [];
  if (session.minutes !== undefined) parts.push(`用时 ${session.minutes} 分钟`);
  if (session.rpe !== undefined) parts.push(`体感 ${session.rpe}/10`);
  return parts.join(' · ');
}

// 疼痛一行：「左膝外侧 2/10」。单独显示，免得被淹没。
export function painText(session) {
  if (!session) return '';
  const { painScore: s, painArea: a } = session;
  if (s === undefined && !a) return '';
  if (s === 0 && !a) return '不疼（0/10）';
  if (s === undefined) return `${a}（分数未填）`;
  if (!a) return `${s}/10（部位未填）`;
  return `${a} ${s}/10`;
}
