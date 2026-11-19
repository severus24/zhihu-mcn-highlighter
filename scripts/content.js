(() => {
  'use strict';

  if (globalThis.__MCN_ZHIHU_CONTENT_LOADED__) {
    return;
  }
  globalThis.__MCN_ZHIHU_CONTENT_LOADED__ = true;

  const PAGE_CHANNEL = 'mcn-zhihu-extension';
  const STORAGE_KEYS = {
    cache: 'mcnCache',
    noMcn: 'noMcn',
    settings: 'mcnSettings',
  };
  const HIDDEN_STYLE_ID = 'mcn-hidden-content';
  const BADGE_CLASS = 'mcn-badge';
  const lookupPromises = new Map();
  const scheduledAuthors = new WeakSet();
  const scheduledBrandQuestions = new WeakSet();

  const state = {
    cache: {},
    noMcn: [],
    settings: {
      autoLoad: false,
      hideContent: false,
    },
  };

  let stateReady = null;
  let observer = null;

  const safeJsonParse = (value, fallback) => {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const normalizeCache = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value;
  };

  const normalizeNoMcn = (value) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return [...new Set(value.filter((item) => typeof item === 'string'))];
  };

  const normalizeSettings = (value) => ({
    autoLoad: Boolean(value?.autoLoad),
    hideContent: Boolean(value?.hideContent),
  });

  const readLegacyState = () => {
    try {
      return {
        cache: normalizeCache(safeJsonParse(localStorage.getItem(STORAGE_KEYS.cache), {})),
        noMcn: normalizeNoMcn(safeJsonParse(localStorage.getItem(STORAGE_KEYS.noMcn), [])),
        settings: {
          autoLoad: Boolean(localStorage.getItem('mcnAutoLoad')),
          hideContent: false,
        },
      };
    } catch {
      return null;
    }
  };

  const writeState = async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.cache]: state.cache,
      [STORAGE_KEYS.noMcn]: state.noMcn,
      [STORAGE_KEYS.settings]: state.settings,
    });
  };

  const persistState = async () => {
    await stateReady;
    await writeState();
  };

  const loadState = async () => {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.cache,
      STORAGE_KEYS.noMcn,
      STORAGE_KEYS.settings,
    ]);

    const hasStoredData =
      Object.hasOwn(stored, STORAGE_KEYS.cache) ||
      Object.hasOwn(stored, STORAGE_KEYS.noMcn) ||
      Object.hasOwn(stored, STORAGE_KEYS.settings);

    if (hasStoredData) {
      state.cache = normalizeCache(stored[STORAGE_KEYS.cache]);
      state.noMcn = normalizeNoMcn(stored[STORAGE_KEYS.noMcn]);
      state.settings = normalizeSettings(stored[STORAGE_KEYS.settings]);
      return;
    }

    const legacy = readLegacyState();
    if (!legacy) {
      return;
    }

    state.cache = legacy.cache;
    state.noMcn = legacy.noMcn;
    state.settings = legacy.settings;
    await writeState();
  };

  const getTokenFromLink = (link) => {
    if (!link) {
      return null;
    }
    try {
      const url = new URL(link, window.location.origin);
      return url.pathname.split('/').filter(Boolean).pop() || null;
    } catch {
      return null;
    }
  };

  const setCache = async (token, data) => {
    state.cache[token] = data;
    state.noMcn = state.noMcn.filter((name) => name !== token);
    await persistState();
  };

  const setNoMcn = async (token) => {
    if (!state.noMcn.includes(token)) {
      state.noMcn.push(token);
      await persistState();
    }
  };

  const isNoMcn = (token) => state.noMcn.includes(token);

  const getMcnMap = () => {
    const mcnMap = {};
    for (const [token, data] of Object.entries(state.cache)) {
      if (!data?.mcn) {
        continue;
      }
      if (!mcnMap[data.mcn]) {
        mcnMap[data.mcn] = [];
      }
      mcnMap[data.mcn].push({
        token,
        nickname: data.nickname || token,
        mcn: data.mcn,
        url: `https://www.zhihu.com/people/${encodeURIComponent(token)}`,
      });
    }
    return mcnMap;
  };

  const getRecords = () => {
    const mcnMap = getMcnMap();
    return Object.entries(mcnMap)
      .sort(([left], [right]) => left.localeCompare(right, 'zh-CN'))
      .flatMap(([mcn, authors]) =>
        authors
          .slice()
          .sort((left, right) => left.nickname.localeCompare(right.nickname, 'zh-CN'))
          .map((author) => ({
            ...author,
            mcn,
          })),
      );
  };

  const getTableText = () =>
    getRecords()
      .map(
        (record) =>
          `${record.mcn}\t${record.token}\t${record.nickname}\t${record.url}`,
      )
      .join('\n');

  const getAuthorMcn = async (token, manual = false) => {
    if (!token) {
      return null;
    }

    const cached = state.cache[token];
    if (cached?.mcn) {
      return cached.mcn;
    }
    if (isNoMcn(token)) {
      return false;
    }
    if (lookupPromises.has(token)) {
      return lookupPromises.get(token);
    }
    if (!state.settings.autoLoad && !manual) {
      return null;
    }

    const lookup = (async () => {
      try {
        const response = await fetch(`https://www.zhihu.com/people/${token}`, {
          credentials: 'include',
        });
        if (!response.ok) {
          throw new Error(`知乎主页请求失败：HTTP ${response.status}`);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const initialData = doc.querySelector('#js-initialData');
        if (!initialData?.textContent) {
          throw new Error('未找到知乎用户初始化数据');
        }

        const data = JSON.parse(initialData.textContent);
        const user = data?.initialState?.entities?.users?.[token];
        const mcn = user?.mcnCompany;
        if (mcn) {
          await setCache(token, {
            mcn,
            nickname: user?.name || token,
          });
          return mcn;
        }

        await setNoMcn(token);
        return false;
      } catch (error) {
        console.error('[MCN 闪耀助手] 读取 MCN 失败', token, error);
        return null;
      } finally {
        lookupPromises.delete(token);
      }
    })();

    lookupPromises.set(token, lookup);
    return lookup;
  };

  const clearBadge = (badge) => {
    badge.className = BADGE_CLASS;
    badge.dataset.state = 'loading';
    badge.textContent = '加载中…';
    badge.removeAttribute('title');
    badge.onclick = null;
  };

  const updateBadge = (badge, token, mcn) => {
    clearBadge(badge);
    badge.dataset.token = token;

    if (mcn) {
      badge.dataset.state = 'found';
      badge.textContent = mcn;
      badge.title = `所属 MCN：${mcn}`;
      return;
    }

    if (mcn === false) {
      badge.dataset.state = 'none';
      badge.textContent = '无 MCN';
      badge.title = '知乎公开资料中未显示 MCN';
      return;
    }

    badge.dataset.state = 'manual';
    badge.textContent = '点击加载 MCN';
    badge.title = '读取该答主的公开资料';
    badge.onclick = async () => {
      clearBadge(badge);
      const result = await getAuthorMcn(token, true);
      updateBadge(badge, token, result);
    };
  };

  const addMcnBadge = async (authorDom) => {
    if (!(authorDom instanceof Element) || authorDom.querySelector(`.${BADGE_CLASS}`)) {
      return;
    }

    const box = authorDom.querySelector('.AuthorInfo-head');
    const userLink = authorDom.querySelector('.UserLink-link');
    if (!box || !userLink) {
      return;
    }

    const token = getTokenFromLink(userLink.getAttribute('href'));
    if (!token) {
      return;
    }

    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.dataset.token = token;
    box.appendChild(badge);
    clearBadge(badge);

    const mcn = await getAuthorMcn(token);
    if (badge.isConnected) {
      updateBadge(badge, token, mcn);
    }
  };

  const addQuestionerMcnBadge = async (dom) => {
    if (!(dom instanceof Element) || dom.querySelector(`.${BADGE_CLASS}`)) {
      return;
    }

    const link = dom.querySelector('.BrandQuestionSymbol-brandLink');
    if (!link) {
      return;
    }

    const token = getTokenFromLink(link.getAttribute('href'));
    if (!token) {
      return;
    }

    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.dataset.token = token;
    dom.insertBefore(badge, link.nextSibling);
    clearBadge(badge);

    const mcn = await getAuthorMcn(token);
    if (badge.isConnected) {
      updateBadge(badge, token, mcn);
    }
  };

  const scheduleAuthor = (element) => {
    if (scheduledAuthors.has(element)) {
      return;
    }
    scheduledAuthors.add(element);
    window.setTimeout(() => {
      scheduledAuthors.delete(element);
      void addMcnBadge(element);
    }, 0);
  };

  const scheduleBrandQuestion = (element) => {
    if (scheduledBrandQuestions.has(element)) {
      return;
    }
    scheduledBrandQuestions.add(element);
    window.setTimeout(() => {
      scheduledBrandQuestions.delete(element);
      void addQuestionerMcnBadge(element);
    }, 0);
  };

  const inspectNode = (node) => {
    if (!(node instanceof Element)) {
      return;
    }

    if (node.matches('.AuthorInfo')) {
      scheduleAuthor(node);
    }
    if (node.matches('.BrandQuestionSymbol')) {
      scheduleBrandQuestion(node);
    }

    node.querySelectorAll('.AuthorInfo').forEach(scheduleAuthor);
    node.querySelectorAll('.BrandQuestionSymbol').forEach(scheduleBrandQuestion);
  };

  const scanPage = () => {
    const authorCount = document.querySelectorAll('.AuthorInfo').length;
    const brandQuestionCount =
      document.querySelectorAll('.BrandQuestionSymbol').length;

    document.querySelectorAll('.AuthorInfo').forEach(scheduleAuthor);
    document
      .querySelectorAll('.BrandQuestionSymbol')
      .forEach(scheduleBrandQuestion);

    return {
      authorCount,
      brandQuestionCount,
    };
  };

  const startObserver = () => {
    observer?.disconnect();
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          inspectNode(node);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  };

  const blockAuthor = async (token) => {
    const response = await fetch(
      `https://www.zhihu.com/api/v4/members/${encodeURIComponent(token)}/actions/block`,
      {
        method: 'POST',
        credentials: 'include',
      },
    );
    return response.status === 204;
  };

  const blockMcn = async (mcn) => {
    const authors = getMcnMap()[mcn] || [];
    if (!authors.length) {
      console.error(`[MCN 闪耀助手] 没有找到已记录的 MCN 作者：${mcn}`);
      return { total: 0, blocked: 0, failed: 0 };
    }

    let blocked = 0;
    let failed = 0;
    for (const author of authors) {
      try {
        if (await blockAuthor(author.token)) {
          blocked += 1;
          console.log(
            `[MCN 闪耀助手] 已屏蔽 ${author.token} ${author.nickname}`,
          );
        } else {
          failed += 1;
          console.error(
            `[MCN 闪耀助手] 屏蔽失败 ${author.token} ${author.nickname}`,
          );
        }
      } catch (error) {
        failed += 1;
        console.error(
          `[MCN 闪耀助手] 屏蔽失败 ${author.token} ${author.nickname}`,
          error,
        );
      }
    }

    return {
      total: authors.length,
      blocked,
      failed,
    };
  };

  const printMcn = () => {
    const mcnMap = getMcnMap();
    const mcnNames = Object.keys(mcnMap);
    console.group('MCN Map');
    if (!mcnNames.length) {
      console.info('还没有发现 MCN 作者。');
    }
    for (const mcn of mcnNames) {
      const list = mcnMap[mcn];
      console.groupCollapsed(`${mcn} (${list.length})`);
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
  };

  const respondToPage = (requestId, result) => {
    if (!requestId) {
      return;
    }
    window.postMessage(
      {
        channel: PAGE_CHANNEL,
        source: 'content',
        requestId,
        result,
      },
      window.location.origin,
    );
  };

  const applyHiddenContent = (hidden) => {
    const existing = document.querySelector(`style#${HIDDEN_STYLE_ID}`);
    if (!hidden) {
      existing?.remove();
      return;
    }
    if (existing) {
      return;
    }

    const style = document.createElement('style');
    style.id = HIDDEN_STYLE_ID;
    style.textContent = `
      .RichContent {
        display: none !important;
      }
      .LabelContainer-wrapper {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  };

  const setHiddenContent = async (hidden) => {
    state.settings.hideContent = Boolean(hidden);
    applyHiddenContent(state.settings.hideContent);
    await persistState();
  };

  const refreshBadges = async () => {
    const badges = document.querySelectorAll(`.${BADGE_CLASS}[data-token]`);
    for (const badge of badges) {
      const token = badge.dataset.token;
      clearBadge(badge);
      const mcn = await getAuthorMcn(token);
      if (badge.isConnected) {
        updateBadge(badge, token, mcn);
      }
    }
  };

  const clearCache = async () => {
    state.cache = {};
    state.noMcn = [];
    await persistState();

    document
      .querySelectorAll(`.${BADGE_CLASS}[data-token]`)
      .forEach((badge) => {
        const token = badge.dataset.token;
        updateBadge(badge, token, null);
      });

    if (state.settings.autoLoad) {
      void refreshBadges();
    }
  };

  const getStateSnapshot = () => {
    const records = getRecords();
    return {
      settings: { ...state.settings },
      records,
      mcnCount: new Set(records.map((record) => record.mcn)).size,
      authorCount: records.length,
    };
  };

  const handleMessage = async (message) => {
    await stateReady;
    switch (message.type) {
      case 'GET_STATE':
        return { ok: true, data: getStateSnapshot() };
      case 'SET_AUTO_LOAD':
        state.settings.autoLoad = Boolean(message.enabled);
        await persistState();
        if (state.settings.autoLoad) {
          void refreshBadges();
          scanPage();
        }
        return { ok: true, data: getStateSnapshot() };
      case 'SET_HIDDEN_CONTENT':
        await setHiddenContent(message.enabled);
        return { ok: true, data: getStateSnapshot() };
      case 'SCAN_PAGE':
        return { ok: true, data: scanPage() };
      case 'GET_TABLE_TEXT':
        return { ok: true, data: getTableText() };
      case 'CLEAR_CACHE':
        await clearCache();
        return { ok: true, data: getStateSnapshot() };
      case 'BLOCK_MCN': {
        const result = await blockMcn(message.mcn);
        return { ok: true, data: result };
      }
      default:
        return { ok: false, error: '未知操作' };
    }
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.channel !== PAGE_CHANNEL) {
      return false;
    }
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        console.error('[MCN 闪耀助手] 操作失败', error);
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      message?.channel !== PAGE_CHANNEL ||
      message?.source !== 'page'
    ) {
      return;
    }

    switch (message.command) {
      case 'printMcn':
        void stateReady.then(printMcn);
        break;
      case 'blockMcn':
        void stateReady
          .then(() => blockMcn(message.payload?.name))
          .then((result) => {
            if (result.total > 0) {
              window.alert('全部完成');
            }
            respondToPage(message.requestId, result);
          })
          .catch((error) => {
            console.error('[MCN 闪耀助手] 批量拉黑失败', error);
            respondToPage(message.requestId, {
              error: error.message,
            });
          });
        break;
      case 'hiddenContent':
        void stateReady.then(() => setHiddenContent(true));
        break;
      case 'showContent':
        void stateReady.then(() => setHiddenContent(false));
        break;
      default:
        break;
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !stateReady) {
      return;
    }
    if (changes[STORAGE_KEYS.cache]) {
      state.cache = normalizeCache(changes[STORAGE_KEYS.cache].newValue);
    }
    if (changes[STORAGE_KEYS.noMcn]) {
      state.noMcn = normalizeNoMcn(changes[STORAGE_KEYS.noMcn].newValue);
    }
    if (changes[STORAGE_KEYS.settings]) {
      state.settings = normalizeSettings(
        changes[STORAGE_KEYS.settings].newValue,
      );
      applyHiddenContent(state.settings.hideContent);
    }
  });

  stateReady = loadState().catch((error) => {
    console.error('[MCN 闪耀助手] 初始化缓存失败', error);
  });

  void stateReady.then(() => {
    applyHiddenContent(state.settings.hideContent);
    startObserver();
    scanPage();
  });
})();
