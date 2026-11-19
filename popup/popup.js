(() => {
  'use strict';

  const CHANNEL = 'mcn-zhihu-extension';
  const elements = {
    pageStatus: document.querySelector('#page-status'),
    autoLoad: document.querySelector('#auto-load'),
    hideContent: document.querySelector('#hide-content'),
    scanPage: document.querySelector('#scan-page'),
    copyTable: document.querySelector('#copy-table'),
    clearCache: document.querySelector('#clear-cache'),
    mcnCount: document.querySelector('#mcn-count'),
    authorCount: document.querySelector('#author-count'),
    recordStatus: document.querySelector('#record-status'),
    mcnList: document.querySelector('#mcn-list'),
    toast: document.querySelector('#toast'),
  };

  let activeTabId = null;
  let ready = false;
  let toastTimer = null;

  const setUiDisabled = (disabled) => {
    for (const element of [
      elements.autoLoad,
      elements.hideContent,
      elements.scanPage,
      elements.copyTable,
      elements.clearCache,
    ]) {
      element.disabled = disabled;
    }
  };

  const setToast = (message, isError = false) => {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.style.color = isError ? '#b42318' : '#475467';
    toastTimer = window.setTimeout(() => {
      elements.toast.textContent = '';
    }, 2600);
  };

  const getActiveTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return tab;
  };

  const isZhihuTab = (tab) => {
    try {
      const url = new URL(tab.url);
      return url.protocol === 'https:' && url.hostname === 'www.zhihu.com';
    } catch {
      return false;
    }
  };

  const sendToTab = (message) =>
    chrome.tabs.sendMessage(activeTabId, {
      channel: CHANNEL,
      ...message,
    });

  const ensureContentScript = async () => {
    try {
      return await sendToTab({ type: 'GET_STATE' });
    } catch {
      await chrome.scripting.insertCSS({
        target: { tabId: activeTabId },
        files: ['styles/content.css'],
      });
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['scripts/page-bridge.js'],
        world: 'MAIN',
      });
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ['scripts/content.js'],
      });
      return sendToTab({ type: 'GET_STATE' });
    }
  };

  const unwrap = (response) => {
    if (!response?.ok) {
      throw new Error(response?.error || '操作失败');
    }
    return response.data;
  };

  const renderRecords = (records) => {
    elements.mcnList.replaceChildren();
    elements.recordStatus.textContent = records.length
      ? `共 ${records.length} 位`
      : '等待数据';

    if (!records.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = '还没有发现 MCN 作者';
      elements.mcnList.appendChild(empty);
      return;
    }

    const grouped = new Map();
    for (const record of records) {
      if (!grouped.has(record.mcn)) {
        grouped.set(record.mcn, []);
      }
      grouped.get(record.mcn).push(record);
    }

    for (const [mcn, authors] of grouped) {
      const details = document.createElement('details');
      details.className = 'mcn-card';

      const summary = document.createElement('summary');
      const title = document.createElement('strong');
      title.textContent = mcn;
      const count = document.createElement('span');
      count.textContent = `${authors.length} 位作者`;
      summary.append(title, count);

      const list = document.createElement('ul');
      list.className = 'author-list';
      for (const author of authors) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = author.url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.textContent = author.nickname;
        link.title = `${author.nickname} (${author.token})`;
        item.appendChild(link);
        list.appendChild(item);
      }

      const blockButton = document.createElement('button');
      blockButton.className = 'block-button';
      blockButton.type = 'button';
      blockButton.textContent = `批量拉黑 ${authors.length} 位作者`;
      blockButton.addEventListener('click', async () => {
        const confirmed = window.confirm(
          `确定拉黑 ${mcn} 的 ${authors.length} 位作者吗？\n\n${authors
            .map((author) => author.nickname)
            .join('、')}`,
        );
        if (!confirmed) {
          return;
        }
        blockButton.disabled = true;
        try {
          const result = unwrap(
            await sendToTab({
              type: 'BLOCK_MCN',
              mcn,
            }),
          );
          setToast(
            `成功 ${result.blocked} 位，失败 ${result.failed} 位`,
            result.failed > 0,
          );
        } catch (error) {
          setToast(error.message, true);
        } finally {
          blockButton.disabled = false;
        }
      });

      details.append(summary, list, blockButton);
      elements.mcnList.appendChild(details);
    }
  };

  const renderState = (data) => {
    elements.autoLoad.checked = data.settings.autoLoad;
    elements.hideContent.checked = data.settings.hideContent;
    elements.mcnCount.textContent = String(data.mcnCount);
    elements.authorCount.textContent = String(data.authorCount);
    renderRecords(data.records);
  };

  const runStateAction = async (message, successMessage) => {
    try {
      const data = unwrap(await sendToTab(message));
      renderState(data);
      if (successMessage) {
        setToast(successMessage);
      }
      return data;
    } catch (error) {
      setToast(error.message, true);
      throw error;
    }
  };

  const initialize = async () => {
    setUiDisabled(true);
    try {
      const tab = await getActiveTab();
      if (!tab?.id || !isZhihuTab(tab)) {
        elements.pageStatus.textContent = '请在知乎网页中使用此扩展';
        elements.pageStatus.style.color = '#b42318';
        return;
      }

      activeTabId = tab.id;
      const response = await ensureContentScript();
      renderState(unwrap(response));
      elements.pageStatus.textContent = '已连接当前知乎页面';
      elements.pageStatus.style.color = '#067647';
      ready = true;
      setUiDisabled(false);
    } catch (error) {
      elements.pageStatus.textContent = '页面连接失败，请刷新知乎后重试';
      elements.pageStatus.style.color = '#b42318';
      setToast(error.message, true);
    }
  };

  elements.autoLoad.addEventListener('change', async () => {
    if (!ready) {
      return;
    }
    elements.autoLoad.disabled = true;
    try {
      await runStateAction({
        type: 'SET_AUTO_LOAD',
        enabled: elements.autoLoad.checked,
      });
    } catch {
      elements.autoLoad.checked = !elements.autoLoad.checked;
    } finally {
      elements.autoLoad.disabled = false;
    }
  });

  elements.hideContent.addEventListener('change', async () => {
    if (!ready) {
      return;
    }
    elements.hideContent.disabled = true;
    try {
      await runStateAction({
        type: 'SET_HIDDEN_CONTENT',
        enabled: elements.hideContent.checked,
      });
    } catch {
      elements.hideContent.checked = !elements.hideContent.checked;
    } finally {
      elements.hideContent.disabled = false;
    }
  });

  elements.scanPage.addEventListener('click', async () => {
    if (!ready) {
      return;
    }
    elements.scanPage.disabled = true;
    try {
      const result = unwrap(await sendToTab({ type: 'SCAN_PAGE' }));
      setToast(
        `已扫描 ${result.authorCount} 个作者区域和 ${result.brandQuestionCount} 个机构提问`,
      );
    } catch (error) {
      setToast(error.message, true);
    } finally {
      elements.scanPage.disabled = false;
    }
  });

  elements.copyTable.addEventListener('click', async () => {
    if (!ready) {
      return;
    }
    elements.copyTable.disabled = true;
    try {
      const text = unwrap(await sendToTab({ type: 'GET_TABLE_TEXT' }));
      if (!text) {
        setToast('暂无可复制的 MCN 数据', true);
        return;
      }
      await navigator.clipboard.writeText(text);
      setToast('已复制 MCN 表格');
    } catch (error) {
      setToast(error.message, true);
    } finally {
      elements.copyTable.disabled = false;
    }
  });

  elements.clearCache.addEventListener('click', async () => {
    if (!ready) {
      return;
    }
    if (!window.confirm('确定清理全部 MCN 缓存吗？')) {
      return;
    }
    elements.clearCache.disabled = true;
    try {
      await runStateAction({ type: 'CLEAR_CACHE' }, '缓存已清理');
    } catch {
      // The toast already explains the failure.
    } finally {
      elements.clearCache.disabled = false;
    }
  });

  void initialize();
})();
