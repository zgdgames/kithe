const { app } = require('electron');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const REPO = 'zgdgames/kithe';
const HOUR = 60 * 60 * 1000;
const APP_DIR = path.join(os.homedir(), '.local', 'share', 'kithe');
const STAGE_DIR = APP_DIR + '.new';
const OLD_DIR = APP_DIR + '.old';
const MARKER = '.kithe-staged-version';

let checking = false;

function compareVersions(a, b) {
  const pa = String(a).replace(/^v/i, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/i, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function get(url, handle, redirects = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Kithe-Updater', Accept: 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        resolve(get(res.headers.location, handle, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      handle(res, resolve, reject);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

function getJson(url) {
  return get(url, (res, resolve, reject) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { body += c; });
    res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    res.on('error', reject);
  });
}

function download(url, dest) {
  return get(url, (res, resolve, reject) => {
    const out = fs.createWriteStream(dest);
    res.pipe(out);
    out.on('finish', () => out.close(resolve));
    out.on('error', reject);
    res.on('error', reject);
  });
}

function extract(archive, dest) {
  return new Promise((resolve, reject) => {
    const p = spawn('tar', ['-xzf', archive, '--strip-components=1', '-C', dest], { stdio: 'ignore' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('tar exited with ' + code))));
  });
}

function stagedVersion() {
  try { return fs.readFileSync(path.join(STAGE_DIR, MARKER), 'utf8').trim(); } catch { return null; }
}

async function check() {
  if (checking || process.platform !== 'linux' || path.dirname(process.execPath) !== APP_DIR) return;
  checking = true;
  try {
    const release = await getJson(`https://api.github.com/repos/${REPO}/releases/latest`);
    const latest = String(release.tag_name || '').replace(/^v/i, '');
    if (!latest || compareVersions(latest, app.getVersion()) <= 0) return;
    if (stagedVersion() === latest) return;
    const asset = (release.assets || []).find((a) => a.name.endsWith('-linux-x64.tar.gz'));
    if (!asset) return;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kithe-update-'));
    try {
      const archive = path.join(tmp, 'update.tar.gz');
      await download(asset.browser_download_url, archive);
      fs.rmSync(STAGE_DIR, { recursive: true, force: true });
      fs.mkdirSync(STAGE_DIR, { recursive: true });
      await extract(archive, STAGE_DIR);
      if (!fs.existsSync(path.join(STAGE_DIR, 'kithe'))) throw new Error('update archive has no kithe binary');
      fs.writeFileSync(path.join(STAGE_DIR, MARKER), latest);
    } catch (e) {
      fs.rmSync(STAGE_DIR, { recursive: true, force: true });
      throw e;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn('Kithe update check failed:', e.message);
  } finally {
    checking = false;
  }
}

function applyStaged() {
  if (process.platform !== 'linux' || path.dirname(process.execPath) !== APP_DIR) return;
  const version = stagedVersion();
  if (!version || compareVersions(version, app.getVersion()) <= 0) return;
  try {
    fs.rmSync(OLD_DIR, { recursive: true, force: true });
    fs.renameSync(APP_DIR, OLD_DIR);
    try {
      fs.renameSync(STAGE_DIR, APP_DIR);
      fs.rmSync(path.join(APP_DIR, MARKER), { force: true });
    } catch (e) {
      fs.renameSync(OLD_DIR, APP_DIR);
      throw e;
    }
    fs.rmSync(OLD_DIR, { recursive: true, force: true });
  } catch (e) {
    console.warn('Kithe update could not be applied:', e.message);
  }
}

function start() {
  if (process.platform !== 'linux' || path.dirname(process.execPath) !== APP_DIR) return;
  const staged = stagedVersion();
  if (staged && compareVersions(staged, app.getVersion()) <= 0) fs.rmSync(STAGE_DIR, { recursive: true, force: true });
  setTimeout(check, 10000);
  setInterval(check, HOUR);
}

module.exports = { start, applyStaged, check, compareVersions };
