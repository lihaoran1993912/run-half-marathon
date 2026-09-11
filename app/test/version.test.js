// 页面底部的版本号（src/version.js）和离线缓存版本号（sw.js 的 CACHE）
// 是两处手动维护的数字，本该每次发布都一起 +1。这个测试就是防「改了一处忘了另一处」——
// 忘了同步，用户看到的版本号会显示"已是最新"，但其实拿到的是没更新的离线缓存。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';

const dir = fileURLToPath(new URL('../', import.meta.url));

test('VERSION 的数字要跟 sw.js 的 CACHE 版本号一致', async () => {
  const sw = await readFile(dir + 'sw.js', 'utf8');
  const m = sw.match(/marathon-checkin-v(\d+)/);
  assert.ok(m, 'sw.js 里应该有 marathon-checkin-vN 格式的 CACHE 常量');
  const swVer = m[1];
  const appVer = VERSION.match(/^v(\d+)$/)?.[1];
  assert.ok(appVer, 'VERSION 应该是 vN 格式');
  assert.equal(appVer, swVer, `version.js 是 ${VERSION}，但 sw.js 是 v${swVer}——发布时忘了同步其中一个`);
});

test('src/version.js 要被 sw.js 预缓存（离线时才能显示版本号）', async () => {
  const sw = await readFile(dir + 'sw.js', 'utf8');
  assert.match(sw, /['"]\.\/src\/version\.js['"]/);
});
