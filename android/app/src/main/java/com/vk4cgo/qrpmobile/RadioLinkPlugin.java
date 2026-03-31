package com.vk4cgo.qrpmobile;

import android.content.Intent;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RadioLinkKeepAlive")
public class RadioLinkPlugin extends Plugin {

    private static final String TAG = "RadioLinkKeepAlive";

    @PluginMethod
    public void enable(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), RadioLinkForegroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(i);
            } else {
                getContext().startService(i);
            }
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "enable failed", e);
            call.reject("Failed to start radio link service: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), RadioLinkForegroundService.class);
            getContext().stopService(i);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "disable failed", e);
            call.reject("Failed to stop radio link service: " + e.getMessage(), e);
        }
    }
}
