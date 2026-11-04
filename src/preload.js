const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  navigate: (tabId, input) => ipcRenderer.invoke('nav:navigate', { tabId, input }),
  back: (tabId) => ipcRenderer.invoke('nav:back', { tabId }),
  forward: (tabId) => ipcRenderer.invoke('nav:forward', { tabId }),
  reload: (tabId) => ipcRenderer.invoke('nav:reload', { tabId }),
  stop: (tabId) => ipcRenderer.invoke('nav:stop', { tabId }),
  newTab: (url) => ipcRenderer.invoke('tab:new', { url }),
  closeTab: (tabId) => ipcRenderer.invoke('tab:close', { tabId }),
  switchTab: (tabId) => ipcRenderer.invoke('tab:switch', { tabId }),
  getTabState: (tabId) => ipcRenderer.invoke('tab:getState', { tabId }),

  getRegistry: () => ipcRenderer.invoke('registry:get'),
  getExclusiveDir: () => ipcRenderer.invoke('registry:exclusiveDir'),

  listBookmarks: () => ipcRenderer.invoke('bookmarks:list'),
  addBookmark: (url, title, faviconUrl) => ipcRenderer.invoke('bookmarks:add', { url, title, faviconUrl }),
  removeBookmark: (id) => ipcRenderer.invoke('bookmarks:remove', { id }),
  renameBookmark: (id, title) => ipcRenderer.invoke('bookmarks:rename', { id, title }),
  setBookmarkFolder: (id, folder) => ipcRenderer.invoke('bookmarks:setFolder', { id, folder }),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),

  reportChromeHeight: (height) => ipcRenderer.send('chrome:resize', height),
  reportImmersive: (active) => ipcRenderer.send('immersive:changed', active),
  setOverlayActive: (active) => ipcRenderer.send('overlay:active', active),
  setModalActive: (active) => ipcRenderer.send('modal:active', active),

  onTabCreated: (cb) => ipcRenderer.on('tab:created', (e, data) => cb(data)),
  onTabClosed: (cb) => ipcRenderer.on('tab:closed', (e, data) => cb(data)),
  onTabUpdated: (cb) => ipcRenderer.on('tab:updated', (e, data) => cb(data)),

  appVersion: () => ipcRenderer.invoke('app:version'),
  aiSearch: (q) => ipcRenderer.invoke('search:ai', { q }),

  installAsApp: (payload) => ipcRenderer.invoke('app:install', payload),

  downloadImage: (srcURL, name) => ipcRenderer.invoke('image:download', { srcURL, name }),
  onImageAskName: (cb) => ipcRenderer.on('image:ask-name', (e, data) => cb(data)),

  onFocusAddress: (cb) => ipcRenderer.on('shortcut:focus-address', () => cb()),
  onToggleBookmark: (cb) => ipcRenderer.on('shortcut:toggle-bookmark', () => cb()),
  onToggleSettings: (cb) => ipcRenderer.on('shortcut:toggle-settings', () => cb()),
  onToggleImmersive: (cb) => ipcRenderer.on('shortcut:toggle-immersive', () => cb()),
  onExitImmersive: (cb) => ipcRenderer.on('shortcut:exit-immersive', () => cb()),
});
