package com.borom.wave;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
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
    private static final String STORAGE_AUTHORITY = "com.android.externalstorage.documents";

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
    protected void handleOnResume() { visible = true; }

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

    // ---- Music folder: permissions, then the system folder picker ----

    /** Media read permission for this Android version. */
    private static String mediaAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? "audio" : "storage";
    }

    @PluginMethod
    public void chooseFolder(PluginCall call) {
        if (getPermissionState(mediaAlias()) == PermissionState.GRANTED) {
            openPicker(call);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // Asked together so the notification controls work from the first track.
            requestPermissionForAliases(new String[] { "audio", "notifications" }, call, "permissionsDone");
        } else {
            requestPermissionForAlias("storage", call, "permissionsDone");
        }
    }

    @PermissionCallback
    private void permissionsDone(PluginCall call) {
        if (getPermissionState(mediaAlias()) != PermissionState.GRANTED) {
            call.reject("Permission d'accès à la musique refusée");
            return;
        }
        openPicker(call);
    }

    private void openPicker(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.putExtra(DocumentsContract.EXTRA_INITIAL_URI,
            DocumentsContract.buildDocumentUri(STORAGE_AUTHORITY, "primary:Music"));
        startActivityForResult(call, i, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        String dir = uri == null ? null : treeToPath(uri);
        JSObject r = new JSObject();
        if (dir == null) {
            // Cancelled, or a location that is not a plain folder (cloud provider...).
            r.put("dir", "");
            call.resolve(r);
            return;
        }
        calls.execute(() -> {
            try {
                WaveCore.call("SetMusicFolder", new JSONArray().put(dir).toString());
                r.put("dir", dir);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    /**
     * Turns a folder picked through the storage access framework into a file path,
     * which the Go scanner reads directly (allowed for media files with READ_MEDIA_AUDIO).
     * "primary:Music/Rock" gives /storage/emulated/0/Music/Rock, "1234-ABCD:Music" gives /storage/1234-ABCD/Music.
     */
    static String treeToPath(Uri uri) {
        if (!STORAGE_AUTHORITY.equals(uri.getAuthority())) return null;
        String id = DocumentsContract.getTreeDocumentId(uri);
        int colon = id.indexOf(':');
        if (colon < 0) return null;
        String volume = id.substring(0, colon);
        String rel = id.substring(colon + 1);
        String root = "primary".equalsIgnoreCase(volume) ? "/storage/emulated/0" : "/storage/" + volume;
        return rel.isEmpty() ? root : root + "/" + rel;
    }
}
