// 计时器的时间轴计算 —— 纯函数。
// 按「墙上时间」算：外面只管把 elapsed（开跑到现在的秒数）传进来，
// 这里算出「现在是第几段、这段还剩多少、总共还剩多少」。
// 页面被 iOS 挂起再回来时，elapsed 会直接跳到正确值，stateAt 立刻给出正确段落。

export function buildTimeline(segments) {
  const bounds = [];
  let acc = 0;
  for (const s of segments) {
    acc += s.sec;
    bounds.push(acc);
  }
  return { bounds, total: acc };
}

export function stateAt(segments, elapsed) {
  const { bounds, total } = buildTimeline(segments);
  const e = Math.min(Math.max(elapsed, 0), total);

  if (e >= total) {
    return {
      done: true,
      index: segments.length,
      label: '',
      kind: '',
      segRemaining: 0,
      segTotal: 0,
      totalElapsed: total,
      totalRemaining: 0,
      total,
    };
  }

  let index = 0;
  while (index < bounds.length && e >= bounds[index]) index += 1;

  const seg = segments[index];
  const segStart = index === 0 ? 0 : bounds[index - 1];

  return {
    done: false,
    index,
    label: seg.label,
    kind: seg.kind,
    segRemaining: bounds[index] - e,
    segTotal: seg.sec,
    totalElapsed: e,
    totalRemaining: total - e,
    total,
  };
}

// 这一帧要发哪些提示音。把「段落切换 / 段末读秒」的判断从 UI 里拎出来单独测。
//   prev: { index, tick }  上一帧记录（初始 index=-1 表示还没画过）
//   st:   stateAt(...) 的结果
// 返回 { cues: ['run'|'walk'|'done'|'tick', ...], index, tick } —— index/tick 存回去给下一帧用。
export function frameCues(prev, st) {
  const out = { cues: [], index: st.index, tick: prev.tick };

  if (st.index !== prev.index && prev.index !== -1) {
    out.cues.push(st.done ? 'done' : st.kind === 'walk' ? 'walk' : 'run');
  }

  if (!st.done) {
    const r = Math.ceil(st.segRemaining);
    if (r >= 1 && r <= 3 && r !== prev.tick) {
      out.cues.push('tick');
      out.tick = r;
    }
    if (r > 3) out.tick = -1;
  }

  return out;
}

export function formatClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

// 节拍器：这一轮该把「哒」排在哪几个音频时刻。纯函数，方便测。
//   now: audioCtx.currentTime
//   nextScheduled: 上一轮排到的下一个时刻（0 / 负 / 落后于 now 都表示要重新起步）
//   interval: 每拍秒数（60 / bpm）
//   horizon: 向前预排多少秒
// 返回 { times: number[], next: number }。绝不把时刻排到 now 之前（排过去的会被丢，听起来「不响」）。
export function metroTimes(now, nextScheduled, interval, horizon = 0.15) {
  let t = (!nextScheduled || nextScheduled < now) ? now + 0.06 : nextScheduled;
  const times = [];
  while (t < now + horizon) {
    times.push(t);
    t += interval;
  }
  return { times, next: t };
}

// 计时会话「已过秒数」。把暂停/继续的时间账目单独拎出来测。
//   sess: { startMs, pausedAccumMs, pauseStartMs, running }
//   nowMs: 当前 Date.now()
// 运行中按 now 算；暂停中冻结在 pauseStartMs；没开始是 0。
export function elapsedFrom(sess, nowMs) {
  if (!sess || !sess.startMs) return 0;
  const ref = sess.running ? nowMs : (sess.pauseStartMs || nowMs);
  return Math.max(0, (ref - sess.startMs - (sess.pausedAccumMs || 0)) / 1000);
}
