// 「该备份了吗」的判断 —— 纯函数（照搬半马 App，阈值按每周 2 次调小）。
// 输入 store.get() 的快照（含 logs 和 backup 书签）和今天日期。

const MS_PER_DAY = 86400000;

// 规则：有没备份的训练，且（累计到 4 次 = 大约两周，或距上次备份满 14 天）。
// 「满 14 天」只在备份过至少一次后才算——从没备份过就单看次数，免得刚上手就被唠叨。
export function backupDue(snapshot, today, { everyLogs = 4, everyDays = 14 } = {}) {
  const b = snapshot.backup || {};
  const pending = Math.max(0, snapshot.logs.length - (b.count || 0));
  if (pending === 0) return { due: false, pending: 0, reason: '' };
  if (pending >= everyLogs) return { due: true, pending, reason: 'count' };
  if (b.at && Math.floor((new Date(today) - new Date(b.at)) / MS_PER_DAY) >= everyDays) {
    return { due: true, pending, reason: 'days' };
  }
  return { due: false, pending, reason: '' };
}
