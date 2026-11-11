package com.borom.wave;

import android.Manifest;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bridge between the web UI (frontend/src/lib/backend/android.ts) and the Go core.
 * Calls run in order on one background thread; core events reach JS as "event".
 */
@CapacitorPlugin(
    name = "Wave",
    permissions = {
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }),
    }
)
public class WavePlugin extends Plugin {
    private final ExecutorService calls = Executors.newSingleThreadExecutor();
    /** False while the app is in the background: the hidden page doesn't need progress ticks. */
    private volatile boolean visible = true;
    private final WaveCore.Sink sink = (name, payload) -> {
        // The next tick (within 250 ms) refreshes the page when it comes back.
        if (!visible && name.equals("playback:progress")) return;
        JSObject e = new JSObject();
        e.put("name", name);
        e.put("payload", payload);
        notifyListeners("event", e);
    };

    @Override
    public void load() {
        WaveCore.start(getContext());
        WaveCore.addSink(sink);
        getContext().startService(new Intent(getContext(), PlaybackService.class));
    }

    @Override
    protected void handleOnPause() { visible = false; }

    @Override
    protected void handleOnResume() {
        visible = true;
        // Music added while away (download, copy) shows up on return. Unchanged files
        // come from the cache, so this is cheap; never asks for the permission.
        if (mediaGranted()) scan(null);
    }

    @Override
    protected void handleOnDestroy() {
        WaveCore.removeSink(sink);
        calls.shutdown();
    }

    @PluginMethod
    public void call(PluginCall call) {
        String method = call.getString("method");
        String args = call.getString("args", "[]");
        calls.execute(() -> {
            try {
                JSObject r = new JSObject();
                r.put("result", WaveCore.call(method, args));
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void coverBaseUrl(PluginCall call) {
        JSObject r = new JSObject();
        r.put("url", WaveCore.coverBaseUrl());
        call.resolve(r);
    }

    // ---- Library: the whole device's music, from the system media index ----

    /** Media read permission for this Android version. */
    private static String mediaAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "storage";
    }

    private boolean mediaGranted() {
        return getPermissionState(mediaAlias()) == PermissionState.GRANTED;
    }

    /** Asks for the media permission if needed, then rescans the library. */
    @PluginMethod
    public void scanLibrary(PluginCall call) {
        if (mediaGranted()) {
            scan(call);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Asked together so the notification controls work from the first track.
            requestPermissionForAliases(new String[] { "audio", "notifications" }, call, "permissionsDone");
        } else {
            requestPermissionForAlias("storage", call, "permissionsDone");
        }
    }

    @PermissionCallback
    private void permissionsDone(PluginCall call) {
        if (!mediaGranted()) {
            call.reject("Permission d'accès à la musique refusée");
            return;
        }
        scan(call);
    }

    /** Gives the Go core every music file the system knows (internal storage and SD cards). */
    private void scan(PluginCall call) {
        calls.execute(() -> {
            try {
                WaveCore.call("ScanFiles", new JSONArray().put(musicFiles()).toString());
                if (call != null) call.resolve();
            } catch (Exception e) {
                if (call != null) call.reject(e.getMessage());
            }
        });
    }

    /**
     * File paths of the audio the media index marks as music, like the system music apps
     * (no ringtones, notifications or voice notes). The Go scanner reads them directly,
     * which READ_MEDIA_AUDIO allows for media files.
     */
    private JSONArray musicFiles() {
        Uri uri = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
            : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String[] projection = { MediaStore.Audio.Media.DATA };
        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0";
        JSONArray paths = new JSONArray();
        try (Cursor c = getContext().getContentResolver().query(uri, projection, selection, null, null)) {
            if (c == null) return paths;
            int col = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
            while (c.moveToNext()) {
                String path = c.getString(col);
                if (path != null && !path.isEmpty()) paths.put(path);
            }
        }
        return paths;
    }
}
