package com.kithe.browser;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

// Home-screen search widgets: search, voice search and AI Mode, in three sizes.
public abstract class KitheWidget extends AppWidgetProvider {
    abstract int layout();

    int miniBelow() {
        return 150;
    }

    int layout(Bundle options) {
        int w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        return w < miniBelow() ? R.layout.widget_mini : layout();
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle options) {
        onUpdate(ctx, mgr, new int[] { id });
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) {
            RemoteViews v = new RemoteViews(ctx.getPackageName(), layout(mgr.getAppWidgetOptions(id)));
            v.setOnClickPendingIntent(R.id.w_search, action(ctx, "search"));
            v.setOnClickPendingIntent(R.id.w_voice, action(ctx, "voice"));
            v.setOnClickPendingIntent(R.id.w_ai, action(ctx, "ai"));
            mgr.updateAppWidget(id, v);
        }
    }

    static PendingIntent action(Context ctx, String name) {
        Intent i = new Intent(ctx, MainActivity.class)
                .setData(Uri.parse("kithe-widget://" + name))
                .putExtra(MainActivity.EXTRA_WIDGET, name)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, name.hashCode(), i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    public static class Bar extends KitheWidget {
        @Override int layout() { return R.layout.widget_bar; }
    }

    public static class Small extends KitheWidget {
        @Override int layout() { return R.layout.widget_small; }
        @Override int miniBelow() { return 100; }
    }

    public static class Large extends KitheWidget {
        @Override int layout() { return R.layout.widget_large; }

        @Override
        int layout(Bundle options) {
            int w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int h = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 120);
            if (w < 100 || h < 60) return R.layout.widget_mini;
            return w < 200 || h < 110 ? R.layout.widget_large_compact : R.layout.widget_large;
        }
    }
}
