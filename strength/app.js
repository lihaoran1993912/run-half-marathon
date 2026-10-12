// 页面渲染 + 事件。计算都在 src/ 的纯函数里（有测试），这里只管画和点。

import { PLAN, EXERCISES, WARMUP, COOLDOWN, TOTAL_WEEKS, applyLegLite } from './src/plan.js';
import { levels, describeLevel, fmtKg } from './src/gear.js';
import { nextSession, percent, recommend, bests } from './src/progress.js';
import { createStore } from './src/store.js';
import { proteinTarget, powderFor } from './src/nutrition.js';
import { VERSION, BUILT_AT } from './src/version.js';
import { formToSession, sessionToForm, sessionSummary, painText } from './src/session.js';
import { buildPack, SCOPES } from './src/analysis-pack.js';
import { backupDue } from './src/backup.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeStorage() {
  try {
    const k = '__t';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  }
}

const store = createStore(safeStorage());

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

const handleKg = () => store.get().settings.handleKg || 0;
const unitOf = (ex) => (ex.unit === 'sec' ? '秒' : '个');

// ── 下一次训练 ─────────────────────────────────────────────
function renderNext() {
  const { logs } = store.get();
  const s = nextSession(logs);
  const card = $('nextCard');
  if (!s) {
    card.innerHTML = `<div class="done-banner"><div class="big">🏅</div><div class="txt">32 次全部完成！去跑你的半马吧。</div></div>
      <p class="muted-note">比赛后想继续练，可以「清空记录」从第 1 次重新开始——建议的重量会接着你最后的水平。</p>`;
    return;
  }
  const draft = store.getDraft(s.seq) || { seq: s.seq, legLite: false, items: {} };
  const items = applyLegLite(s.items, draft.legLite);
  const hasLeg = s.items.some((it) => EXERCISES[it.id].region === 'leg');

  const tags = [
    `<span class="tag">第 ${s.week} / ${TOTAL_WEEKS} 周</span>`,
    `<span class="tag plain">${esc(s.phaseName)}</span>`,
    s.deload ? '<span class="tag rest">减量周</span>' : '',
    s.raceWeek ? '<span class="tag rest">赛前周</span>' : '',
    `<span class="tag plain">每组留 ${s.rir} 个</span>`,
  ].join('');

  const exHtml = items.map((it) => exerciseHtml(it, logs, s, draft.items[it.id])).join('');

  card.innerHTML = `
    <div class="next-head">下一次 · 第 ${s.seq} / ${PLAN.length} 次</div>
    <div class="tag-row">${tags}</div>
    <div class="next-detail">${esc(s.title)}</div>
    <div class="focus">${esc(s.note)}</div>
    ${hasLeg ? `<label class="toggle"><input type="checkbox" id="legLite" ${draft.legLite ? 'checked' : ''}>
      <span><b>明天有间歇 / 节奏 / 长距离跑</b>：下肢每个动作少做一组</span></label>` : ''}
    <details class="warm"><summary>先热身 5 分钟</summary><ol>${WARMUP.map((w) => `<li>${esc(w)}</li>`).join('')}</ol></details>
    <div id="exList">${exHtml}</div>
    <div class="cool">
      <div class="cool-head">练完拉伸 5 分钟</div>
      ${COOLDOWN.map((c) => `<details><summary>${esc(c.name)} · ${esc(c.time)}</summary><ul>${c.cues.map((x) => `<li>${esc(x)}</li>`).join('')}${c.knee ? `<li class="knee">${esc(c.knee)}</li>` : ''}</ul></details>`).join('')}
    </div>
    <div class="sess-form">
      <div class="cool-head">这次感受（可以空着，以后在「最近完成」里补）</div>
      ${sessionFields(draft.sessionForm || sessionToForm(null), 'sf')}
      <p class="form-err" id="sfErr" hidden></p>
    </div>
    <button class="btn block" id="finishBtn">完成本次训练</button>
    ${logs.length ? '<button class="undo" id="undoBtn">↶ 撤销上一次</button>' : ''}`;
}

function exerciseHtml(it, logs, s, saved) {
  const ex = EXERCISES[it.id];
  const rec = recommend(it.id, logs, { deload: s.deload });
  const weighted = ex.load !== 'bw';
  const level = saved && Number.isInteger(saved.level) ? saved.level : rec.level;
  const range = `${it.sets} 组 × ${ex.min}–${ex.max} ${unitOf(ex)}${ex.each ? '（每边）' : ''}`;
  const lvOpts = weighted
    ? levels(handleKg()).map((l) => `<option value="${l.level}" ${l.level === level ? 'selected' : ''}>${esc(describeLevel(l.level, handleKg()))}${l.level === rec.level ? '  ← 建议' : ''}</option>`).join('')
    : '';
  const reps = Array.from({ length: it.sets }, (_, i) => {
    const v = saved && saved.reps && saved.reps[i] != null ? saved.reps[i] : '';
    return `<input class="rep" data-i="${i}" inputmode="numeric" placeholder="${rec.target}" value="${esc(v)}" aria-label="第 ${i + 1} 组">`;
  }).join('');
  const rir = saved ? saved.rir : null;
  const rirChips = [0, 1, 2, 3].map((n) => `<button class="chip rir ${rir === n ? 'on' : ''}" data-rir="${n}">${n === 3 ? '3+' : n}</button>`).join('');
  const oneHint = ex.load === 'one' ? '（只用一只）' : '';
  return `
    <div class="ex" data-id="${it.id}" data-sets="${it.sets}">
      <div class="ex-head"><b>${esc(ex.name)}</b><span>${range}</span></div>
      <div class="ex-rec">${weighted ? `建议：${esc(describeLevel(rec.level, handleKg()))}${oneHint} · ` : ''}目标每组 ${rec.target} ${unitOf(ex)}</div>
      <div class="ex-note">${esc(rec.note)}</div>
      ${weighted ? `<div class="ex-row"><select class="lv" aria-label="重量">${lvOpts}</select></div>` : ''}
      <div class="ex-row">实际：${reps}<button class="rest-go" data-rest="${ex.rest}">休息 ${ex.rest} 秒</button></div>
      <div class="ex-row">最后一组还能做几个：${rirChips}</div>
      <details><summary>动作要点</summary><ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join('')}${ex.knee ? `<li class="knee">${esc(ex.knee)}</li>` : ''}</ul></details>
    </div>`;
}

// 「感受」表单：下一次训练卡片里和「最近完成」补填共用。校验在 src/session.js。
const SESSION_FIELDS = [
  ['minutes', '用时（分钟）', 'numeric', '热身到拉伸完'],
  ['rpe', '体感 1–10', 'numeric', '1 轻松～10 极累'],
  ['painScore', '疼痛 0–10', 'numeric', '不疼填 0'],
];

function sessionFields(f, prefix) {
  return `<div class="form-grid">
    ${SESSION_FIELDS.map(([k, label, mode, ph]) => `
      <label>${label}<input id="${prefix}_${k}" class="sf" inputmode="${mode}" placeholder="${ph}" value="${esc(f[k])}"></label>`).join('')}
    <label class="wide">疼痛部位 / 哪个动作疼<input id="${prefix}_painArea" class="sf" placeholder="如：左膝外侧，弓步下蹲时" value="${esc(f.painArea)}"></label>
    <label class="wide">备注<input id="${prefix}_note" class="sf" placeholder="如：硬拉很累 / 没睡好" value="${esc(f.note)}"></label>
  </div>`;
}

function readSessionForm(prefix) {
  const form = {};
  for (const k of ['minutes', 'rpe', 'painScore', 'painArea', 'note']) {
    const el = $(`${prefix}_${k}`);
    form[k] = el ? el.value : '';
  }
  return form;
}

// 从表单读出当前输入（草稿和完成时都用这个）。
function readForm() {
  const items = {};
  document.querySelectorAll('#exList .ex').forEach((el) => {
    const id = el.dataset.id;
    const lvEl = el.querySelector('.lv');
    const reps = [...el.querySelectorAll('.rep')].map((r) => (r.value.trim() === '' ? null : Number(r.value)));
    const on = el.querySelector('.rir.on');
    items[id] = {
      level: lvEl ? Number(lvEl.value) : null,
      reps,
      rir: on ? Number(on.dataset.rir) : null,
    };
  });
  const lite = $('legLite');
  return { items, legLite: !!(lite && lite.checked), sessionForm: readSessionForm('sf') };
}

function saveDraft() {
  const s = nextSession(store.get().logs);
  if (!s) return;
  store.saveDraft({ seq: s.seq, ...readForm() });
}

function finish() {
  const { logs } = store.get();
  const s = nextSession(logs);
  if (!s) return;
  const { items, legLite, sessionForm } = readForm();
  const { session, errors } = formToSession(sessionForm);
  if (errors.length) {
    $('sfErr').textContent = errors.join('；');
    $('sfErr').hidden = false;
    $('sfErr').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const clean = {};
  let empty = 0;
  for (const [id, e] of Object.entries(items)) {
    const reps = e.reps.filter((r) => Number.isInteger(r) && r >= 0);
    if (reps.length) clean[id] = { ...e, reps };
    else empty++;
  }
  if (!Object.keys(clean).length) return toast('先填一下每组实际做了几个');
  if (empty && !confirm(`还有 ${empty} 个动作没填次数，就这样完成吗？（没填的不记录）`)) return;
  store.finish({ seq: s.seq, at: today(), items: clean, legLite, session });
  stopRest();
  toast(`第 ${s.seq} 次完成 ✓`);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 最近完成 ───────────────────────────────────────────────
function renderRecent() {
  const { logs } = store.get();
  const card = $('recentCard');
  if (!logs.length) { card.hidden = true; return; }
  card.hidden = false;
  const h = handleKg();
  const rows = logs.slice(-5).reverse().map((l, k) => {
    const index = logs.length - 1 - k;
    const plan = PLAN[l.seq - 1];
    const sum = sessionSummary(l.session);
    const pain = l.session && l.session.painScore > 0 ? painText(l.session) : '';
    const note = l.session && l.session.note;
    const detail = Object.entries(l.items).map(([id, e]) => {
      const ex = EXERCISES[id];
      const w = e.level == null ? '' : ` ${fmtKg(levels(h)[e.level].kg)}kg`;
      return `${ex.name.replace('（选做）', '')}${w} ${e.reps.join('/')}`;
    }).join('　');
    return `<div class="rc-item"><div class="rc"><span class="rc-date">${esc(l.at.slice(5))}</span>
      <span class="rc-detail">第 ${l.seq} 次 · ${plan ? plan.kind : ''} 课${l.legLite ? ' · 腿部减量' : ''}</span>
      <button class="rc-edit" data-index="${index}">${l.session ? '改感受' : '填感受'}</button></div>
      <div class="lg">${esc(detail)}</div>
      ${sum || note ? `<div class="rc-run">${esc([sum, note].filter(Boolean).join(' · '))}</div>` : ''}
      ${pain ? `<div class="rc-pain">疼痛：${esc(pain)}</div>` : ''}</div>`;
  }).join('');

  const b = bests(logs);
  const bestRows = Object.entries(b).map(([id, v]) => {
    const ex = EXERCISES[id];
    const w = v.level < 0 ? '' : `${fmtKg(levels(h)[v.level].kg)} kg × `;
    return `${ex.name.replace('（选做）', '')} ${w}${v.reps}${unitOf(ex)}`;
  }).join('　');
  card.innerHTML = `<h2 style="font-size:15px;margin-bottom:6px">最近完成</h2>${rows}
    <p class="muted-note"><b>目前最好：</b>${esc(bestRows)}</p>`;
  card.querySelectorAll('.rc-edit').forEach((b) => {
    b.onclick = () => openSessionForm(Number(b.dataset.index));
  });
}

// ── 补填 / 修改某次的感受 ──────────────────────────────────
function openSessionForm(index) {
  const l = store.get().logs[index];
  if (!l) return;
  const card = $('sessCard');
  card.hidden = false;
  card.innerHTML = `
    <div class="t-head"><span>第 ${l.seq} 次 · ${esc(l.at.slice(5))} · 这次感受</span>
      <button class="t-x" id="seCloseBtn" aria-label="关闭">✕</button></div>
    ${sessionFields(sessionToForm(l.session), 'se')}
    <p class="form-err" id="seErr" hidden></p>
    <div class="t-ctrls">
      <button class="btn" id="seSaveBtn">保存</button>
      <button class="btn ghost" id="seCancelBtn">取消</button>
    </div>
    ${l.session ? '<button class="undo" id="seDelBtn">删掉这次的感受</button>' : ''}`;
  const close = () => { card.hidden = true; card.innerHTML = ''; };
  $('seCloseBtn').onclick = close;
  $('seCancelBtn').onclick = close;
  $('seSaveBtn').onclick = () => {
    const { session, errors } = formToSession(readSessionForm('se'));
    if (errors.length) {
      $('seErr').textContent = errors.join('；');
      $('seErr').hidden = false;
      return;
    }
    store.setSession(index, session);
    close();
    render();
    toast(session ? '感受已保存 ✓' : '没填任何内容');
  };
  if ($('seDelBtn')) $('seDelBtn').onclick = () => {
    if (!confirm('删掉这次的感受？训练记录本身保留。')) return;
    store.setSession(index, null);
    close();
    render();
    toast('已删除');
  };
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── 分析包 ─────────────────────────────────────────────────
// 拼文本的逻辑在 src/analysis-pack.js，有测试；这里只管选范围和复制。
let packScope = 'recent4w';

function paintScope() {
  $('scopeRow').querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.scope === packScope));
}

async function copyPack() {
  const { logs, settings } = store.get();
  if (!logs.length) return toast('还没有训练记录');
  const text = buildPack({ logs, settings, scope: packScope, today: today() });
  const box = $('packText');
  box.value = text;
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制，粘贴给 Claude 吧');
  } catch {
    box.focus();
    box.select();
    toast('已选中全文，请长按复制');
  }
}

// ── 蛋白粉 ─────────────────────────────────────────────────
function renderFood() {
  const t = proteinTarget(store.get().settings.bodyKg);
  const target = t
    ? `<p>按你的体重，每天大约要 <b>${t.low}–${t.high} g 蛋白质</b>（每公斤 1.4–1.6 g，跑步 + 力量一起练的量）。</p>`
    : '<p>在下面「设置」里填上体重，这里会算出你每天该吃多少蛋白质。</p>';
  $('foodBody').innerHTML = `
    ${target}
    <p>家里那罐是<b>大豆分离蛋白，蛋白质含量 83%</b>。一次冲 <b>约 ${powderFor(25)} g 粉</b>（≈ 25 g 蛋白），用温水或牛奶冲。
      练完 2 小时内或早餐喝都行，<b>一天 1 次就够</b>，不练的日子饭里蛋白够就不用喝。实际一勺多少克，以罐子背面的「食用方法」为准。</p>
    <p><b>先靠吃饭，粉只补缺口。</b>大概的量：</p>
    <table>
      <tr><td>鸡蛋 1 个</td><td>≈ 6 g</td></tr>
      <tr><td>牛奶 250 ml</td><td>≈ 8 g</td></tr>
      <tr><td>瘦肉 / 鸡胸 / 牛肉 100 g（生重）</td><td>≈ 20 g</td></tr>
      <tr><td>北豆腐 100 g</td><td>≈ 12 g</td></tr>
      <tr><td>蛋白粉 ${powderFor(25)} g</td><td>≈ 25 g</td></tr>
    </table>
    <p>罐子上写的「增强免疫力」是保健食品的标签说法，别为了这个多喝。肾脏健康的人按上面的量吃是安全的。长距离跑那天更要紧的是<b>碳水吃够</b>。</p>`;
}

// ── 全部计划 ───────────────────────────────────────────────
function renderPlan() {
  const { logs } = store.get();
  const done = new Map(logs.map((l) => [l.seq, l.at]));
  const nextSeq = logs.length + 1;
  let html = '';
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const ss = PLAN.filter((s) => s.week === w);
    const head = ss[0];
    html += `<div class="wk"><h3>第 ${w} 周 · ${esc(head.phaseName)}${head.deload ? ' <span class="r">减量周</span>' : ''}${head.raceWeek ? ' <span class="r">赛前周</span>' : ''}</h3>`;
    for (const s of ss) {
      const cls = done.has(s.seq) ? 'done' : s.seq === nextSeq ? 'now' : '';
      const mark = done.has(s.seq) ? '✓' : s.seq === nextSeq ? '▶' : '·';
      const names = s.items.map((it) => EXERCISES[it.id].name.replace('（选做）', '')).join('、');
      html += `<div class="sess ${cls}"><span class="mark">${mark}</span><span class="d">${s.kind} 课 ${s.items[0].sets} 组</span>
        <span class="t">${esc(names)}</span>${done.has(s.seq) ? `<span class="at">${esc(done.get(s.seq).slice(5))}</span>` : ''}</div>`;
    }
    html += '</div>';
  }
  $('weeks').innerHTML = html;
}

function renderHeader() {
  const { logs } = store.get();
  const pct = percent(logs);
  $('barFill').style.width = pct + '%';
  $('barDone').textContent = `${Math.min(logs.length, PLAN.length)} / ${PLAN.length} 次`;
  $('barPct').textContent = pct + '%';
}

function renderSettings() {
  const st = store.get().settings;
  $('st_handle').value = st.handleKg ?? '';
  $('st_body').value = st.bodyKg ?? '';
}

function renderBackup() {
  const st = store.get();
  const b = st.backup;
  $('backupStatus').textContent = b.at ? `上次备份：${b.at}（当时 ${b.count} 次）` : '还没备份过';
  const due = backupDue(st, today());
  $('backupNudge').hidden = !due.due;
  if (due.due) $('backupNudgeText').textContent = `有 ${due.pending} 次训练还没备份，存一份免得丢`;
}

function render() {
  renderHeader();
  renderBackup();
  renderNext();
  renderRecent();
  renderFood();
  renderPlan();
}

// ── 组间休息计时 ───────────────────────────────────────────
// 按墙上时钟算（切出去再回来也准）；到点「嘀」两声。iOS 锁屏后声音可能不响，看屏幕为准。
let restEnd = 0;
let restTick = null;
let audioCtx = null;

function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume();
  } catch { /* 没声音也不影响计时 */ }
}

function beep() {
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime + 0.05;
    [0, 0.25].forEach((d) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + d + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.2);
    });
  } catch { /* 同上 */ }
}

function startRest(sec) {
  unlockAudio();
  restEnd = Date.now() + sec * 1000;
  $('restBar').hidden = false;
  $('restClock').classList.remove('end');
  clearInterval(restTick);
  restTick = setInterval(tickRest, 250);
  tickRest();
}

function tickRest() {
  const left = Math.ceil((restEnd - Date.now()) / 1000);
  const clock = $('restClock');
  if (left <= 0) {
    clearInterval(restTick);
    restTick = null;
    clock.textContent = '开始下一组';
    clock.classList.add('end');
    beep();
    setTimeout(() => { if (!restTick) $('restBar').hidden = true; }, 4000);
    return;
  }
  clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

function stopRest() {
  clearInterval(restTick);
  restTick = null;
  $('restBar').hidden = true;
}

// ── 事件 ───────────────────────────────────────────────────
$('nextCard').addEventListener('click', (e) => {
  const chip = e.target.closest('.rir');
  if (chip) {
    const row = chip.parentElement;
    const was = chip.classList.contains('on');
    row.querySelectorAll('.rir').forEach((c) => c.classList.remove('on'));
    if (!was) chip.classList.add('on');
    saveDraft();
    return;
  }
  const rest = e.target.closest('.rest-go');
  if (rest) return startRest(Number(rest.dataset.rest));
  if (e.target.id === 'finishBtn') return finish();
  if (e.target.id === 'undoBtn') {
    if (!confirm('撤销上一次训练记录？')) return;
    store.undoLast();
    toast('已撤销');
    render();
  }
});

$('nextCard').addEventListener('change', (e) => {
  if (e.target.id === 'legLite') {
    saveDraft();
    renderNext();
    return;
  }
  saveDraft();
});
$('nextCard').addEventListener('input', (e) => {
  if (e.target.classList.contains('rep') || e.target.classList.contains('sf')) saveDraft();
});

$('restPlus').addEventListener('click', () => {
  if (restTick) restEnd += 15000;
  else startRest(15);
});
$('restStop').addEventListener('click', stopRest);

$('stSaveBtn').addEventListener('click', () => {
  const n = (v) => (v.trim() === '' ? undefined : Number(v));
  store.setSettings({ handleKg: n($('st_handle').value), bodyKg: n($('st_body').value) });
  renderSettings();
  render();
  toast('设置已保存 ✓');
});

// 打开分享面板保存备份；不支持分享就退回复制 / 选中。成功后记下备份书签。
async function saveBackup() {
  const text = store.exportJson();
  $('backupBox').value = text;
  try {
    if (navigator.share) {
      await navigator.share({ title: '哑铃力量备份', text });
      toast('已发起保存');
    } else {
      throw new Error('no share');
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return; // 取消了，不算备份
    try {
      await navigator.clipboard.writeText(text);
      toast('已复制备份文本，粘到备忘录里存好');
    } catch {
      $('backupBox').select();
      toast('已选中备份文本，请长按复制保存');
    }
  }
  store.markBackedUp(today());
  renderBackup();
}

$('saveBtn').addEventListener('click', saveBackup);
$('backupNudgeBtn').addEventListener('click', () => {
  $('backupBox2').open = true;
  saveBackup();
});

$('importBtn').addEventListener('click', () => {
  const text = $('backupBox').value.trim();
  if (!text) return toast('先把备份文本粘进上面的框');
  try {
    store.importJson(text);
    renderSettings();
    render();
    toast('已导入备份');
  } catch (err) {
    toast('导入失败：' + err.message);
  }
});

$('resetBtn').addEventListener('click', () => {
  if (!confirm('清空所有训练记录？（设置保留）建议先保存备份。')) return;
  store.reset();
  render();
  toast('已清空');
});

$('scopeRow').innerHTML = '范围：' + Object.entries(SCOPES).map(([k, v]) => `<button class="chip" data-scope="${k}">${v}</button>`).join('');
$('scopeRow').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  packScope = b.dataset.scope;
  paintScope();
});
paintScope();
$('packCopyBtn').addEventListener('click', copyPack);

$('verFoot').textContent = `${VERSION} · ${BUILT_AT}`;
renderSettings();
render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
