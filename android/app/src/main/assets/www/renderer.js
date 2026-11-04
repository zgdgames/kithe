// Surface any JS error loudly instead of silently breaking the whole UI —
// self-contained (no dependency on functions defined later) so it works
// even if the error happens before the rest of the script finishes.
function showFatalError(message) {
  let banner = document.getElementById('fatalErrorBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'fatalErrorBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#c0392b;color:#fff;' +
      'font:12px monospace;padding:8px 12px;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto;';
    document.documentElement.appendChild(banner);
  }
  const line = document.createElement('div');
  line.textContent = message;
  banner.appendChild(line);
}
window.addEventListener('error', (e) => showFatalError('JS error: ' + e.message + ' (' + e.filename + ':' + e.lineno + ')'));
window.addEventListener('unhandledrejection', (e) => showFatalError('Unhandled promise rejection: ' + (e.reason?.message || e.reason)));

const chromeEl = document.getElementById('chrome');
const tabsEl = document.getElementById('tabs');
const addressBar = document.getElementById('addressBar');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const newTabBtn = document.getElementById('newTabBtn');
const bookmarkBtn = document.getElementById('bookmarkBtn');
const voiceBtn = document.getElementById('voiceBtn');
const aiBtn = document.getElementById('aiBtn');
const bookmarksBtn = document.getElementById('bookmarksBtn');
const settingsBtn = document.getElementById('settingsBtn');
const immersiveBtn = document.getElementById('immersiveBtn');
const bookmarksPanel = document.getElementById('bookmarksPanel');
const settingsPanel = document.getElementById('settingsPanel');
const bookmarksList = document.getElementById('bookmarksList');
const bookmarksBarEl = document.getElementById('bookmarksBar');
const searchModeToggle = document.getElementById('searchModeToggle');
const apiFields = document.getElementById('apiFields');
const googleApiKeyInput = document.getElementById('googleApiKeyInput');
const googleCxInput = document.getElementById('googleCxInput');
const accentPicker = document.getElementById('accentPicker');
const bgPicker = document.getElementById('bgPicker');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const exclusiveList = document.getElementById('exclusiveList');
const installAppBtn = document.getElementById('installAppBtn');
const promptOverlay = document.getElementById('promptOverlay');
const promptLabel = document.getElementById('promptLabel');
const promptInput = document.getElementById('promptInput');
const promptCancel = document.getElementById('promptCancel');
const promptOk = document.getElementById('promptOk');

// Electron doesn't implement window.prompt() (it silently no-ops), so this
// stands in for it — a small modal returning a Promise<string|null>.
// Like the settings/bookmarks panels, this is drawn in the chrome window's
// own DOM below the toolbar — the same region the active tab's BrowserView
// always paints on top of — so it needs the same overlay-active signal to
// main (shrinking the page) or it renders invisibly underneath the page.
let promptResolve = null;
function showPrompt(label, defaultValue) {
  promptLabel.textContent = label;
  promptInput.value = defaultValue || '';
  promptOverlay.classList.remove('hidden');
  syncOverlayState();
  promptInput.focus();
  promptInput.select();
  return new Promise((resolve) => { promptResolve = resolve; });
}
function closePrompt(result) {
  promptOverlay.classList.add('hidden');
  syncOverlayState();
  if (promptResolve) { promptResolve(result); promptResolve = null; }
}
promptOk.addEventListener('click', () => closePrompt(promptInput.value));
promptCancel.addEventListener('click', () => closePrompt(null));
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') closePrompt(promptInput.value);
  else if (e.key === 'Escape') closePrompt(null);
});

const tabState = new Map(); // id -> { url, title, canGoBack, canGoForward, loading }
let activeTabId = null;
let bookmarksCache = [];

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Real site favicon when available, falling back to a generic globe (and
// gracefully degrading to that same globe if the favicon fails to load).
function iconHtml(state) {
  if (state.loading) return '<span class="icon">⏳</span>';
  if (state.faviconUrl) {
    return `<img class="favicon" src="${escapeHtml(state.faviconUrl)}" onerror="this.outerHTML='<span class=icon>🌐</span>'" />`;
  }
  return '<span class="icon">🌐</span>';
}

// --- Tabs ---
function render() {
  tabsEl.innerHTML = '';

  for (const [id, state] of tabState) {
    const el = document.createElement('div');
    el.className = 'tab' + (id === activeTabId ? ' active' : '');
    el.title = state.title || 'New Tab';
    el.innerHTML = `
      ${iconHtml(state)}
      <span class="title">${escapeHtml(state.title || 'New Tab')}</span>
      <span class="close">✕</span>
    `;
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('close')) {
        window.browserAPI.closeTab(id);
      } else {
        window.browserAPI.switchTab(id);
      }
    });
    tabsEl.appendChild(el);
  }

  if (activeTabId !== null && tabState.has(activeTabId)) {
    const s = tabState.get(activeTabId);
    if (document.activeElement !== addressBar) {
      addressBar.value = s.url && s.url !== 'about:blank' ? s.url : '';
    }
    backBtn.disabled = !s.canGoBack;
    forwardBtn.disabled = !s.canGoForward;
    reloadBtn.textContent = s.loading ? '✕' : '↻';
    updateBookmarkStar();
  }
}

window.browserAPI.onTabCreated(({ id }) => {
  tabState.set(id, { url: '', title: 'New Tab', canGoBack: false, canGoForward: false, loading: true });
  activeTabId = id;
  render();
});

window.browserAPI.onTabClosed(({ id }) => {
  tabState.delete(id);
  render();
});

window.browserAPI.onTabUpdated((data) => {
  // Mutate the existing state object in place rather than replacing it —
  // onTabUpdated fires constantly (every navigation, title change, favicon
  // load, loading start/stop), and replacing the object each time would
  // orphan anything still holding a reference to the old one.
  let state = tabState.get(data.id);
  if (state) {
    if (data.id === activeTabId && Object.keys(data).every((k) => state[k] === data[k])) return;
    Object.assign(state, data);
  } else {
    state = { ...data };
    tabState.set(data.id, state);
  }
  activeTabId = data.id;
  render();
});

addressBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && activeTabId !== null) {
    window.browserAPI.navigate(activeTabId, addressBar.value);
    addressBar.blur();
  }
});

backBtn.addEventListener('click', () => activeTabId !== null && window.browserAPI.back(activeTabId));
forwardBtn.addEventListener('click', () => activeTabId !== null && window.browserAPI.forward(activeTabId));
reloadBtn.addEventListener('click', () => {
  if (activeTabId === null) return;
  const s = tabState.get(activeTabId);
  if (s && s.loading) window.browserAPI.stop(activeTabId);
  else window.browserAPI.reload(activeTabId);
});
newTabBtn.addEventListener('click', () => window.browserAPI.newTab());
if (window.browserAPI.voiceSearch) voiceBtn.classList.remove('hidden');
voiceBtn.addEventListener('click', () => window.browserAPI.voiceSearch());
aiBtn.addEventListener('click', () => {
  const typed = document.activeElement === addressBar ? addressBar.value.trim() : '';
  window.browserAPI.aiSearch(typed);
});

// --- Panels ---
// BrowserView (the active tab's content) is a native layer Electron always
// paints on top of this window's own HTML, ignoring CSS z-index — so a
// panel positioned under the toolbar would otherwise render invisibly,
// covered by whatever page is open. Right-anchored panels/toasts narrow
// the page's view so it stops at the panel's edge (setOverlayActive); the centered rename prompt, being a
// blocking modal, fully detaches it instead (setModalActive) since a
// reserved edge strip can't expose something centered.
function syncOverlayState() {
  const panelOpen = !bookmarksPanel.classList.contains('hidden') || !settingsPanel.classList.contains('hidden');
  const toastVisible = !!document.querySelector('.toast.show');
  window.browserAPI.setOverlayActive(panelOpen || toastVisible);
  window.browserAPI.setModalActive(!promptOverlay.classList.contains('hidden'));
}

function closeAllPanels() {
  bookmarksPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  syncOverlayState();
}

function togglePanel(panel) {
  const wasHidden = panel.classList.contains('hidden');
  closeAllPanels();
  if (wasHidden) panel.classList.remove('hidden');
  syncOverlayState();
}

document.querySelectorAll('.panel-close').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.close).classList.add('hidden');
    syncOverlayState();
  });
});

// --- Bookmarks ---
async function refreshBookmarks() {
  bookmarksCache = await window.browserAPI.listBookmarks();
  if (bookmarksCache.length === 0) {
    bookmarksList.innerHTML = '<div class="panel-empty">No bookmarks yet — click ☆ in the address bar</div>';
  } else {
    bookmarksList.innerHTML = '';
    for (const b of bookmarksCache) {
      const el = document.createElement('div');
      el.className = 'panel-item';
      el.innerHTML = `
        <span class="title">${escapeHtml(b.title)}</span>
        <span class="rename" title="Rename">✎</span>
        <span class="remove">✕</span>
      `;
      el.title = b.url;
      el.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove')) {
          window.browserAPI.removeBookmark(b.id).then(refreshBookmarks).then(renderBookmarksBar);
        } else if (e.target.classList.contains('rename')) {
          const name = await showPrompt('Rename bookmark:', b.title);
          if (name !== null) {
            await window.browserAPI.renameBookmark(b.id, name.trim() || b.title);
            refreshBookmarks();
            renderBookmarksBar();
          }
        } else if (activeTabId !== null) {
          window.browserAPI.navigate(activeTabId, b.url);
          closeAllPanels();
        }
      });
      bookmarksList.appendChild(el);
    }
  }
  renderBookmarksBar();
}

// The bookmarks bar sits under the toolbar and is visible on every site
// (not just the home page) — right-click a bookmark to rename it, move it
// to a folder, or remove it; click a folder chip to see what's inside.
let openBookmarksFolder = null;
let openBmPopover = null;
function closeBmPopover() {
  if (openBmPopover) { openBmPopover.remove(); openBmPopover = null; }
}
document.addEventListener('click', closeBmPopover);

function bmChipIcon(b) {
  return b.faviconUrl
    ? `<img class="bm-icon" src="${escapeHtml(b.faviconUrl)}" alt="" onerror="this.outerHTML='🌐'" />`
    : '🌐';
}

function openBmMenu(anchorEl, b, folderNames) {
  closeBmPopover();
  const pop = document.createElement('div');
  pop.className = 'bm-popover';
  const rect = anchorEl.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.top = (rect.bottom + 4) + 'px';
  pop.style.left = rect.left + 'px';

  const buttons = [`<button data-act="rename">✎ Rename…</button>`];
  for (const name of folderNames) {
    if (name === b.folder) continue;
    buttons.push(`<button data-act="folder" data-folder="${escapeHtml(name)}">📁 Move to "${escapeHtml(name)}"</button>`);
  }
  buttons.push(`<button data-act="newfolder">＋ New folder…</button>`);
  if (b.folder) buttons.push(`<button data-act="folder" data-folder="">Remove from folder</button>`);
  buttons.push(`<button data-act="remove">✕ Remove bookmark</button>`);
  pop.innerHTML = buttons.join('');

  pop.querySelectorAll('button[data-act="folder"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.browserAPI.setBookmarkFolder(b.id, btn.dataset.folder || null);
      refreshBookmarks();
    });
  });
  pop.querySelector('[data-act="remove"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    bookmarksCache = await window.browserAPI.removeBookmark(b.id);
    updateBookmarkStar();
    refreshBookmarks();
  });
  pop.querySelector('[data-act="rename"]').addEventListener('click', async (e) => {
    e.stopPropagation();
    closeBmPopover();
    const name = await showPrompt('Rename bookmark:', b.title);
    if (name !== null) {
      await window.browserAPI.renameBookmark(b.id, name.trim() || b.title);
      refreshBookmarks();
    }
  });
  const newFolderBtn = pop.querySelector('[data-act="newfolder"]');
  newFolderBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    newFolderBtn.outerHTML = '<input type="text" placeholder="Folder name" spellcheck="false" />';
    const input = pop.querySelector('input');
    input.focus();
    input.addEventListener('click', (ev) => ev.stopPropagation());
    input.addEventListener('keydown', async (ev) => {
      if (ev.key === 'Enter' && input.value.trim()) {
        await window.browserAPI.setBookmarkFolder(b.id, input.value.trim());
        refreshBookmarks();
      }
    });
  });

  document.body.appendChild(pop);
  openBmPopover = pop;
}

function renderBookmarksBar() {
  bookmarksBarEl.innerHTML = '';
  bookmarksBarEl.classList.toggle('hidden', bookmarksCache.length === 0);
  if (bookmarksCache.length === 0) return;

  const folderNames = [...new Set(bookmarksCache.filter((b) => b.folder).map((b) => b.folder))];

  if (openBookmarksFolder && !folderNames.includes(openBookmarksFolder)) openBookmarksFolder = null;

  if (openBookmarksFolder) {
    const back = document.createElement('div');
    back.className = 'bm-chip';
    back.innerHTML = `← ${escapeHtml(openBookmarksFolder)}`;
    back.addEventListener('click', () => { openBookmarksFolder = null; renderBookmarksBar(); });
    bookmarksBarEl.appendChild(back);
    for (const b of bookmarksCache.filter((x) => x.folder === openBookmarksFolder)) {
      bookmarksBarEl.appendChild(renderBmChip(b, folderNames));
    }
    return;
  }

  for (const b of bookmarksCache.filter((x) => !x.folder)) {
    bookmarksBarEl.appendChild(renderBmChip(b, folderNames));
  }
  for (const name of folderNames) {
    const count = bookmarksCache.filter((x) => x.folder === name).length;
    const chip = document.createElement('div');
    chip.className = 'bm-chip bm-folder';
    chip.innerHTML = `📁 <span class="bm-label">${escapeHtml(name)} (${count})</span>`;
    chip.addEventListener('click', () => { openBookmarksFolder = name; renderBookmarksBar(); });
    bookmarksBarEl.appendChild(chip);
  }
}

function renderBmChip(b, folderNames) {
  const chip = document.createElement('div');
  chip.className = 'bm-chip';
  chip.title = b.url;
  chip.innerHTML = `${bmChipIcon(b)}<span class="bm-label">${escapeHtml(b.title)}</span>`;
  chip.addEventListener('click', () => {
    if (activeTabId !== null) window.browserAPI.navigate(activeTabId, b.url);
  });
  chip.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openBmMenu(chip, b, folderNames);
  });
  return chip;
}

function updateBookmarkStar() {
  const s = tabState.get(activeTabId);
  const isBookmarked = s && bookmarksCache.some((b) => b.url === s.url);
  bookmarkBtn.textContent = isBookmarked ? '★' : '☆';
  bookmarkBtn.classList.toggle('active', !!isBookmarked);
}

async function toggleBookmark() {
  if (activeTabId === null) return;
  const s = tabState.get(activeTabId);
  if (!s || !s.url) return;
  const existing = bookmarksCache.find((b) => b.url === s.url);
  if (existing) {
    bookmarksCache = await window.browserAPI.removeBookmark(existing.id);
  } else {
    const name = await showPrompt('Name this bookmark:', s.title || s.url);
    if (name === null) return; // cancelled
    bookmarksCache = await window.browserAPI.addBookmark(s.url, name.trim() || s.title || s.url, s.faviconUrl);
  }
  updateBookmarkStar();
  bookmarkBtn.classList.remove('pop');
  void bookmarkBtn.offsetWidth; // restart animation
  bookmarkBtn.classList.add('pop');
  renderBookmarksBar();
  if (!bookmarksPanel.classList.contains('hidden')) refreshBookmarks();
}

bookmarkBtn.addEventListener('click', toggleBookmark);
bookmarksBtn.addEventListener('click', () => { togglePanel(bookmarksPanel); refreshBookmarks(); });

// --- Settings ---

/**
 * Rotates a hex colour's hue, keeping saturation and lightness. Used to derive
 * the second half of the blue-to-purple ramp from whatever accent is picked,
 * so a custom accent still gets a matching gradient instead of a clashing one.
 */
function shiftHue(hex, degrees) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  let [r, g, b] = m.slice(1).map(v => parseInt(v, 16) / 255);

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + degrees + 360) % 360;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const mm = l - c / 2;
  const seg = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h / 60) % 6];
  const to = v => Math.round((v + mm) * 255).toString(16).padStart(2, '0');
  return '#' + seg.map(to).join('');
}

function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--accent', theme.accent);
  root.setProperty('--accent-2', theme.accent2 || shiftHue(theme.accent, 35));
  root.setProperty('--bg', theme.bg);
}

function loadTheme() {
  const saved = JSON.parse(localStorage.getItem('theme') || '{}');
  // Untouched theme uses the icon's exact blue/purple pair; a custom accent
  // derives its partner instead.
  const theme = {
    accent: saved.accent || '#5b8cff',
    accent2: saved.accent ? undefined : '#a45bff',
    bg: saved.bg || '#1e1f26',
  };
  accentPicker.value = theme.accent;
  bgPicker.value = theme.bg;
  applyTheme(theme);
}

function saveTheme() {
  const theme = { accent: accentPicker.value, bg: bgPicker.value };
  localStorage.setItem('theme', JSON.stringify(theme));
  applyTheme(theme);
}

accentPicker.addEventListener('input', saveTheme);
bgPicker.addEventListener('input', saveTheme);

async function refreshExclusiveList() {
  const registry = await window.browserAPI.getRegistry();
  const hosts = Object.keys(registry);
  if (hosts.length === 0) {
    exclusiveList.innerHTML = '<div class="panel-empty">None installed</div>';
    return;
  }
  exclusiveList.innerHTML = hosts.map((h) => {
    const entry = registry[h];
    const icon = entry.iconImage
      ? `<img class="exclusive-icon" src="Extra exclusive URLS/${entry.iconImage}" alt="" />`
      : `${entry.icon || '⭐'}`;
    return `
      <div class="exclusive-item">
        <span>${icon} ${escapeHtml(entry.title || h)}</span>
        <span class="host">${escapeHtml(h)}</span>
      </div>
    `;
  }).join('');
}

function setSearchMode(mode) {
  searchModeToggle.dataset.value = mode;
  apiFields.classList.toggle('collapsed', mode !== 'api');
}

searchModeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.segmented-opt');
  if (btn) setSearchMode(btn.dataset.mode);
});

async function loadSettings() {
  const settings = await window.browserAPI.getSettings();
  googleApiKeyInput.value = settings.googleApiKey || '';
  googleCxInput.value = settings.googleCx || '';
  setSearchMode(settings.searchMode || 'direct');
}

saveSettingsBtn.addEventListener('click', async () => {
  await window.browserAPI.setSettings({
    searchMode: searchModeToggle.dataset.value,
    googleApiKey: googleApiKeyInput.value.trim(),
    googleCx: googleCxInput.value.trim(),
  });
  closeAllPanels();
});

document.getElementById('resetSettingsBtn').addEventListener('click', async () => {
  await window.browserAPI.setSettings({
    searchMode: 'direct',
    searchEngine: 'https://www.google.com/search?q=%s',
    googleApiKey: '',
    googleCx: '',
  });
  localStorage.removeItem('theme');
  loadTheme();
  await loadSettings();
  showToast('Settings restored to default');
});

if (window.browserAPI.appVersion) {
  window.browserAPI.appVersion().then((v) => { document.getElementById('versionLine').textContent = 'Kithe ' + v; });
}

settingsBtn.addEventListener('click', () => {
  togglePanel(settingsPanel);
  loadSettings();
  refreshExclusiveList();
});

installAppBtn.addEventListener('click', async () => {
  const s = activeTabId !== null ? tabState.get(activeTabId) : null;
  if (!s || !s.url) return;
  const name = await showPrompt('Name this app:', s.title || s.url);
  if (name === null) return;
  installAppBtn.disabled = true;
  installAppBtn.textContent = 'Installing…';
  const result = await window.browserAPI.installAsApp({ url: s.url, title: name.trim() || s.title, faviconUrl: s.faviconUrl });
  installAppBtn.disabled = false;
  installAppBtn.textContent = '📌 Install current page as app';
  showToast(result.success ? `Installed — check your app launcher` : `Failed: ${result.message || 'unknown error'}`);
});

// --- Full-screen tab (hide chrome entirely) ---
function showToast(text) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('show'); syncOverlayState(); }, 10);
  setTimeout(() => {
    toast.classList.remove('show');
    syncOverlayState();
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

function toggleImmersive() {
  const on = document.body.classList.toggle('chrome-hidden');
  if (on) showToast('Full-screen tab — press Esc or Ctrl+Shift+F to exit');
  window.browserAPI.reportImmersive(on);
}
function exitImmersive() {
  if (document.body.classList.contains('chrome-hidden')) {
    document.body.classList.remove('chrome-hidden');
    window.browserAPI.reportImmersive(false);
  }
}
immersiveBtn.addEventListener('click', toggleImmersive);

// --- Image right-click → Download Image… (choose the file name) ---
window.browserAPI.onImageAskName(async ({ srcURL, defaultName }) => {
  const name = await showPrompt('Save image as:', defaultName);
  if (name === null) return;
  const result = await window.browserAPI.downloadImage(srcURL, name.trim() || defaultName);
  showToast(result.success ? `Saved to Downloads as ${result.name}` : `Failed: ${result.message || 'unknown error'}`);
});

// --- Keyboard shortcuts from main process ---
window.browserAPI.onFocusAddress(() => { addressBar.focus(); addressBar.select(); });
window.browserAPI.onToggleBookmark(() => toggleBookmark());
window.browserAPI.onToggleSettings(() => { togglePanel(settingsPanel); loadSettings(); refreshExclusiveList(); });
window.browserAPI.onToggleImmersive(() => toggleImmersive());
window.browserAPI.onExitImmersive(() => exitImmersive());

loadTheme();
refreshBookmarks();

// Tell main how tall the chrome actually is (tabstrip + toolbar) so the
// page content area is positioned correctly.
const chromeResizeObserver = new ResizeObserver((entries) => {
  const height = Math.round(entries[0].contentRect.height);
  document.documentElement.style.setProperty('--chrome-height', height + 'px');
  window.browserAPI.reportChromeHeight(height);
});
chromeResizeObserver.observe(chromeEl);
