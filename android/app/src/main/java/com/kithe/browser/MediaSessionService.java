package com.kithe.browser;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

// Keeps a tab's audio or video playing after the user leaves the app, the
// same way a music app does: a foreground service with a media-style
// notification tells Android not to kill the process while it's playing.
public class MediaSessionService extends Service {
    static final String CHANNEL = "playback";
    static final String ACTION_PLAY = "com.kithe.browser.MEDIA_PLAY";
    static final String ACTION_PAUSE = "com.kithe.browser.MEDIA_PAUSE";
    static final String ACTION_STOP = "com.kithe.browser.MEDIA_STOP";

    private MediaSession session;
    private PowerManager.WakeLock wakeLock;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaSession(this, "KitheMedia");
        session.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() {
                sendTo(ACTION_PLAY);
            }

            @Override
            public void onPause() {
                sendTo(ACTION_PAUSE);
            }

            @Override
            public void onStop() {
                sendTo(ACTION_STOP);
            }
        });
        session.setActive(true);
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Kithe:media");
    }

    private void sendTo(String action) {
        Intent i = new Intent(action).setPackage(getPackageName());
        sendBroadcast(i);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        String title = intent == null ? null : intent.getStringExtra("title");
        if (ACTION_STOP.equals(action)) {
            stop();
            return START_NOT_STICKY;
        }
        boolean playing = !ACTION_PAUSE.equals(action);
        if (wakeLock != null && !wakeLock.isHeld() && playing) wakeLock.acquire(4 * 60 * 60 * 1000L);
        if (wakeLock != null && wakeLock.isHeld() && !playing) wakeLock.release();
        session.setPlaybackState(new PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE)
            .setState(playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, 0, 1f)
            .build());
        startForeground(1002, notification(title == null ? "Playing" : title, playing));
        return START_NOT_STICKY;
    }

    private Notification notification(String title, boolean playing) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Playback", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent toggle = PendingIntent.getService(this, 1,
            new Intent(this, MediaSessionService.class).setAction(playing ? ACTION_PAUSE : ACTION_PLAY), flags);
        PendingIntent stop = PendingIntent.getService(this, 2,
            new Intent(this, MediaSessionService.class).setAction(ACTION_STOP), flags);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText("Playing in Kithe")
            .setContentIntent(content)
            .setOngoing(playing)
            .setOnlyAlertOnce(true)
            .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, playing ? "Pause" : "Play", toggle)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stop)
            .setStyle(new Notification.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1));
        return b.build();
    }

    private void stop() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (session != null) session.release();
        super.onDestroy();
    }
}
