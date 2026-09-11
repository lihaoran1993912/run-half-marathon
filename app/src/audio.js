// 提示音 + 节拍器。Web Audio，真的出声这件事没法做单元测试，靠手动测；
// 但「该不该现在排音、打断后该不该补播」这层判断逻辑用假 AudioContext 测了，见 test/audio.test.js。
// iPhone 要求音频在「用户手势」里首次启动，所以 unlock() 必须在按钮点击回调里调一次。
//
// cue 种类：
//   'run'  进入「跑」段 —— 三声上行
//   'walk' 进入「走」段 —— 两声下行
//   'done' 全部结束      —— 三声长音
//   tick() 段末最后 3 秒每秒一声短促「嘀」

import { metroTimes } from './timer.js';

export function createBeeper() {
  let ctx = null;
  let metroTimer = 0;
  let metroNext = 0;
  let metroInterval = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, at, dur, gain) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // 手表读秒/合环提示这类系统通知会抢走音频，ctx.state 变成 'suspended' 或
  // iOS 专有的 'interrupted'（两者都不是 'running'）。这时绝不能照抄旧的 currentTime
  // 硬排音符——resume() 是异步的，排的时刻会被判定为「过去」，直接被丢掉、听起来像没响。
  // 正确做法：running 就立刻排；不是就等 resume() 真正落地、且这期间没被 close() 拆掉再排。
  // （节拍器 scheduleMetro 靠 25ms 轮询自带这个效果，这里给一次性提示音补上同样的保护。）
  function whenRunning(c, fn) {
    if (c.state === 'running') {
      fn();
      return;
    }
    c.resume().then(() => {
      if (ctx === c && c.state === 'running') fn();
    }).catch(() => {});
  }

  function unlock() {
    const c = ensure();
    if (!c) return;
    // 播一个几乎无声的极短音，解锁 iOS 音频
    whenRunning(c, () => tone(440, c.currentTime + 0.001, 0.03, 0.0002));
  }

  function cue(kind) {
    const c = ensure();
    if (!c) return;
    whenRunning(c, () => {
      const t = c.currentTime + 0.02;
      if (kind === 'walk') {
        tone(523, t, 0.16, 0.25);
        tone(392, t + 0.18, 0.22, 0.25);
      } else if (kind === 'done') {
        tone(880, t, 0.22, 0.3);
        tone(880, t + 0.28, 0.22, 0.3);
        tone(880, t + 0.56, 0.4, 0.3);
      } else {
        tone(660, t, 0.1, 0.22);
        tone(880, t + 0.12, 0.1, 0.22);
        tone(1046, t + 0.24, 0.16, 0.24);
      }
    });
  }

  function tick() {
    const c = ensure();
    if (!c) return;
    whenRunning(c, () => tone(1320, c.currentTime + 0.01, 0.05, 0.15));
  }

  // 节拍器：25ms 轮询，把未来 0.15s 内的「哒」排到音频时钟上（标准 Web Audio 做法）。
  // iOS 上 AudioContext 可能还没 resume（gesture 后 resume 是异步的）、或被系统 interrupt，
  // 这时 currentTime 不走。所以每次轮询都：没 running 就重试 resume 并跳过；
  // metroNext 惰性/落后时按「当前时间」重新起步，绝不排到过去（排过去会被丢掉 → 听起来「不响」）。
  function scheduleMetro() {
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ctx.resume && ctx.resume().catch(() => {});
      return;
    }
    const { times, next } = metroTimes(ctx.currentTime, metroNext, metroInterval);
    for (const t of times) tone(2000, t, 0.03, 0.09);
    metroNext = next;
  }

  function setMetronome(bpm) {
    clearInterval(metroTimer);
    metroTimer = 0;
    const c = ensure();
    if (!bpm || !c) return;
    if (c.state !== 'running') c.resume().catch(() => {});
    metroInterval = 60 / bpm;
    metroNext = 0; // 让第一次轮询用当时的 currentTime 初始化
    metroTimer = setInterval(scheduleMetro, 25);
  }

  function close() {
    clearInterval(metroTimer);
    metroTimer = 0;
    try { ctx && ctx.close(); } catch { /* ignore */ }
    ctx = null;
  }

  return { unlock, cue, tick, setMetronome, close };
}
