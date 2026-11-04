package com.kithe.browser;

import android.app.Activity;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.os.Handler;
import android.os.Looper;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.os.Messenger;
import android.os.IBinder;
import android.content.ServiceConnection;
import android.speech.RecognizerIntent;
import android.view.inputmethod.InputMethodManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    static final String WWW = "file:///android_asset/www/";
    static final String WWW_ASSET = "www/";
    static final String EXCLUSIVE = "Extra exclusive URLS/";
    static final String ACTION_OPEN_APP = "com.kithe.browser.OPEN_APP";
    static final int REQ_FILE = 1;
    static final int REQ_VOICE = 2;
    static final String ASSISTANT_PKG = "com.igx.assistant";
    static final String EXTRA_WIDGET = "kithe_widget";
    static final Object ASYNC = new Object();
    static final int BG = 0xFF1E1F26;

    static final Pattern DOMAIN = Pattern.compile("^[a-z0-9][a-z0-9-]*(\\.[a-z0-9][a-z0-9-]*)+(:[0-9]+)?(/.*)?$", Pattern.CASE_INSENSITIVE);
    static final Pattern SCHEME = Pattern.compile("^[a-z][a-z0-9+.-]*://.*", Pattern.CASE_INSENSITIVE);

    static class Tab {
        int id;
        WebView view;
        String faviconUrl;
        boolean loading;
        String finishedUrl;
        String lastSent;
        android.graphics.Bitmap lastIcon;
        // Loaded URL -> what the address bar should show for it (e.g. the
        // bundled home page shows as http://home.local/).
        final Map<String, String> displayByUrl = new HashMap<>();
        // Loaded URL -> script to run once that page has finished loading.
        final Map<String, String> injections = new HashMap<>();
    }

    static volatile boolean visible = false;
    boolean aiModeOn;
    boolean forceWeb;
    private final Handler updateHandler = new Handler(Looper.getMainLooper());
    private final Runnable updateTick = new Runnable() {
        @Override
        public void run() {
            final Context app = getApplicationContext();
            new Thread(() -> UpdateChecker.check(app, true)).start();
            updateHandler.postDelayed(this, UpdateChecker.INTERVAL_MS);
        }
    };

    private FrameLayout root;
    private FrameLayout tabHost;
    private WebView chrome;
    private final Map<Integer, Tab> tabs = new LinkedHashMap<>();
    private final List<Integer> tabOrder = new ArrayList<>();
    private int activeTabId = -1;
    private int nextTabId = 1;
    private int chromeHeightCss = 88;
    private boolean chromeFull = false;
    // Screen regions (px) the open panels/popovers occupy; touches outside
    // them (and outside the toolbar) fall through to the tab underneath.
    private float[][] uiRects = new float[0][];
    private boolean immersive = false;
    private boolean appMode = false;
    private boolean initialTabCreated = false;
    private float density;
    private Messenger privateService;
    private boolean privateBinding;
    private final List<Message> privateQueue = new ArrayList<>();
    private final Map<Integer, SearchCallback> searchCallbacks = new HashMap<>();
    private int nextSearchId = 1;
    private final Messenger searchReplies = new Messenger(new Handler(Looper.getMainLooper()) {
        @Override
        public void handleMessage(Message m) {
            if (m.what != PrivateSearchService.MSG_RESULT) return;
            SearchCallback cb = searchCallbacks.remove(m.arg1);
            if (cb == null) return;
            JSONObject o;
            try {
                o = new JSONObject(m.getData().getString("json", "{}"));
            } catch (JSONException e) {
                o = new JSONObject();
            }
            cb.done(o);
        }
    });
    private final ServiceConnection privateConn = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            privateService = new Messenger(binder);
            for (Message m : privateQueue) {
                try {
                    privateService.send(m);
                } catch (Exception ignored) {
                }
            }
            privateQueue.clear();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            privateService = null;
            privateBinding = false;
        }
    };

    interface SearchCallback {
        void done(JSONObject outcome);
    }

    private boolean saveTabsEnabled = false;
    private final Handler saveHandler = new Handler(Looper.getMainLooper());
    private final Runnable saveTabsTick = this::saveTabsNow;
    private final Map<Integer, Runnable> pendingTabState = new HashMap<>();

    private JSONObject registry = new JSONObject();
    private Store store;

    private ValueCallback<Uri[]> fileCallback;
    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    // ---------------------------------------------------------------- setup

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        density = getResources().getDisplayMetrics().density;
        WebView.setWebContentsDebuggingEnabled(false);
        store = new Store(getFilesDir());
        aiModeOn = getSharedPreferences("ui", MODE_PRIVATE).getBoolean("aiOn", false);
        if (!privateBinding) privateBinding = bindService(new Intent(this, PrivateSearchService.class), privateConn, Context.BIND_AUTO_CREATE);
        try {
            registry = new JSONObject(readAsset(WWW_ASSET + EXCLUSIVE + "registry.json"));
            // Apps that need a desktop server ship a self-contained mobile
            // build instead; on Android they load that as a bundled page.
            Iterator<String> hosts = registry.keys();
            while (hosts.hasNext()) {
                JSONObject e = registry.optJSONObject(hosts.next());
                if (e != null && e.has("mobileEntry")) {
                    e.put("entry", e.getString("mobileEntry"));
                    e.remove("type");
                    e.remove("mobileEntry");
                }
            }
        } catch (Exception ignored) {
        }

        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);

        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        root.setFitsSystemWindows(true);
        setContentView(root);

        tabHost = new FrameLayout(this);
        root.addView(tabHost, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        Intent intent = getIntent();
        if (ACTION_OPEN_APP.equals(intent.getAction()) && intent.getStringExtra("url") != null) {
            // A pinned "installed app": just the page, no tabs or toolbar.
            appMode = true;
            createTab(intent.getStringExtra("url"), null);
            return;
        }

        chrome = new WebView(this);
        chrome.setBackgroundColor(BG);
        WebSettings s = chrome.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        chrome.addJavascriptInterface(new Bridge(), "KitheNative");
        chrome.setOnTouchListener(new View.OnTouchListener() {
            private boolean forwarding;

            @Override
            public boolean onTouch(View v, MotionEvent ev) {
                if (!chromeFull) return false;
                if (ev.getActionMasked() == MotionEvent.ACTION_DOWN) {
                    forwarding = !hitsChromeUi(ev.getX(), ev.getY());
                }
                if (!forwarding) return false;
                Tab t = tabs.get(activeTabId);
                if (t != null) {
                    MotionEvent copy = MotionEvent.obtain(ev);
                    copy.offsetLocation(-tabHost.getLeft(), -tabHost.getTop());
                    t.view.dispatchTouchEvent(copy);
                    copy.recycle();
                }
                return true;
            }
        });
        chrome.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!initialTabCreated) {
                    initialTabCreated = true;
                    Intent in = getIntent();
                    Uri data = in == null ? null : in.getData();
                    boolean opensLink = data != null && Intent.ACTION_VIEW.equals(in.getAction());
                    int first = opensLink ? createTab(data.toString(), null) : createTab(null, null);
                    offerRestoreTabs(first, opensLink);
                    runWidgetAction(in);
                }
            }
        });
        root.addView(chrome, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.round(chromeHeightCss * density)));
        layoutChrome();
        chrome.loadUrl(WWW + "index.html");
    }

    @Override
    protected void onStart() {
        super.onStart();
        visible = true;
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 2);
        }
        JobScheduler js = (JobScheduler) getSystemService(JOB_SCHEDULER_SERVICE);
        boolean scheduled = false;
        if (js != null) {
            for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == 4101) scheduled = true;
            if (!scheduled) {
                js.schedule(new JobInfo.Builder(4101, new ComponentName(this, UpdateJobService.class))
                    .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                    .setPeriodic(UpdateChecker.INTERVAL_MS)
                    .setPersisted(true)
                    .build());
            }
        }
        long last = getSharedPreferences("updates", MODE_PRIVATE).getLong("lastCheck", 0);
        updateHandler.removeCallbacks(updateTick);
        updateHandler.postDelayed(updateTick, Math.max(0, UpdateChecker.INTERVAL_MS - (System.currentTimeMillis() - last)));
    }

    @Override
    protected void onStop() {
        visible = false;
        saveTabsNow();
        updateHandler.removeCallbacks(updateTick);
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (privateBinding) {
            try {
                unbindService(privateConn);
            } catch (Exception ignored) {
            }
            privateBinding = false;
        }
        for (Tab t : tabs.values()) t.view.destroy();
        if (chrome != null) chrome.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (customView != null) {
            hideCustomView();
            return;
        }
        if (!appMode && chrome != null) {
            if (immersive) {
                emit("shortcut:exit-immersive", null);
                return;
            }
            if (chromeFull) {
                chrome.evaluateJavascript(
                        "(function(){var p=document.getElementById('promptOverlay');" +
                        "if(!p.classList.contains('hidden')){closePrompt(null);return;}" +
                        "closeBmPopover();closeAllPanels();})()", null);
                return;
            }
        }
        Tab tab = tabs.get(activeTabId);
        if (tab != null && tab.view.canGoBack()) tab.view.goBack();
        else if (appMode && tabOrder.size() > 1) closeTab(activeTabId);
        else if (appMode) finish();
        else moveTaskToBack(true);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (appMode || chrome == null) return;
        setIntent(intent);
        Uri data = intent.getData();
        if (data != null && Intent.ACTION_VIEW.equals(intent.getAction())) createTab(data.toString(), null);
        runWidgetAction(intent);
    }

    // Widgets and shortcuts send an action name; run it once the chrome is up.
    void runWidgetAction(Intent in) {
        if (in == null) return;
        String action = in.getStringExtra(EXTRA_WIDGET);
        if (action == null) return;
        in.removeExtra(EXTRA_WIDGET);
        if (action.equals("voice")) startVoiceSearch();
        else if (action.equals("ai")) { setAiMode(true); focusAddressBar(); }
        else if (action.equals("search")) focusAddressBar();
    }

    void focusAddressBar() {
        if (chrome == null) return;
        emit("shortcut:focus-address", null);
        chrome.requestFocus();
        chrome.postDelayed(() -> {
            InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
            if (imm != null) imm.showSoftInput(chrome, InputMethodManager.SHOW_IMPLICIT);
        }, 250);
    }

    static final int REQ_MIC = 3;

    void startVoiceSearch() {
        if (!VoiceSearch.available(this)) {
            startSystemVoiceSearch();
            return;
        }
        if (checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { "android.permission.RECORD_AUDIO" }, REQ_MIC);
            return;
        }
        new VoiceSearch(this, text -> {
            if (tabs.get(activeTabId) != null) navigateTab(activeTabId, text);
        }).start();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code == REQ_MIC && results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) startVoiceSearch();
    }

    void startSystemVoiceSearch() {
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_PROMPT, "Search Kithe");
        try {
            startActivityForResult(i, REQ_VOICE);
        } catch (Exception e) {
            Toast.makeText(this, "Voice search isn't available on this phone", Toast.LENGTH_SHORT).show();
        }
    }

    // AI Mode is the IGX Assistant's answer, shown inside Kithe. It comes from
    // the private, signed-out search, never from Kithe, so the two can't loop.
    void setAiMode(boolean on) {
        aiModeOn = on;
        getSharedPreferences("ui", MODE_PRIVATE).edit().putBoolean("aiOn", on).apply();
        try {
            emit("ai:mode", new JSONObject().put("on", on));
        } catch (JSONException ignored) {
        }
        Tab tab = tabs.get(activeTabId);
        if (tab != null) tab.view.evaluateJavascript("window.__setAiOn && window.__setAiOn(" + on + ")", null);
    }

    void openAiMode(String raw) {
        Tab tab = tabs.get(activeTabId);
        if (tab == null) return;
        int c = raw.indexOf("&ctx=");
        String query = Uri.decode(c < 0 ? raw : raw.substring(0, c));
        String ctx = c < 0 ? "" : Uri.decode(raw.substring(c + 5));
        performAiSearch(tab, query.trim(), ctx);
    }

    void performAiSearch(final Tab tab, final String query, final String ctx) {
        final String url = WWW + "internal/search.html?ai=1&q=" + Uri.encode(query) + (ctx.isEmpty() ? "" : "&follow=1");
        tab.displayByUrl.put(url, "kithe://ai?q=" + Uri.encode(query));
        try {
            loadAssetPage(tab, WWW_ASSET + "internal/search.html", url, "window.__voiceSearch = true;window.__aiMode = true;");
        } catch (IOException e) {
            tab.view.loadUrl(url);
            return;
        }
        if (query.isEmpty()) {
            setSearchState(tab, url, query, true, new JSONObject());
            return;
        }
        privateSearch(ctx.isEmpty() ? query : ctx + "\n\nUser: " + query, true, outcome -> setSearchState(tab, url, query, true, outcome));
    }

    // Reads the Google results page in a separate, signed-out process.
    void privateSearch(String query, SearchCallback cb) {
        privateSearch(query, false, cb);
    }

    void privateSearch(String query, boolean ai, SearchCallback cb) {
        privateSearch(query, ai ? "ai" : "web", cb);
    }

    void privateSearch(String query, String kind, SearchCallback cb) {
        int id = nextSearchId++;
        searchCallbacks.put(id, cb);
        Message m = Message.obtain(null, PrivateSearchService.MSG_SEARCH);
        m.arg1 = id;
        m.replyTo = searchReplies;
        Bundle b = new Bundle();
        b.putString("q", query);
        b.putString("kind", kind);
        m.setData(b);
        if (privateService != null) {
            try {
                privateService.send(m);
                return;
            } catch (Exception ignored) {
            }
        }
        privateQueue.add(m);
        if (!privateBinding) {
            privateBinding = bindService(new Intent(this, PrivateSearchService.class), privateConn, Context.BIND_AUTO_CREATE);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_VOICE) {
            if (resultCode == RESULT_OK && data != null) {
                ArrayList<String> heard = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
                if (heard != null && !heard.isEmpty() && tabs.get(activeTabId) != null) navigateTab(activeTabId, heard.get(0));
            }
            return;
        }
        if (requestCode == REQ_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ------------------------------------------------------- chrome bridge

    void layoutChrome() {
        if (chrome == null) return;
        int h = Math.round(chromeHeightCss * density);
        FrameLayout.LayoutParams cp = (FrameLayout.LayoutParams) chrome.getLayoutParams();
        cp.height = chromeFull ? ViewGroup.LayoutParams.MATCH_PARENT : h;
        chrome.setLayoutParams(cp);
        FrameLayout.LayoutParams tp = (FrameLayout.LayoutParams) tabHost.getLayoutParams();
        tp.topMargin = h;
        tabHost.setLayoutParams(tp);
        tabHost.setVisibility(View.VISIBLE);
        chrome.setBackgroundColor(chromeFull ? Color.TRANSPARENT : BG);
        if (chromeFull) chrome.requestFocus();
    }

    boolean hitsChromeUi(float x, float y) {
        if (uiRects.length == 0 || y < chromeHeightCss * density) return true;
        for (float[] r : uiRects) {
            if (x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) return true;
        }
        return false;
    }

    void setUiRects(String json) throws JSONException {
        JSONArray arr = new JSONArray(json);
        float[][] out = new float[arr.length()][];
        for (int i = 0; i < out.length; i++) {
            JSONArray r = arr.getJSONArray(i);
            out[i] = new float[] {
                (float) r.getDouble(0) * density, (float) r.getDouble(1) * density,
                (float) r.getDouble(2) * density, (float) r.getDouble(3) * density,
            };
        }
        uiRects = out;
    }

    void emit(String channel, JSONObject data) {
        if (chrome == null) return;
        String js = "window.__kitheEmit(" + JSONObject.quote(channel) + "," + (data == null ? "null" : data.toString()) + ")";
        chrome.evaluateJavascript(js, null);
    }

    void resolve(int reqId, Object result) {
        if (chrome == null) return;
        String json = result == null ? "null" : (result instanceof JSONObject || result instanceof JSONArray) ? result.toString() : result instanceof String ? JSONObject.quote((String) result) : String.valueOf(result);
        chrome.evaluateJavascript("window.__kitheResolve(" + reqId + "," + JSONObject.quote(json) + ")", null);
    }

    class Bridge {
        @JavascriptInterface
        public void invoke(final int reqId, final String channel, final String argsJson) {
            runOnUiThread(() -> {
                Object result = null;
                try {
                    result = handle(reqId, channel, new JSONObject(argsJson));
                } catch (Exception e) {
                    result = null;
                }
                if (result != ASYNC) resolve(reqId, result);
            });
        }

        @JavascriptInterface
        public void send(final String channel, final String json) {
            runOnUiThread(() -> {
                try {
                    if (channel.equals("chrome:resize")) {
                        int height = (int) Math.round(Double.parseDouble(json));
                        if (height < 0 || height == chromeHeightCss) return;
                        if (height < 30 && !immersive) return;
                        chromeHeightCss = height;
                        layoutChrome();
                    } else if (channel.equals("chrome:full")) {
                        chromeFull = Boolean.parseBoolean(json);
                        layoutChrome();
                    } else if (channel.equals("chrome:rects")) {
                        setUiRects(json);
                    } else if (channel.equals("immersive:changed")) {
                        immersive = Boolean.parseBoolean(json);
                    }
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void toast(final String text) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show());
        }
    }

    Object handle(int reqId, String channel, JSONObject a) throws Exception {
        switch (channel) {
            case "nav:navigate": navigateTab(a.getInt("tabId"), a.getString("input")); return null;
            case "nav:back": { Tab t = tabs.get(a.getInt("tabId")); if (t != null && t.view.canGoBack()) t.view.goBack(); return null; }
            case "nav:forward": { Tab t = tabs.get(a.getInt("tabId")); if (t != null && t.view.canGoForward()) t.view.goForward(); return null; }
            case "nav:reload": { Tab t = tabs.get(a.getInt("tabId")); if (t != null) t.view.reload(); return null; }
            case "nav:stop": { Tab t = tabs.get(a.getInt("tabId")); if (t != null) t.view.stopLoading(); return null; }
            case "tab:new": return createTab(a.isNull("url") ? null : a.optString("url", null), null);
            case "tab:close": closeTab(a.getInt("tabId")); return null;
            case "tab:switch": switchTab(a.getInt("tabId")); return null;
            case "tab:getState": { Tab t = tabs.get(a.getInt("tabId")); return t == null ? null : tabState(t); }
            case "registry:get": return registry;
            case "registry:exclusiveDir": return JSONObject.quote("");
            case "bookmarks:list": return store.bookmarks();
            case "bookmarks:add": return store.addBookmark(a.getString("url"), a.optString("title", ""), a.isNull("faviconUrl") ? null : a.optString("faviconUrl", null));
            case "bookmarks:remove": return store.removeBookmark(a.getLong("id"));
            case "bookmarks:rename": return store.updateBookmark(a.getLong("id"), new JSONObject().put("title", a.getString("title")));
            case "bookmarks:setFolder": return store.updateBookmark(a.getLong("id"), new JSONObject().put("folder", a.isNull("folder") || a.optString("folder").isEmpty() ? JSONObject.NULL : a.getString("folder")));
            case "settings:get": return store.settings();
            case "settings:set": return store.setSettings(a);
            case "app:install": installAsApp(reqId, a); return ASYNC;
            case "app:version": {
                try {
                    return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                } catch (Exception e) {
                    return "";
                }
            }
            case "search:voice": startVoiceSearch(); return null;
            case "search:ai": openAiMode(Uri.encode(a.optString("q", ""))); return null;
            case "ai:get": return aiModeOn;
            case "ai:set": setAiMode(a.optBoolean("on")); return null;
            case "image:download": downloadImage(reqId, a.getString("srcURL"), a.getString("name")); return ASYNC;
            default: return null;
        }
    }

    // ---------------------------------------------------------------- tabs

    JSONObject tabState(Tab tab) throws JSONException {
        WebView wv = tab.view;
        String title = wv.getTitle();
        return new JSONObject()
                .put("id", tab.id)
                .put("url", displayUrl(tab))
                .put("title", title == null || title.isEmpty() ? "New Tab" : title)
                .put("canGoBack", wv.canGoBack())
                .put("canGoForward", wv.canGoForward())
                .put("loading", tab.loading)
                .put("faviconUrl", tab.faviconUrl == null ? JSONObject.NULL : tab.faviconUrl);
    }

    String displayUrl(Tab tab) {
        String url = tab.view.getUrl();
        if (url == null) return "";
        String d = tab.displayByUrl.get(url);
        return d != null ? d : url;
    }

    // Pages like chat apps fire title/history callbacks constantly while
    // typing; each one used to re-render the whole chrome, so updates for a
    // tab are merged into one per short interval.
    void sendTabState(final Tab tab) {
        if (chrome == null || !tabs.containsKey(tab.id)) return;
        if (pendingTabState.containsKey(tab.id)) return;
        Runnable r = () -> {
            pendingTabState.remove(tab.id);
            if (chrome == null || !tabs.containsKey(tab.id)) return;
            try {
                JSONObject st = tabState(tab);
                String sig = st.toString();
                if (sig.equals(tab.lastSent)) return;
                String prevUrl = tab.lastSent == null ? null : new JSONObject(tab.lastSent).optString("url");
                tab.lastSent = sig;
                emit("tab:updated", st);
                if (!st.optString("url").equals(prevUrl)) scheduleSaveTabs();
            } catch (JSONException ignored) {
            }
        };
        pendingTabState.put(tab.id, r);
        saveHandler.postDelayed(r, 250);
    }

    // ------------------------------------------------------- saved tabs

    void scheduleSaveTabs() {
        if (!saveTabsEnabled || appMode) return;
        saveHandler.removeCallbacks(saveTabsTick);
        saveHandler.postDelayed(saveTabsTick, 600);
    }

    String savedUrl(Tab tab) {
        String url = displayUrl(tab);
        if (url == null || url.isEmpty() || url.equals("about:blank")) return null;
        if (url.startsWith("kithe://search?q=")) return Uri.decode(url.substring("kithe://search?q=".length()));
        for (String k : new String[] { "images", "news", "videos" }) {
            if (url.startsWith("kithe://" + k + "?q=")) return Uri.decode(url.substring(("kithe://" + k + "?q=").length()));
        }
        if (url.startsWith("kithe://ai?q=")) return Uri.decode(url.substring("kithe://ai?q=".length()));
        return url;
    }

    void saveTabsNow() {
        if (!saveTabsEnabled || appMode || store == null) return;
        saveHandler.removeCallbacks(saveTabsTick);
        try {
            JSONArray list = new JSONArray();
            int active = 0;
            for (int id : tabOrder) {
                Tab t = tabs.get(id);
                if (t == null) continue;
                String u = savedUrl(t);
                if (u == null) continue;
                if (id == activeTabId) active = list.length();
                list.put(u);
            }
            store.write("tabs.json", new JSONObject().put("active", active).put("tabs", list).toString());
        } catch (JSONException ignored) {
        }
    }

    void offerRestoreTabs(final int firstTabId, boolean opensLink) {
        JSONArray saved = null;
        int active = 0;
        try {
            String raw = store.read("tabs.json");
            if (raw != null) {
                JSONObject o = new JSONObject(raw);
                saved = o.getJSONArray("tabs");
                active = o.optInt("active", 0);
            }
        } catch (Exception e) {
            saved = null;
        }
        boolean worthAsking = saved != null && (saved.length() > 1
                || (saved.length() == 1 && !"http://home.local/".equals(saved.optString(0))));
        if (!worthAsking) {
            saveTabsEnabled = true;
            scheduleSaveTabs();
            return;
        }
        final JSONArray urls = saved;
        final int activeIndex = active;
        final boolean keepFirst = opensLink;
        KitheDialog.show(this, "Open your tabs?",
                "You had " + urls.length() + (urls.length() == 1 ? " tab" : " tabs") + " open last time.",
                null, "Open tabs", () -> restoreTabs(firstTabId, keepFirst, urls, activeIndex),
                "No thanks", () -> {
                    saveTabsEnabled = true;
                    scheduleSaveTabs();
                }, null, false);
    }

    void restoreTabs(int firstTabId, boolean keepFirst, JSONArray urls, int activeIndex) {
        saveTabsEnabled = false;
        if (!keepFirst) closeTabKeepingOne(firstTabId);
        int activeId = -1;
        for (int i = 0; i < urls.length(); i++) {
            int id = createTab(urls.optString(i), null);
            if (i == activeIndex) activeId = id;
        }
        if (activeId != -1) switchTab(activeId);
        saveTabsEnabled = true;
        scheduleSaveTabs();
    }

    void closeTabKeepingOne(int id) {
        Tab tab = tabs.remove(id);
        if (tab == null) return;
        tabOrder.remove((Integer) id);
        tabHost.removeView(tab.view);
        tab.view.destroy();
        try {
            emit("tab:closed", new JSONObject().put("id", id));
        } catch (JSONException ignored) {
        }
        if (activeTabId == id) activeTabId = -1;
    }

    int createTab(String initialUrl, Message transportMsg) {
        final Tab tab = new Tab();
        tab.id = nextTabId++;
        tab.view = makeTabView(tab);
        tabs.put(tab.id, tab);
        tabOrder.add(tab.id);
        tabHost.addView(tab.view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        try {
            emit("tab:created", new JSONObject().put("id", tab.id));
        } catch (JSONException ignored) {
        }
        switchTab(tab.id);
        if (transportMsg != null) {
            WebView.WebViewTransport transport = (WebView.WebViewTransport) transportMsg.obj;
            transport.setWebView(tab.view);
            transportMsg.sendToTarget();
        } else {
            navigateTab(tab.id, initialUrl != null ? initialUrl : "home.local");
        }
        return tab.id;
    }

    void switchTab(int id) {
        Tab tab = tabs.get(id);
        if (tab == null) return;
        activeTabId = id;
        for (Tab t : tabs.values()) t.view.setVisibility(t.id == id ? View.VISIBLE : View.GONE);
        sendTabState(tab);
    }

    void closeTab(int id) {
        Tab tab = tabs.remove(id);
        if (tab == null) return;
        tabOrder.remove((Integer) id);
        tabHost.removeView(tab.view);
        tab.view.destroy();
        try {
            emit("tab:closed", new JSONObject().put("id", id));
        } catch (JSONException ignored) {
        }
        if (activeTabId == id) {
            activeTabId = -1;
            if (!tabOrder.isEmpty()) switchTab(tabOrder.get(tabOrder.size() - 1));
            else if (appMode) finish();
            else createTab(null, null);
        }
    }

    // ---------------------------------------------------------- navigation

    static String extractHostname(String input) {
        String candidate = SCHEME.matcher(input).matches() ? input : "http://" + input;
        try {
            String host = new URI(candidate).getHost();
            return host == null ? null : host.toLowerCase();
        } catch (Exception e) {
            return null;
        }
    }

    static boolean looksLikeDomain(String input) {
        String t = input.trim();
        if (t.matches(".*\\s.*")) return false;
        if (SCHEME.matcher(t).matches()) return true;
        return DOMAIN.matcher(t).matches();
    }

    void navigateTab(int id, String raw) {
        Tab tab = tabs.get(id);
        if (tab == null) return;
        JSONObject settings = store.settings();
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            navigateTab(id, "home.local");
            return;
        }
        String host = extractHostname(trimmed);
        JSONObject entry = host != null ? registry.optJSONObject(host) : null;
        if (entry != null) {
            activateEntry(tab, host, entry);
        } else if (looksLikeDomain(trimmed)) {
            tab.view.loadUrl(SCHEME.matcher(trimmed).matches() ? trimmed : "https://" + trimmed);
        } else if (aiModeOn && !forceWeb) {
            performAiSearch(tab, trimmed, "");
        } else {
            performSearch(tab, trimmed, settings, "web");
        }
    }

    void activateEntry(Tab tab, String host, JSONObject entry) {
        if ("native".equals(entry.optString("type"))) {
            Intent i = getPackageManager().getLaunchIntentForPackage(entry.optString("package"));
            if (i == null) {
                Toast.makeText(this, entry.optString("title") + " isn't installed on this phone", Toast.LENGTH_SHORT).show();
            } else {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            }
            return;
        }
        if ("server".equals(entry.optString("type"))) {
            String url = "http://localhost:" + entry.optInt("port") + "/";
            tab.displayByUrl.put(url, "http://" + host + "/");
            tab.view.loadUrl(url);
            return;
        }
        String path = EXCLUSIVE + entry.optString("entry");
        String url = WWW + path.replace(" ", "%20");
        tab.displayByUrl.put(url, "http://" + host + "/");
        try {
            if (!host.equals("home.local")) {
                tab.view.loadUrl(url);
                return;
            }
            String prelude = "window.__registry = " + registry + ";window.__voiceSearch = true;";
            if (host.equals("home.local")) {
                JSONArray apps = new JSONArray();
                Iterator<String> keys = registry.keys();
                while (keys.hasNext()) {
                    String h = keys.next();
                    if (h.equals("home.local")) continue;
                    JSONObject e = registry.optJSONObject(h);
                    if (e == null) continue;
                    apps.put(new JSONObject()
                            .put("hostname", h)
                            .put("title", e.optString("title"))
                            .put("icon", e.has("icon") ? e.getString("icon") : JSONObject.NULL)
                            .put("iconImage", e.has("iconImage") ? "../" + e.getString("iconImage") : JSONObject.NULL));
                }
                prelude += "window.__bookmarks = " + store.bookmarks() + ";window.__exclusiveApps = " + apps + ";";
            }
            loadAssetPage(tab, WWW_ASSET + path, url, prelude);
        } catch (Exception e) {
            tab.view.loadUrl(url);
        }
    }

    // Loads a bundled page with a script run before any of its own scripts,
    // so pages can read window.__* data synchronously on startup.
    void loadAssetPage(Tab tab, String assetPath, String url, String prelude) throws IOException {
        String html = readAsset(assetPath);
        String tag = "<script>" + prelude + "window.__aiOn = " + aiModeOn + ";</script>";
        int i = html.indexOf("<head>");
        html = i >= 0 ? html.substring(0, i + 6) + tag + html.substring(i + 6) : tag + html;
        tab.view.loadDataWithBaseURL(url, html, "text/html", "UTF-8", url);
    }

    void performSearch(final Tab tab, final String query, JSONObject settings, final String kind) {
        final boolean web = "web".equals(kind);
        final String url = WWW + "internal/search.html?q=" + Uri.encode(query) + (web ? "" : "&kind=" + kind);
        tab.displayByUrl.put(url, "kithe://" + (web ? "search" : kind) + "?q=" + Uri.encode(query));
        try {
            loadAssetPage(tab, WWW_ASSET + "internal/search.html", url, "window.__voiceSearch = true;");
        } catch (IOException e) {
            tab.view.loadUrl(url);
        }
        final String key = settings.optString("googleApiKey");
        final String cx = settings.optString("googleCx");
        final boolean configured = !key.isEmpty() && !cx.isEmpty() && "api".equals(settings.optString("searchMode"));
        if (!configured || !web) {
            privateSearch(query, kind, outcome -> setSearchState(tab, url, query, true, outcome));
            return;
        }
        new Thread(() -> {
            final JSONObject outcome = googleSearch(query, key, cx);
            runOnUiThread(() -> setSearchState(tab, url, query, true, outcome));
        }).start();
    }

    void setSearchState(Tab tab, String url, String query, boolean configured, JSONObject outcome) {
        try {
            JSONObject state = new JSONObject().put("configured", configured).put("query", query);
            if (outcome != null) {
                Iterator<String> keys = outcome.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    state.put(k, outcome.get(k));
                }
            }
            String script = "window.__searchState = " + state + ";";
            tab.injections.put(url, script);
            if (url.equals(tab.finishedUrl)) tab.view.evaluateJavascript(script, null);
        } catch (JSONException ignored) {
        }
    }

    // Google's official Custom Search JSON API — same call the desktop app makes.
    static JSONObject googleSearch(String query, String key, String cx) {
        try {
            URL u = new URL("https://www.googleapis.com/customsearch/v1?key=" + URLEncoder.encode(key, "UTF-8")
                    + "&cx=" + URLEncoder.encode(cx, "UTF-8") + "&q=" + URLEncoder.encode(query, "UTF-8"));
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            InputStream in = c.getResponseCode() >= 400 ? c.getErrorStream() : c.getInputStream();
            JSONObject json = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
            if (json.has("error")) {
                return new JSONObject().put("error", json.getJSONObject("error").optString("message", "Search API error"));
            }
            JSONArray results = new JSONArray();
            JSONArray items = json.optJSONArray("items");
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject it = items.getJSONObject(i);
                    results.put(new JSONObject()
                            .put("title", it.optString("title"))
                            .put("url", it.optString("link"))
                            .put("snippet", it.optString("snippet", "")));
                }
            }
            return new JSONObject().put("results", results);
        } catch (Exception e) {
            try {
                return new JSONObject().put("error", String.valueOf(e.getMessage()));
            } catch (JSONException je) {
                return new JSONObject();
            }
        }
    }

    // ------------------------------------------------------------ tab view

    WebView makeTabView(final Tab tab) {
        final WebView wv = new WebView(this);
        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
                CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("kithe-search:")) {
                    forceWeb = true;
                    try {
                        navigateTab(tab.id, Uri.decode(url.substring("kithe-search:".length())));
                    } finally {
                        forceWeb = false;
                    }
                    return true;
                }
                for (String kind : new String[] { "images", "news", "videos" }) {
                    if (url.startsWith("kithe-" + kind + ":")) {
                        performSearch(tab, Uri.decode(url.substring(("kithe-" + kind + ":").length())), store.settings(), kind);
                        return true;
                    }
                }
                if (url.startsWith("kithe-aimode:")) {
                    setAiMode(!aiModeOn);
                    return true;
                }
                if (url.startsWith("kithe-installigx:")) {
                    new Thread(() -> IgxInstaller.run(MainActivity.this, msg -> runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show()))).start();
                    return true;
                }
                if (url.startsWith("kithe-voice:")) {
                    startVoiceSearch();
                    return true;
                }
                if (url.startsWith("kithe-ai:")) {
                    openAiMode(url.substring("kithe-ai:".length()));
                    return true;
                }
                if (url.startsWith("kithe-bookmark-action:")) {
                    handleBookmarkAction(tab, url.substring("kithe-bookmark-action:".length()));
                    return true;
                }
                String scheme = request.getUrl().getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    if (request.isForMainFrame()) {
                        String host = extractHostname(url);
                        JSONObject entry = host != null ? registry.optJSONObject(host) : null;
                        if (entry != null) {
                            activateEntry(tab, host, entry);
                            return true;
                        }
                    }
                    return false;
                }
                if ("file".equals(scheme) || "about".equals(scheme) || "data".equals(scheme)
                        || "blob".equals(scheme) || "javascript".equals(scheme)) {
                    return false;
                }
                try {
                    Intent i = "intent".equals(scheme) ? Intent.parseUri(url, Intent.URI_INTENT_SCHEME) : new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(i);
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                tab.loading = true;
                tab.finishedUrl = null;
                tab.faviconUrl = null;
                sendTabState(tab);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                tab.loading = false;
                tab.finishedUrl = url;
                String script = tab.injections.get(url);
                if (script != null) view.evaluateJavascript(script, null);
                sendTabState(tab);
            }

            @Override
            public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                sendTabState(tab);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                String url = request.getUrl().toString();
                if (request.isForMainFrame() && url.startsWith("http://localhost:")) {
                    view.loadDataWithBaseURL(url, "<body style=\"background:#1e1f26;color:#e8e8ee;font-family:sans-serif;padding:32px\">"
                            + "<h2>This app needs its server</h2><p>It runs on a Node server on the desktop version of Kithe, "
                            + "which can't run on Android.</p></body>", "text/html", "UTF-8", url);
                }
            }
        });

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onReceivedTitle(WebView view, String title) {
                sendTabState(tab);
            }

            @Override
            public void onReceivedIcon(WebView view, Bitmap icon) {
                if (icon == null) return;
                if (tab.lastIcon != null && tab.lastIcon.sameAs(icon)) return;
                tab.lastIcon = icon;
                int max = 48;
                Bitmap b = icon;
                if (Math.max(icon.getWidth(), icon.getHeight()) > max) {
                    float r = (float) max / Math.max(icon.getWidth(), icon.getHeight());
                    b = Bitmap.createScaledBitmap(icon, Math.max(1, Math.round(icon.getWidth() * r)), Math.max(1, Math.round(icon.getHeight() * r)), true);
                }
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                b.compress(Bitmap.CompressFormat.PNG, 100, out);
                tab.faviconUrl = "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
                sendTabState(tab);
            }

            // Sites routinely open links via target="_blank" or window.open() —
            // open them as a normal new tab, like the desktop version does.
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                createTab(null, resultMsg);
                return true;
            }

            @Override
            public void onCloseWindow(WebView window) {
                for (Tab t : tabs.values()) {
                    if (t.view == window) {
                        closeTab(t.id);
                        return;
                    }
                }
            }

            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (customView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                customView = view;
                customViewCallback = callback;
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                view.setBackgroundColor(Color.BLACK);
                if (chrome != null) chrome.setVisibility(View.GONE);
                tabHost.setVisibility(View.GONE);
                root.setFitsSystemWindows(false);
                getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
            }

            @Override
            public void onHideCustomView() {
                hideCustomView();
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                KitheDialog.show(MainActivity.this, null, message, null, "OK", result::confirm, null, null, result::cancel, true);
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                KitheDialog.show(MainActivity.this, null, message, null, "OK", result::confirm, "Cancel", result::cancel, result::cancel, true);
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, final JsPromptResult result) {
                final EditText input = new EditText(MainActivity.this);
                input.setText(defaultValue);
                input.setTextColor(KitheDialog.TEXT);
                input.setBackground(KitheDialog.rounded(MainActivity.this, 0xFF1E1F26, KitheDialog.LINE, 14));
                int pad = KitheDialog.dp(MainActivity.this, 12);
                input.setPadding(pad, pad, pad, pad);
                KitheDialog.show(MainActivity.this, null, message, input, "OK", () -> result.confirm(input.getText().toString()),
                        "Cancel", result::cancel, result::cancel, true);
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                return true;
            }
        });

        wv.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
                r.setMimeType(mimeType);
                r.addRequestHeader("User-Agent", userAgent);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) r.addRequestHeader("Cookie", cookie);
                r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType));
                ((DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE)).enqueue(r);
                Toast.makeText(this, "Downloading…", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show();
            }
        });

        // Holding = right-click. On an image that opens the image menu; for
        // anything else the page (and the system) handle it as usual.
        wv.setOnLongClickListener(v -> {
            WebView.HitTestResult hit = wv.getHitTestResult();
            int type = hit.getType();
            if ((type == WebView.HitTestResult.IMAGE_TYPE || type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) && hit.getExtra() != null) {
                showImageMenu(hit.getExtra(), tab);
                return true;
            }
            return false;
        });
        return wv;
    }

    void hideCustomView() {
        if (customView == null) return;
        root.removeView(customView);
        customView = null;
        if (customViewCallback != null) customViewCallback.onCustomViewHidden();
        customViewCallback = null;
        root.setFitsSystemWindows(true);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (chrome != null) chrome.setVisibility(View.VISIBLE);
        tabHost.setVisibility(View.VISIBLE);
    }

    void handleBookmarkAction(Tab tab, String b64) {
        // The home page can't call into the app, so it "navigates" to a
        // kithe-bookmark-action: URL carrying a base64url JSON payload.
        try {
            JSONObject p = new JSONObject(new String(Base64.decode(b64, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING), StandardCharsets.UTF_8));
            JSONObject patch = new JSONObject();
            if (p.has("folder")) patch.put("folder", p.isNull("folder") || p.optString("folder").isEmpty() ? JSONObject.NULL : p.getString("folder"));
            if (p.has("title")) patch.put("title", p.getString("title"));
            store.updateBookmark(p.getLong("id"), patch);
        } catch (Exception ignored) {
        }
        JSONObject entry = registry.optJSONObject("home.local");
        if (entry != null) activateEntry(tab, "home.local", entry);
    }

    // -------------------------------------------------------------- images

    void showImageMenu(final String src, final Tab tab) {
        KitheDialog.show(this, "Image", null, null, "Download image", () -> {
            try {
                emit("image:ask-name", new JSONObject().put("srcURL", src).put("defaultName", defaultImageName(src)));
            } catch (JSONException ignored) {
            }
        }, "Copy image", () -> copyImage(src, tab.view.getUrl()), null, true);
    }

    static String defaultImageName(String src) {
        if (src.startsWith("data:")) return "image";
        String seg = Uri.parse(src).getLastPathSegment();
        return seg == null || seg.trim().isEmpty() ? "image" : seg;
    }

    static class Fetched {
        byte[] data;
        String mime;
    }

    Fetched fetchImage(String src, String referer) throws IOException {
        Fetched f = new Fetched();
        if (src.startsWith("data:")) {
            int comma = src.indexOf(',');
            String meta = src.substring(5, comma);
            f.data = meta.contains(";base64") ? Base64.decode(src.substring(comma + 1), Base64.DEFAULT)
                    : Uri.decode(src.substring(comma + 1)).getBytes(StandardCharsets.UTF_8);
            f.mime = meta.split("[;,]")[0];
        } else if (src.startsWith("http://") || src.startsWith("https://")) {
            String current = src;
            for (int hop = 0; hop < 6; hop++) {
                HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(10000);
                c.setReadTimeout(20000);
                c.setRequestProperty("User-Agent", WebSettings.getDefaultUserAgent(this));
                if (referer != null && referer.startsWith("http")) c.setRequestProperty("Referer", referer);
                String cookie = CookieManager.getInstance().getCookie(current);
                if (cookie != null) c.setRequestProperty("Cookie", cookie);
                int code = c.getResponseCode();
                if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                    current = new URL(new URL(current), c.getHeaderField("Location")).toString();
                    continue;
                }
                if (code != 200) throw new IOException("HTTP " + code);
                f.data = readAll(c.getInputStream());
                String ct = c.getContentType();
                f.mime = ct == null ? "" : ct.split(";")[0].trim();
                break;
            }
            if (f.data == null) throw new IOException("Too many redirects");
        } else {
            throw new IOException("Unsupported image address");
        }
        if (f.mime == null || !f.mime.startsWith("image/")) f.mime = sniffMime(f.data);
        return f;
    }

    static String sniffMime(byte[] d) {
        if (d.length > 4 && (d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') return "image/png";
        if (d.length > 3 && (d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8) return "image/jpeg";
        if (d.length > 4 && d[0] == 'G' && d[1] == 'I' && d[2] == 'F') return "image/gif";
        if (d.length > 12 && d[0] == 'R' && d[1] == 'I' && d[2] == 'F' && d[3] == 'F' && d[8] == 'W' && d[9] == 'E' && d[10] == 'B' && d[11] == 'P') return "image/webp";
        String head = new String(d, 0, Math.min(d.length, 256), StandardCharsets.UTF_8);
        if (head.contains("<svg")) return "image/svg+xml";
        return "image/png";
    }

    static String extFor(String mime) {
        switch (mime) {
            case "image/jpeg": return "jpg";
            case "image/gif": return "gif";
            case "image/webp": return "webp";
            case "image/svg+xml": return "svg";
            case "image/bmp": return "bmp";
            case "image/avif": return "avif";
            case "image/x-icon": case "image/vnd.microsoft.icon": return "ico";
            default: return "png";
        }
    }

    void copyImage(final String src, final String referer) {
        new Thread(() -> {
            try {
                Fetched f = fetchImage(src, referer);
                byte[] data = f.data;
                String ext = extFor(f.mime);
                if (!f.mime.equals("image/png") && !f.mime.equals("image/jpeg")) {
                    Bitmap bmp = BitmapFactory.decodeByteArray(data, 0, data.length);
                    if (bmp == null) throw new IOException("Can't read this image");
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    bmp.compress(Bitmap.CompressFormat.PNG, 100, out);
                    data = out.toByteArray();
                    ext = "png";
                }
                File dir = new File(getCacheDir(), "images");
                dir.mkdirs();
                File[] old = dir.listFiles();
                if (old != null) for (File o : old) o.delete();
                String name = "kithe-image-" + System.currentTimeMillis() + "." + ext;
                try (OutputStream os = new FileOutputStream(new File(dir, name))) {
                    os.write(data);
                }
                final Uri uri = Uri.parse("content://" + ImageProvider.AUTHORITY + "/" + name);
                runOnUiThread(() -> {
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    cm.setPrimaryClip(ClipData.newUri(getContentResolver(), "Image", uri));
                    Toast.makeText(MainActivity.this, "Image copied", Toast.LENGTH_SHORT).show();
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Couldn't copy image: " + e.getMessage(), Toast.LENGTH_SHORT).show());
            }
        }).start();
    }

    void downloadImage(final int reqId, final String src, final String requestedName) {
        Tab active = tabs.get(activeTabId);
        final String referer = active != null ? active.view.getUrl() : null;
        new Thread(() -> {
            JSONObject result = new JSONObject();
            try {
                Fetched f = fetchImage(src, referer);
                String name = requestedName.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]", "_").trim();
                if (name.isEmpty()) name = "image";
                if (!name.matches(".*\\.[A-Za-z0-9]{2,5}$")) name += "." + extFor(f.mime);

                ContentResolver cr = getContentResolver();
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, name);
                v.put(MediaStore.Downloads.MIME_TYPE, f.mime);
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                v.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new IOException("Couldn't create the file");
                try (OutputStream os = cr.openOutputStream(uri)) {
                    os.write(f.data);
                }
                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                cr.update(uri, done, null, null);

                String finalName = name;
                try (Cursor c = cr.query(uri, new String[]{MediaStore.Downloads.DISPLAY_NAME}, null, null, null)) {
                    if (c != null && c.moveToFirst()) finalName = c.getString(0);
                }
                result.put("success", true).put("name", finalName);
            } catch (Exception e) {
                try {
                    result.put("success", false).put("message", String.valueOf(e.getMessage()));
                } catch (JSONException ignored) {
                }
            }
            runOnUiThread(() -> resolve(reqId, result));
        }).start();
    }

    // --------------------------------------------------------- install app

    // Bundled apps (snake, Fighting Game, Cyber Track) pin with their own logo
    // instead of the browser's icon.
    Bitmap registryLayer(String url) {
        try {
            String host = extractHostname(url);
            JSONObject entry = host != null ? registry.optJSONObject(host) : null;
            if (entry == null || !entry.has("iconImage")) return null;
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            String path = WWW_ASSET + EXCLUSIVE + entry.getString("iconImage");
            try (InputStream in = getAssets().open(path)) { BitmapFactory.decodeStream(in, null, bounds); }
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = Math.max(1, Math.max(bounds.outWidth, bounds.outHeight) / 432);
            Bitmap logo;
            try (InputStream in = getAssets().open(path)) { logo = BitmapFactory.decodeStream(in, null, opts); }
            if (logo == null) return null;
            // Adaptive icons show the centre of a 108dp layer, so the logo fills the whole layer.
            Bitmap layer = Bitmap.createBitmap(432, 432, Bitmap.Config.ARGB_8888);
            android.graphics.Canvas canvas = new android.graphics.Canvas(layer);
            canvas.drawColor(BG);
            canvas.drawBitmap(logo, null, new android.graphics.Rect(0, 0, 432, 432), new android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG));
            return layer;
        } catch (Exception e) {
            return null;
        }
    }

    static final String ICON_JS = "(function(){var o={icons:[],manifest:''};var l=document.querySelectorAll('link[rel]');"
            + "for(var i=0;i<l.length;i++){var r=(l[i].getAttribute('rel')||'').toLowerCase();var h=l[i].href;if(!h)continue;"
            + "if(r.indexOf('manifest')>=0){o.manifest=h;continue;}"
            + "if(r.indexOf('icon')<0||r.indexOf('mask')>=0)continue;"
            + "var sz=0,sa=(l[i].getAttribute('sizes')||'').split(/\\s+/);for(var k=0;k<sa.length;k++){var m=/^(\\d+)x\\d+$/.exec(sa[k]);if(m)sz=Math.max(sz,+m[1]);}"
            + "if(!sz&&r.indexOf('apple')>=0)sz=180;o.icons.push({href:h,size:sz});}return JSON.stringify(o);})()";

    static byte[] httpGet(String u) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36");
            if (c.getResponseCode() >= 400) return null;
            InputStream in = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                if (out.size() > 6_000_000) return null;
            }
            in.close();
            return out.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }

    // Finds the biggest icon the site offers (manifest, apple-touch-icon, or
    // its favicon links) instead of the 48px favicon the tab strip shows.
    Bitmap fetchBestIcon(String pageUrl, String evalResult) {
        List<Object[]> cands = new ArrayList<>();
        try {
            Object v = new org.json.JSONTokener(evalResult).nextValue();
            JSONObject o = new JSONObject(String.valueOf(v));
            JSONArray icons = o.optJSONArray("icons");
            for (int i = 0; icons != null && i < icons.length(); i++) {
                JSONObject ic = icons.getJSONObject(i);
                cands.add(new Object[] { ic.getString("href"), ic.optInt("size", 0) });
            }
            String manifest = o.optString("manifest");
            if (!manifest.isEmpty()) {
                byte[] raw = httpGet(manifest);
                if (raw != null) {
                    JSONArray mi = new JSONObject(new String(raw, StandardCharsets.UTF_8)).optJSONArray("icons");
                    for (int i = 0; mi != null && i < mi.length(); i++) {
                        JSONObject ic = mi.getJSONObject(i);
                        int best = 0;
                        for (String part : ic.optString("sizes", "").split("\\s+")) {
                            if (part.matches("\\d+x\\d+")) best = Math.max(best, Integer.parseInt(part.substring(0, part.indexOf('x'))));
                        }
                        if (ic.optString("purpose", "any").contains("monochrome")) continue;
                        cands.add(new Object[] { new URI(manifest).resolve(ic.getString("src")).toString(), best });
                    }
                }
            }
        } catch (Exception ignored) {
        }
        try {
            URI base = new URI(pageUrl);
            cands.add(new Object[] { base.resolve("/favicon.ico").toString(), 16 });
            String host = base.getHost();
            if (host != null) cands.add(new Object[] { "https://www.google.com/s2/favicons?domain=" + host + "&sz=256", 1 });
        } catch (Exception ignored) {
        }
        java.util.Collections.sort(cands, (x, y) -> ((Integer) y[1]) - ((Integer) x[1]));
        Bitmap best = null;
        int tried = 0;
        for (Object[] c : cands) {
            String u = (String) c[0];
            if (u.toLowerCase().contains(".svg") || tried++ >= 8) continue;
            byte[] raw = httpGet(u);
            if (raw == null) continue;
            Bitmap bmp = BitmapFactory.decodeByteArray(raw, 0, raw.length);
            if (bmp == null) continue;
            if (best == null || Math.max(bmp.getWidth(), bmp.getHeight()) > Math.max(best.getWidth(), best.getHeight())) best = bmp;
            if (Math.max(bmp.getWidth(), bmp.getHeight()) >= 256) break;
        }
        return best;
    }

    // Puts a site icon on the 108dp adaptive layer at full resolution: opaque
    // square icons fill it, transparent ones sit on a plain backdrop.
    Bitmap iconLayer(Bitmap src) {
        Bitmap layer = Bitmap.createBitmap(432, 432, Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(layer);
        android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.FILTER_BITMAP_FLAG | android.graphics.Paint.ANTI_ALIAS_FLAG);
        int corner = src.getPixel(0, 0);
        boolean opaque = Color.alpha(corner) > 250 && Color.alpha(src.getPixel(src.getWidth() - 1, src.getHeight() - 1)) > 250;
        if (opaque) {
            canvas.drawColor(corner);
            canvas.drawBitmap(src, null, new android.graphics.Rect(0, 0, 432, 432), paint);
        } else {
            long sum = 0;
            int count = 0;
            for (int y = 0; y < src.getHeight(); y += Math.max(1, src.getHeight() / 16)) {
                for (int x = 0; x < src.getWidth(); x += Math.max(1, src.getWidth() / 16)) {
                    int px = src.getPixel(x, y);
                    if (Color.alpha(px) > 128) {
                        sum += (Color.red(px) * 299 + Color.green(px) * 587 + Color.blue(px) * 114) / 1000;
                        count++;
                    }
                }
            }
            canvas.drawColor(count > 0 && sum / count > 150 ? BG : Color.WHITE);
            canvas.drawBitmap(src, null, new android.graphics.Rect(76, 76, 356, 356), paint);
        }
        return layer;
    }

    void installAsApp(final int reqId, final JSONObject p) {
        final String url = p.optString("url");
        final String title = p.optString("title", url);
        final String fav = p.isNull("faviconUrl") ? null : p.optString("faviconUrl", null);
        Bitmap own = registryLayer(url);
        Tab t = tabs.get(activeTabId);
        if (own != null || t == null) {
            finishInstall(reqId, url, title, own, fav);
            return;
        }
        t.view.evaluateJavascript(ICON_JS, v -> new Thread(() -> {
            Bitmap best = fetchBestIcon(url, v);
            Bitmap layer = best == null ? null : iconLayer(best);
            runOnUiThread(() -> finishInstall(reqId, url, title, layer, fav));
        }).start());
    }

    void finishInstall(int reqId, String url, String title, Bitmap layer, String fav) {
        JSONObject result = new JSONObject();
        try {
            if (layer == null && fav != null && fav.startsWith("data:")) {
                try {
                    byte[] bytes = Base64.decode(fav.substring(fav.indexOf(',') + 1), Base64.DEFAULT);
                    Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bmp != null) layer = iconLayer(bmp);
                } catch (Exception ignored) {
                }
            }
            String label = title == null || title.isEmpty() ? url : title;
            Intent i = new Intent(this, MainActivity.class)
                    .setAction(ACTION_OPEN_APP)
                    .putExtra("url", url)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NEW_DOCUMENT | Intent.FLAG_ACTIVITY_MULTIPLE_TASK);
            // Launchers that still take the classic shortcut broadcast show the
            // icon as-is; pinned shortcuts get a small Kithe badge from the launcher.
            Intent legacy = new Intent("com.android.launcher.action.INSTALL_SHORTCUT");
            if (layer != null && !getPackageManager().queryBroadcastReceivers(legacy, 0).isEmpty()) {
                legacy.putExtra(Intent.EXTRA_SHORTCUT_INTENT, i)
                        .putExtra(Intent.EXTRA_SHORTCUT_NAME, label)
                        .putExtra(Intent.EXTRA_SHORTCUT_ICON, Bitmap.createScaledBitmap(layer, 256, 256, true));
                sendBroadcast(legacy);
                resolve(reqId, result.put("success", true).put("message", ""));
                return;
            }
            ShortcutManager sm = getSystemService(ShortcutManager.class);
            if (sm == null || !sm.isRequestPinShortcutSupported()) {
                resolve(reqId, result.put("success", false).put("message", "Your launcher doesn't support pinned shortcuts"));
                return;
            }
            Icon icon = layer != null ? Icon.createWithAdaptiveBitmap(layer) : Icon.createWithResource(this, R.mipmap.ic_launcher);
            ShortcutInfo info = new ShortcutInfo.Builder(this, "site-" + Integer.toHexString(url.hashCode()))
                    .setShortLabel(label)
                    .setIcon(icon)
                    .setIntent(i)
                    .build();
            boolean ok = sm.requestPinShortcut(info, null);
            resolve(reqId, result.put("success", ok).put("message", ok ? "" : "The launcher refused the shortcut"));
        } catch (JSONException e) {
            resolve(reqId, null);
        }
    }

    // ------------------------------------------------------------- helpers

    String readAsset(String path) throws IOException {
        try (InputStream in = getAssets().open(path)) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        }
    }

    static byte[] readAll(InputStream in) throws IOException {
        if (in == null) return new byte[0];
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        in.close();
        return out.toByteArray();
    }

    // ---------------------------------------------------------------- store

    static class Store {
        final File dir;

        Store(File dir) {
            this.dir = dir;
        }

        String read(String name) {
            try {
                return new String(readAll(new java.io.FileInputStream(new File(dir, name))), StandardCharsets.UTF_8);
            } catch (Exception e) {
                return null;
            }
        }

        void write(String name, String content) {
            try (OutputStream os = new FileOutputStream(new File(dir, name))) {
                os.write(content.getBytes(StandardCharsets.UTF_8));
            } catch (IOException ignored) {
            }
        }

        JSONArray bookmarks() {
            try {
                String s = read("bookmarks.json");
                return s == null ? new JSONArray() : new JSONArray(s);
            } catch (JSONException e) {
                return new JSONArray();
            }
        }

        JSONArray addBookmark(String url, String title, String faviconUrl) throws JSONException {
            JSONArray list = bookmarks();
            for (int i = 0; i < list.length(); i++) if (url.equals(list.getJSONObject(i).optString("url"))) return list;
            long now = System.currentTimeMillis();
            JSONArray next = new JSONArray();
            next.put(new JSONObject().put("id", now).put("url", url).put("title", title.isEmpty() ? url : title)
                    .put("faviconUrl", faviconUrl == null ? JSONObject.NULL : faviconUrl).put("folder", JSONObject.NULL).put("createdAt", now));
            for (int i = 0; i < list.length(); i++) next.put(list.get(i));
            write("bookmarks.json", next.toString(2));
            return next;
        }

        JSONArray removeBookmark(long id) throws JSONException {
            JSONArray list = bookmarks();
            JSONArray next = new JSONArray();
            for (int i = 0; i < list.length(); i++) if (list.getJSONObject(i).optLong("id") != id) next.put(list.get(i));
            write("bookmarks.json", next.toString(2));
            return next;
        }

        JSONArray updateBookmark(long id, JSONObject patch) throws JSONException {
            JSONArray list = bookmarks();
            for (int i = 0; i < list.length(); i++) {
                JSONObject o = list.getJSONObject(i);
                if (o.optLong("id") == id) {
                    Iterator<String> keys = patch.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        o.put(k, patch.get(k));
                    }
                }
            }
            write("bookmarks.json", list.toString(2));
            return list;
        }

        JSONObject settings() {
            try {
                JSONObject s = new JSONObject()
                        .put("searchEngine", "https://www.google.com/search?q=%s")
                        .put("googleApiKey", "")
                        .put("googleCx", "")
                        .put("searchMode", "direct");
                String saved = read("settings.json");
                if (saved != null) {
                    JSONObject o = new JSONObject(saved);
                    Iterator<String> keys = o.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        s.put(k, o.get(k));
                    }
                }
                return s;
            } catch (JSONException e) {
                return new JSONObject();
            }
        }

        JSONObject setSettings(JSONObject partial) throws JSONException {
            JSONObject merged = settings();
            Iterator<String> keys = partial.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                merged.put(k, partial.get(k));
            }
            write("settings.json", merged.toString(2));
            return merged;
        }
    }
}
