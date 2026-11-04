const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function filePath(name) {
  return path.join(app.getPath('userData'), name);
}

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(name, data) {
  fs.mkdirSync(path.dirname(filePath(name)), { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

const DEFAULT_SETTINGS = {
  searchEngine: 'https://www.google.com/search?q=%s',
  googleApiKey: '',
  googleCx: '',
  searchMode: 'direct', // 'direct' = go straight to the real search engine, 'api' = private results page
};

function getBookmarks() {
  return readJson('bookmarks.json', []);
}

function addBookmark(url, title, faviconUrl) {
  const bookmarks = getBookmarks();
  if (bookmarks.some((b) => b.url === url)) return bookmarks;
  bookmarks.unshift({ id: Date.now(), url, title: title || url, faviconUrl: faviconUrl || null, folder: null, createdAt: Date.now() });
  writeJson('bookmarks.json', bookmarks);
  return bookmarks;
}

function removeBookmark(id) {
  const bookmarks = getBookmarks().filter((b) => b.id !== id);
  writeJson('bookmarks.json', bookmarks);
  return bookmarks;
}

function updateBookmark(id, patch) {
  const bookmarks = getBookmarks();
  const entry = bookmarks.find((b) => b.id === id);
  if (entry) Object.assign(entry, patch);
  writeJson('bookmarks.json', bookmarks);
  return bookmarks;
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson('settings.json', {}) };
}

function setSettings(partial) {
  const merged = { ...getSettings(), ...partial };
  writeJson('settings.json', merged);
  return merged;
}

module.exports = {
  getBookmarks,
  addBookmark,
  removeBookmark,
  updateBookmark,
  getSettings,
  setSettings,
};
