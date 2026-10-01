// 防「新加了 src 模块，忘了登记」——这类 bug 出过两次：
//   1. sw.js 预缓存清单漏了新模块 → 离线时整个 App 加载失败
//   2. build-preview.js 的 LIBS 漏了新模块 / 文件名带连字符 → preview.html 打不开
// 这里不跑浏览器，只做静态核对 + 让 Node 解析一遍 preview.html 的内联脚本。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const dir = fileURLToPath(new URL('../', import.meta.url));
const srcFiles = (await readdir(dir + 'src')).filter((f) => f.endsWith('.js'));

test('每个 src 模块都在 sw.js 的预缓存清单里', async () => {
  const sw = await readFile(dir + 'sw.js', 'utf8');
  for (const f of srcFiles) assert.ok(sw.includes(`'./src/${f}'`), `sw.js 漏了 ./src/${f}`);
});

test('每个 src 模块都在 build-preview.js 的 LIBS 里', async () => {
  const b = await readFile(dir + 'build-preview.js', 'utf8');
  for (const f of srcFiles) assert.ok(b.includes(`'src/${f}'`), `build-preview.js 的 LIBS 漏了 src/${f}`);
});

test('preview.html 的内联脚本语法正确（改了代码记得 npm run build:preview）', async () => {
  const html = await readFile(dir + 'preview.html', 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  for (const s of scripts) new vm.Script(s); // 语法错误会在这里抛
});
