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
    static final String UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

    private String aiJs;
    private String imagesJs;

    private final Handler main = new Handler(Looper.getMainLooper());
    private String extractJs;
    private static boolean suffixSet;

    private final Messenger messenger = new Messenger(new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(Message m) {
            if (m.what == MSG_SEARCH && m.replyTo != null) new Search(m.getData().getString("q", ""), m.replyTo, m.arg1, m.getData().getString("kind", "web")).start();
        }
    });

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
        aiJs = asset("www/internal/ai-extract.js");
        imagesJs = asset("www/internal/images-extract.js");
        CookieManager.getInstance().removeAllCookies(null);
        WebStorage.getInstance().deleteAllData();
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
        final boolean ai;
        String prevText = "";
        long deadline;
        WebView web;
        boolean done;
        int polls;
        int lastCount = -1;
        int stable;

        Search(String query, Messenger replyTo, int reqId, String kind) {
            this.kind = kind;
            this.ai = "ai".equals(kind);
            this.query = query;
            this.replyTo = replyTo;
            this.reqId = reqId;
        }

        void start() {
            web = new WebView(getApplicationContext());
            WebSettings s = web.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            s.setSaveFormData(false);
            s.setUserAgentString(UA);
            web.setWebViewClient(new WebViewClient());
            float d = getResources().getDisplayMetrics().density;
            web.layout(0, 0, Math.round(412 * d), Math.round(915 * d));
            if (ai) {
                web.loadUrl("https://www.google.com/search?hl=en&udm=50&q=" + android.net.Uri.encode(query));
                main.postDelayed(this::pollAi, 3500);
                main.postDelayed(() -> finish(null, "AI Mode timed out"), 50000);
                return;
            }
            String vertical = "images".equals(kind) ? "&udm=2" : "videos".equals(kind) ? "&udm=7" : "news".equals(kind) ? "&tbm=nws" : "";
            web.loadUrl("https://www.google.com/search?hl=en" + vertical + "&q=" + android.net.Uri.encode(query));
            main.postDelayed(this::poll, 1200);
            main.postDelayed(() -> finish(null, "Search timed out"), 25000);
        }

        void pollAi() {
            if (done || web == null) return;
            if (aiJs == null) { finish(null, "AI Mode is unavailable"); return; }
            web.evaluateJavascript(aiJs + "(" + JSONObject.quote(query) + ")", value -> {
                if (done) return;
                String text = "";
                try {
                    Object v = new JSONTokener(value).nextValue();
                    text = v == null || v == JSONObject.NULL ? "" : v.toString().trim();
                } catch (Exception ignored) {
                }
                if (text.length() > 25) {
                    if (text.equals(prevText)) stable++; else { stable = 0; prevText = text; }
                    if (stable >= 2) { finishAi(text); return; }
                }
                polls++;
                if (polls > 36) { finishAi(text.length() > 25 ? text : ""); return; }
                main.postDelayed(this::pollAi, 1200);
            });
        }

        void finishAi(String text) {
            try {
                finish(new JSONObject().put("ai", true).put("answer", text), text.isEmpty() ? "AI Mode had no answer for that" : null);
            } catch (Exception e) {
                finish(null, "AI Mode failed");
            }
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
                if (count > 0 && stable >= 1) { finish(o, null); return; }
                if (polls >= 14) { finish(count > 0 ? o : null, count > 0 ? null : "No results came back"); return; }
                main.postDelayed(this::poll, 800);
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
}
