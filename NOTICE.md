# Attribution Notice

This repository is a Chrome Manifest V3 conversion of the userscript:

> 让MCN闪耀，让荣誉的勋章更容易看到！

## Original Work

- Original article author: xioxin
- Original article: <https://zhuanlan.zhihu.com/p/9647814222>
- Greasy Fork publisher: xuser-6 / Dislike soft AD
- Greasy Fork source: <https://greasyfork.org/zh-CN/scripts/519155>
- Original userscript version: 1.0.3
- Original license: MIT

The original userscript remains available in `source/original.user.js` for
attribution and reference.

## Conversion

The Chrome extension conversion includes:

- Manifest V3 packaging and permissions.
- A Chrome extension popup replacing the userscript manager menu.
- `chrome.storage.local` persistence and legacy cache migration.
- A MAIN-world compatibility bridge for the original console functions.
- Repository documentation, automated checks, and release packaging.

This project is not affiliated with Zhihu, xioxin, Greasy Fork, or the
Tampermonkey project.
