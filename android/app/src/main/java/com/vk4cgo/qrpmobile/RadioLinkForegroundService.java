package com.vk4cgo.qrpmobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Keeps CPU and Wi‑Fi active while the user is linked to the KV4P board over Wi‑Fi,
 * so the WebSocket is not torn down when the screen is off.
 */
public class RadioLinkForegroundService extends Service {

    public static final String CHANNEL_ID = "radio_link_keepalive";
    private static final int NOTIFICATION_ID = 0x4b563470; // 'KV4P' hint

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        acquireLocks();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel ch =
            new NotificationChannel(
                CHANNEL_ID,
                "Radio link",
                NotificationManager.IMPORTANCE_LOW
            );
        ch.setDescription("Keeps Wi‑Fi connection to your KV4P radio while the screen is off");
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    private Notification buildNotification() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            piFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent content =
            PendingIntent.getActivity(this, 0, launch != null ? launch : new Intent(), piFlags);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("KV4P radio link active")
            .setContentText("Keeping Wi‑Fi link to the radio while the screen is off")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentIntent(content)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @SuppressWarnings("deprecation")
    private void acquireLocks() {
        if (wakeLock == null || !wakeLock.isHeld()) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "qrpmobile:RadioLinkWake");
                wakeLock.acquire();
            }
        }
        if (wifiLock == null || !wifiLock.isHeld()) {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "qrpmobile:RadioWifiLock");
                wifiLock.acquire();
            }
        }
    }

    private void releaseLocks() {
        if (wifiLock != null && wifiLock.isHeld()) {
            try {
                wifiLock.release();
            } catch (RuntimeException ignored) {
            }
            wifiLock = null;
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (RuntimeException ignored) {
            }
            wakeLock = null;
        }
    }
}
