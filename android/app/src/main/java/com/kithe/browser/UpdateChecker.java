package com.kithe.browser;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

final class UpdateChecker {
    static final String RELEASE_API = "https://api.github.com/repos/zgdgames/kithe/releases/latest";
    static final String ACTION = "com.kithe.browser.UPDATE_STATUS";
    static final String CHANNEL = "updates";
    static final long INTERVAL_MS = 60L * 60L * 1000L;
    private static final AtomicBoolean busy = new AtomicBoolean(false);

    private UpdateChecker() {}

    static int installedVersion(Context ctx) {
        try {
            return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionCode;
        } catch (Exception e) {
            return Integer.MAX_VALUE;
        }
    }

    static int versionCodeOf(String tag) {
        String[] p = tag.replaceFirst("^[vV]", "").split("[.-]");
        int major = 0, minor = 0, patch = 0;
        try {
            major = Integer.parseInt(p[0]);
            minor = p.length > 1 ? Integer.parseInt(p[1]) : 0;
            patch = p.length > 2 ? Integer.parseInt(p[2]) : 0;
        } catch (NumberFormatException e) {
            return 0;
        }
        return major * 10000 + minor * 100 + patch;
    }

    static void check(Context ctx, boolean foreground) {
        if (!busy.compareAndSet(false, true)) return;
        try {
            SharedPreferences prefs = ctx.getSharedPreferences("updates", Context.MODE_PRIVATE);
            JSONObject info = new JSONObject(readText(RELEASE_API));
            prefs.edit().putLong("lastCheck", System.currentTimeMillis()).apply();
            int latest = versionCodeOf(info.getString("tag_name"));
            String apkUrl = null;
            JSONArray assets = info.getJSONArray("assets");
            for (int i = 0; i < assets.length(); i++) {
                JSONObject a = assets.getJSONObject(i);
                if (a.getString("name").endsWith("-android.apk")) apkUrl = a.getString("browser_download_url");
            }
            if (apkUrl == null) return;
            if (latest <= installedVersion(ctx)) return;
            if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
                Intent allow = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
                allow.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (foreground && prefs.getInt("askedFor", 0) != latest) {
                    prefs.edit().putInt("askedFor", latest).apply();
                    ctx.startActivity(allow);
                } else {
                    notifyUser(ctx, "Kithe update ready", "Tap to allow Kithe to update itself.", allow);
                }
                return;
            }
            install(ctx, apkUrl);
        } catch (Exception e) {
            android.util.Log.w("KitheUpdate", "update check failed: " + e);
        } finally {
            busy.set(false);
        }
    }

    private static String readText(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        c.setRequestProperty("Accept", "application/vnd.github+json");
        try (InputStream in = c.getInputStream()) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } finally {
            c.disconnect();
        }
    }

    private static void install(Context ctx, String apkUrl) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(apkUrl).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setUseCaches(false);
        PackageInstaller installer = ctx.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(ctx.getPackageName());
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (InputStream in = c.getInputStream(); OutputStream out = session.openWrite("update", 0, c.getContentLengthLong())) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                session.fsync(out);
            }
            Intent cb = new Intent(ctx, UpdateReceiver.class).setAction(ACTION);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            session.commit(PendingIntent.getBroadcast(ctx, id, cb, flags).getIntentSender());
        } catch (Exception e) {
            installer.abandonSession(id);
            throw e;
        } finally {
            c.disconnect();
        }
    }

    static void notifyUser(Context ctx, String title, String text, Intent tap) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Updates", NotificationManager.IMPORTANCE_DEFAULT));
            b = new Notification.Builder(ctx, CHANNEL);
        } else {
            b = new Notification.Builder(ctx);
        }
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        b.setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(title)
            .setContentText(text)
            .setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(ctx, 1, tap, flags));
        nm.notify(1001, b.build());
    }
}
