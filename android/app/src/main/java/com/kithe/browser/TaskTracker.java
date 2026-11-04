package com.kithe.browser;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;

// Started (not bound) from MainActivity, purely so Android calls
// onTaskRemoved only when the user actually swipes Kithe away from Recents -
// never when the OS silently kills the background process to reclaim
// memory while the task is still there. That's the signal that decides
// whether the next launch asks to reopen tabs or just restores them as-is.
public class TaskTracker extends Service {
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        getSharedPreferences("ui", MODE_PRIVATE).edit().putBoolean("taskRemoved", true).apply();
        stopSelf();
        super.onTaskRemoved(rootIntent);
    }
}
