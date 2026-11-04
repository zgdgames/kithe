package com.kithe.browser;

import android.app.Activity;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.LinearLayout;
import android.widget.TextView;

// Kithe-styled replacement for the stock Android dialogs: dark, rounded, purple and blue.
final class KitheDialog {
    static final int CARD = 0xFF26272F;
    static final int LINE = 0xFF34353F;
    static final int TEXT = 0xFFE8E8EE;
    static final int DIM = 0xFF9A9AA5;
    static final int PURPLE = 0xFF7C5CFF;
    static final int BLUE = 0xFF4F8CFF;

    static int dp(Activity a, float v) {
        return Math.round(v * a.getResources().getDisplayMetrics().density);
    }

    static GradientDrawable rounded(Activity a, int fill, int stroke, float radiusDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(a, radiusDp));
        if (stroke != 0) g.setStroke(dp(a, 1), stroke);
        return g;
    }

    static TextView button(Activity a, String label, boolean primary, final Runnable onClick, final Dialog d) {
        TextView b = new TextView(a);
        b.setText(label);
        b.setTextSize(15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setGravity(Gravity.CENTER);
        b.setTextColor(primary ? Color.WHITE : TEXT);
        b.setPadding(dp(a, 20), 0, dp(a, 20), 0);
        if (primary) {
            GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { PURPLE, BLUE });
            g.setCornerRadius(dp(a, 22));
            b.setBackground(g);
        } else {
            b.setBackground(rounded(a, 0, LINE, 22));
        }
        b.setOnClickListener(v -> {
            if (d != null) d.dismiss();
            if (onClick != null) onClick.run();
        });
        return b;
    }

    static Dialog base(Activity a, View content, boolean cancelable) {
        final Dialog d = new Dialog(a);
        d.requestWindowFeature(Window.FEATURE_NO_TITLE);
        d.setContentView(content);
        d.setCancelable(cancelable);
        Window w = d.getWindow();
        if (w != null) {
            w.setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            w.setLayout(Math.min(a.getResources().getDisplayMetrics().widthPixels - dp(a, 40), dp(a, 420)), ViewGroup.LayoutParams.WRAP_CONTENT);
            w.setDimAmount(0.6f);
        }
        return d;
    }

    static LinearLayout card(Activity a) {
        LinearLayout c = new LinearLayout(a);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setBackground(rounded(a, CARD, LINE, 24));
        c.setPadding(dp(a, 22), dp(a, 22), dp(a, 22), dp(a, 18));
        return c;
    }

    static Dialog show(Activity a, String title, String message, View extra, String yes, Runnable onYes, String no, Runnable onNo, Runnable onCancel, boolean cancelable) {
        LinearLayout c = card(a);
        if (title != null) {
            TextView t = new TextView(a);
            t.setText(title);
            t.setTextColor(TEXT);
            t.setTextSize(19);
            t.setTypeface(Typeface.DEFAULT_BOLD);
            c.addView(t);
        }
        if (message != null) {
            TextView m = new TextView(a);
            m.setText(message);
            m.setTextColor(title != null ? DIM : TEXT);
            m.setTextSize(15);
            m.setLineSpacing(0, 1.25f);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
            lp.topMargin = dp(a, title != null ? 8 : 0);
            c.addView(m, lp);
        }
        if (extra != null) {
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
            lp.topMargin = dp(a, 12);
            c.addView(extra, lp);
        }
        final Dialog d = base(a, c, cancelable);
        LinearLayout row = new LinearLayout(a);
        row.setGravity(Gravity.END);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(-1, -2);
        rp.topMargin = dp(a, 20);
        c.addView(row, rp);
        if (no != null) {
            LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-2, dp(a, 44));
            bp.rightMargin = dp(a, 8);
            row.addView(button(a, no, false, onNo, d), bp);
        }
        row.addView(button(a, yes, true, onYes, d), new LinearLayout.LayoutParams(-2, dp(a, 44)));
        if (onCancel != null) d.setOnCancelListener(x -> onCancel.run());
        d.show();
        return d;
    }
}
