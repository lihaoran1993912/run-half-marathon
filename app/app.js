// 浏览器入口。这里只做两件事：把数据渲染成页面、把点击接到 store 上。
// 所有「算」的逻辑都在 src/ 里，并且有测试；这个文件故意保持薄。

import { PLAN, TOTAL_SESSIONS, TOTAL_WEEKS } from './src/plan.js';
import {
  nextSession, isComplete, progressPercent, doneCount,
  weekProgress, estimateFinishDate, annotatePlan, recentCheckins,
} from './src/progress.js';
import {
  completedRunMinutes, totalRunMinutes,
  checkinsInLastDays, avgPerWeek,
} from './src/stats.js';
import { createStore } from './src/store.js';
import { backupDue } from './src/backup.js';

const store = createStore(window.localStorage);
const $ = (id) => document.getElementById(id);
const todayStr = () => new Date().toLocaleDateString('sv-SE'); // 'YYYY-MM-DD' 本地时区

function fmtDate(s) {
  if (!s) return '—';
  const [y, m, d] = s.split('-');
  return `${y}年${+m}月${+d}日`;
}

function fmtShort(s) {
  if (!s) return '';
  const [, m, d] = s.split('-');
  return `${+m}/${+d}`;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1600);
}

function render() {
  const state = store.get();
  const done = doneCount(state);
  const pct = progressPercent(PLAN, state);
  const complete = isComplete(PLAN, state);

  // 顶部进度条
  $('barFill').style.width = pct + '%';
  $('barDone').textContent = `${done} / ${TOTAL_SESSIONS} 次`;
  $('barPct').textContent = pct + '%';

  // 「接下来」卡片
  const card = $('nextCard');
  if (complete) {
    card.innerHTML = `
      <div class="done-banner">
        <div class="big">🎉</div>
        <div class="txt">63 次训练全部完成，去比赛吧！</div>
      </div>`;
  } else {
    const s = nextSession(PLAN, state);
    const wp = weekProgress(PLAN, state);
    card.innerHTML = `
      <div class="tag-row">
        <span class="tag">第 ${s.month} 月 · ${s.phase}</span>
        <span class="tag plain">第 ${s.week} / ${TOTAL_WEEKS} 周（本周 ${wp.done}/${wp.total}）</span>
        ${s.recovery ? '<span class="tag rest">减量 / 恢复</span>' : ''}
      </div>
      <div class="next-head">接下来 · 第 ${s.seq} 次（计划里标注为 ${esc(s.day)}）</div>
      <div class="next-detail">${esc(s.detail)}</div>
      <div class="wc"><span>热身</span><span>${esc(s.warmup)}</span></div>
      <div class="wc"><span>放松</span><span>${esc(s.cooldown)}</span></div>
      <div class="focus"><b>教练的话：</b>${esc(s.focus)}</div>
      <div class="check-row">
        <input type="date" id="ciDate" value="${todayStr()}" max="${todayStr()}" aria-label="打卡日期">
        <button class="btn" id="ciBtn">完成打卡</button>
      </div>
      ${done > 0 ? '<button class="undo" id="undoBtn">↩ 撤销上一次打卡</button>' : ''}
    `;
    $('ciBtn').onclick = () => {
      $('ciBtn').disabled = true; // 防手抖连点两下多打一次
      const at = $('ciDate').value || todayStr();
      store.checkIn(nextSession(PLAN, store.get()).seq, at);
      render();
      toast('已打卡 ✓');
    };
    if ($('undoBtn')) $('undoBtn').onclick = () => {
      store.undoLast();
      render();
      toast('已撤销');
    };
  }

  // 统计
  const ranDone = completedRunMinutes(PLAN, state);
  const ranTotal = totalRunMinutes(PLAN);
  const finish = estimateFinishDate(PLAN, state, todayStr());
  const small = 'font-size:13px;color:var(--ink-faint)';
  $('stats').innerHTML = `
    <div class="stat"><div class="n">${done}<span style="${small}"> / ${TOTAL_SESSIONS}</span></div><div class="k">已完成训练</div></div>
    <div class="stat"><div class="n">${TOTAL_SESSIONS - done}</div><div class="k">还剩几次</div></div>
    <div class="stat"><div class="n">${checkinsInLastDays(state, todayStr(), 7)}</div><div class="k">近 7 天打卡</div></div>
    <div class="stat"><div class="n">${avgPerWeek(state, todayStr()) || 0}</div><div class="k">平均每周次数</div></div>
    <div class="stat"><div class="n">${Math.round(ranDone / 60)}<span style="${small}"> / ${Math.round(ranTotal / 60)} 小时</span></div><div class="k">累计跑量（估算）</div></div>
    <div class="stat"><div class="n" style="font-size:14px;font-weight:600">${finish ? fmtDate(finish) : '再打几次卡'}</div><div class="k">按当前节奏预计完成</div></div>
  `;

  renderRecent(state);
  renderBackup(state);
  renderWeeks(state);
}

function renderBackup(state) {
  const b = state.backup || { at: null, count: 0 };
  $('backupStatus').textContent = b.at
    ? `上次备份：${fmtDate(b.at)}（当时 ${b.count} 次）`
    : '还没备份过';

  const due = backupDue(state, todayStr());
  const nudge = $('backupNudge');
  if (due.due) {
    $('backupNudgeText').textContent = `有 ${due.pending} 次打卡还没备份，存一份免得丢`;
    nudge.hidden = false;
  } else {
    nudge.hidden = true;
  }
}

// 打开分享面板保存备份；不支持分享就退回复制 / 选中。成功后记下备份书签。
async function saveBackup() {
  const text = store.exportJson();
  $('backupBox').value = text;
  try {
    if (navigator.share) {
      await navigator.share({ title: '半马打卡备份', text });
      toast('已发起保存');
      store.markBackedUp(todayStr());
      render();
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // 用户取消，不算备份
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制备份文本，粘到备忘录里存好');
  } catch {
    $('backupBox').select();
    toast('已选中备份文本，请长按复制保存');
  }
  store.markBackedUp(todayStr());
  render();
}

function renderRecent(state) {
  const list = recentCheckins(PLAN, state, 5);
  const card = $('recentCard');
  if (list.length === 0) {
    card.hidden = true;
    return;
  }
  card.hidden = false;
  card.innerHTML = `<div class="next-head">最近完成</div>` + list.map((r) => `
    <div class="rc">
      <span class="rc-date">${fmtShort(r.at)}</span>
      <span class="rc-txt">第 ${r.seq} 次 · 第 ${r.week} 周</span>
      <span class="rc-detail">${esc(r.detail)}</span>
    </div>`).join('');
}

function renderWeeks(state) {
  const ann = annotatePlan(PLAN, state);
  let html = '';
  for (let wk = 1; wk <= TOTAL_WEEKS; wk++) {
    const inWeek = ann.filter((s) => s.week === wk);
    const head = inWeek[0];
    html += `<div class="wk"><h3>第 ${wk} 周 · 第 ${head.month} 月 ${esc(head.phase)}${head.recovery ? ' <span class="r">减量</span>' : ''}</h3>`;
    html += `<div class="wk-note">${esc(head.focus)}</div>`;
    for (const s of inWeek) {
      html += `<div class="sess ${s.done ? 'done' : ''} ${s.isNext ? 'now' : ''}">
        <span class="mark">${s.done ? '✓' : s.isNext ? '→' : '·'}</span>
        <span class="d">${esc(s.day)}</span>
        <span class="t">${esc(s.detail)}</span>
        <span class="at">${s.at ? fmtShort(s.at) : ''}</span>
      </div>`;
    }
    html += '</div>';
  }
  $('weeks').innerHTML = html;
}

// ── 备份工具 ──────────────────────────────
function wireTools() {
  $('saveBtn').onclick = saveBackup;
  $('backupNudgeBtn').onclick = () => {
    $('toolsBox').open = true;
    saveBackup();
  };
  $('importBtn').onclick = () => {
    const text = $('backupBox').value.trim();
    if (!text) return toast('先把备份文本粘进上面的框');
    try {
      store.importJson(text);
      render();
      toast('已导入备份');
    } catch (e) {
      toast('导入失败：' + e.message);
    }
  };
  $('resetBtn').onclick = () => {
    if (confirm('确定清空所有打卡记录？建议先「保存备份」。')) {
      store.reset();
      render();
      toast('已清空');
    }
  };
}

// ── 启动 ──────────────────────────────
render();
wireTools();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
