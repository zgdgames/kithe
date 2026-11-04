const { app, BrowserWindow, BrowserView, ipcMain, Menu, screen, session } = require('electron');
const path = require('path');
const fs = require('node:fs');
const https = require('node:https');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { resolveInput, loadRegistry, extractHostname, EXCLUSIVE_DIR } = require('./urlResolver');
const store = require('./store');
const updater = require('./updater');

app.setName('Kithe');

// Kithe never keeps a cache of the sites it loads (cookies and site logins
// are untouched, so you stay signed in). The HTTP cache is pointed at RAM
// with a 1-byte cap, and every other on-disk cache folder is wiped on launch
// and on quit.
const SITE_CACHE_DIRS = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'Service Worker', 'Shared Dictionary'];
app.commandLine.appendSwitch('disk-cache-dir', path.join(fs.existsSync('/dev/shm') ? '/dev/shm' : require('node:os').tmpdir(), 'kithe-cache'));
app.commandLine.appendSwitch('disk-cache-size', '1');
app.commandLine.appendSwitch('media-cache-size', '1');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
function wipeSiteCaches() {
  for (const dir of SITE_CACHE_DIRS) {
    try { fs.rmSync(path.join(app.getPath('userData'), dir), { recursive: true, force: true }); } catch {}
  }
}
wipeSiteCaches();
app.on('will-quit', wipeSiteCaches);

app.on('web-contents-created', (_e, wc) => {
  wc.on('before-input-event', (event, input) => {
    const k = String(input.key).toLowerCase();
    if (input.type === 'keyDown' && (k === 'f12' || ((input.control || input.meta) && input.shift && 'ijc'.includes(k)) || (input.meta && input.alt && 'ijc'.includes(k)))) event.preventDefault();
  });
  wc.on('devtools-opened', () => wc.closeDevTools());
});

const INTERNAL_DIR = path.join(__dirname, '..', 'internal');

let mainWindow = null;
let tabs = new Map(); // id -> { view, id, customHostname, displayOverride }
let tabOrder = [];
let activeTabId = null;
const runningServers = new Map(); // hostname -> { proc, ready: Promise<void> }
let nextTabId = 1;
// Actual rendered height of the chrome (tabstrip + toolbar), reported by
// the renderer via ResizeObserver.
let chromeHeight = 88;

// webContents.navigationHistory.canGoBack()/goBack() etc. only became
// fully functional in later Electron versions; some versions expose a
// navigationHistory object without those methods. Feature-detect the
// method itself, not just the object, and fall back to the older
// wc.canGoBack()/goBack() API.
function canGoBack(wc) {
  return typeof wc.navigationHistory?.canGoBack === 'function' ? wc.navigationHistory.canGoBack() : wc.canGoBack();
}
function canGoForward(wc) {
  return typeof wc.navigationHistory?.canGoForward === 'function' ? wc.navigationHistory.canGoForward() : wc.canGoForward();
}
function goBack(wc) {
  return typeof wc.navigationHistory?.goBack === 'function' ? wc.navigationHistory.goBack() : wc.goBack();
}
function goForward(wc) {
  return typeof wc.navigationHistory?.goForward === 'function' ? wc.navigationHistory.goForward() : wc.goForward();
}

function displayUrl(tab) {
  if (tab.displayOverride) return tab.displayOverride;
  return tab.view.webContents.getURL();
}

function sendTabState(tabId) {
  const tab = tabs.get(tabId);
  if (!tab || !mainWindow) return;
  const wc = tab.view.webContents;
  mainWindow.webContents.send('tab:updated', {
    id: tabId,
    url: displayUrl(tab),
    title: wc.getTitle() || 'New Tab',
    canGoBack: canGoBack(wc),
    canGoForward: canGoForward(wc),
    loading: wc.isLoading(),
    faviconUrl: tab.faviconUrl || null,
  });
}

// BrowserView is a native layer that Electron always paints on top of the
// host window's own HTML, regardless of CSS z-index — our own DOM content
// (settings/bookmarks panels, the rename prompt, toasts) can never appear
// above it while it covers that screen region. Two different responses:
//  - overlayActive (a right-anchored panel): narrow the view to leave room
//    on the right, but keep the page's layout width (device emulation) so
//    the panel just covers the page's right edge — nothing reflows.
//  - modalActive (a centered blocking dialog, e.g. the rename prompt):
//    fully detach the page — normal dialog behavior blocks the page
//    underneath anyway, and a centered dialog can't be exposed by
//    reserving a strip on one edge.
const PANEL_RESERVED_WIDTH = 340;
let overlayActive = false;
let modalActive = false;

function layoutActiveView() {
  if (!mainWindow || activeTabId === null) return;
  const tab = tabs.get(activeTabId);
  if (!tab) return;
  if (modalActive) {
    mainWindow.removeBrowserView(tab.view);
    return;
  }
  mainWindow.addBrowserView(tab.view);
  const [width, height] = mainWindow.getContentSize();
  const w = overlayActive ? Math.max(200, width - PANEL_RESERVED_WIDTH) : width;
  // Clamp: a window shorter than the chrome would otherwise ask for a
  // negative height, which Electron renders as a stale/garbled view.
  const y = Math.min(chromeHeight, height);
  const viewHeight = Math.max(0, height - y);
  tab.view.setBounds({ x: 0, y, width: w, height: viewHeight });
  if (overlayActive && w < width) {
    tab.view.webContents.enableDeviceEmulation({
      screenPosition: 'desktop',
      screenSize: { width, height: viewHeight },
      viewPosition: { x: 0, y: 0 },
      deviceScaleFactor: 0,
      viewSize: { width, height: viewHeight },
      scale: 1,
    });
    tab.emulated = true;
  } else if (tab.emulated) {
    tab.view.webContents.disableDeviceEmulation();
    tab.emulated = false;
  }
}

// Window geometry changes settle asynchronously: the compositor animates a
// fullscreen/maximize transition, and the final 'resize' can arrive while
// getContentSize() still reports an intermediate size. Laying out once (or
// on a fixed timer) latches that stale size and leaves the page short of
// the window edge. Instead, keep re-laying out until the content size holds
// steady for a few ticks, then stop — self-limiting, so no idle polling.
let relayoutTimer = null;

function relayoutAfterGeometryChange() {
  layoutActiveView();
  if (relayoutTimer) clearInterval(relayoutTimer);

  let last = mainWindow.getContentSize().join('x');
  let stableTicks = 0;

  relayoutTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(relayoutTimer);
      relayoutTimer = null;
      return;
    }
    const now = mainWindow.getContentSize().join('x');
    if (now !== last) {
      last = now;
      stableTicks = 0;
      layoutActiveView();
    } else if (++stableTicks >= 4) {
      clearInterval(relayoutTimer);
      relayoutTimer = null;
      layoutActiveView();
    }
  }, 60);
}

// Loads one of our own local pages and hands it the current registry (plus,
// for the home page, bookmarks) as window.__* globals, so these pages can
// render without needing Node access.
function loadCustomEntry(tabId, hostname, entryPath) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.customHostname = hostname;
  tab.displayOverride = `http://${hostname}/`;
  const injected = { __registry: loadRegistry() };
  if (hostname === 'home.local') {
    injected.__bookmarks = store.getBookmarks();
    const registry = injected.__registry;
    injected.__exclusiveApps = Object.entries(registry)
      .filter(([host]) => host !== 'home.local')
      .map(([host, entry]) => ({
        hostname: host,
        title: entry.title,
        icon: entry.icon || null,
        // iconImage paths are relative to EXCLUSIVE_DIR; home/index.html lives
        // one level down inside it, so go up one to resolve them as <img src>.
        iconImage: entry.iconImage ? `../${entry.iconImage}` : null,
      }));
  }
  tab.view.webContents.loadFile(entryPath).then(() => {
    const script = Object.entries(injected).map(([k, v]) => `window.${k} = ${JSON.stringify(v)};`).join('\n');
    tab.view.webContents.executeJavaScript(script).catch(() => {});
  });
}

// Polls a local port until it accepts HTTP connections (or times out).
function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('timed out waiting for server'));
        else setTimeout(attempt, 200);
      });
      req.on('timeout', () => req.destroy());
    };
    attempt();
  });
}

// Some exclusive apps (like Cyber Track) are full Node servers (Express +
// socket.io for multiplayer), not static files. Spawn the server once per
// hostname, reusing it across tabs, and wait for it to accept connections
// before navigating.
function ensureServerRunning(hostname, entry) {
  const existing = runningServers.get(hostname);
  if (existing) return existing.ready;

  const cwd = path.join(EXCLUSIVE_DIR, entry.dir);
  const [cmd, ...args] = entry.command;
  const proc = spawn(cmd, args, { cwd, stdio: 'ignore' });
  proc.on('exit', () => runningServers.delete(hostname));
  proc.on('error', () => runningServers.delete(hostname));

  const ready = waitForPort(entry.port, 8000);
  runningServers.set(hostname, { proc, ready });
  return ready;
}

function loadServerEntry(tabId, hostname, entry) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.customHostname = hostname;
  tab.displayOverride = `http://${hostname}/`;
  ensureServerRunning(hostname, entry)
    .then(() => tab.view.webContents.loadURL(`http://localhost:${entry.port}/`))
    .catch(() => tab.view.webContents.loadURL(`http://localhost:${entry.port}/`));
}

function activateRegistryEntry(tabId, hostname, entry) {
  if (entry.type === 'native') return;
  if (entry.type === 'server') {
    loadServerEntry(tabId, hostname, entry);
  } else {
    loadCustomEntry(tabId, hostname, path.join(EXCLUSIVE_DIR, entry.entry));
  }
}

// Fetches results from Google's official Custom Search JSON API (an
// authorized, key-based API — not scraping google.com's live page, which
// Google's bot detection blocks for automated/background requests anyway).
function googleCustomSearch(query, apiKey, cx) {
  return new Promise((resolve) => {
    const apiUrl = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}`;
    https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            resolve({ error: json.error.message || 'Search API error' });
          } else {
            const results = (json.items || []).map((it) => ({
              title: it.title,
              url: it.link,
              snippet: it.snippet || '',
            }));
            resolve({ results });
          }
        } catch (err) {
          resolve({ error: 'Could not parse search response' });
        }
      });
    }).on('error', (err) => resolve({ error: err.message }));
  });
}

// Reads Google's results page in a hidden window with its own throwaway
// session, so it is never signed in to the user's account.
const GOOGLE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

// Google wraps result links in its own redirect; asking it for the target
// without any cookies gives the real address.
async function resolveGoogleLinks(results) {
  for (let pass = 0; pass < 3; pass++) await resolveGooglePass(results);
}

function resolveGooglePass(results) {
  return Promise.all(results.map((r) => new Promise((resolve) => {
    if (!r.url || !r.url.includes('/goto?')) return resolve();
    const req = https.get(r.url, { headers: { 'User-Agent': GOOGLE_UA }, timeout: 6000 }, (res) => {
      if (res.headers.location && /^https?:/.test(res.headers.location)) {
        r.url = res.headers.location;
        try {
          const u = new URL(r.url);
          const host = u.hostname.replace(/^www\./, '');
          r.display = host + u.pathname.split('/').filter(Boolean).map((x) => ' \u203a ' + x).join('');
          if (!r.site || r.site.includes('://')) r.site = host;
        } catch {}
      }
      res.resume();
      resolve();
    });
    req.on('error', () => resolve());
    req.on('timeout', () => { req.destroy(); resolve(); });
  })));
}

function privateGoogleSearch(query, kind = 'web') {
  const ai = kind === 'ai';
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      width: 412,
      height: 915,
      webPreferences: { sandbox: true, contextIsolation: true, partition: 'private-search', backgroundThrottling: false },
    });
    win.webContents.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
    let code = '';
    try { code = fs.readFileSync(path.join(INTERNAL_DIR, ai ? 'ai-extract.js' : kind === 'images' ? 'images-extract.js' : 'search-extract.js'), 'utf-8'); } catch {}
    let finished = false;
    const finish = async (out) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      if (!win.isDestroyed()) win.destroy();
      if (out && Array.isArray(out.results)) await resolveGoogleLinks(out.results);
      resolve(out);
    };
    let last = -1;
    let stable = 0;
    let polls = 0;
    let lastText = '';
    const timer = setInterval(async () => {
      polls++;
      if (ai) {
        let text = '';
        try { text = String(await win.webContents.executeJavaScript(`${code}(${JSON.stringify(query)})`, true) || '').trim(); } catch {}
        if (text.length > 25) {
          stable = text === lastText ? stable + 1 : 0;
          lastText = text;
          if (stable >= 2) { finish({ ai: true, answer: text }); return; }
        }
        if (polls >= 36) finish(text.length > 25 ? { ai: true, answer: text } : { error: 'AI Mode had no answer for that' });
        return;
      }
      let o = null;
      try { o = JSON.parse(await win.webContents.executeJavaScript(code, true)); } catch {}
      const n = o && o.results ? o.results.length : 0;
      stable = n > 0 && n === last ? stable + 1 : 0;
      last = n;
      if (n > 0 && stable >= 1) finish(o);
      else if (polls >= 24) finish(n > 0 ? o : { error: 'No results came back' });
    }, 800);
    win.loadURL('https://www.google.com/search?hl=en' + ({ ai: '&udm=50', images: '&udm=2', videos: '&udm=7', news: '&tbm=nws' }[kind] || '') + '&q=' + encodeURIComponent(query)).catch(() => {});
  });
}

function performSearch(tabId, query, kind = 'web') {
  if (kind === true) kind = 'ai';
  const ai = kind === 'ai';
  const tab = tabs.get(tabId);
  if (!tab) return;
  tab.customHostname = null;
  tab.displayOverride = `kithe://${kind === 'web' ? 'search' : kind}?q=${encodeURIComponent(query)}`;

  const settings = store.getSettings();
  const configured = !!(settings.googleApiKey && settings.googleCx) && settings.searchMode === 'api';

  tab.view.webContents.loadFile(path.join(INTERNAL_DIR, 'search.html'), ai ? { query: { ai: '1' } } : kind !== 'web' ? { query: { kind } } : undefined).then(async () => {
    let state = { configured: true, query };
    const outcome = ai
      ? (query ? await privateGoogleSearch(query, 'ai') : {})
      : configured && kind === 'web'
        ? await googleCustomSearch(query, settings.googleApiKey, settings.googleCx)
        : await privateGoogleSearch(query, kind);
    state = { ...state, ...outcome };
    tab.view.webContents.executeJavaScript(`window.__searchState = ${JSON.stringify(state)};`).catch(() => {});
  });
}

function navigateTab(tabId, rawInput) {
  const tab = tabs.get(tabId);
  if (!tab) return;
  const settings = store.getSettings();
  const resolved = resolveInput(rawInput, settings.searchEngine);
  if (resolved.type === 'custom') {
    activateRegistryEntry(tabId, resolved.hostname, resolved.entry);
  } else if (resolved.type === 'search') {
    performSearch(tabId, rawInput.trim());
  } else {
    tab.customHostname = null;
    tab.displayOverride = null;
    tab.view.webContents.loadURL(resolved.url);
  }
}

function createTab(initialUrl) {
  const id = nextTabId++;
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const tab = { view, id, customHostname: null, displayOverride: null, faviconUrl: null };
  tabs.set(id, tab);
  tabOrder.push(id);

  const wc = view.webContents;

  // Intercept in-page navigations (e.g. clicking a link to an exclusive
  // URL, or submitting the home page's search box) so custom hostnames
  // resolve to local apps and searches go through the normal resolver
  // instead of hitting real DNS.
  const interceptCustomNav = (event, url) => {
    if (url.startsWith('kithe-ai:')) {
      event.preventDefault();
      performSearch(tab.id, decodeURIComponent(url.slice('kithe-ai:'.length)), true);
      return;
    }
    const vertical = ['images', 'news', 'videos'].find((k) => url.startsWith('kithe-' + k + ':'));
    if (vertical) {
      event.preventDefault();
      performSearch(tab.id, decodeURIComponent(url.slice(('kithe-' + vertical + ':').length)), vertical);
      return;
    }
    if (url.startsWith('kithe-voice:')) {
      event.preventDefault();
      return;
    }
    if (url.startsWith('kithe-search:')) {
      event.preventDefault();
      navigateTab(id, decodeURIComponent(url.slice('kithe-search:'.length)));
      return;
    }
    // Home page bookmark-folder management: since the home page is a
    // sandboxed tab with no IPC/preload access, it signals actions by
    // "navigating" to a fake kithe-bookmark-action: URL carrying a
    // base64url JSON payload. Intercept it, persist the change, and
    // reload the home page so it re-renders with the updated data.
    if (url.startsWith('kithe-bookmark-action:')) {
      event.preventDefault();
      try {
        const payload = JSON.parse(Buffer.from(url.slice('kithe-bookmark-action:'.length), 'base64url').toString('utf-8'));
        const patch = {};
        if ('folder' in payload) patch.folder = payload.folder || null;
        if ('title' in payload) patch.title = payload.title;
        store.updateBookmark(payload.id, patch);
      } catch {
        // malformed payload — ignore, just reload
      }
      const registry = loadRegistry();
      if (registry['home.local']) activateRegistryEntry(id, 'home.local', registry['home.local']);
      return;
    }
    const hostname = extractHostname(url);
    const registry = loadRegistry();
    if (hostname && registry[hostname]) {
      event.preventDefault();
      activateRegistryEntry(id, hostname, registry[hostname]);
    } else {
      tab.customHostname = null;
      tab.displayOverride = null;
    }
  };
  wc.on('will-navigate', interceptCustomNav);
  wc.setWindowOpenHandler(({ url }) => {
    const hostname = extractHostname(url);
    const registry = loadRegistry();
    if (hostname && registry[hostname]) {
      activateRegistryEntry(id, hostname, registry[hostname]);
      return { action: 'deny' };
    }
    // Sites routinely open links via target="_blank" or window.open() (e.g.
    // eBay listings). Returning 'allow' here would let Electron spawn a
    // bare, uncontrolled native window with none of Kithe's chrome — open
    // it as a normal new tab instead, like every real browser does.
    if (url && url !== 'about:blank') createTab(url);
    return { action: 'deny' };
  });

  // Right-clicking an image offers Copy Image / Download Image…
  wc.on('context-menu', (event, params) => {
    if (params.mediaType !== 'image' || !params.srcURL) return;
    Menu.buildFromTemplate([
      { label: 'Copy Image', click: () => wc.copyImageAt(params.x, params.y) },
      {
        label: 'Download Image…',
        click: () => mainWindow?.webContents.send('image:ask-name', {
          srcURL: params.srcURL,
          defaultName: defaultImageName(params.srcURL),
        }),
      },
    ]).popup({ window: mainWindow });
  });

  wc.on('did-start-loading', () => {
    tab.faviconUrl = null;
    sendTabState(id);
  });
  wc.on('did-stop-loading', () => sendTabState(id));
  wc.on('page-title-updated', () => sendTabState(id));
  wc.on('page-favicon-updated', (e, favicons) => {
    tab.faviconUrl = favicons[0] || null;
    sendTabState(id);
  });
  wc.on('did-navigate', () => sendTabState(id));
  wc.on('did-navigate-in-page', () => sendTabState(id));

  mainWindow.webContents.send('tab:created', { id });
  switchTab(id);
  navigateTab(id, initialUrl || 'home.local');
  return id;
}

function switchTab(id) {
  const tab = tabs.get(id);
  if (!tab || !mainWindow) return;
  if (activeTabId !== null) {
    const prev = tabs.get(activeTabId);
    if (prev) mainWindow.removeBrowserView(prev.view);
  }
  activeTabId = id;
  layoutActiveView();
  sendTabState(id);
}

function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) return;
  if (activeTabId === id) mainWindow.removeBrowserView(tab.view);
  tab.view.webContents.close();
  tabs.delete(id);
  tabOrder = tabOrder.filter((t) => t !== id);
  mainWindow.webContents.send('tab:closed', { id });

  if (activeTabId === id) {
    activeTabId = null;
    const fallback = tabOrder[tabOrder.length - 1];
    if (fallback) switchTab(fallback);
    else createTab();
  }
}

function cycleTab(delta) {
  if (tabOrder.length < 2 || activeTabId === null) return;
  const idx = tabOrder.indexOf(activeTabId);
  const next = tabOrder[(idx + delta + tabOrder.length) % tabOrder.length];
  switchTab(next);
}

// Whether the window is in a fullscreen-like state (OS fullscreen and/or
// our own chrome-hidden "full-screen tab" mode). Escape should only be
// reserved to exit that state — binding it unconditionally would swallow
// Escape on every website (closing modals, exiting video players, etc.)
// even when nothing is fullscreen.
let immersiveActive = false;

function buildMenu() {
  const escapeActive = immersiveActive || !!mainWindow?.isFullScreen();
  const template = [
    {
      label: 'Kithe',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => createTab() },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => activeTabId !== null && closeTab(activeTabId) },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => activeTabId !== null && tabs.get(activeTabId)?.view.webContents.reload() },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => activeTabId !== null && tabs.get(activeTabId)?.view.webContents.reloadIgnoringCache() },
        { label: 'Focus Address Bar', accelerator: 'CmdOrCtrl+L', click: () => mainWindow?.webContents.send('shortcut:focus-address') },
        { label: 'Bookmark Page', accelerator: 'CmdOrCtrl+D', click: () => mainWindow?.webContents.send('shortcut:toggle-bookmark') },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('shortcut:toggle-settings') },
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => cycleTab(1) },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => cycleTab(-1) },
        { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        { label: 'Toggle Full-Screen Tab', accelerator: 'CmdOrCtrl+Shift+F', click: () => mainWindow?.webContents.send('shortcut:toggle-immersive') },
        ...(escapeActive ? [{
          label: 'Exit Fullscreen',
          accelerator: 'Escape',
          click: () => {
            if (mainWindow?.isFullScreen()) mainWindow.setFullScreen(false);
            mainWindow?.webContents.send('shortcut:exit-immersive');
          },
        }] : []),
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        // Electron's default 'viewMenu' role includes Reload (CmdOrCtrl+R)
        // and Force Reload (CmdOrCtrl+Shift+R) items that reload the
        // focused window's OWN page — i.e. the chrome UI (index.html)
        // itself, not the active tab. Reloading the chrome wipes its
        // in-memory tab strip state and recreates a single fresh tab,
        // which looks exactly like every tab closing at once. Built our
        // own View menu without those two items so our tab-scoped Reload
        // above is the only thing bound to those accelerators.
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;

  mainWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    backgroundColor: '#1e1f26',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  // Every event that can change the content area, not just 'resize' —
  // maximize/unmaximize/fullscreen don't reliably emit 'resize' on Linux.
  mainWindow.on('resize', layoutActiveView);
  for (const ev of ['maximize', 'unmaximize', 'restore']) {
    mainWindow.on(ev, relayoutAfterGeometryChange);
  }
  for (const ev of ['enter-full-screen', 'leave-full-screen']) {
    mainWindow.on(ev, () => {
      buildMenu();
      relayoutAfterGeometryChange();
    });
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const searchArg = process.argv.find((a) => a.startsWith('--search='));
    const query = searchArg ? Buffer.from(searchArg.slice('--search='.length), 'base64url').toString('utf-8') : '';
    createTab(query || undefined);
  });
}

// "Install as app" launches with --open-url=<base64> instead of opening the
// normal tabbed browser — this creates a bare window showing just that one
// page, with no tab strip or toolbar, so it actually feels like a separate
// installed application rather than "Kithe with a URL typed in".
function createAppWindow(url) {
  const appWindow = new BrowserWindow({
    title: 'Kithe',
    width: 1200,
    height: 800,
    backgroundColor: '#1e1f26',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  appWindow.once('ready-to-show', () => appWindow.show());
  // Links to other sites (and target=_blank links) stay inside the app.
  appWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) appWindow.loadURL(target);
    return { action: 'deny' };
  });
  // Electron otherwise syncs the OS window/taskbar title to the loaded
  // page's own <title> (e.g. "Cyber Track") — keep it branded as Kithe.
  appWindow.on('page-title-updated', (e) => e.preventDefault());

  const hostname = extractHostname(url);
  const registry = loadRegistry();
  const entry = hostname ? registry[hostname] : null;
  if (entry && entry.type === 'server') {
    ensureServerRunning(hostname, entry)
      .then(() => appWindow.loadURL(`http://localhost:${entry.port}/`))
      .catch(() => appWindow.loadURL(`http://localhost:${entry.port}/`));
  } else if (entry) {
    appWindow.loadFile(path.join(EXCLUSIVE_DIR, entry.entry));
  } else {
    appWindow.loadURL(url);
  }
}

function slugify(title) {
  return (title || 'site')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'site';
}

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/svg+xml': 'svg',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
};

// Downloads bytes from a URL (following one redirect), resolving null on
// any failure so the caller can fall back to Kithe's own icon.
function downloadFile(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, { timeout: timeoutMs }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          downloadFile(new URL(res.headers.location, url).toString(), timeoutMs).then(resolve);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => req.destroy());
    } catch {
      resolve(null);
    }
  });
}

async function installAsApp({ url, title, faviconUrl }) {
  const slug = slugify(title);
  const iconsDir = path.join(__dirname, '..', 'build', 'site-icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  let iconPath = path.join(__dirname, '..', 'build', 'icon.png'); // fallback
  if (faviconUrl && faviconUrl.startsWith('file:')) {
    try {
      const src = decodeURIComponent(new URL(faviconUrl).pathname);
      const dest = path.join(iconsDir, `${slug}${path.extname(src) || '.png'}`);
      fs.copyFileSync(src, dest);
      iconPath = dest;
    } catch {
      // fall back to Kithe's icon
    }
  } else if (faviconUrl) {
    const downloaded = await downloadFile(faviconUrl);
    if (downloaded && downloaded.buffer.length > 0) {
      const mime = (downloaded.contentType || '').split(';')[0].trim();
      const ext = EXT_BY_MIME[mime] || 'png';
      const dest = path.join(iconsDir, `${slug}.${ext}`);
      fs.writeFileSync(dest, downloaded.buffer);
      iconPath = dest;
    }
  }

  const launcher = path.join(__dirname, '..', 'bin', 'kithe-browser');
  const desktopPath = path.join(app.getPath('home'), '.local', 'share', 'applications', `kithe-site-${slug}.desktop`);
  const desktopContent = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${title || url}`,
    `Comment=Opens ${url} directly in Kithe`,
    `Exec="${launcher}" --open-url=${Buffer.from(url).toString('base64url')} %U`,
    `Icon=${iconPath}`,
    'Terminal=false',
    'Categories=Network;WebBrowser;',
    'StartupWMClass=Kithe',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(desktopPath), { recursive: true });
  fs.writeFileSync(desktopPath, desktopContent);
  spawn('update-desktop-database', [path.dirname(desktopPath)], { stdio: 'ignore' }).on('error', () => {});

  return { success: true, path: desktopPath };
}

function defaultImageName(srcURL) {
  if (srcURL.startsWith('data:')) return 'image';
  try {
    const last = decodeURIComponent(new URL(srcURL).pathname.split('/').filter(Boolean).pop() || '');
    return last || 'image';
  } catch {
    return 'image';
  }
}

const IMAGE_EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

// Picks a path in Downloads that doesn't overwrite an existing file.
function uniqueDownloadPath(name) {
  const dir = app.getPath('downloads');
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  let candidate = path.join(dir, name);
  for (let n = 1; fs.existsSync(candidate); n++) candidate = path.join(dir, `${base} (${n})${ext}`);
  return candidate;
}

function saveImage(srcURL, requestedName) {
  return new Promise((resolve) => {
    let name = (requestedName || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'image';
    const withExt = (mime) => (/\.[A-Za-z0-9]{2,5}$/.test(name) ? name : `${name}.${IMAGE_EXT_BY_MIME[mime] || 'png'}`);

    if (srcURL.startsWith('data:')) {
      try {
        const comma = srcURL.indexOf(',');
        const meta = srcURL.slice(5, comma);
        const buffer = meta.includes(';base64')
          ? Buffer.from(srcURL.slice(comma + 1), 'base64')
          : Buffer.from(decodeURIComponent(srcURL.slice(comma + 1)));
        const dest = uniqueDownloadPath(withExt(meta.split(/[;,]/)[0]));
        fs.writeFileSync(dest, buffer);
        resolve({ success: true, name: path.basename(dest) });
      } catch (err) {
        resolve({ success: false, message: err.message });
      }
      return;
    }

    const tab = tabs.get(activeTabId);
    if (!tab) {
      resolve({ success: false, message: 'No active tab' });
      return;
    }
    session.defaultSession.once('will-download', (e, item) => {
      const dest = uniqueDownloadPath(withExt(item.getMimeType()));
      item.setSavePath(dest);
      item.once('done', (ev, state) => {
        resolve(state === 'completed' ? { success: true, name: path.basename(dest) } : { success: false, message: state });
      });
    });
    tab.view.webContents.downloadURL(srcURL);
  });
}

ipcMain.handle('image:download', (e, { srcURL, name }) => saveImage(srcURL, name));

ipcMain.handle('app:install', (e, payload) => installAsApp(payload).catch((err) => ({ success: false, message: err.message })));

ipcMain.handle('nav:navigate', (e, { tabId, input }) => navigateTab(tabId, input));
ipcMain.handle('nav:back', (e, { tabId }) => goBack(tabs.get(tabId)?.view.webContents));
ipcMain.handle('nav:forward', (e, { tabId }) => goForward(tabs.get(tabId)?.view.webContents));
ipcMain.handle('nav:reload', (e, { tabId }) => tabs.get(tabId)?.view.webContents.reload());
ipcMain.handle('nav:stop', (e, { tabId }) => tabs.get(tabId)?.view.webContents.stop());
ipcMain.handle('tab:new', (e, { url } = {}) => createTab(url));
ipcMain.handle('tab:close', (e, { tabId }) => closeTab(tabId));
ipcMain.handle('tab:switch', (e, { tabId }) => switchTab(tabId));
ipcMain.handle('tab:getState', (e, { tabId }) => {
  const tab = tabs.get(tabId);
  if (!tab) return null;
  const wc = tab.view.webContents;
  return {
    id: tabId,
    url: displayUrl(tab),
    title: wc.getTitle() || 'New Tab',
    canGoBack: canGoBack(wc),
    canGoForward: canGoForward(wc),
    loading: wc.isLoading(),
    faviconUrl: tab.faviconUrl || null,
  };
});

ipcMain.handle('registry:get', () => loadRegistry());
ipcMain.handle('registry:exclusiveDir', () => EXCLUSIVE_DIR);

ipcMain.handle('bookmarks:list', () => store.getBookmarks());
ipcMain.handle('bookmarks:add', (e, { url, title, faviconUrl }) => store.addBookmark(url, title, faviconUrl));
ipcMain.handle('bookmarks:remove', (e, { id }) => store.removeBookmark(id));
ipcMain.handle('bookmarks:rename', (e, { id, title }) => store.updateBookmark(id, { title }));
ipcMain.handle('bookmarks:setFolder', (e, { id, folder }) => store.updateBookmark(id, { folder: folder || null }));

ipcMain.handle('search:ai', (e, { q }) => { if (activeTabId !== null) performSearch(activeTabId, (q || '').trim(), true); });
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('settings:get', () => store.getSettings());
ipcMain.handle('settings:set', (e, partial) => store.setSettings(partial));

ipcMain.on('chrome:resize', (e, height) => {
  if (typeof height !== 'number' || height < 0 || height === chromeHeight) return;
  // A near-zero height is only legitimate in full-screen-tab mode (chrome
  // deliberately hidden). Outside that mode, treat it as a stray/glitched
  // measurement rather than trusting it — otherwise a single bad reading
  // could make the page content cover the entire toolbar, leaving every
  // button behind it and unclickable.
  if (height < 30 && !immersiveActive) return;
  chromeHeight = height;
  layoutActiveView();
});

ipcMain.on('immersive:changed', (e, active) => {
  immersiveActive = !!active;
  buildMenu();
});

ipcMain.on('overlay:active', (e, active) => {
  overlayActive = !!active;
  layoutActiveView();
});

ipcMain.on('modal:active', (e, active) => {
  modalActive = !!active;
  layoutActiveView();
  // The active tab's BrowserView is a separate webContents that can hold
  // real OS-level keyboard focus even after being detached from the
  // window — without this, the modal's input renders and looks focused
  // but never actually receives typed characters, since the chrome
  // window's own webContents never got real input focus to give to it.
  if (modalActive && mainWindow) {
    mainWindow.focus();
    mainWindow.webContents.focus();
  }
});

if (process.argv.includes('--assistant-engine')) require('./assistantEngine').start();
const ENGINE = process.argv.includes('--assistant-engine');

app.whenReady().then(() => {
  if (ENGINE) return;
  updater.start();
  const openUrlArg = process.argv.find((a) => a.startsWith('--open-url='));
  if (openUrlArg) {
    const url = Buffer.from(openUrlArg.slice('--open-url='.length), 'base64url').toString('utf-8');
    createAppWindow(url);
  } else {
    buildMenu();
    createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !ENGINE) app.quit();
});

app.on('will-quit', () => updater.applyStaged());

app.on('before-quit', () => {
  for (const { proc } of runningServers.values()) proc.kill();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
