// 「该备份了吗」的判断 —— 纯函数。
// 输入 store.get() 的快照（含 checkins 和 backup 书签）和今天日期。

const MS_PER_DAY = 86400000;

// 距上次备份，新增了多少次打卡还没备份。
export function unbackedUpCount(snapshot) {
  const done = snapshot.checkins.length;
  const backedUp = (snapshot.backup && snapshot.backup.count) || 0;
  return Math.max(0, done - backedUp);
}

// 距上次备份过了多少天；从没备份过返回 Infinity。
export function daysSinceBackup(snapshot, today) {
  const at = snapshot.backup && snapshot.backup.at;
  if (!at) return Infinity;
  return Math.floor((new Date(today) - new Date(at)) / MS_PER_DAY);
}

// 该不该弹「去备份」提示。
// 规则：有没备份的打卡，且（累计到阈值次数，或距上次备份够久）。
// 「距上次备份够久」只在确实备份过至少一次后才算数——从没备份过就单看次数，避免刚上手就被唠叨。
export function backupDue(snapshot, today, opts = {}) {
  const everyCheckins = opts.everyCheckins ?? 6;
  const everyDays = opts.everyDays ?? 14;

  const pending = unbackedUpCount(snapshot);
  if (pending === 0) return { due: false, pending: 0, reason: '' };

  if (pending >= everyCheckins) return { due: true, pending, reason: 'count' };

  const days = daysSinceBackup(snapshot, today);
  if (days !== Infinity && days >= everyDays) return { due: true, pending, reason: 'days' };

  return { due: false, pending, reason: '' };
}
