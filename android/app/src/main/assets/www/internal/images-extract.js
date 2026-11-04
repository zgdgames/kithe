(function () {
  function clean(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  function real(href) {
    try {
      var u = new URL(href, location.href);
      if (/(^|\.)google\.[a-z.]+$/.test(u.hostname)) return u.pathname === '/goto' ? u.href : '';
      return /^https?:$/.test(u.protocol) ? u.href : '';
    } catch (e) { return ''; }
  }
  var out = [], seen = {};
  var imgs = document.images;
  for (var i = 0; i < imgs.length; i++) {
    var img = imgs[i];
    var src = img.currentSrc || img.src || '';
    if (!/^https?:/.test(src) || seen[src] || (img.width < 60 && img.naturalWidth < 60 && !/tbn:/.test(src))) continue;
    var box = img, link = null;
    for (var k = 0; k < 8 && box.parentElement && !link; k++) {
      box = box.parentElement;
      link = box.querySelector('a[href]');
    }
    if (!link) continue;
    var url = real(link.getAttribute('href') || link.href);
    if (!url) continue;
    var title = clean(img.alt) || clean(link.innerText);
    seen[src] = 1;
    out.push({ title: title, url: url, thumb: src, site: '' });
  }
  return JSON.stringify({ results: out, stats: '', answer: '' });
})()
