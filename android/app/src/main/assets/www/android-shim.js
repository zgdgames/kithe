// Provides window.browserAPI to the shared desktop UI (renderer.js) on
// Android, backed by the native app instead of Electron's preload/IPC.
(function () {
  const native = window.KitheNative;
  let seq = 0;
  const pending = new Map();
  const listeners = {};

  window.__kitheResolve = (id, json) => {
    const resolve = pending.get(id);
    pending.delete(id);
    if (resolve) resolve(JSON.parse(json));
  };
  window.__kitheEmit = (channel, data) => {
    (listeners[channel] || []).forEach((cb) => cb(data));
  };

  const invoke = (channel, payload) => new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    native.invoke(id, channel, JSON.stringify(payload === undefined ? {} : payload));
  });
  const send = (channel, payload) => native.send(channel, JSON.stringify(payload === undefined ? null : payload));
  const on = (channel, cb) => { (listeners[channel] = listeners[channel] || []).push(cb); };

  // The chrome is only as tall as the tab strip + toolbar. Anything drawn
  // below that (panels, the name prompt, bookmark popovers) needs the whole
  // screen, so the native side is told to give the chrome full height while
  // one of them is open. The chrome turns transparent then, and the native
  // side hands touches outside the regions reported here to the tab, so the
  // page stays visible and usable around the panel.
  let full = false;
  function uiRects() {
    const pad = 8;
    const rects = [];
    document.querySelectorAll('.panel:not(.hidden), .bm-popover, #promptOverlay:not(.hidden)').forEach((el) => {
      const r = el.getBoundingClientRect();
      rects.push([r.left - pad, r.top - pad, r.width + 2 * pad, r.height + 2 * pad]);
    });
    return rects;
  }
  function syncFull() {
    const open = (id) => !document.getElementById(id).classList.contains('hidden');
    const now = open('bookmarksPanel') || open('settingsPanel') || open('promptOverlay') || !!document.querySelector('.bm-popover');
    if (now !== full) {
      full = now;
      document.documentElement.classList.toggle('kithe-overlay', full);
      send('chrome:full', full);
    }
    if (full) send('chrome:rects', uiRects());
  }
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.classList && n.classList.contains('toast')) native.toast(n.textContent);
      });
    }
    syncFull();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

  window.browserAPI = {
    navigate: (tabId, input) => invoke('nav:navigate', { tabId, input }),
    back: (tabId) => invoke('nav:back', { tabId }),
    forward: (tabId) => invoke('nav:forward', { tabId }),
    reload: (tabId) => invoke('nav:reload', { tabId }),
    stop: (tabId) => invoke('nav:stop', { tabId }),
    newTab: (url) => invoke('tab:new', { url }),
    closeTab: (tabId) => invoke('tab:close', { tabId }),
    switchTab: (tabId) => invoke('tab:switch', { tabId }),
    getTabState: (tabId) => invoke('tab:getState', { tabId }),

    getRegistry: () => invoke('registry:get'),
    getExclusiveDir: () => invoke('registry:exclusiveDir'),

    listBookmarks: () => invoke('bookmarks:list'),
    addBookmark: (url, title, faviconUrl) => invoke('bookmarks:add', { url, title, faviconUrl }),
    removeBookmark: (id) => invoke('bookmarks:remove', { id }),
    renameBookmark: (id, title) => invoke('bookmarks:rename', { id, title }),
    setBookmarkFolder: (id, folder) => invoke('bookmarks:setFolder', { id, folder }),

    getSettings: () => invoke('settings:get'),
    setSettings: (partial) => invoke('settings:set', partial),

    reportChromeHeight: (height) => send('chrome:resize', height),
    reportImmersive: (active) => send('immersive:changed', active),
    setOverlayActive: () => syncFull(),
    setModalActive: () => syncFull(),

    onTabCreated: (cb) => on('tab:created', cb),
    onTabClosed: (cb) => on('tab:closed', cb),
    onTabUpdated: (cb) => on('tab:updated', cb),

    voiceSearch: () => invoke('search:voice'),
    appVersion: () => invoke('app:version'),
  aiSearch: (q) => invoke('search:ai', { q }),

    installAsApp: (payload) => invoke('app:install', payload),

    downloadImage: (srcURL, name) => invoke('image:download', { srcURL, name }),
    onImageAskName: (cb) => on('image:ask-name', cb),

    onFocusAddress: (cb) => on('shortcut:focus-address', cb),
    onToggleBookmark: (cb) => on('shortcut:toggle-bookmark', cb),
    onToggleSettings: (cb) => on('shortcut:toggle-settings', cb),
    onToggleImmersive: (cb) => on('shortcut:toggle-immersive', cb),
    onExitImmersive: (cb) => on('shortcut:exit-immersive', cb),
  };
})();
