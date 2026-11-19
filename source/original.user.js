// ==UserScript==
// @name         让MCN闪耀，让荣誉的勋章更容易看到！
// @namespace    mcn.is.very.very.good
// @version      1.0.3
// @description  发现更大的世界和更多的软广！
// @author       Dislike soft AD
// @license MIT
// @match        https://www.zhihu.com/*
// @grant        unsafeWindow
// @grant GM_registerMenuCommand
// @grant GM_unregisterMenuCommand
// @grant GM_setClipboard
// ==/UserScript==

(async () => {
  'use strict';

  // 请不要将这里改为 true，否则将会在机构前增加一个emoji表情，这可能会增加攻击性。
  const useIcon = false;

  const setCache = (name, data) => {
    const cache = JSON.parse(localStorage.getItem('mcnCache')) || {};
    cache[name] = data;
    localStorage.setItem('mcnCache', JSON.stringify(cache));
    updateMenu();
  };

  const getCache = (name) => {
    const cache = JSON.parse(localStorage.getItem('mcnCache')) || {};
    return cache[name];
  };

  const setNoMcn = (name) => {
    const noMcn = new Set(JSON.parse(localStorage.getItem('noMcn')) || []);
    noMcn.add(name);
    localStorage.setItem('noMcn', JSON.stringify(Array.from(noMcn)));
  };

  const isNoMcn = (name) => {
    const noMcn = new Set(JSON.parse(localStorage.getItem('noMcn')) || []);
    return noMcn.has(name);
  };

  const promiseMap = {};
  const getAuthorMcn = async (token, manual = false) => {
    const cache = getCache(token);
    if (cache?.mcn) return cache.mcn;
    if (isNoMcn(token)) return false;
    if (promiseMap[token]) return promiseMap[token];
    const autoLoad = localStorage.getItem('mcnAutoLoad') || false;
    if (!autoLoad && !manual) return null;

    promiseMap[token] = new Promise(async (resolve) => {
      const url = `https://www.zhihu.com/people/${token}`;
      const html = await fetch(url).then((response) => response.text());
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const initialData = doc.querySelector('#js-initialData');
      const json = initialData.textContent;
      const data = JSON.parse(json);
      const mcn = data?.initialState?.entities?.users?.[token]?.mcnCompany;
      if (mcn) {
        setCache(token, {
          mcn,
          nickname:
            data?.initialState?.entities?.users?.[token]?.name ?? token,
        });
      } else {
        setNoMcn(token);
      }
      resolve(mcn || false);
      promiseMap[token] = null;
    });
    return promiseMap[token];
  };

  const clearBadge = (mcnBadge) => {
    mcnBadge.onclick = null;
    mcnBadge.style.cursor = null;
    mcnBadge.style.border = null;
    mcnBadge.style.backgroundColor = null;
    mcnBadge.className = 'mcn-badge';
    mcnBadge.textContent = 'Loading...';
    mcnBadge.style.marginLeft = '5px';
    mcnBadge.style.display = 'inline-block';
    mcnBadge.style.color = '#DDD';
    mcnBadge.style.fontSize = '12px';
    mcnBadge.style.padding = '2px';
    mcnBadge.style.borderRadius = '3px';
  };

  const updateBadge = (mcnBadge, token, mcn) => {
    clearBadge(mcnBadge);
    if (mcn) {
      mcnBadge.textContent = mcn;
      mcnBadge.style.marginLeft = '5px';
      mcnBadge.style.display = 'inline-block';
      mcnBadge.style.color = '#FFFFFF';
      mcnBadge.style.backgroundColor = '#FF0000';
      if (useIcon) {
        mcnBadge.textContent = '🐕‍🦺' + mcn;
        mcnBadge.style.backgroundColor = null;
        mcnBadge.style.color = '#FF0000';
      }
      mcnBadge.title = '如果是被包养了，就不要谈独立人格';
    } else if (mcn === false) {
      mcnBadge.textContent = 'No MCN';
    } else {
      mcnBadge.textContent = '点击加载MCN';
      mcnBadge.style.cursor = 'pointer';
      mcnBadge.style.color = '#aaa';
      mcnBadge.style.backgroundColor = '#FFFFFF';
      mcnBadge.style.border = '1px solid #aaa';
      mcnBadge.style.padding = '1px';
      mcnBadge.onclick = async () => {
        clearBadge(mcnBadge);
        const result = await getAuthorMcn(token, true);
        updateBadge(mcnBadge, token, result);
      };
    }
  };

  const addMcnBadge = async (authorDom) => {
    if (authorDom.querySelector('.mcn-badge')) return;
    const box = authorDom.querySelector('.AuthorInfo-head');
    const mcnBadge = document.createElement('span');
    box.appendChild(mcnBadge);
    const userLink = authorDom.querySelector('.UserLink-link');
    if (!userLink) return;
    const link = userLink.getAttribute('href');
    const token = link.split('/').pop();
    clearBadge(mcnBadge);
    const mcn = await getAuthorMcn(token);
    updateBadge(mcnBadge, token, mcn);
  };

  const addQuestionerMcnBadge = async (dom) => {
    if (!dom) return;
    if (dom.querySelector('.mcn-badge')) return;
    const link = dom.querySelector('.BrandQuestionSymbol-brandLink');
    if (!link) return;
    const token = link.getAttribute('href').split('/').pop();
    const mcnBadge = document.createElement('span');
    dom.insertBefore(mcnBadge, link.nextSibling);
    clearBadge(mcnBadge, token, null);
    const mcn = await getAuthorMcn(token);
    updateBadge(mcnBadge, token, mcn);
  };

  const blockAuthor = async (name) => {
    const url = `https://www.zhihu.com/api/v4/members/${name}/actions/block`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
    });
    return response.status === 204;
  };

  const getMcnAuthorMap = () => {
    const cache = JSON.parse(localStorage.getItem('mcnCache')) || {};
    const mcnMap = {};
    for (const [name, data] of Object.entries(cache)) {
      if (!mcnMap[data.mcn]) {
        mcnMap[data.mcn] = [];
      }
      mcnMap[data.mcn].push({ token: name, ...data });
    }
    return mcnMap;
  };

  if (typeof unsafeWindow === 'undefined') {
    window.unsafeWindow = window;
  }

  const mcn = (unsafeWindow.mcn = () => {
    const mcnMap = getMcnAuthorMap();
    console.group('MCN Map');
    for (const [mcn, list] of Object.entries(mcnMap)) {
      console.groupCollapsed(mcn + ' (' + list.length + ')');
      for (const data of list) {
        console.log(
          data.token,
          '\t',
          data.nickname,
          '\t',
          `https://www.zhihu.com/people/${data.token}`,
        );
      }
      console.groupEnd();
    }
    console.groupEnd();
  });

  const blockMcn = (unsafeWindow.blockMcn = async (name) => {
    const mcnMap = getMcnAuthorMap();
    const authors = mcnMap[name] || [];
    if (!authors.length) {
      console.error('没有找到已记录的MCN作者 ' + name);
      return;
    }
    for (const author of authors) {
      const result = await blockAuthor(author.token);
      if (result) {
        console.log(`已屏蔽 ${author.token} ${author.nickname}`);
      } else {
        console.error(`屏蔽失败 ${author.token} ${author.nickname}`);
      }
    }
    console.log('全部完成');
    alert('全部完成');
  });

  const headDom = document.querySelector('head');
  const hiddenContent = (unsafeWindow.hiddenContent = () => {
    const style = document.createElement('style');
    style.id = 'hiddenContent';
    style.textContent = `
      .RichContent {
        display: none !important;
      }
      .LabelContainer-wrapper {
        display: none !important;
      }
    `;
    headDom.appendChild(style);
  });

  const showContent = (unsafeWindow.showContent = () => {
    const style = document.querySelector('style#hiddenContent');
    if (style) {
      style.remove();
    }
  });

  let observer;
  function runObserver() {
    if (observer) observer.disconnect();
    const handle = (node) => {
      if (node.classList?.contains('AuthorInfo')) {
        setTimeout(() => {
          addMcnBadge(node);
        });
      }
      if (node.classList?.contains('BrandQuestionSymbol')) {
        setTimeout(() => {
          addQuestionerMcnBadge(node);
        });
      }
    };
    observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes') {
          handle(mutation.target);
        } else {
          for (const node of mutation.addedNodes) {
            handle(node);
            if (node.childNodes) {
              const nodeIterator = document.createNodeIterator(node);
              let childNode = nodeIterator.nextNode();
              while (childNode) {
                handle(childNode);
                childNode = nodeIterator.nextNode();
              }
            }
          }
        }
      }
    });
    observer.observe(window.document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  const mcnMenuId = [];
  let showMcnList = false;
  const updateMenu = () => {
    if (typeof GM_registerMenuCommand === 'undefined') {
      return;
    }

    try {
      mcnMenuId.forEach((id) => {
        GM_unregisterMenuCommand(id);
      });

      const isAuto = localStorage.getItem('mcnAutoLoad') || false;
      mcnMenuId.push(
        GM_registerMenuCommand(
          `自动加载MCN（当前：${isAuto ? '自动' : '手动'}）`,
          () => {
            localStorage.setItem('mcnAutoLoad', isAuto ? '' : '1');
            updateMenu();
          },
        ),
      );

      const hasHCstyle = document.querySelector('style#hiddenContent');
      mcnMenuId.push(
        GM_registerMenuCommand(
          hasHCstyle ? '显示回答正文（当前：隐藏）' : '隐藏回答正文（当前：显示）',
          () => {
            hasHCstyle ? showContent() : hiddenContent();
            updateMenu();
          },
        ),
      );

      mcnMenuId.push(
        GM_registerMenuCommand('复制表格', () => {
          const mcnMap = getMcnAuthorMap();
          const textList = [];
          for (const [mcn, list] of Object.entries(mcnMap)) {
            for (const data of list) {
              textList.push(
                `${mcn}\t${data.token}\t${data.nickname}\thttps://www.zhihu.com/people/${data.token}`,
              );
            }
          }
          GM_setClipboard(textList.join('\n'));
        }),
      );

      mcnMenuId.push(
        GM_registerMenuCommand('清理缓存', () => {
          if (!confirm('确定要清理缓存吗？')) return;
          localStorage.removeItem('mcnCache');
          localStorage.removeItem('noMcn');
          updateMenu();
        }),
      );

      mcnMenuId.push(
        GM_registerMenuCommand(
          `${showMcnList ? '▼' : '▶'} 显示MCN列表${showMcnList ? '' : ' (需再次打开菜单)'}`,
          () => {
            showMcnList = !showMcnList;
            updateMenu();
          },
          { autoClose: true },
        ),
      );

      if (showMcnList) {
        const mcnMap = getMcnAuthorMap();
        for (const [mcn, list] of Object.entries(mcnMap)) {
          mcnMenuId.push(
            GM_registerMenuCommand(`拉黑 ${mcn} (${list.length})`, async () => {
              if (
                !confirm(
                  `确定要拉黑 ${mcn} (${list.length}) 吗？\n${list
                    .map((value) => value.nickname)
                    .join(', ')}`,
                )
              ) {
                return;
              }
              await blockMcn(mcn);
            }),
          );
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (typeof GM_registerMenuCommand !== 'undefined') {
    updateMenu();
  }
  runObserver();
  addQuestionerMcnBadge();
  const authorDomList = document.querySelectorAll('.AuthorInfo');
  for (const authorDom of authorDomList) {
    await addMcnBadge(authorDom);
  }
})();
