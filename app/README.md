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

## 发布到 GitHub Pages（正式版，能装能离线）

1. 在 GitHub 新建仓库（比如 `run-half-marathon`），按它给的命令把本仓库 push 上去。
2. 仓库 **Settings → Pages → Build and deployment → Source 选 “Deploy from a branch”**，
   分支选 `master`、目录选 `/ (root)`，保存。
3. 等一两分钟，打开 `https://<你的用户名>.github.io/run-half-marathon/app/`
4. iPhone Safari 打开这个地址 → 分享按钮 → **添加到主屏幕**。
   第一次要联 WiFi 打开一次（缓存整包），之后断网也能用。

## 兜底：单文件版

GitHub Pages 万一在国内打不开，运行 `npm run build:preview` 会生成 `app/preview.html`，
把这**一个文件**发到手机用 Safari 打开也能用（少了离线缓存，其他一样）。

## 提醒通知

iOS 的网页 App 不能自己定时弹通知（要服务器推）。这个 App 的做法是把「接下来该做什么」
放在最显眼的位置；想要固定提醒，自己在 iOS「日历」或「快捷指令」里设周期提醒即可。
