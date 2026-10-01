// 个人基本信息（只填一次，生成分析包时带上）。纯函数，有测试。
//
// 形状（每项都可以没有）：
//   { age, restHr, easyLow, easyHigh, maxHr, heightCm, weightKg, altitudeM, injuries }
//   easyLow/easyHigh —— 轻松跑心率区间（用户按书里公式算的）
//   maxHr            —— 实测最大心率，没测过就不填
//   altitudeM        —— 常住 / 常跑地点的海拔（米）；高海拔下同样配速心率会更高

import { readNumber } from './runlog.js';

const isIntIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const inRange = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

const RULES = {
  age: { label: '年龄', ok: (v) => isIntIn(v, 10, 100), hint: '10–100 的整数' },
  restHr: { label: '静息心率', ok: (v) => isIntIn(v, 30, 120), hint: '30–120 的整数' },
  easyLow: { label: '区间下限', ok: (v) => isIntIn(v, 60, 230), hint: '60–230 的整数' },
  easyHigh: { label: '区间上限', ok: (v) => isIntIn(v, 60, 230), hint: '60–230 的整数' },
  maxHr: { label: '最大心率', ok: (v) => isIntIn(v, 100, 230), hint: '100–230 的整数' },
  heightCm: { label: '身高', ok: (v) => inRange(v, 100, 250), hint: '100–250 厘米' },
  weightKg: { label: '体重', ok: (v) => inRange(v, 25, 250), hint: '25–250 公斤' },
  altitudeM: { label: '常住海拔', ok: (v) => isIntIn(v, 0, 6000), hint: '0–6000 米的整数' },
};
const NUM_KEYS = Object.keys(RULES);
const TEXT_MAX = 200;

const rangeFlipped = (p) => p.easyLow !== undefined && p.easyHigh !== undefined && p.easyLow >= p.easyHigh;

export function formToProfile(form) {
  const errors = [];
  const profile = {};
  for (const key of NUM_KEYS) {
    const v = readNumber(form[key]);
    if (v === undefined) continue;
    if (RULES[key].ok(v)) profile[key] = v;
    else errors.push(`${RULES[key].label}填得不对（应为 ${RULES[key].hint}）`);
  }
  if (rangeFlipped(profile)) errors.push('轻松跑心率区间的下限要比上限小');
  const injuries = String(form.injuries ?? '').trim().slice(0, TEXT_MAX);
  if (injuries) profile.injuries = injuries;
  return errors.length ? { profile: null, errors } : { profile, errors: [] };
}

export function sanitizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const p = {};
  for (const key of NUM_KEYS) if (RULES[key].ok(raw[key])) p[key] = raw[key];
  if (rangeFlipped(p)) { delete p.easyLow; delete p.easyHigh; }
  if (typeof raw.injuries === 'string' && raw.injuries.trim()) p.injuries = raw.injuries.trim().slice(0, TEXT_MAX);
  return p;
}

export function profileToForm(p) {
  const form = {};
  for (const key of NUM_KEYS) form[key] = p && p[key] !== undefined ? String(p[key]) : '';
  form.injuries = (p && p.injuries) || '';
  return form;
}
