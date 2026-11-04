package com.kithe.browser;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// Downloads the newest IGX Assistant straight from the web and hands it to
// Android's installer, so the app never has to travel through a chat or a file.
final class IgxInstaller {
    static final String HOST = "https://verticality.vercel.app/";
    static final String SLUG = "igx-assistant";
    static final String ACTION = "com.kithe.browser.IGX_INSTALL_STATUS";

    private IgxInstaller() {}

    interface Progress {
        void say(String message);
    }

    static void run(Context ctx, Progress say) {
        try {
            if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
                Intent allow = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
                allow.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(allow);
                say.say("Allow Kithe to install apps, then tap Install the app again.");
                return;
            }
            say.say("Finding the newest IGX Assistant…");
            JSONObject info = new JSONObject(readText(HOST + "downloads/" + SLUG + "-version.json?t=" + System.currentTimeMillis()));
            String apk = HOST + info.optString("apk", "downloads/" + SLUG + ".apk").replaceFirst("^/", "") + "?v=" + info.optInt("versionCode");
            say.say("Downloading IGX Assistant…");
            install(ctx, apk);
            say.say("Tap Install when Android asks.");
        } catch (Exception e) {
            say.say("Couldn't get IGX Assistant: " + (e.getMessage() == null ? e.toString() : e.getMessage()));
        }
    }

    private static String readText(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
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
        params.setAppPackageName("com.igx.assistant");
        int id = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(id)) {
            try (InputStream in = c.getInputStream(); OutputStream out = session.openWrite("igx", 0, c.getContentLengthLong())) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                session.fsync(out);
            }
            Intent cb = new Intent(ctx, IgxInstallReceiver.class).setAction(ACTION);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            session.commit(PendingIntent.getBroadcast(ctx, id, cb, flags).getIntentSender());
        } catch (Exception e) {
            installer.abandonSession(id);
            throw e;
        } finally {
            c.disconnect();
        }
    }
}
