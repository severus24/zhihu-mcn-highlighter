(() => {
  'use strict';

  const CHANNEL = 'mcn-zhihu-extension';
  if (window.__MCN_ZHIHU_PAGE_BRIDGE__) {
    return;
  }
  window.__MCN_ZHIHU_PAGE_BRIDGE__ = true;

  let requestId = 0;
  const pendingRequests = new Map();

  const send = (command, payload = {}, request = false) => {
    if (!request) {
      window.postMessage(
        {
          channel: CHANNEL,
          source: 'page',
          command,
          payload,
        },
        window.location.origin,
      );
      return undefined;
    }

    requestId += 1;
    const id = String(requestId);
    const promise = new Promise((resolve) => {
      pendingRequests.set(id, resolve);
    });
    window.postMessage(
      {
        channel: CHANNEL,
        source: 'page',
        command,
        payload,
        requestId: id,
      },
      window.location.origin,
    );
    return promise;
  };

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (
      event.source !== window ||
      message?.channel !== CHANNEL ||
      message?.source !== 'content' ||
      !pendingRequests.has(message.requestId)
    ) {
      return;
    }

    const resolve = pendingRequests.get(message.requestId);
    pendingRequests.delete(message.requestId);
    resolve(message.result);
  });

  window.mcn = () => {
    send('printMcn');
  };

  window.blockMcn = (name) => send('blockMcn', { name }, true);

  window.hiddenContent = () => {
    send('hiddenContent');
  };

  window.showContent = () => {
    send('showContent');
  };
})();
