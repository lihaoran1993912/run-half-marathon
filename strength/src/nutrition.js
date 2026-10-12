// 蛋白质怎么吃。家里那罐是汤臣倍健金装蛋白粉：大豆分离蛋白，标称蛋白质含量 83%。
//
// - 一边跑半马一边练力量：每天每公斤体重 1.4–1.6 g 蛋白质（先靠正常吃饭，蛋白粉补缺口）
// - 单次 20–30 g 蛋白质最划算；大豆蛋白亮氨酸略少，取这个区间的上半段
// - 练完 2 小时内或早餐吃一次都行，「练完必须 30 分钟内」是过时的说法

export const POWDER_PROTEIN_RATIO = 0.83;

export function proteinTarget(bodyKg) {
  if (!Number.isFinite(bodyKg) || bodyKg <= 0) return null;
  return { low: Math.round(bodyKg * 1.4), high: Math.round(bodyKg * 1.6) };
}

// 想补 proteinG 克蛋白质，需要多少克粉（取整到 5 g，方便用勺子量）。
export function powderFor(proteinG, ratio = POWDER_PROTEIN_RATIO) {
  return Math.round(proteinG / ratio / 5) * 5;
}
