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
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

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
    private WindowManager wm;
    private ImageView bubble;
    private boolean bubblePlaying;

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
        showBubble(playing);
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

    // A small draggable button pinned near the top-left, like the "now
    // playing" chip other media apps show over everything else, so there is
    // something to tap besides pulling down the notification shade.
    private void showBubble(boolean playing) {
        bubblePlaying = playing;
        if (bubble != null) {
            paintBubble();
            return;
        }
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) return;
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
            dp(44), dp(44), type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            android.graphics.PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = dp(12);
        lp.y = dp(90);
        bubble = new ImageView(this);
        bubble.setPadding(dp(10), dp(10), dp(10), dp(10));
        paintBubble();
        bubble.setOnTouchListener(new View.OnTouchListener() {
            float downX, downY;
            int startX, startY;
            boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = e.getRawX();
                        downY = e.getRawY();
                        startX = lp.x;
                        startY = lp.y;
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int nx = startX + (int) (e.getRawX() - downX);
                        int ny = startY + (int) (e.getRawY() - downY);
                        if (Math.abs(nx - startX) > 6 || Math.abs(ny - startY) > 6) moved = true;
                        lp.x = nx;
                        lp.y = ny;
                        try {
                            wm.updateViewLayout(bubble, lp);
                        } catch (Exception ignored) {
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) sendTo(bubblePlaying ? ACTION_PAUSE : ACTION_PLAY);
                        return true;
                }
                return false;
            }
        });
        try {
            wm.addView(bubble, lp);
        } catch (Exception ignored) {
            bubble = null;
        }
    }

    private void paintBubble() {
        if (bubble == null) return;
        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(Color.parseColor("#7C5CFF"));
        bubble.setBackground(bg);
        bubble.setImageResource(bubblePlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
        bubble.setColorFilter(Color.WHITE);
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void hideBubble() {
        if (bubble != null && wm != null) {
            try {
                wm.removeView(bubble);
            } catch (Exception ignored) {
            }
            bubble = null;
        }
    }

    private void stop() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        hideBubble();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        hideBubble();
        if (session != null) session.release();
        super.onDestroy();
    }
}
