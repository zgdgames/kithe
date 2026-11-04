(function () {
  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function real(href) {
    try {
      var u = new URL(href, location.href);
      if (/(^|\.)google\.[a-z.]+$/.test(u.hostname)) {
        if (u.pathname === '/url') return u.searchParams.get('q') || u.searchParams.get('url') || '';
        if (u.pathname === '/goto') return u.href;
        return '';
      }
      return /^https?:$/.test(u.protocol) ? u.href : '';
    } catch (e) { return ''; }
  }
  function pretty(href) {
    try {
      var u = new URL(href);
      if (/(^|\.)google\.[a-z.]+$/.test(u.hostname)) return '';
      var parts = u.pathname.split('/').filter(Boolean);
      return u.hostname.replace(/^www\./, '') + (parts.length ? ' › ' + parts.join(' › ') : '');
    } catch (e) { return href; }
  }
  var out = [], seen = {};
  var as = document.querySelectorAll('a[href]');
  for (var i = 0; i < as.length; i++) {
    var a = as[i];
    var h = a.querySelector('h3,[role=heading]');
    if (!h) continue;
    var url = real(a.getAttribute('href') || a.href);
    var title = clean(h.innerText);
    if (!url || !title || seen[url]) continue;
    var box = a, text = '';
    for (var k = 0; k < 7 && box.parentElement; k++) {
      var up = box.parentElement;
      if (up.querySelectorAll('a[href] h3,a[href] [role=heading]').length > 1) break;
      box = up;
      text = box.innerText || '';
      if (clean(text).length > title.length + 70) break;
    }
    var lines = text.split('\n').map(clean).filter(Boolean);
    if (/^(Sponsored|Ad)\b/i.test(lines[0] || '')) continue;
    var site = '', snippet = '';
    for (var j = 0; j < lines.length; j++) {
      var l = lines[j];
      if (l === title) break;
      if (!site && l.length < 60 && !/^https?:/.test(l) && !/^\d{1,2}:\d{2}(:\d{2})?$/.test(l) && !/^(Web results|Search Results|Videos|Images|News|Shopping|Short videos|Forums|Top stories|People also ask|Featured snippet.*)$/i.test(l)) site = l;
    }
    for (var m = 0; m < lines.length; m++) {
      var s = lines[m];
      if (s === title || s === site || s.length < 40 || /^https?:/.test(s) || s.indexOf('›') >= 0 && s.length < 90) continue;
      if (s.length > snippet.length) snippet = s;
    }
    seen[url] = 1;
    out.push({ title: title, url: url, site: site || pretty(url).split(' ')[0] || '', display: pretty(url), snippet: snippet });
  }
  var stats = document.querySelector('#result-stats');
  var answer = '';
  var w = document.querySelector('#wob_tm');
  if (w) {
    var loc = document.querySelector('#wob_loc'), dc = document.querySelector('#wob_dc');
    answer = (loc ? clean(loc.innerText) + ': ' : '') + clean(w.innerText) + '° ' + (dc ? clean(dc.innerText) : '');
  }
  if (!answer) {
    var cw = document.querySelector('#cwos,.qv3Wpe');
    if (cw && clean(cw.innerText)) answer = clean(cw.innerText);
  }
  if (!answer) {
    var sn = document.querySelector('[data-attrid="wa:/description"],[data-attrid="description"],.hgKElc,.Z0LcW,.IZ6rdc,.kno-rdesc span');
    if (sn && clean(sn.innerText).length > 10) answer = clean(sn.innerText);
  }
  return JSON.stringify({ results: out, stats: stats ? clean(stats.innerText) : '', answer: answer });
})()
