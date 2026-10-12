// 页面底部显示这个。发布时两件事一起做（test/version.test.js 会检查）：
//   1. 这里的 VERSION +1、BUILT_AT 改成今天
//   2. sw.js 里的 CACHE 改成同一个数字
export const VERSION = 'v1';
export const BUILT_AT = '2026-10-12';
