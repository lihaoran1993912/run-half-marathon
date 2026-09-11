// audio.js 头部注释说「没法做单元测试，靠手动测」——这话对「真的发出声音」成立，
// 但「该不该现在排音、该不该等 resume 完成」这层判断逻辑其实可以用一个假 AudioContext
// 顶替浏览器的真引擎来测。这个文件就测这一层：专门盯着「手表读秒/合环提示打断页面音频」
// 这一类场景 —— iOS 上表现为 ctx.state 变成 'suspended' 或 WebKit 专有的 'interrupted'。
//
// 背景：0.3 版加计时器时（见 7c967e6），发现节拍器在这种打断下会失声，用
// 「state !== 'running' 就先不排、下一轮 25ms 轮询再试」这个模式修好了（scheduleMetro）。
// 但走跑切换音 cue() 和读秒音 tick() 当时没有同步改 —— 这个文件就是复现并钉住这个缺口。

import test from 'node:test';
import assert from 'node:assert/strict';

// ── 假 AudioContext：只记录「什么时候、在什么状态下」被要求播音，不真的出声 ──
class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    this.log = []; // { freq, stateAtSchedule } —— 真正「排上音频时钟」的那一刻
    this._resumeResolvers = [];
    FakeAudioContext.instances.push(this);
  }
  createOscillator() {
    const ctx = this;
    const node = {
      type: '',
      frequency: { value: 0 },
      connect() {},
      start() {
        ctx.log.push({ freq: node.frequency.value, stateAtSchedule: ctx.state });
      },
      stop() {},
    };
    return node;
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
  resume() {
    return new Promise((resolve) => this._resumeResolvers.push(resolve));
  }
  // 测试用：模拟「手表读秒/合环提示」结束、系统真的把音频还回来了
  completeResume() {
    this.state = 'running';
    const rs = this._resumeResolvers;
    this._resumeResolvers = [];
    rs.forEach((r) => r());
  }
  close() {}
}
FakeAudioContext.instances = [];

async function freshBeeper() {
  FakeAudioContext.instances.length = 0;
  globalThis.window = { AudioContext: FakeAudioContext };
  // 加时间戳查询参数绕开 ESM 模块缓存，让每个测试拿到全新的闭包状态（新的 ctx=null）
  const mod = await import(`../src/audio.js?t=${Date.now()}_${Math.random()}`);
  const beeper = mod.createBeeper();
  beeper.unlock(); // 相当于用户点了「开始」，触发 ensure() 建 ctx
  const ctx = FakeAudioContext.instances.at(-1);
  ctx.completeResume(); // unlock 自己也会 resume；直接给它结算，模拟已解锁完毕
  ctx.log.length = 0; // 只关心 unlock 之后的行为
  return { beeper, ctx };
}

async function tick() {
  await Promise.resolve();
  await Promise.resolve();
}

test('cue()：正常运行时应该立刻把音排上音频时钟', async () => {
  const { beeper, ctx } = await freshBeeper();
  beeper.cue('run');
  assert.equal(ctx.log.length, 3); // 'run' 是三声上行
  assert.ok(ctx.log.every((e) => e.stateAtSchedule === 'running'));
});

test('cue()：被 Watch 读秒/合环提示打断（interrupted）时，不该硬排到没在跑的时钟上', async () => {
  const { beeper, ctx } = await freshBeeper();
  ctx.state = 'interrupted'; // 手表正在说「当前配速...」，系统抢走了音频
  beeper.cue('walk');
  await tick();
  // 打断的瞬间：绝不能在这个状态下往音频时钟上排东西（排了等于宣判必丢）
  assert.equal(ctx.log.length, 0, 'interrupted 状态下不应该立刻排音');
});

test('cue()：打断结束、resume 完成后，之前那次切换音应该补上，而不是永久丢失', async () => {
  const { beeper, ctx } = await freshBeeper();
  ctx.state = 'interrupted';
  beeper.cue('walk');
  await tick();
  assert.equal(ctx.log.length, 0);
  ctx.completeResume(); // 手表读完了，系统把音频还给页面
  await tick();
  assert.equal(ctx.log.length, 2, 'walk 是两声下行，补播出来'); // 之前是 0，说明真的漏播了
  assert.ok(ctx.log.every((e) => e.stateAtSchedule === 'running'));
});

test('tick()：读秒音同样要能扛住 interrupted（旧代码完全没有 resume 逻辑）', async () => {
  const { beeper, ctx } = await freshBeeper();
  ctx.state = 'interrupted';
  beeper.tick();
  await tick();
  assert.equal(ctx.log.length, 0, '打断中不该硬排');
  ctx.completeResume();
  await tick();
  assert.equal(ctx.log.length, 1, '打断结束后应该把这声读秒补上');
});

test('cue()：resume 还没完成时用户就结束了计时（close），不该往已拆掉的 ctx 上补播', async () => {
  const { beeper, ctx } = await freshBeeper();
  ctx.state = 'interrupted';
  beeper.cue('run');
  await tick();
  beeper.close(); // 用户点了「结束」
  ctx.completeResume(); // 旧 ctx 的 resume 才姗姗来迟地 resolve
  await tick();
  assert.equal(ctx.log.length, 0, '页面已经关闭计时，不该再往旧 ctx 补播音，否则可能报错/内存泄漏');
});
