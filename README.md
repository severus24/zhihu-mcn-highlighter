# 知乎 MCN 闪耀助手

[![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-c83b32)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: MIT](https://img.shields.io/badge/License-MIT-1f7a5c.svg)](LICENSE)

把知乎答主所属的 MCN 机构显示在用户名旁，减少判断内容立场时的信息差。
这是将 xioxin 原 Tampermonkey 用户脚本转换为 Chrome Manifest V3
扩展后的公开版本。

项目主页：<https://severus24.github.io/zhihu-mcn-highlighter/>  
下载最新版：<https://github.com/severus24/zhihu-mcn-highlighter/releases/latest>

> 本项目与知乎、xioxin、Greasy Fork 或 Tampermonkey 官方无隶属关系。

## 功能

- 在答主名称旁显示 MCN 机构。
- 支持手动按需读取或自动加载。
- 隐藏回答正文，保留作者信息，便于快速浏览和截图。
- 复制 MCN 表格并清理本地缓存。
- 按 MCN 批量拉黑已记录作者。
- 自动迁移原用户脚本保存在知乎域下的缓存。
- 保留原页面控制台 API。

## 安装

### GitHub Release

1. 从 [Releases](https://github.com/severus24/zhihu-mcn-highlighter/releases/latest)
   下载 `mcn-zhihu-chrome-v1.0.4.zip`。
2. 解压 ZIP。
3. 打开 `chrome://extensions/`。
4. 开启右上角“开发者模式”。
5. 点击“加载已解压的扩展程序”，选择解压目录。
6. 打开或刷新 <https://www.zhihu.com/>。

扩展需要 Chrome 111 或更高版本。

### 源码加载

```bash
git clone https://github.com/severus24/zhihu-mcn-highlighter.git
cd zhihu-mcn-highlighter
npm ci
npm test
```

然后在 `chrome://extensions/` 中选择仓库根目录。

## 使用

打开知乎后，答主名称旁会出现“点击加载 MCN”。点击徽章即可按需读取，
也可以点击扩展图标，在控制面板中开启自动加载。

扩展面板还提供隐藏正文、复制表格、清理缓存和按 MCN 批量拉黑操作。

## 原脚本控制台 API

在 `www.zhihu.com` 的 DevTools Console 中仍可使用：

```js
mcn()
blockMcn('MCN 机构名称')
hiddenContent()
showContent()
```

## 开发与验证

项目没有运行时 npm 依赖，只使用 Node.js 标准库和浏览器扩展 API。

```bash
npm ci
npm run lint
npm test
npm audit --audit-level=moderate
npm run build
```

构建产物写入 `release/`，该目录不会提交到 Git，而是上传到 GitHub
Release。图标可通过以下命令重新生成：

```bash
python3 tools/generate-icons.py
```

## 文件结构

```text
.
├── manifest.json
├── scripts/
│   ├── content.js
│   └── page-bridge.js
├── styles/
│   └── content.css
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── icons/
├── source/
│   └── original.user.js
├── docs/
├── tools/
├── LICENSE
├── NOTICE.md
└── README.md
```

## 权限与隐私

扩展不包含后端服务，不上传 MCN 缓存或浏览记录。缓存和设置保存在
`chrome.storage.local`。

- `storage`：保存缓存和显示设置。
- `activeTab`、`scripting`：连接当前知乎标签页。
- `clipboardWrite`：复制 MCN 表格。
- `https://www.zhihu.com/*`：读取公开作者资料并执行用户主动触发的拉黑请求。

## 来源与许可

- 原作者：xioxin
- 原文章：<https://zhuanlan.zhihu.com/p/9647814222>
- Greasy Fork 发布者：xuser-6 / Dislike soft AD
- 原用户脚本：<https://greasyfork.org/zh-CN/scripts/519155>
- 原脚本版本：1.0.3
- 原脚本许可：MIT

转换版本继续使用 MIT 许可，详见 `LICENSE` 和 `NOTICE.md`。
