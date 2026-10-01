// 单次跑步的实际数据（从 Apple Watch / 健身 App 里抄过来的 7 项 + 疼痛）。纯函数，有测试。
//
// 一条 run 的形状（每项都可以没有，没填就不出现）：
//   { distKm, durationSec, avgHr, maxHr, cadence, rpe, painScore, painArea, note }
//   distKm      距离，公里，两位小数
//   durationSec 时长，秒
//   avgHr/maxHr 平均 / 最高心率
//   cadence     平均步频（步/分）
//   rpe         体感 1–10（1 = 很轻松，10 = 拼尽全力）
//   painScore   疼痛 0–10（0 = 不疼）
//   painArea    疼痛部位 / 什么时候疼，最多 60 字（如「左膝外侧，跑到第 15 分钟开始」）
//   note        备注，最多 200 字
//
// 表单那一侧全是字符串（时长拆成「分」「秒」两个框，因为 iPhone 数字键盘没有冒号）。

const NOTE_MAX = 200;
const PAIN_AREA_MAX = 60;

// 全角数字 / 中文逗号句号 → 半角，再转数字。空串返回 undefined（= 没填）。
export function readNumber(s) {
  const t = String(s ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[，,。．]/g, '.')
    .trim();
  if (t === '') return undefined;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isIntIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

// 每个字段的合法范围；表单校验和读存储共用一份。
const RULES = {
  distKm: { label: '距离', ok: (v) => inRange(v, 0.01, 60), hint: '0–60 公里' },
  durationSec: { label: '时长', ok: (v) => isIntIn(v, 1, 36000), hint: '大于 0' },
  avgHr: { label: '平均心率', ok: (v) => isIntIn(v, 40, 230), hint: '40–230 的整数' },
  maxHr: { label: '最高心率', ok: (v) => isIntIn(v, 40, 230), hint: '40–230 的整数' },
  cadence: { label: '步频', ok: (v) => isIntIn(v, 100, 250), hint: '100–250 的整数' },
  rpe: { label: '体感', ok: (v) => isIntIn(v, 1, 10), hint: '1–10 的整数' },
  painScore: { label: '疼痛', ok: (v) => isIntIn(v, 0, 10), hint: '0–10 的整数' },
};

// 文本字段：去首尾空格、截长度；空串 = 没填。
const TEXTS = { painArea: PAIN_AREA_MAX, note: NOTE_MAX };
const cleanText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function formToRun(form) {
  const errors = [];
  const run = {};

  const take = (key, raw, transform = (v) => v) => {
    const v = readNumber(raw);
    if (v === undefined) return;
    const val = transform(v);
    if (RULES[key].ok(val)) run[key] = val;
    else errors.push(`${RULES[key].label}填得不对（应为 ${RULES[key].hint}）`);
  };

  take('distKm', form.distKm, (v) => Math.round(v * 100) / 100);

  const min = readNumber(form.durMin);
  const sec = readNumber(form.durSec);
  if (min !== undefined || sec !== undefined) {
    if (min !== undefined && !isIntIn(min, 0, 600)) errors.push('时长的分钟填得不对（应为 0–600 的整数）');
    else if (sec !== undefined && !isIntIn(sec, 0, 59)) errors.push('时长的秒填得不对（应为 0–59 的整数）');
    else {
      const total = (min ?? 0) * 60 + (sec ?? 0);
      if (total > 0) run.durationSec = total;
    }
  }

  take('avgHr', form.avgHr);
  take('maxHr', form.maxHr);
  if (run.avgHr !== undefined && run.maxHr !== undefined && run.maxHr < run.avgHr) {
    errors.push('最高心率不能比平均心率还低');
  }
  take('cadence', form.cadence);
  take('rpe', form.rpe);
  take('painScore', form.painScore);

  for (const [key, max] of Object.entries(TEXTS)) {
    const t = cleanText(String(form[key] ?? ''), max);
    if (t) run[key] = t;
  }

  if (errors.length) return { run: null, errors };
  return { run: Object.keys(run).length ? run : null, errors: [] };
}

// 从存储 / 导入的备份里读回来时用：只留认识且合法的字段，一个都没有就是 null。
export function sanitizeRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const run = {};
  for (const key of Object.keys(RULES)) {
    if (RULES[key].ok(raw[key])) run[key] = raw[key];
  }
  if (run.maxHr !== undefined && run.avgHr !== undefined && run.maxHr < run.avgHr) delete run.maxHr;
  for (const [key, max] of Object.entries(TEXTS)) {
    const t = cleanText(raw[key], max);
    if (t) run[key] = t;
  }
  return Object.keys(run).length ? run : null;
}

// 编辑已有数据时回填表单。
export function runToForm(run) {
  const r = run || {};
  const str = (v) => (v === undefined ? '' : String(v));
  return {
    distKm: str(r.distKm),
    durMin: r.durationSec === undefined ? '' : String(Math.floor(r.durationSec / 60)),
    durSec: r.durationSec === undefined ? '' : String(r.durationSec % 60),
    avgHr: str(r.avgHr),
    maxHr: str(r.maxHr),
    cadence: str(r.cadence),
    rpe: str(r.rpe),
    painScore: str(r.painScore),
    painArea: r.painArea ?? '',
    note: r.note ?? '',
  };
}

export function paceSecPerKm(run) {
  if (!run || !run.distKm || !run.durationSec) return null;
  return run.durationSec / run.distKm;
}

const pad2 = (n) => String(n).padStart(2, '0');

export function formatPace(sec) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}'${pad2(s % 60)}"`;
}

export function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

// 疼痛一行：「左膝外侧 3/10」。疼痛单独显示，不混进 runSummary，免得被一长串数字淹没。
export function painText(run) {
  if (!run) return '';
  const { painScore: s, painArea: a } = run;
  if (s === undefined && !a) return '';
  if (s === 0 && !a) return '不疼（0/10）';
  if (s === undefined) return `${a}（分数未填）`;
  if (!a) return `${s}/10（部位未填）`;
  return `${a} ${s}/10`;
}

// 一行摘要：「3.52 km · 26:10 · 配速 7'26"/km · 心率 148/162 · 步频 168 · 体感 4/10」
export function runSummary(run) {
  if (!run) return '';
  const parts = [];
  if (run.distKm !== undefined) parts.push(`${run.distKm} km`);
  if (run.durationSec !== undefined) parts.push(formatDuration(run.durationSec));
  const pace = paceSecPerKm(run);
  if (pace) parts.push(`配速 ${formatPace(pace)}/km`);
  if (run.avgHr !== undefined && run.maxHr !== undefined) parts.push(`心率 ${run.avgHr}/${run.maxHr}`);
  else if (run.avgHr !== undefined) parts.push(`平均心率 ${run.avgHr}`);
  else if (run.maxHr !== undefined) parts.push(`最高心率 ${run.maxHr}`);
  if (run.cadence !== undefined) parts.push(`步频 ${run.cadence}`);
  if (run.rpe !== undefined) parts.push(`体感 ${run.rpe}/10`);
  return parts.join(' · ');
}
