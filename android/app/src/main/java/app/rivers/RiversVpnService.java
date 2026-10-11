package app.rivers;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import hev.htproxy.TProxyService;

public class RiversVpnService extends VpnService {
    public static final String ACTION_START = "app.rivers.START";
    public static final String ACTION_STOP = "app.rivers.STOP";
    public static volatile boolean running = false;
    public static volatile String status = "Выключен";

    private final Object lock = new Object();
    private Process core;
    private ParcelFileDescriptor tun;
    private Thread pump;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            shutdown("Выключен");
            return START_NOT_STICKY;
        }
        promote("Подключение");
        new Thread(this::connect, "rivers-connect").start();
        return START_NOT_STICKY;
    }

    @Override
    public void onRevoke() {
        shutdown("VPN отозван");
    }

    @Override
    public void onDestroy() {
        shutdown("Выключен");
        super.onDestroy();
    }

    private void connect() {
        synchronized (lock) {
            if (running) return;
            try {
                Server server = Store.selected(this);
                if (server == null) throw new IOException("Сначала добавь сервер");
                File dir = getFilesDir();
                copyAsset(dir, "geoip.dat");
                copyAsset(dir, "geosite.dat");
                File config = new File(dir, "config.json");
                write(config, ConfigBuilder.xray(server));
                File binary = new File(getApplicationInfo().nativeLibraryDir, "libxray.so");
                if (!binary.exists()) throw new IOException("В сборке нет ядра для этого телефона");
                stopCore();
                ProcessBuilder builder = new ProcessBuilder(binary.getAbsolutePath(), "run", "-c", config.getAbsolutePath());
                builder.directory(dir);
                builder.environment().put("XRAY_LOCATION_ASSET", dir.getAbsolutePath());
                builder.redirectErrorStream(true);
                core = builder.start();
                pump = new Thread(() -> drain(core), "rivers-log");
                pump.start();
                String error = waitReady(core);
                if (error != null) throw new IOException(error);
                openTun();
                File yaml = new File(dir, "tproxy.yml");
                write(yaml, tunnelYaml());
                boolean started = TProxyService.TProxyStartService(yaml.getAbsolutePath(), tun.getFd());
                if (!started) throw new IOException("Туннель не поднялся");
                running = true;
                status = "Включен";
                LogBuffer.add("Rivers включён. Рунет напрямую, остальное через VPN");
                promote("Включен");
            } catch (Exception error) {
                LogBuffer.add(error.getMessage() == null ? "не запустилось" : error.getMessage());
                shutdown(error.getMessage() == null ? "Ошибка" : error.getMessage());
            }
        }
    }

    private void openTun() throws PackageManager.NameNotFoundException {
        Builder builder = new Builder();
        builder.setSession("Rivers");
        builder.setMtu(1400);
        builder.setBlocking(false);
        builder.addAddress("172.19.0.1", 30);
        builder.addRoute("0.0.0.0", 0);
        builder.addDnsServer("172.19.0.2");
        applyApps(builder);
        tun = builder.establish();
        if (tun == null) throw new IllegalStateException("Система не дала VPN");
    }

    private void applyApps(Builder builder) {
        Set<String> selected = Store.appPackages(this);
        boolean onlyVpn = "vpn".equals(Store.appMode(this)) && !selected.isEmpty();
        if (onlyVpn) {
            int added = 0;
            for (String pkg : selected) {
                if (getPackageName().equals(pkg)) continue;
                try {
                    builder.addAllowedApplication(pkg);
                    added++;
                } catch (PackageManager.NameNotFoundException ignored) {
                }
            }
            if (added > 0) return;
        }
        try {
            builder.addDisallowedApplication(getPackageName());
        } catch (PackageManager.NameNotFoundException ignored) {
        }
        if (!onlyVpn && "direct".equals(Store.appMode(this))) {
            for (String pkg : selected) {
                if (getPackageName().equals(pkg)) continue;
                try {
                    builder.addDisallowedApplication(pkg);
                } catch (PackageManager.NameNotFoundException ignored) {
                }
            }
        }
    }

    private String waitReady(Process process) {
        for (int i = 0; i < 40; i++) {
            if (!process.isAlive()) {
                return "Ядро остановилось";
            }
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress("127.0.0.1", ConfigBuilder.SOCKS_PORT), 200);
                return null;
            } catch (IOException ignored) {
                try {
                    Thread.sleep(150);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    return "Остановлено";
                }
            }
        }
        return "Ядро не открыло порт";
    }

    private void drain(Process process) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) LogBuffer.add(line);
        } catch (IOException ignored) {
        }
    }

    private void shutdown(String next) {
        synchronized (lock) {
            running = false;
            status = next;
            try {
                if (TProxyService.TProxyIsRunning()) TProxyService.TProxyStopService();
            } catch (Throwable ignored) {
            }
            if (tun != null) {
                try {
                    tun.close();
                } catch (IOException ignored) {
                }
                tun = null;
            }
            stopCore();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }

    private void stopCore() {
        if (core == null) return;
        core.destroy();
        core = null;
    }

    private void promote(String text) {
        Notification notification = notification(text);
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(1, notification);
        }
    }

    private Notification notification(String text) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel("vpn", "Rivers", NotificationManager.IMPORTANCE_LOW);
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
        Intent stop = new Intent(this, RiversVpnService.class).setAction(ACTION_STOP);
        PendingIntent pending = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, "vpn")
                : new Notification.Builder(this);
        return builder
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Rivers")
                .setContentText(text)
                .setOngoing(true)
                .addAction(new Notification.Action.Builder(null, "Выключить", pending).build())
                .build();
    }

    private void copyAsset(File dir, String name) throws IOException {
        byte[] buffer = new byte[8192];
        try (InputStream in = getAssets().open(name);
             FileOutputStream out = new FileOutputStream(new File(dir, name))) {
            int read;
            while ((read = in.read(buffer)) >= 0) out.write(buffer, 0, read);
        }
    }

    private static void write(File file, String text) throws IOException {
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
        }
    }

    private static String tunnelYaml() {
        return "misc:\n"
                + "  task-stack-size: 24576\n"
                + "  tcp-buffer-size: 4096\n"
                + "  connect-timeout: 5000\n"
                + "  read-write-timeout: 60000\n"
                + "  log-level: warn\n"
                + "tunnel:\n"
                + "  mtu: 1400\n"
                + "socks5:\n"
                + "  port: " + ConfigBuilder.SOCKS_PORT + "\n"
                + "  address: 127.0.0.1\n"
                + "  udp: 'udp'\n"
                + "mapdns:\n"
                + "  address: 172.19.0.2\n"
                + "  port: 53\n"
                + "  network: 240.0.0.0\n"
                + "  netmask: 240.0.0.0\n"
                + "  cache-size: 10000\n";
    }
}
