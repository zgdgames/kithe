(function (q) {
  function n(x) { return (x || '').toLowerCase().replace(/[\s?!.,]+$/, '').replace(/\s+/g, ' ').trim(); }
  var lines = (document.body ? document.body.innerText : '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  var end = /^(\d{1,2}:\d{2}|[A-Z][a-z]{2} \d{1,2}, \d{4} [—-] |Add files and tools|Ask about|Ask anything|Ask a follow|Follow-up|AI can make mistakes|Microphone|Transcribing\.\.\.|Upload image|My Ad Center)/i;
  var skip = /^(Show all|Show more|Show less|Copy|Share|Shared|Good response|Bad response|Sources?|Retry|Send|Stop|Thinking.*|Searching.*|Looking.*|Working.*|Generating.*|\d+ files?|AI Mode|AI Mode reply for.*|\+\d+|Sign in|Feedback|Dive deeper.*|AI responses may include mistakes.*)$/i;
  var idx = -1;
  for (var i = 0; i < lines.length; i++) { if (n(lines[i]) === n(q)) { idx = i; break; } }
  var out = [];
  if (idx >= 0) {
    for (var j = idx + 1; j < lines.length; j++) {
      if (end.test(lines[j])) break;
      if (skip.test(lines[j]) || /^\u00b7/.test(lines[j])) continue;
      out.push(lines[j]);
    }
  }
  return out.join('\n');
})
