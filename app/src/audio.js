// 提示音 + 节拍器。Web Audio，纯副作用，没法做单元测试，靠手动测。
// iPhone 要求音频在「用户手势」里首次启动，所以 unlock() 必须在按钮点击回调里调一次。
//
// cue 种类：
//   'run'  进入「跑」段 —— 三声上行
//   'walk' 进入「走」段 —— 两声下行
//   'done' 全部结束      —— 三声长音
//   tick() 段末最后 3 秒每秒一声短促「嘀」

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

  function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    // 播一个几乎无声的极短音，解锁 iOS 音频
    tone(440, c.currentTime + 0.001, 0.03, 0.0002);
  }

  function cue(kind) {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
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
  }

  function tick() {
    const c = ensure();
    if (!c) return;
    tone(1320, c.currentTime + 0.01, 0.05, 0.15);
  }

  // 节拍器：25ms 轮询，把未来 0.15s 内的「哒」排到音频时钟上（标准 Web Audio 做法，稳）。
  function scheduleMetro() {
    if (!ctx) return;
    while (metroNext < ctx.currentTime + 0.15) {
      tone(2000, metroNext, 0.03, 0.09);
      metroNext += metroInterval;
    }
  }

  function setMetronome(bpm) {
    clearInterval(metroTimer);
    metroTimer = 0;
    const c = ensure();
    if (!bpm || !c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    metroInterval = 60 / bpm;
    metroNext = c.currentTime + 0.1;
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
