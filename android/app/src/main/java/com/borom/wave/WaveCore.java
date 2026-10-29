package com.borom.wave;

import android.content.Context;
import android.util.Log;

import com.borom.wave.core.mobile.Listener;
import com.borom.wave.core.mobile.Mobile;

import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Process-wide access to the Go core (wave.aar). The core is started once, by
 * whichever of the plugin and the playback service comes first, and its events
 * are fanned out to every registered sink.
 */
public final class WaveCore {
    private static final String TAG = "WaveCore";

    public interface Sink {
        void onEvent(String name, String payload);
    }

    private static final CopyOnWriteArrayList<Sink> sinks = new CopyOnWriteArrayList<>();
    private static boolean started;

    private WaveCore() {}

    public static synchronized void start(Context ctx) {
        if (started) return;
        try {
            // Before start: the library scan needs it for .m4a and Opus files.
            Mobile.setDecoder(new AndroidDecoder());
            Mobile.start(ctx.getFilesDir().getAbsolutePath(), new Listener() {
                @Override
                public void onEvent(String name, String payload) {
                    for (Sink s : sinks) s.onEvent(name, payload);
                }
            });
            started = true;
        } catch (Exception e) {
            Log.e(TAG, "start", e);
        }
    }

    public static void addSink(Sink s) { sinks.add(s); }

    public static void removeSink(Sink s) { sinks.remove(s); }

    /** Calls a core method; args is a JSON array, the result is JSON. */
    public static String call(String method, String args) throws Exception {
        return Mobile.call(method, args);
    }

    /** Fire-and-forget call, for media buttons and audio focus changes. */
    public static void send(String method, String args) {
        try {
            Mobile.call(method, args);
        } catch (Exception e) {
            Log.w(TAG, method, e);
        }
    }

    public static String coverBaseUrl() { return Mobile.coverBaseURL(); }

    /** Writes the settings now: the process may be killed while in the background. */
    public static void save() { Mobile.save(); }
}
