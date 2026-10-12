// 家里那对哑铃能拼出哪些重量。
//
// 每只哑铃每边各有 3 片：2 kg、1.5 kg、1.25 kg（两边要对称装）。
// 所以「一只哑铃」的配重 = 2 × (这一边装的片数之和) + 手柄重。
// 手柄重量没称过，做成可设置的（默认 0 = 只算片）。
//
// 档位 level：0 = 空手柄，往上按重量从轻到重排。计划和记录里只存 level，
// 显示时再换算成「每边装哪几片 / 一只多少 kg」。

export const PLATES = [2, 1.5, 1.25];

// 所有「每边装法」：PLATES 的每个子集（含空集），按每边重量排序。
function sideCombos() {
  const out = [];
  for (let mask = 0; mask < 1 << PLATES.length; mask++) {
    const plates = PLATES.filter((_, i) => mask & (1 << i));
    const side = plates.reduce((s, p) => s + p, 0);
    out.push({ plates, side });
  }
  out.sort((a, b) => a.side - b.side);
  return out;
}

export function levels(handleKg = 0) {
  const h = Number.isFinite(handleKg) && handleKg > 0 ? handleKg : 0;
  return sideCombos().map(({ plates, side }, level) => ({
    level,
    plates,
    kg: round2(side * 2 + h),
  }));
}

export const MAX_LEVEL = (1 << PLATES.length) - 1;

export function clampLevel(level) {
  if (!Number.isInteger(level)) return 0;
  return Math.max(0, Math.min(MAX_LEVEL, level));
}

// 「每边 2 + 1.25 · 约 6.5 kg/只」
export function describeLevel(level, handleKg = 0) {
  const lv = levels(handleKg)[clampLevel(level)];
  const side = lv.plates.length ? `每边 ${lv.plates.join(' + ')}` : '空手柄';
  return `${side} · ${handleKg > 0 ? '' : '片重 '}${fmtKg(lv.kg)} kg/只`;
}

export function fmtKg(kg) {
  return String(round2(kg));
}

function round2(x) {
  return Math.round(x * 100) / 100;
}
