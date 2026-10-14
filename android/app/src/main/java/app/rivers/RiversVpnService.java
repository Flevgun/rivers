package app.rivers;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.net.ConnectivityManager;
import android.net.IpPrefix;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.system.OsConstants;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import hev.htproxy.TProxyService;

public class RiversVpnService extends VpnService {
    public static final String ACTION_START = "app.rivers.START";
    public static final String ACTION_STOP = "app.rivers.STOP";
    public static final String ACTION_PAUSE = "app.rivers.PAUSE";
    public static volatile boolean running = false;
    public static volatile boolean starting = false;
    public static volatile String status = "Выключен";
    public static volatile String speedText = "";

    private final Object lock = new Object();
    private final AtomicInteger generation = new AtomicInteger();
    private Process core;
    private ParcelFileDescriptor tun;
    private Thread pump;
    private volatile boolean speedStop = true;
    private int commandId;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        commandId = startId;
        if (intent != null && (ACTION_PAUSE.equals(intent.getAction()) || ACTION_STOP.equals(intent.getAction()))) {
            boolean pause = ACTION_PAUSE.equals(intent.getAction());
            generation.incrementAndGet();
            shutdown(pause ? "На паузе" : "Выключен", pause, startId);
            return START_NOT_STICKY;
        }
        if (starting || running) return START_NOT_STICKY;
        int gen = generation.incrementAndGet();
        starting = true;
        status = "Подключение";
        try {
            promote("Подключение");
        } catch (Throwable error) {
            LogBuffer.add(error.getMessage() == null ? "уведомление не создалось" : error.getMessage());
        }
        new Thread(() -> connect(gen), "rivers-connect").start();
        return START_NOT_STICKY;
    }

    @Override
    public void onRevoke() {
        generation.incrementAndGet();
        shutdown("VPN отозван", false, commandId);
    }

    @Override
    public void onDestroy() {
        generation.incrementAndGet();
        speedStop = true;
        running = false;
        starting = false;
        releaseTunnel();
        unpinNetwork();
        super.onDestroy();
    }

    private void connect(int gen) {
        int origin = commandId;
        try {
            if (gen != generation.get()) return;
            Server server = Store.selected(this);
            if (server == null) throw new IOException("Сначала добавь сервер");
            Network physical = physicalNetwork();
            pinNetwork(physical);
            File dir = getFilesDir();
            copyAsset(dir, "geoip.dat");
            copyAsset(dir, "geosite.dat");
            File config = new File(dir, "config.json");
            write(config, ConfigBuilder.xray(server));
            File binary = new File(getApplicationInfo().nativeLibraryDir, "libxray.so");
            if (!binary.exists()) throw new IOException("В сборке нет ядра для этого телефона");
            Process process;
            synchronized (lock) {
                stopCore();
                ProcessBuilder builder = new ProcessBuilder(binary.getAbsolutePath(), "run", "-c", config.getAbsolutePath());
                builder.directory(dir);
                builder.environment().put("XRAY_LOCATION_ASSET", dir.getAbsolutePath());
                builder.redirectErrorStream(true);
                process = builder.start();
                core = process;
            }
            pump = new Thread(() -> drain(process), "rivers-log");
            pump.start();
            String error = waitReady(process);
            if (gen != generation.get()) return;
            if (error != null) throw new IOException(error);
            openTun(server, physical);
            if (gen != generation.get()) {
                releaseTunnel();
                return;
            }
            File yaml = new File(dir, "tproxy.yml");
            write(yaml, tunnelYaml());
            boolean started = TProxyService.TProxyStartService(yaml.getAbsolutePath(), tun.getFd());
            if (gen != generation.get()) {
                releaseTunnel();
                return;
            }
            if (!started) throw new IOException("Туннель не поднялся");
            running = true;
            status = "Включен";
            LogBuffer.add("Rivers включён. Рунет напрямую, остальное через VPN");
            try {
                updateNotice("Включен");
            } catch (Throwable ignored) {
            }
            startSpeed();
        } catch (Exception error) {
            if (gen != generation.get()) return;
            LogBuffer.add(error.getMessage() == null ? "не запустилось" : error.getMessage());
            shutdown(error.getMessage() == null ? "Ошибка" : error.getMessage(), false, origin);
        } finally {
            if (gen == generation.get()) starting = false;
        }
    }

    private void openTun(Server server, Network physical) throws PackageManager.NameNotFoundException {
        Builder builder = new Builder();
        builder.setSession("Rivers");
        builder.setMtu(1500);
        builder.setBlocking(true);
        builder.addAddress("172.19.0.1", 30);
        builder.addRoute("0.0.0.0", 0);
        builder.addDnsServer("1.1.1.1");
        builder.addDnsServer("8.8.8.8");
        builder.allowFamily(OsConstants.AF_INET);
        if (Build.VERSION.SDK_INT >= 29) builder.setMetered(false);
        if (physical != null && Build.VERSION.SDK_INT >= 22) builder.setUnderlyingNetworks(new Network[]{physical});
        excludeServer(builder, server.address);
        applyApps(builder);
        tun = builder.establish();
        if (tun == null) throw new IllegalStateException("Система не дала VPN");
    }

    private void excludeServer(Builder builder, String host) {
        if (Build.VERSION.SDK_INT < 33) return;
        String ip = ipv4(host);
        if (ip == null) return;
        try {
            builder.excludeRoute(new IpPrefix(InetAddress.getByName(ip), 32));
        } catch (Exception ignored) {
        }
    }

    private Network physicalNetwork() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager == null || Build.VERSION.SDK_INT < 23) return null;
        Network active = manager.getActiveNetwork();
        if (active != null && usable(manager, active)) return active;
        for (Network network : manager.getAllNetworks()) {
            if (usable(manager, network)) return network;
        }
        return null;
    }

    private static boolean usable(ConnectivityManager manager, Network network) {
        NetworkCapabilities caps = manager.getNetworkCapabilities(network);
        if (caps == null || caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return false;
        if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) return false;
        return caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
                || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET);
    }

    private void pinNetwork(Network network) {
        if (network == null || Build.VERSION.SDK_INT < 23) return;
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager != null) manager.bindProcessToNetwork(network);
    }

    private void unpinNetwork() {
        if (Build.VERSION.SDK_INT < 23) return;
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager != null) manager.bindProcessToNetwork(null);
    }

    private static String ipv4(String host) {
        if (host == null || host.isEmpty()) return null;
        String clean = host.trim().replaceAll("^\\[|\\]$", "");
        if (clean.matches("\\d{1,3}(?:\\.\\d{1,3}){3}")) return clean;
        try {
            for (InetAddress address : InetAddress.getAllByName(clean)) {
                if (address instanceof Inet4Address) return address.getHostAddress();
            }
        } catch (Exception ignored) {
        }
        return null;
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

    private void shutdown(String next, boolean paused, int startId) {
        speedStop = true;
        speedText = "";
        running = false;
        starting = false;
        status = next;
        releaseTunnel();
        unpinNetwork();
        try {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } catch (Throwable ignored) {
        }
        if (paused) {
            try {
                showPaused();
            } catch (Throwable ignored) {
            }
        } else {
            stopSelf(startId);
        }
    }

    private void releaseTunnel() {
        synchronized (lock) {
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
        }
    }

    private void stopCore() {
        if (core == null) return;
        core.destroy();
        core = null;
    }

    private void startSpeed() {
        speedStop = false;
        long[] base = tunBytes();
        new Thread(() -> {
            long rx = base[0];
            long tx = base[1];
            while (!speedStop && running) {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException interrupted) {
                    return;
                }
                long[] now = tunBytes();
                long down = Math.max(0, now[0] - rx);
                long up = Math.max(0, now[1] - tx);
                rx = now[0];
                tx = now[1];
                speedText = "↓ " + rate(down) + "   ↑ " + rate(up);
                if (!running || speedStop) return;
                try {
                    updateNotice(speedText);
                } catch (Throwable ignored) {
                }
            }
        }, "rivers-speed").start();
    }

    private static long[] tunBytes() {
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/net/dev"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (!trimmed.startsWith("tun")) continue;
                String[] parts = trimmed.split(":");
                if (parts.length < 2) continue;
                String[] cols = parts[1].trim().split("\\s+");
                if (cols.length < 9) continue;
                return new long[] { Long.parseLong(cols[0]), Long.parseLong(cols[8]) };
            }
        } catch (Exception ignored) {
        }
        return new long[] { 0, 0 };
    }

    private static String rate(long bytes) {
        if (bytes < 1024) return bytes + " Б/с";
        if (bytes < 1024 * 1024) return String.format(Locale.US, "%.1f КБ/с", bytes / 1024.0);
        return String.format(Locale.US, "%.1f МБ/с", bytes / 1024.0 / 1024.0);
    }

    private void showPaused() {
        ensureChannel();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 3, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(1, baseNotification("На паузе", content).addAction(action("Включить", ACTION_START, 2)).build());
    }

    private void updateNotice(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(1, notification(text));
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
        ensureChannel();
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 3, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return baseNotification(text, content).addAction(action("Пауза", ACTION_PAUSE, 1)).build();
    }

    private Notification.Builder baseNotification(String text, PendingIntent content) {
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, "vpn")
                : new Notification.Builder(this);
        return builder
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle("Rivers")
                .setContentText(text)
                .setContentIntent(content)
                .setOngoing(true);
    }

    private Notification.Action action(String title, String command, int request) {
        Intent intent = new Intent(this, RiversVpnService.class).setAction(command);
        PendingIntent pending = PendingIntent.getService(this, request, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Action.Builder(Icon.createWithResource(this, R.drawable.ic_stat), title, pending).build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel("vpn", "Rivers", NotificationManager.IMPORTANCE_LOW);
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
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
                + "  tcp-read-write-timeout: 300000\n"
                + "  udp-read-write-timeout: 60000\n"
                + "  log-level: warn\n"
                + "tunnel:\n"
                + "  mtu: 1500\n"
                + "socks5:\n"
                + "  port: " + ConfigBuilder.SOCKS_PORT + "\n"
                + "  address: 127.0.0.1\n"
                + "  udp: 'udp'\n";
    }
}
