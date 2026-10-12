// 防「加了新模块忘了登记离线缓存」和「版本号只改了一处」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';

const dir = fileURLToPath(new URL('../', import.meta.url));

test('每个 src 模块都在 sw.js 的预缓存清单里', async () => {
  const sw = await readFile(dir + 'sw.js', 'utf8');
  for (const f of await readdir(dir + 'src')) {
    assert.ok(sw.includes(`'./src/${f}'`), `sw.js 漏了 ./src/${f}`);
  }
});

test('VERSION 跟 sw.js 的 CACHE 版本号一致', async () => {
  const sw = await readFile(dir + 'sw.js', 'utf8');
  const m = sw.match(/dumbbell-strength-v(\d+)/);
  assert.ok(m);
  assert.equal(VERSION, 'v' + m[1]);
});
