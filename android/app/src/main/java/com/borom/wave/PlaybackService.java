package com.borom.wave;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;

import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Keeps the process alive while music plays (foreground service) and exposes
 * playback to the system: media session (lock screen, Bluetooth, headset
 * buttons), notification controls, audio focus and "becoming noisy".
 * Playback itself happens in the Go core; this service mirrors its events.
 */
public class PlaybackService extends Service implements WaveCore.Sink {
    private static final String TAG = "PlaybackService";
    private static final String CHANNEL = "playback";
    private static final int NOTIFICATION_ID = 1;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService covers = Executors.newSingleThreadExecutor();

    private MediaSessionCompat session;
    private AudioManager audio;
    private AudioFocusRequest focusRequest;

    // Main thread only.
    private String trackId = "";
    private MediaMetadataCompat metadata;
    private boolean paused = true;
    private boolean hasTrack;
    private boolean foreground;
    private boolean noisyRegistered;
    /** Paused by a transient focus loss (call, assistant): resume when focus comes back. */
    private boolean resumeOnFocus;

    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            // Headphones unplugged or Bluetooth disconnected: don't blast the speaker.
            WaveCore.send("SetPaused", "[true]");
        }
    };

    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        switch (change) {
            case AudioManager.AUDIOFOCUS_LOSS:
                resumeOnFocus = false;
                WaveCore.send("SetPaused", "[true]");
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                resumeOnFocus = !paused;
                WaveCore.send("SetPaused", "[true]");
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                if (resumeOnFocus) WaveCore.send("SetPaused", "[false]");
                resumeOnFocus = false;
                break;
            default:
                // AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK: the system lowers our volume itself.
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        WaveCore.start(this);

        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CHANNEL, getString(R.string.playback_channel), NotificationManager.IMPORTANCE_LOW);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);

        audio = getSystemService(AudioManager.class);
        focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build())
            .setOnAudioFocusChangeListener(focusListener, main)
            .build();

        session = new MediaSessionCompat(this, "Wave");
        session.setSessionActivity(openAppIntent());
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { WaveCore.send("SetPaused", "[false]"); }
            @Override public void onPause() { WaveCore.send("SetPaused", "[true]"); }
            @Override public void onStop() { WaveCore.send("SetPaused", "[true]"); }
            @Override public void onSkipToNext() { WaveCore.send("Next", "[]"); }
            @Override public void onSkipToPrevious() { WaveCore.send("Prev", "[]"); }
            @Override public void onSeekTo(long ms) { WaveCore.send("Seek", "[" + ms / 1000.0 + "]"); }
        });
        session.setActive(true);

        WaveCore.addSink(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Media buttons from the notification and from headsets land here.
        MediaButtonReceiver.handleIntent(session, intent);
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // App swiped away: keep playing if music is on, otherwise leave.
        WaveCore.save();
        if (paused) stopSelf();
    }

    @Override
    public void onDestroy() {
        WaveCore.removeSink(this);
        WaveCore.save();
        if (noisyRegistered) unregisterReceiver(noisy);
        audio.abandonAudioFocusRequest(focusRequest);
        session.release();
        covers.shutdown();
        super.onDestroy();
    }

    // ---- Core events (any thread) ----

    @Override
    public void onEvent(String name, String payload) {
        try {
            switch (name) {
                case "track:changed": {
                    JSONObject np = new JSONObject(payload);
                    JSONObject t = np.getJSONObject("track");
                    boolean hasCover = np.optBoolean("hasCover");
                    main.post(() -> onTrack(t, hasCover));
                    break;
                }
                case "playback:progress": {
                    JSONObject s = new JSONObject(payload);
                    main.post(() -> onProgress(s));
                    break;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, name, e);
        }
    }

    private void onTrack(JSONObject t, boolean hasCover) {
        String id = t.optString("id");
        trackId = id;
        String artist = t.optString("artist");
        metadata = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, id)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, t.optString("title"))
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist.isEmpty() ? t.optString("group") : artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, t.optString("album"))
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (long) (t.optDouble("duration") * 1000))
            .build();
        session.setMetadata(metadata);
        updateNotification();
        if (hasCover) loadCover(id);
    }

    private void loadCover(String id) {
        String url = WaveCore.coverBaseUrl() + id;
        covers.execute(() -> {
            Bitmap bmp = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                try (InputStream in = c.getInputStream()) {
                    bmp = BitmapFactory.decodeStream(in);
                } finally {
                    c.disconnect();
                }
            } catch (Exception e) {
                Log.w(TAG, "cover " + id, e);
            }
            if (bmp == null) return;
            Bitmap art = bmp;
            main.post(() -> {
                if (!id.equals(trackId) || metadata == null) return;
                metadata = new MediaMetadataCompat.Builder(metadata)
                    .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art)
                    .build();
                session.setMetadata(metadata);
                updateNotification();
            });
        });
    }

    private void onProgress(JSONObject s) {
        boolean nowPaused = s.optBoolean("paused", true);
        boolean nowHasTrack = s.optBoolean("hasTrack");
        long position = (long) (s.optDouble("position") * 1000);
        float speed = (float) s.optDouble("speed", 1);

        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                | PlaybackStateCompat.ACTION_SEEK_TO)
            .setState(nowPaused ? PlaybackStateCompat.STATE_PAUSED : PlaybackStateCompat.STATE_PLAYING,
                position, nowPaused ? 0 : speed)
            .build());

        if (nowPaused == paused && nowHasTrack == hasTrack) return;
        paused = nowPaused;
        hasTrack = nowHasTrack;
        if (!paused) onPlaying();
        else onPaused();
        updateNotification();
    }

    private void onPlaying() {
        audio.requestAudioFocus(focusRequest);
        if (!noisyRegistered) {
            ContextCompat.registerReceiver(this, noisy,
                new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY), ContextCompat.RECEIVER_NOT_EXPORTED);
            noisyRegistered = true;
        }
    }

    private void onPaused() {
        if (noisyRegistered) {
            unregisterReceiver(noisy);
            noisyRegistered = false;
        }
        WaveCore.save();
    }

    // ---- Notification ----

    private void updateNotification() {
        if (!hasTrack || metadata == null) {
            if (foreground) {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
                foreground = false;
            }
            return;
        }
        Notification n = buildNotification();
        if (!paused) {
            try {
                int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
                ServiceCompat.startForeground(this, NOTIFICATION_ID, n, type);
                foreground = true;
            } catch (Exception e) {
                // Started from the background without an exemption (Android 12+): show it anyway.
                Log.w(TAG, "startForeground", e);
                getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, n);
            }
        } else {
            // Paused: the notification stays but can be swiped away, and the system may stop us.
            if (foreground) {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
                foreground = false;
            }
            getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, n);
        }
    }

    private Notification buildNotification() {
        MediaMetadataCompat m = metadata;
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_wave)
            .setContentTitle(m.getString(MediaMetadataCompat.METADATA_KEY_TITLE))
            .setContentText(m.getString(MediaMetadataCompat.METADATA_KEY_ARTIST))
            .setSubText(m.getString(MediaMetadataCompat.METADATA_KEY_ALBUM))
            .setLargeIcon(m.getBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART))
            .setContentIntent(openAppIntent())
            .setDeleteIntent(MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_STOP))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(!paused)
            .addAction(R.drawable.ic_skip_previous, getString(R.string.previous),
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS))
            .addAction(paused ? R.drawable.ic_play : R.drawable.ic_pause, getString(paused ? R.string.play : R.string.pause),
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY_PAUSE))
            .addAction(R.drawable.ic_skip_next, getString(R.string.next),
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT))
            .setStyle(new MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2))
            .build();
    }

    private PendingIntent openAppIntent() {
        Intent i = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
