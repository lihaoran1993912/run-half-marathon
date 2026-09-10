// 把 index.html + styles.css + 所有 src 模块 + app.js 拼成一个 preview.html。
//   node build-preview.js
// 用途：① 直接双击 / 发到手机就能打开看效果（不含 Service Worker，不能离线）
//       ② GitHub Pages 万一在国内打不开时的兜底：把这一个文件发到手机也能用
// 正式版仍然是拆开的那套（带离线缓存），这个只是预览 / 兜底。
//
// 做法：每个被 import 的模块包成一个 IIFE，返回它导出的东西；
// app.js 里的 import 改写成从这些 IIFE 结果里解构。够小、够直白，方便回头看。

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const read = (p) => readFile(dir + p, 'utf8');

const LIBS = ['src/plan.js', 'src/progress.js', 'src/stats.js', 'src/store.js'];
const nsOf = (path) => '__' + path.replace(/.*\//, '').replace('.js', '');

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
  const body = code
    .replace(/^\s*export\s+(?=(?:const|function|let|var|class)\b)/gm, '')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
  return `const ${nsOf(path)} = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();\n`;
}

let bundle = '';
for (const p of LIBS) bundle += `\n/* ===== ${p} ===== */\n` + wrapLib(p, await read(p));

let app = await read('app.js');
app = app
  .replace(/^import\s*\{([^}]+)\}\s*from\s*'\.\/(src\/[a-z]+)\.js';\s*$/gm,
    (_, names, path) => `const {${names}} = ${nsOf(path + '.js')};`)
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
