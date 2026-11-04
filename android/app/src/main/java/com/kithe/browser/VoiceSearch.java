package com.kithe.browser;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.util.ArrayList;

// Kithe's own voice search: a rounded purple and blue sheet over the page
// instead of the system speech dialog.
final class VoiceSearch {
    interface Done { void heard(String text); }

    private final Activity a;
    private final Done done;
    private SpeechRecognizer rec;
    private Dialog dialog;
    private TextView status;
    private TextView transcript;
    private View ring;
    private boolean finished;

    VoiceSearch(Activity a, Done done) {
        this.a = a;
        this.done = done;
    }

    static boolean available(Activity a) {
        return SpeechRecognizer.isRecognitionAvailable(a);
    }

    void start() {
        LinearLayout c = KitheDialog.card(a);
        c.setGravity(Gravity.CENTER_HORIZONTAL);
        int size = KitheDialog.dp(a, 96);
        FrameLayout mic = new FrameLayout(a);
        ring = new View(a);
        GradientDrawable rg = new GradientDrawable();
        rg.setShape(GradientDrawable.OVAL);
        rg.setColor(0x337C5CFF);
        ring.setBackground(rg);
        mic.addView(ring, new FrameLayout.LayoutParams(size, size, Gravity.CENTER));
        ImageView icon = new ImageView(a);
        GradientDrawable ig = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { KitheDialog.PURPLE, KitheDialog.BLUE });
        ig.setShape(GradientDrawable.OVAL);
        icon.setBackground(ig);
        icon.setImageResource(R.drawable.ic_w_mic);
        int pad = KitheDialog.dp(a, 17);
        icon.setPadding(pad, pad, pad, pad);
        int core = KitheDialog.dp(a, 64);
        mic.addView(icon, new FrameLayout.LayoutParams(core, core, Gravity.CENTER));
        c.addView(mic, new LinearLayout.LayoutParams(size, size));

        status = new TextView(a);
        status.setText("Listening…");
        status.setTextColor(KitheDialog.TEXT);
        status.setTextSize(18);
        status.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(-2, -2);
        sp.topMargin = KitheDialog.dp(a, 14);
        c.addView(status, sp);

        transcript = new TextView(a);
        transcript.setTextColor(KitheDialog.DIM);
        transcript.setTextSize(15);
        transcript.setGravity(Gravity.CENTER);
        transcript.setMinHeight(KitheDialog.dp(a, 24));
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(-1, -2);
        tp.topMargin = KitheDialog.dp(a, 6);
        c.addView(transcript, tp);

        TextView cancel = KitheDialog.button(a, "Cancel", false, this::stop, null);
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(-2, KitheDialog.dp(a, 44));
        cp.topMargin = KitheDialog.dp(a, 18);

        dialog = KitheDialog.base(a, c, true);
        dialog.setOnCancelListener(d -> stop());
        cancel.setOnClickListener(v -> { dialog.dismiss(); stop(); });
        c.addView(cancel, cp);
        dialog.show();

        ValueAnimator pulse = ValueAnimator.ofFloat(0.72f, 1f);
        pulse.setDuration(900);
        pulse.setRepeatMode(ValueAnimator.REVERSE);
        pulse.setRepeatCount(ValueAnimator.INFINITE);
        pulse.addUpdateListener(v -> {
            float s = (float) v.getAnimatedValue();
            ring.setScaleX(s);
            ring.setScaleY(s);
        });
        pulse.start();
        dialog.setOnDismissListener(d -> pulse.cancel());

        rec = SpeechRecognizer.createSpeechRecognizer(a);
        rec.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle p) { }
            @Override public void onBeginningOfSpeech() { status.setText("Listening…"); }
            @Override public void onRmsChanged(float rms) {
                float s = 0.78f + Math.min(Math.max(rms, 0f), 10f) / 10f * 0.22f;
                ring.animate().cancel();
                ring.setScaleX(s);
                ring.setScaleY(s);
            }
            @Override public void onBufferReceived(byte[] b) { }
            @Override public void onEndOfSpeech() { status.setText("Searching…"); }
            @Override public void onError(int e) {
                if (finished) return;
                boolean quiet = e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT;
                status.setText(quiet ? "Didn't catch that" : "Voice search isn't available");
                transcript.setText("");
                a.getWindow().getDecorView().postDelayed(() -> { if (!finished) { dialog.dismiss(); stop(); } }, 1400);
            }
            @Override public void onResults(Bundle r) {
                ArrayList<String> list = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                String text = list == null || list.isEmpty() ? "" : list.get(0);
                dialog.dismiss();
                stop();
                if (!text.isEmpty()) done.heard(text);
            }
            @Override public void onPartialResults(Bundle r) {
                ArrayList<String> list = r.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (list != null && !list.isEmpty()) transcript.setText(list.get(0));
            }
            @Override public void onEvent(int t, Bundle p) { }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        rec.startListening(i);
    }

    void stop() {
        finished = true;
        if (rec != null) {
            rec.destroy();
            rec = null;
        }
    }
}
