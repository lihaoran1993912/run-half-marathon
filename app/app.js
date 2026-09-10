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
import { parseSession } from './src/segments.js';
import { stateAt, formatClock, frameCues } from './src/timer.js';
import { createBeeper } from './src/audio.js';

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
      <button class="btn ghost" id="startTimerBtn">▶ 开始计时</button>
      <div class="check-row">
        <input type="date" id="ciDate" value="${todayStr()}" max="${todayStr()}" aria-label="打卡日期">
        <button class="btn" id="ciBtn">完成打卡</button>
      </div>
      ${done > 0 ? '<button class="undo" id="undoBtn">↩ 撤销上一次打卡</button>' : ''}
    `;
    $('startTimerBtn').onclick = () => openTimer(s);
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

// ── 跑步计时器 ────────────────────────────
// 纯逻辑（解析、时间轴、时钟格式）在 src/segments.js + src/timer.js，有测试。
// 这里是薄壳：墙上时间驱动的循环、提示音、屏幕常亮、DOM。
const beeper = createBeeper();
let T = null; // 当前计时会话；null = 没在计时

function openTimer(session) {
  const parsed = parseSession(session.detail);
  T = {
    session,
    parsed,
    segments: parsed.segments || [],
    startMs: 0,
    pausedAccumMs: 0,
    pauseStartMs: 0,
    running: false,
    lastIndex: -1,
    lastTick: -1,
    raf: 0,
    gen: 0, // 每次 (重新)启动循环 +1；旧的一代自己退出，避免后台回来后循环叠加
    wakeLock: null,
    bpm: 180,
    metro: false,
  };
  $('timerCard').hidden = false;
  renderTimer();
  $('timerCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeTimer() {
  stopClock();
  releaseWake();
  beeper.setMetronome(null);
  T = null;
  $('timerCard').hidden = true;
}

function elapsedSec() {
  if (!T || !T.startMs) return 0;
  const ref = T.running ? Date.now() : (T.pauseStartMs || Date.now());
  return Math.max(0, (ref - T.startMs - T.pausedAccumMs) / 1000);
}

async function startClock() {
  beeper.unlock(); // 必须在用户手势里
  T.startMs = Date.now();
  T.pausedAccumMs = 0;
  T.pauseStartMs = 0;
  T.running = true;
  T.lastIndex = -1;
  T.lastTick = -1;
  await requestWake();
  if (T.metro) beeper.setMetronome(T.bpm);
  startLoop();
  renderTimer();
}

function pauseClock() {
  if (!T || !T.running) return;
  T.running = false;
  T.gen += 1; // 让当前循环这一代作废
  T.pauseStartMs = Date.now();
  cancelAnimationFrame(T.raf);
  releaseWake();
  beeper.setMetronome(null);
  renderTimer();
}

function resumeClock() {
  if (!T || T.running || !T.startMs) return;
  T.pausedAccumMs += Date.now() - T.pauseStartMs;
  T.pauseStartMs = 0;
  T.running = true;
  requestWake();
  if (T.metro) beeper.setMetronome(T.bpm);
  startLoop();
  renderTimer();
}

function stopClock() {
  if (T) {
    T.running = false;
    T.gen += 1;
    cancelAnimationFrame(T.raf);
  }
}

// 启动新一代帧循环；上一代（如果还在）下一帧会自己发现代号变了而退出。
function startLoop() {
  const gen = ++T.gen;
  const frame = () => {
    if (!T || !T.running || gen !== T.gen) return;
    tickFrame();
    if (T && T.running && gen === T.gen) T.raf = requestAnimationFrame(frame);
  };
  frame();
}

function tickFrame() {
  if (!T || !T.running) return;
  const e = elapsedSec();

  if (T.parsed.type === 'freeform') {
    paintFreeform(e);
    return;
  }

  const st = stateAt(T.segments, e);
  paintTimed(st);

  const fc = frameCues({ index: T.lastIndex, tick: T.lastTick }, st);
  for (const c of fc.cues) (c === 'tick' ? beeper.tick() : beeper.cue(c));
  T.lastIndex = fc.index;
  T.lastTick = fc.tick;

  if (st.done) {
    T.running = false;
    T.gen += 1;
    releaseWake();
    beeper.setMetronome(null);
    renderTimer(true);
  }
}

async function requestWake() {
  try {
    if ('wakeLock' in navigator) T.wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* 电量低 / 不支持：算了 */ }
}
function releaseWake() {
  try { if (T && T.wakeLock) T.wakeLock.release(); } catch { /* ignore */ }
  if (T) T.wakeLock = null;
}

// 页面从后台回到前台：Wake Lock 会被系统释放，重新申请；循环也重新踢一下。
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && T && T.running) {
    requestWake();
    startLoop(); // 新一代循环；后台冻结的旧帧回来发现代号变了会自己退出
  }
});

function timerHeadHtml(finished) {
  const s = T.session;
  return `
    <div class="t-head">
      <span>第 ${s.seq} 次 · 第 ${s.week} 周 · ${esc(s.phase)}</span>
      <button class="t-x" id="tCloseBtn" aria-label="关闭计时器">✕</button>
    </div>
    <div class="t-plan">${esc(s.detail)}</div>
    ${finished ? '' : `<p class="t-note">iPhone 网页不支持震动，用提示音提醒。已尝试让屏幕保持常亮；锁屏放兜里时提示音可能延后。</p>`}
  `;
}

function metroRowHtml() {
  return `
    <label class="t-metro">
      <input type="checkbox" id="tMetroChk" ${T.metro ? 'checked' : ''}>
      节拍音
      <input type="range" id="tMetroBpm" min="165" max="190" step="5" value="${T.bpm}" ${T.metro ? '' : 'disabled'}>
      <b id="tBpmLbl">${T.bpm}</b> 步/分
    </label>`;
}

function renderTimer(finished) {
  if (!T) return;
  const started = !!T.startMs;
  const card = $('timerCard');

  if (T.parsed.type === 'freeform') {
    card.innerHTML = timerHeadHtml(false) + `
      <div class="t-phase">秒表</div>
      <div class="t-clock" id="tClock">0:00</div>
      <div class="t-sub">这次含按距离 / 自定义组间休息的部分，不自动循环，照上面计划来，这里当秒表用。</div>
      ${metroRowHtml()}
      <div class="t-ctrls">
        ${!started || !T.running
          ? `<button class="btn" id="tStartBtn">${started ? '继续' : '开始'}</button>`
          : `<button class="btn ghost" id="tPauseBtn">暂停</button>`}
        <button class="btn ghost" id="tStopBtn">结束</button>
      </div>`;
    if (started) paintFreeform(elapsedSec());
    wireTimerCtrls(finished);
    return;
  }

  card.innerHTML = timerHeadHtml(finished) + `
    <div class="t-phase" id="tPhase">${started ? '' : '预备'}</div>
    <div class="t-clock" id="tClock">${started ? '' : formatClock(T.segments[0].sec)}</div>
    <div class="t-sub" id="tSub"></div>
    <div class="bar"><i id="tBar" style="width:0%"></i></div>
    ${finished ? `
      <div class="t-done">✅ 这次训练完成！</div>
      <div class="t-ctrls">
        <button class="btn" id="tCheckinBtn">顺手打卡</button>
        <button class="btn ghost" id="tStopBtn">关闭</button>
      </div>`
    : `
      ${metroRowHtml()}
      <div class="t-ctrls">
        ${!T.running
          ? `<button class="btn" id="tStartBtn">${started ? '继续' : '开始'}</button>`
          : `<button class="btn ghost" id="tPauseBtn">暂停</button>`}
        <button class="btn ghost" id="tStopBtn">结束</button>
      </div>`}
  `;
  if (started && !finished) paintTimed(stateAt(T.segments, elapsedSec()));
  wireTimerCtrls(finished);
}

function paintTimed(st) {
  const phase = $('tPhase');
  if (!phase) return;
  if (st.done) {
    phase.textContent = '完成';
    $('tClock').textContent = '0:00';
    return;
  }
  phase.textContent = st.kind === 'walk' ? '走' : '跑';
  phase.className = 't-phase ' + (st.kind === 'walk' ? 'walk' : 'run');
  $('tClock').textContent = formatClock(st.segRemaining);
  const sub = $('tSub');
  if (T.parsed.type === 'runwalk') {
    const pair = Math.floor(st.index / 2) + 1;
    sub.textContent = `第 ${pair} / ${T.parsed.reps} 组 · 总剩 ${formatClock(st.totalRemaining)}`;
  } else {
    sub.textContent = `总剩 ${formatClock(st.totalRemaining)}`;
  }
  $('tBar').style.width = (st.total ? (st.totalElapsed / st.total) * 100 : 0) + '%';
}

function paintFreeform(e) {
  const c = $('tClock');
  if (c) c.textContent = formatClock(Math.floor(e));
}

function wireTimerCtrls(finished) {
  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  on('tCloseBtn', closeTimer);
  on('tStopBtn', closeTimer);
  on('tStartBtn', () => (T.startMs ? resumeClock() : startClock()));
  on('tPauseBtn', pauseClock);
  on('tCheckinBtn', () => {
    const at = todayStr();
    store.checkIn(nextSession(PLAN, store.get()).seq, at);
    closeTimer();
    render();
    toast('已打卡 ✓');
  });
  const chk = $('tMetroChk');
  if (chk) chk.onchange = () => {
    T.metro = chk.checked;
    $('tMetroBpm').disabled = !T.metro;
    beeper.setMetronome(T.metro && T.running ? T.bpm : null);
  };
  const bpm = $('tMetroBpm');
  if (bpm) bpm.oninput = () => {
    T.bpm = Number(bpm.value);
    $('tBpmLbl').textContent = T.bpm;
    if (T.metro && T.running) beeper.setMetronome(T.bpm);
  };
  void finished;
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
