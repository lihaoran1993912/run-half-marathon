// 页面底部显示这个，方便联网刷新后确认拿到的是不是最新代码。
//
// 每次改完前端代码、准备发布时，两件事一起做（缺一个 test/version.test.js 就会报红）：
//   1. 这里的 VERSION 往上 +1、BUILT_AT 改成今天
//   2. sw.js 里的 CACHE 常量也要跟着改成同一个数字（否则 Service Worker 不认为有更新）
export const VERSION = 'v6';
export const BUILT_AT = '2026-09-11';
