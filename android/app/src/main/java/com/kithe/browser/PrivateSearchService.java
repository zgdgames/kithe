package com.kithe.browser;

import android.app.Service;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebStorage;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

// Runs Kithe's searches in a separate process with its own WebView data, so
// the Google page it reads is never signed in to the user's account.
public class PrivateSearchService extends Service {
    static final int MSG_SEARCH = 1;
    static final int MSG_RESULT = 2;
    static final int MSG_CLOSE_SESSION = 3;
    static final String UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

    private String imagesJs;

    private final Handler main = new Handler(Looper.getMainLooper());
    private String extractJs;
    private static boolean suffixSet;
    private WebView spare;

    private final java.util.Map<Integer, AiSession> aiSessions = new java.util.HashMap<>();

    private final Messenger messenger = new Messenger(new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(Message m) {
            if (m.what == MSG_SEARCH && m.replyTo != null) {
                int tabId = m.getData().getInt("tabId", 0);
                String kind = m.getData().getString("kind", "web");
                if ("ai".equals(kind)) {
                    aiAsk(tabId, m.getData().getString("q", ""), m.replyTo, m.arg1);
                } else {
                    new Search(m.getData().getString("q", ""), m.replyTo, m.arg1, kind).start();
                }
            } else if (m.what == MSG_CLOSE_SESSION) {
                AiSession s = aiSessions.remove(m.arg1);
                if (s != null) s.destroy();
            }
        }
    });

    // A follow-up asks the SAME live Google AI Mode page the next question,
    // the way a person would keep chatting on the page, instead of reloading
    // a new page and pasting the whole conversation into one query.
    void aiAsk(int tabId, String query, Messenger replyTo, int reqId) {
        AiSession s = aiSessions.get(tabId);
        if (s == null || !s.alive()) {
            if (s != null) s.destroy();
            s = new AiSession(getApplicationContext());
            aiSessions.put(tabId, s);
        }
        s.ask(query, replyTo, reqId);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return messenger.getBinder();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        if (!suffixSet) {
            suffixSet = true;
            try {
                WebView.setDataDirectorySuffix("private");
            } catch (Exception ignored) {
            }
        }
        extractJs = asset("www/internal/search-extract.js");
        imagesJs = asset("www/internal/images-extract.js");
        CookieManager.getInstance().removeAllCookies(null);
        WebStorage.getInstance().deleteAllData();
        warm();
    }

    // A ready-made page that has already opened a connection to Google, so
    // the next search starts with no browser start-up or handshake to wait for.
    private void warm() {
        if (spare != null) return;
        WebView w = new WebView(getApplicationContext());
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSaveFormData(false);
        s.setUserAgentString(UA);
        w.setWebViewClient(new WebViewClient());
        float d = getResources().getDisplayMetrics().density;
        w.layout(0, 0, Math.round(412 * d), Math.round(915 * d));
        w.loadUrl("https://www.google.com/generate_204");
        spare = w;
        main.postDelayed(retire, 25000);
    }

    private final Runnable retire = () -> {
        if (spare != null) {
            spare.destroy();
            spare = null;
        }
    };

    @Override
    public void onDestroy() {
        main.removeCallbacks(retire);
        if (spare != null) {
            spare.destroy();
            spare = null;
        }
        super.onDestroy();
    }

    private WebView takeWeb() {
        if (spare == null) warm();
        main.removeCallbacks(retire);
        WebView w = spare;
        spare = null;
        main.postDelayed(this::warm, 400);
        return w;
    }

    private String asset(String path) {
        try {
            InputStream in = getAssets().open(path);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            in.close();
            return out.toString("UTF-8");
        } catch (Exception e) {
            return null;
        }
    }

    // Google wraps result links in its own redirect; asking it for the target
    // without any cookies gives the real address.
    static void resolveLinks(org.json.JSONArray list) {
        for (int pass = 0; pass < 3; pass++) resolvePass(list);
    }

    static void resolvePass(org.json.JSONArray list) {
        java.util.List<Thread> threads = new java.util.ArrayList<>();
        for (int i = 0; i < list.length(); i++) {
            final JSONObject r = list.optJSONObject(i);
            if (r == null || !r.optString("url").contains("/goto?")) continue;
            Thread t = new Thread(() -> {
                try {
                    java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(r.optString("url")).openConnection();
                    c.setInstanceFollowRedirects(false);
                    c.setConnectTimeout(6000);
                    c.setReadTimeout(6000);
                    c.setRequestProperty("User-Agent", UA);
                    String loc = c.getHeaderField("Location");
                    c.disconnect();
                    if (loc != null && loc.startsWith("http")) {
                        r.put("url", loc);
                        java.net.URL u = new java.net.URL(loc);
                        StringBuilder d = new StringBuilder(u.getHost().replaceFirst("^www\\.", ""));
                        for (String part : u.getPath().split("/")) if (!part.isEmpty()) d.append(" \u203a ").append(part);
                        r.put("display", d.toString());
                        String site = r.optString("site");
                        if (site.isEmpty() || site.contains("://") || site.startsWith("http")) r.put("site", u.getHost().replaceFirst("^www\\.", ""));
                    }
                } catch (Exception ignored) {
                }
            });
            t.start();
            threads.add(t);
        }
        for (Thread t : threads) {
            try {
                t.join(8000);
            } catch (InterruptedException ignored) {
            }
        }
    }

    class Search {
        final String query;
        final Messenger replyTo;
        final int reqId;
        final String kind;
        long deadline;
        WebView web;
        boolean done;
        int polls;
        int lastCount = -1;
        int stable;

        Search(String query, Messenger replyTo, int reqId, String kind) {
            this.kind = kind;
            this.query = query;
            this.replyTo = replyTo;
            this.reqId = reqId;
        }

        void start() {
            web = takeWeb();
            String vertical = "images".equals(kind) ? "&udm=2" : "videos".equals(kind) ? "&udm=7" : "news".equals(kind) ? "&tbm=nws" : "";
            web.loadUrl("https://www.google.com/search?hl=en" + vertical + "&q=" + android.net.Uri.encode(query));
            main.postDelayed(this::poll, 450);
            main.postDelayed(() -> finish(null, "Search timed out"), 25000);
        }

        void poll() {
            if (done || web == null) return;
            String js = "images".equals(kind) ? imagesJs : extractJs;
            if (js == null) { finish(null, "Search is unavailable"); return; }
            web.evaluateJavascript(js, value -> {
                if (done) return;
                JSONObject o = null;
                try {
                    Object v = new JSONTokener(value).nextValue();
                    if (v instanceof String) o = new JSONObject((String) v);
                } catch (Exception ignored) {
                }
                int count = o == null ? 0 : o.optJSONArray("results") == null ? 0 : o.optJSONArray("results").length();
                polls++;
                if (count > 0 && count == lastCount) stable++; else stable = 0;
                lastCount = count;
                if (count >= 6 || (count > 0 && stable >= 1)) { finish(o, null); return; }
                if (polls >= 30) { finish(count > 0 ? o : null, count > 0 ? null : "No results came back"); return; }
                main.postDelayed(this::poll, 350);
            });
        }

        void finish(JSONObject o, String error) {
            if (done) return;
            done = true;
            final JSONObject fo = o;
            final String ferr = error;
            if (o != null && o.optJSONArray("results") != null) {
                new Thread(() -> {
                    resolveLinks(fo.optJSONArray("results"));
                    main.post(() -> reply(fo, ferr));
                }).start();
                return;
            }
            reply(o, error);
        }

        void reply(JSONObject o, String error) {
            try {
                JSONObject res = o != null ? o : new JSONObject();
                if (error != null) res.put("error", error);
                Message m = Message.obtain(null, MSG_RESULT);
                m.arg1 = reqId;
                Bundle b = new Bundle();
                b.putString("json", res.toString());
                m.setData(b);
                replyTo.send(m);
            } catch (Exception ignored) {
            }
            if (web != null) {
                web.stopLoading();
                web.destroy();
                web = null;
            }
        }
    }

    // One tab's AI Mode conversation. The first question loads Google's AI
    // Mode page; every question after that is typed into that SAME page and
    // submitted, so Google sees one real ongoing chat, not a series of new
    // searches with the history pasted into the query text.
    private static final String LINES_JS =
        "(function(){return JSON.stringify((document.body?document.body.innerText:'').split('\\n').map(function(x){return x.trim();}).filter(Boolean));})()";

    private static final String ANSWER_JS =
        "(function(q,base){function n(x){return (x||'').toLowerCase().replace(/[\\s?!.,]+$/,'').replace(/\\s+/g,' ').trim();}"
        + "function esc(x){return x.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&');}"
        + "var heading=new RegExp('^AI Mode reply for\\\\s+'+esc(q)+'\\\\s*','i');"
        + "function clip(x){return x.replace(heading,'');}"
        + "var lines=(document.body?document.body.innerText:'').split('\\n').map(function(x){return x.trim();}).filter(Boolean);"
        + "var end=/^(Add files and tools|Ask about|Ask anything|Ask a follow|Follow-up|AI can make mistakes|Microphone|Transcribing\\.\\.\\.|Upload image|My Ad Center)/i;"
        + "var skip=/^(Show all|Show more|Show less|Copy|Share|Shared|Good response|Bad response|Sources?|Retry|Send|Stop|Thinking.*|Searching.*|Looking.*|Working.*|Generating.*|\\d+ files?|AI Mode|AI Mode reply for.*|Sign in|Feedback|Dive deeper.*|AI responses may include mistakes.*)$/i;"
        + "var idx=-1;for(var i=0;i<lines.length;i++){if(n(lines[i])===n(q))idx=i;}"
        + "var out=[];"
        + "if(idx>=0){for(var j=idx+1;j<lines.length;j++){if(end.test(lines[j]))break;if(skip.test(lines[j]))continue;var c=clip(lines[j]);if(c)out.push(c);}}"
        + "if(!out.length&&base){var seen={};base.forEach(function(b){seen[b]=1;});"
        + "for(var k=0;k<lines.length;k++){var l=lines[k];if(seen[l]||end.test(l)||skip.test(l)||n(l)===n(q))continue;var c=clip(l);if(c)out.push(c);}}"
        + "return out.join(' ');})";

    private static final String SEND_JS =
        "(function(q){var vis=function(x){return x.offsetParent!==null;};var ta=[].slice.call(document.querySelectorAll('textarea')).filter(vis)[0];if(!ta){var c=[].slice.call(document.querySelectorAll('[contenteditable=true]')).filter(vis)[0];if(!c)return 'noinput';c.focus();document.execCommand('insertText',false,q);}else{ta.focus();var set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;set.call(ta,q);ta.dispatchEvent(new Event('input',{bubbles:true}));ta.dispatchEvent(new Event('change',{bubbles:true}));}setTimeout(function(){var b=[].slice.call(document.querySelectorAll('button,[role=button]')).filter(function(x){return /^(send|submit)/i.test((x.getAttribute('aria-label')||x.innerText||'').trim())&&vis(x);})[0];if(b){b.click();}else{var t=ta||document.activeElement;['keydown','keypress','keyup'].forEach(function(nm){t.dispatchEvent(new KeyboardEvent(nm,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));});}},400);return 'ok';})";

    final class AiSession {
        private final android.content.Context ctx;
        private WebView web;
        private boolean started;
        private boolean destroyed;
        private String q, prevText = "", baseline = "null";
        private int polls, stable;
        private long deadline;
        private Messenger replyTo;
        private int reqId;
        private final Runnable expire = this::destroy;

        AiSession(android.content.Context ctx) {
            this.ctx = ctx;
        }

        boolean alive() {
            return !destroyed;
        }

        void destroy() {
            destroyed = true;
            main.removeCallbacks(expire);
            if (web != null) {
                web.stopLoading();
                web.destroy();
                web = null;
            }
        }

        void ask(String query, Messenger replyTo, int reqId) {
            main.removeCallbacks(expire);
            this.replyTo = replyTo;
            this.reqId = reqId;
            q = query;
            polls = 0;
            stable = 0;
            prevText = "";
            deadline = System.currentTimeMillis() + (started ? 40000 : 50000);
            if (web == null) {
                web = new WebView(ctx);
                WebSettings s = web.getSettings();
                s.setJavaScriptEnabled(true);
                s.setDomStorageEnabled(true);
                s.setSaveFormData(false);
                s.setUserAgentString(UA);
                web.setWebViewClient(new WebViewClient());
                float d = getResources().getDisplayMetrics().density;
                web.layout(0, 0, Math.round(412 * d), Math.round(915 * d));
            }
            if (!started) {
                started = true;
                baseline = "null";
                web.loadUrl("https://www.google.com/search?hl=en&udm=50&q=" + android.net.Uri.encode(query));
                main.postDelayed(() -> web.evaluateJavascript(LINES_JS, v -> {
                    try {
                        baseline = new JSONTokener(v).nextValue().toString();
                    } catch (Exception e) {
                        baseline = "null";
                    }
                    poll();
                }), 1100);
            } else {
                web.evaluateJavascript(LINES_JS, v -> {
                    try {
                        baseline = new JSONTokener(v).nextValue().toString();
                    } catch (Exception e) {
                        baseline = "null";
                    }
                    web.evaluateJavascript(SEND_JS + "(" + JSONObject.quote(query) + ")", r -> {
                        if (r != null && r.contains("noinput")) { started = false; finish(null, "AI Mode had no answer for that"); return; }
                        main.postDelayed(this::poll, 1500);
                    });
                });
            }
        }

        private void poll() {
            if (destroyed || web == null) return;
            web.evaluateJavascript(ANSWER_JS + "(" + JSONObject.quote(q) + "," + baseline + ")", value -> {
                if (destroyed) return;
                String text = "";
                try {
                    Object v = new JSONTokener(value).nextValue();
                    text = v == null || v == JSONObject.NULL ? "" : v.toString().trim();
                } catch (Exception ignored) {
                }
                if (text.length() > 25) {
                    if (text.equals(prevText)) stable++; else { stable = 0; sendPartial(text); prevText = text; }
                    if (stable >= 2) { finish(text, null); return; }
                }
                polls++;
                if (System.currentTimeMillis() > deadline || polls > 70) {
                    finish(text.length() > 25 ? text : null, text.length() > 25 ? null : "AI Mode had no answer for that");
                    return;
                }
                main.postDelayed(this::poll, 450);
            });
        }

        private void sendPartial(String text) {
            try {
                JSONObject res = new JSONObject().put("ai", true).put("answer", text).put("partial", true);
                Message m = Message.obtain(null, MSG_RESULT);
                m.arg1 = reqId;
                Bundle b = new Bundle();
                b.putString("json", res.toString());
                m.setData(b);
                replyTo.send(m);
            } catch (Exception ignored) {
            }
        }

        private void finish(String text, String error) {
            try {
                JSONObject res = new JSONObject().put("ai", true);
                if (text != null) res.put("answer", text);
                if (error != null) res.put("error", error);
                Message m = Message.obtain(null, MSG_RESULT);
                m.arg1 = reqId;
                Bundle b = new Bundle();
                b.putString("json", res.toString());
                m.setData(b);
                replyTo.send(m);
            } catch (Exception ignored) {
            }
            main.postDelayed(expire, 10 * 60 * 1000L);
        }
    }
}
