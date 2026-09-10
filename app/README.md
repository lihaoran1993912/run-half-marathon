# app/ — 半马训练打卡（网页 App / PWA）

一个只给自己用的手机打卡程序。**5 个月 / 20 周 / 63 次训练**，
按顺序完成即可，忙了就顺延，不按日历强制——把 63 次做完就算达标。

- 训练计划来自「得到 App」的 5 张计划表（走跑结合 → 连续轻松跑 → 间歇跑 → 节奏跑 → 马拉松心率跑 + 比赛）
- 打卡记录只存在手机本机，无账号、无服务器、无网络也能用
- 加到 iPhone 主屏幕后，跟原生 App 一样全屏打开
- 不引任何外部字体 / CDN，国行手机（iOS 26）也能秒开

## 目录

```
app/
  index.html          页面骨架
  app.js              渲染 + 事件绑定（薄，不含业务逻辑）
  styles.css          样式，橙色主题，深色模式自适应
  manifest.webmanifest / sw.js / icons/   PWA：可安装 + 离线缓存
  src/
    plan.js           20 周训练数据 + buildPlan()
    progress.js       下一课 / 进度 / 当前周 / 完成日期预估（纯函数）
    stats.js          累计跑量 / 近 7 天次数 / 平均每周次数（纯函数）
    store.js          打卡记录读写，storage 适配器可注入
  test/               Node 内置测试，38 个用例，零依赖
  serve.js            本地预览服务器（零依赖）
  build-preview.js    把上面所有文件打包成单个 preview.html
```

## 开发（试错循环）

```bash
cd app
npm test            # 跑全部测试（node --test）
npm run test:watch  # 改代码自动重跑
npm run serve       # http://localhost:8000 本地预览
```

写法约定：**能算的都放进 `src/` 并配测试**，`app.js` 只负责把结果画到页面上。
改动流程：先写 / 改 `test/` 里的用例（红）→ 改实现到通过（绿）→ 重构 → `git commit`。
改了前端任意文件，记得把 `sw.js` 里的 `CACHE` 版本号 +1，否则手机上不会更新。

## 线上地址

**<https://lihaoran1993912.github.io/run-half-marathon/app/>**

iPhone Safari 打开 → 分享按钮 → **添加到主屏幕**。第一次联 WiFi 打开一次（缓存整包），之后断网也能用。

### 已经是怎么发布的（以后自己维护参考）

- 仓库：`gh repo create run-half-marathon --public --source=. --remote=origin --push`
- 开 Pages：`gh api -X POST repos/lihaoran1993912/run-half-marathon/pages -f "source[branch]=master" -f "source[path]=/"`
- 以后改了代码：`git add -A && git commit -m "..." && git push`，等一两分钟 Pages 自动重建。
  改了前端文件记得先把 `sw.js` 里的 `CACHE` 版本号 +1，手机上才会拿到新版。

## 兜底：单文件版

GitHub Pages 万一在国内打不开，运行 `npm run build:preview` 会生成 `app/preview.html`，
把这**一个文件**发到手机用 Safari 打开也能用（少了离线缓存，其他一样）。

## 提醒通知

iOS 的网页 App 不能自己定时弹通知（要服务器推）。这个 App 的做法是把「接下来该做什么」
放在最显眼的位置；想要固定提醒，自己在 iOS「日历」或「快捷指令」里设周期提醒即可。
