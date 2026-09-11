// 把 index.html + styles.css + 所有 src 模块 + app.js 拼成一个 preview.html。
//   node build-preview.js
// 用途：① 直接双击 / 发到手机就能打开看效果（不含 Service Worker，不能离线）
//       ② GitHub Pages 万一在国内打不开时的兜底：把这一个文件发到手机也能用
// 正式版仍然是拆开的那套（带离线缓存），这个只是预览 / 兜底。
//
// 做法：每个被 import 的模块包成一个 IIFE，返回它导出的东西；
// 谁 import 谁（不管是 app.js 引 src/xxx.js，还是 src 模块内部互相引用，
// 比如 audio.js 引 timer.js）都改写成从这些 IIFE 结果里解构。
// LIBS 的顺序有讲究：被引用的模块必须排在引用它的模块前面（timer.js 在 audio.js 之前），
// 因为顶层 const 是按文本顺序执行的。

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => readFile(dir + p, 'utf8');

// 有依赖关系的必须按「被依赖的在前」排：segments/timer 不依赖别人；
// audio 依赖 timer，排在它后面。
const LIBS = [
  'src/plan.js', 'src/progress.js', 'src/stats.js', 'src/store.js',
  'src/segments.js', 'src/timer.js', 'src/audio.js', 'src/backup.js', 'src/version.js',
];
const nsOf = (path) => '__' + path.replace(/.*\//, '').replace('.js', '');

// 把「import { a, b } from './xxx.js'」或「from './src/xxx.js'」统一改写成
// 「const { a, b } = __xxx;」——前一种是 app.js 引 src 模块的写法，后一种是
// src 模块互相引用的写法（比如 audio.js 引 timer.js），两种都可能出现。
function rewriteImports(code) {
  return code.replace(/^\s*import\s*\{([^}]+)\}\s*from\s*'\.\/(?:src\/)?([A-Za-z0-9_]+)\.js';\s*$/gm,
    (_, names, mod) => `const {${names}} = __${mod};`);
}

function exportedNames(code) {
  const names = new Set();
  for (const m of code.matchAll(/^\s*export\s+(?:const|function|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of code.matchAll(/^\s*export\s*\{([^}]+)\}/gm)) {
    m[1].split(',').forEach((n) => n.trim() && names.add(n.trim().split(/\s+as\s+/).pop()));
  }
  return [...names];
}

function wrapLib(path, code) {
  const names = exportedNames(code);
  const body = rewriteImports(code)
    .replace(/^\s*export\s+(?=(?:const|function|let|var|class)\b)/gm, '')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
  return `const ${nsOf(path)} = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();\n`;
}

let bundle = '';
for (const p of LIBS) bundle += `\n/* ===== ${p} ===== */\n` + wrapLib(p, await read(p));

let app = rewriteImports(await read('app.js'))
  .replace(/if \('serviceWorker' in navigator\)[\s\S]*?\n\}\n?/, ''); // 预览版没有 SW
bundle += `\n/* ===== app.js ===== */\n` + app;

const css = await read('styles.css');
let html = await read('index.html');
html = html
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<link rel="manifest" href="manifest.webmanifest">', '')
  .replace('<script type="module" src="app.js"></script>', `<script type="module">\n${bundle}\n</script>`)
  .replace('<title>半马训练打卡</title>', '<title>半马训练打卡（预览版）</title>');

await writeFile(dir + 'preview.html', html);
console.log('已生成 app/preview.html （' + Math.round(html.length / 1024) + ' KB）');
