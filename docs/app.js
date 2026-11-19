(() => {
  'use strict';

  const status = document.querySelector('.copy-status');
  let statusTimer = null;

  const showStatus = (message) => {
    window.clearTimeout(statusTimer);
    status.textContent = message;
    status.classList.add('visible');
    statusTimer = window.setTimeout(() => {
      status.classList.remove('visible');
    }, 2200);
  };

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = '已复制';
        showStatus('命令已复制到剪贴板');
      } catch {
        button.textContent = '复制失败';
        showStatus('浏览器未允许访问剪贴板');
      }
      window.setTimeout(() => {
        button.textContent = original;
      }, 1800);
    });
  });
})();
