// Hidden Kithe engine for the IGX Assistant: runs searches in invisible Kithe windows and returns the answer text.
// Started with: kithe --assistant-engine
const { app, BrowserWindow } = require('electron');
const http = require('http');

const PORT = 47732;
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const AIO_JS = "(function(){document.querySelectorAll('style,script,noscript').forEach(function(x){x.remove()});function clean(t){return (t||'').replace(/\\s+/g,' ').trim();}var all=document.querySelectorAll('h1,h2,h3,div,span');var hdr=null;for(var i=0;i<all.length;i++){var e=all[i];if(e.children.length<=1&&/^AI Overview$/i.test(clean(e.textContent))){hdr=e;break;}}if(hdr){var n=hdr;for(var k=0;k<9&&n.parentElement;k++){n=n.parentElement;var t=clean(n.innerText);if(t.length>200&&t.length<6000){return JSON.stringify({kind:'aio',text:t});}}}var w=document.querySelector('#wob_tm');if(w){var loc=document.querySelector('#wob_loc'),dc=document.querySelector('#wob_dc');return JSON.stringify({kind:'snippet',text:'In '+(loc?clean(loc.innerText):'your area')+', it is '+clean(w.innerText)+' degrees and '+(dc?clean(dc.innerText):'')+'.'});}var cw=document.querySelector('#cwos,.qv3Wpe');if(cw&&clean(cw.innerText))return JSON.stringify({kind:'snippet',text:'The answer is '+clean(cw.innerText)});var sn=document.querySelector('[data-attrid=\"wa:/description\"],[data-attrid=\"description\"],.hgKElc,.Z0LcW,.IZ6rdc,.kno-rdesc span');if(sn&&clean(sn.innerText).length>10)return JSON.stringify({kind:'snippet',text:clean(sn.innerText)});return JSON.stringify({kind:'none',text:''});})()";
const LINES_JS = "(function(){[].forEach.call(document.querySelectorAll('button,[role=button],a'),function(b){var t=(b.innerText||'').trim();var al=b.getAttribute('aria-label')||'';if(/related results|\\(\\+\\d+\\)/i.test(al)||/(^|\\s)\\+\\d+$/.test(t)||/^\\(?\\+\\d+\\)?$/.test(t))b.style.display='none';});return JSON.stringify((document.body?document.body.innerText:'').split('\\n').map(function(x){return x.trim();}).filter(Boolean));})()";
const ANSWER_JS = "(function(q,base){[].forEach.call(document.querySelectorAll('button,[role=button],a'),function(b){var t=(b.innerText||'').trim();var al=b.getAttribute('aria-label')||'';if(/related results|\\(\\+\\d+\\)/i.test(al)||/(^|\\s)\\+\\d+$/.test(t)||/^\\(?\\+\\d+\\)?$/.test(t))b.style.display='none';});function n(x){return (x||'').toLowerCase().replace(/[\\s?!.,]+$/,'').replace(/\\s+/g,' ').trim();}var lines=(document.body?document.body.innerText:'').split('\\n').map(function(x){return x.trim();}).filter(Boolean);var end=/^(Add files and tools|Ask about|Ask anything|Ask a follow|Follow-up|AI can make mistakes|AI Mode response is ready|Microphone|Transcribing\\.\\.\\.|Upload image|My Ad Center)/i;var skip=/^(Show all|Show more|Show less|Copy|Share|Shared|Good response|Bad response|Sources?|Retry|Send|Stop|Thinking.*|Searching.*|Looking.*|Working.*|Generating.*|\\d+ files?|AI Mode|Sign in|Feedback|Dive deeper.*|AI responses may include mistakes.*|[A-Za-z0-9 .&|\\u00b7'-]+ \\+\\d+)$/i;var idx=-1;for(var i=0;i<lines.length;i++){if(n(lines[i])===n(q))idx=i;}var out=[];if(idx>=0){for(var j=idx+1;j<lines.length;j++){if(end.test(lines[j]))break;if(skip.test(lines[j]))continue;out.push(lines[j]);}}if(!out.length&&base){var seen={};base.forEach(function(b){seen[b]=1;});for(var k=0;k<lines.length;k++){var l=lines[k];if(seen[l]||end.test(l)||skip.test(l)||n(l)===n(q))continue;out.push(l);}}return out.join('\\n');})";
const SEND_JS = "(function(q){var vis=function(x){return x.offsetParent!==null;};var ta=[].slice.call(document.querySelectorAll('textarea')).filter(vis)[0];if(!ta){var c=[].slice.call(document.querySelectorAll('[contenteditable=true]')).filter(vis)[0];if(!c)return 'noinput';c.focus();document.execCommand('insertText',false,q);}else{ta.focus();var set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,q);ta.dispatchEvent(new Event('input',{bubbles:true}));ta.dispatchEvent(new Event('change',{bubbles:true}));}setTimeout(function(){var b=[].slice.call(document.querySelectorAll('button,[role=button]')).filter(function(x){return /^(send|submit)/i.test((x.getAttribute('aria-label')||x.innerText||'').trim())&&vis(x);})[0];if(b){b.click();}else{var t=ta||document.activeElement;['keydown','keypress','keyup'].forEach(function(nm){t.dispatchEvent(new KeyboardEvent(nm,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));});}},400);return 'ok';})";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sessions = new Map();

function hiddenWindow() {
  const win = new BrowserWindow({ show: false, width: 412, height: 915, webPreferences: { sandbox: true, contextIsolation: true, backgroundThrottling: false } });
  win.webContents.setUserAgent(UA);
  win.webContents.setAudioMuted(true);
  return win;
}

const run = (win, code) => win.webContents.executeJavaScript(code, true).catch(() => '');

async function classic(query) {
  const win = hiddenWindow();
  try {
    win.loadURL('https://www.google.com/search?hl=en&q=' + encodeURIComponent(query)).catch(() => {});
    const t0 = Date.now();
    let last = { kind: 'none', text: '' };
    while (Date.now() - t0 < 20000) {
      await sleep(1000);
      let o;
      try { o = JSON.parse(await run(win, AIO_JS)); } catch (e) { continue; }
      last = o;
      if (o.kind === 'aio') break;
      if (Date.now() - t0 > 8000 && o.kind !== 'none') break;
    }
    return last;
  } finally { if (!win.isDestroyed()) win.destroy(); }
}

class AiMode {
  constructor() { this.win = null; this.started = false; this.prev = ''; this.baseline = 'null'; this.last = Date.now(); }
  async ask(q) {
    this.last = Date.now();
    if (!this.win || this.win.isDestroyed()) { this.win = hiddenWindow(); this.started = false; }
    const win = this.win;
    const deadline = Date.now() + (this.started ? 40000 : 45000);
    if (!this.started) {
      this.started = true;
      win.loadURL('https://www.google.com/search?hl=en&udm=50&q=' + encodeURIComponent(q)).catch(() => {});
      await sleep(3000);
      this.baseline = (await run(win, LINES_JS)) || 'null';
    } else {
      this.baseline = (await run(win, LINES_JS)) || 'null';
      const r = await run(win, SEND_JS + '(' + JSON.stringify(q) + ')');
      if (String(r).includes('noinput')) { this.started = false; return { kind: 'none', text: '' }; }
      await sleep(2000);
    }
    let prevText = '', stable = 0, text = '';
    while (Date.now() < deadline) {
      let base = 'null';
      try { base = this.baseline || 'null'; JSON.parse(base); } catch (e) { base = 'null'; }
      text = String((await run(win, ANSWER_JS + '(' + JSON.stringify(q) + ',' + base + ')')) || '').trim();
      if (text.length > 25 && text !== this.prev) {
        if (text === prevText) stable++; else { stable = 0; prevText = text; }
        if (stable >= 2) { this.prev = text; return { kind: 'aimode', text }; }
      }
      await sleep(1200);
    }
    if (text.length > 25 && text !== this.prev) { this.prev = text; return { kind: 'aimode', text }; }
    return { kind: 'none', text: '' };
  }
  destroy() { if (this.win && !this.win.isDestroyed()) this.win.destroy(); this.win = null; }
}

async function ask(sessionId, q) {
  let s = sessions.get(sessionId);
  if (!s) { s = new AiMode(); sessions.set(sessionId, s); }
  let r = await s.ask(q);
  if (r.kind === 'aimode') return r;
  return classic(q);
}

function start() {
  app.on('window-all-closed', (e) => e.preventDefault());
  app.whenReady().then(() => {
    let lastRequest = Date.now();
    http.createServer((req, res) => {
      if (req.headers.origin || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'none') || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) { res.writeHead(403); return res.end(); }
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', async () => {
        lastRequest = Date.now();
        const send = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
        try {
          if (req.url === '/ping') return send({ ok: true });
          const b = JSON.parse(body || '{}');
          if (req.url === '/ask') return send(await ask(String(b.session || 'default'), String(b.q || '')));
          if (req.url === '/close') { const s = sessions.get(b.session); if (s) { s.destroy(); sessions.delete(b.session); } return send({ ok: true }); }
          if (req.url === '/quit') { send({ ok: true }); return setTimeout(() => app.quit(), 100); }
          send({ error: 'unknown' });
        } catch (e) { send({ error: String(e && e.message || e) }); }
      });
    }).listen(PORT, '127.0.0.1');
    setInterval(() => {
      if (!sessions.size && Date.now() - lastRequest > 20 * 60000) app.quit();
      for (const [id, s] of sessions) if (Date.now() - s.last > 40 * 60000) { s.destroy(); sessions.delete(id); }
    }, 60000);
  });
}

module.exports = { start };
