package app.rivers;

import android.Manifest;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.drawable.Drawable;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends android.app.Activity {
    private static final int REQ_VPN = 7;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Spinner servers;
    private TextView status;
    private TextView logs;
    private TextView appsHint;
    private Button power;
    private Button tabHome;
    private Button tabApps;
    private Button tabLogs;
    private Button modeDirect;
    private Button modeVpn;
    private View pageHome;
    private View pageApps;
    private View pageLogs;
    private AppAdapter apps;
    private boolean spinning;
    private int tab;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            status.setText(RiversVpnService.status);
            power.setText(RiversVpnService.running ? "Выключить" : "Включить");
            if (tab == 2) logs.setText(LogBuffer.text());
            handler.postDelayed(this, 700);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        status = findViewById(R.id.status);
        logs = findViewById(R.id.logs);
        power = findViewById(R.id.power);
        servers = findViewById(R.id.servers);
        appsHint = findViewById(R.id.appsHint);
        pageHome = findViewById(R.id.pageHome);
        pageApps = findViewById(R.id.pageApps);
        pageLogs = findViewById(R.id.pageLogs);
        tabHome = findViewById(R.id.tabHome);
        tabApps = findViewById(R.id.tabApps);
        tabLogs = findViewById(R.id.tabLogs);
        modeDirect = findViewById(R.id.modeDirect);
        modeVpn = findViewById(R.id.modeVpn);
        apps = new AppAdapter();
        ListView list = findViewById(R.id.appList);
        list.setAdapter(apps);
        list.setOnItemClickListener((parent, view, position, id) -> {
            apps.toggle(position);
            toast(RiversVpnService.running ? "Переподключи, чтобы применить" : "Сохранено");
        });
        ((EditText) findViewById(R.id.appSearch)).addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                apps.filter(s.toString());
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
        tabHome.setOnClickListener(view -> showTab(0));
        tabApps.setOnClickListener(view -> showTab(1));
        tabLogs.setOnClickListener(view -> showTab(2));
        modeDirect.setOnClickListener(view -> setMode("direct"));
        modeVpn.setOnClickListener(view -> setMode("vpn"));
        paintMode();
        reloadServers();
        loadApps();
        power.setOnClickListener(view -> {
            if (RiversVpnService.running) {
                startService(new Intent(this, RiversVpnService.class).setAction(RiversVpnService.ACTION_STOP));
            } else {
                askVpn();
            }
        });
        findViewById(R.id.addLink).setOnClickListener(view -> askText("Ссылка vless://", this::addText));
        findViewById(R.id.addSub).setOnClickListener(view -> askText("Ссылка подписки", this::loadSubscription));
        findViewById(R.id.copyLogs).setOnClickListener(view -> {
            ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            clipboard.setPrimaryClip(ClipData.newPlainText("Rivers", LogBuffer.text()));
            toast("Логи в буфере");
        });
        showTab(0);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 8);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(tick);
        super.onPause();
    }

    private void showTab(int next) {
        tab = next;
        pageHome.setVisibility(next == 0 ? View.VISIBLE : View.GONE);
        pageApps.setVisibility(next == 1 ? View.VISIBLE : View.GONE);
        pageLogs.setVisibility(next == 2 ? View.VISIBLE : View.GONE);
        paintTab(tabHome, next == 0);
        paintTab(tabApps, next == 1);
        paintTab(tabLogs, next == 2);
        if (next == 2) logs.setText(LogBuffer.text());
    }

    private void setMode(String mode) {
        Store.setAppMode(this, mode);
        paintMode();
        toast(RiversVpnService.running ? "Переподключи, чтобы применить" : "Сохранено");
    }

    private void paintMode() {
        boolean vpn = "vpn".equals(Store.appMode(this));
        paintTab(modeDirect, !vpn);
        paintTab(modeVpn, vpn);
        appsHint.setText(vpn
                ? "Только отмеченные идут в VPN. Остальные приложения — напрямую, мимо правил конфига. Применится после переподключения."
                : "Отмеченные идут напрямую, мимо VPN. Остальные — по конфигу: рунет напрямую, прочее через VPN. Применится после переподключения.");
    }

    private static void paintTab(Button button, boolean on) {
        button.setTextColor(on ? 0xFF3DFFB0 : 0xFF8B978F);
    }

    private void loadApps() {
        new Thread(() -> {
            PackageManager manager = getPackageManager();
            Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolved = manager.queryIntentActivities(launcher, 0);
            Set<String> seen = new HashSet<>();
            List<AppRow> rows = new ArrayList<>();
            String self = getPackageName();
            for (ResolveInfo info : resolved) {
                String pkg = info.activityInfo.packageName;
                if (self.equals(pkg) || !seen.add(pkg)) continue;
                CharSequence label = info.loadLabel(manager);
                Drawable icon = info.loadIcon(manager);
                rows.add(new AppRow(label == null ? pkg : label.toString(), pkg, icon));
            }
            Collections.sort(rows, (a, b) -> a.label.compareToIgnoreCase(b.label));
            runOnUiThread(() -> apps.setAll(rows, Store.appPackages(this)));
        }).start();
    }

    private void askVpn() {
        if (Store.selected(this) == null) {
            toast("Сначала добавь сервер");
            return;
        }
        Intent prepare = VpnService.prepare(this);
        if (prepare != null) startActivityForResult(prepare, REQ_VPN);
        else startTunnel();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_VPN) {
            if (resultCode == RESULT_OK) startTunnel();
            else toast("Без разрешения VPN трафик не пойдёт");
        }
    }

    private void startTunnel() {
        int index = servers.getSelectedItemPosition();
        List<Server> list = Store.servers(this);
        if (index >= 0 && index < list.size()) Store.save(this, list, index);
        Intent intent = new Intent(this, RiversVpnService.class).setAction(RiversVpnService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent);
        else startService(intent);
    }

    private void askText(String title, java.util.function.Consumer<String> onOk) {
        EditText input = new EditText(this);
        input.setMinLines(3);
        input.setTextColor(0xFFE7EFE9);
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setView(input)
                .setPositiveButton("Добавить", (dialog, which) -> onOk.accept(input.getText().toString().trim()))
                .setNegativeButton("Отмена", null)
                .show();
    }

    private void addText(String text) {
        List<Server> parsed = VlessParser.parseMany(text);
        if (parsed.isEmpty()) {
            toast("В тексте нет vless://");
            return;
        }
        List<Server> all = new ArrayList<>(parsed);
        all.addAll(Store.servers(this));
        Store.save(this, all, 0);
        reloadServers();
        toast("Серверов: " + parsed.size());
    }

    private void loadSubscription(String url) {
        if (url.isEmpty() || spinning) return;
        spinning = true;
        toast("Качаю подписку");
        new Thread(() -> {
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(20000);
                connection.setRequestProperty("User-Agent", "Rivers/1.0");
                connection.connect();
                String body = read(connection.getInputStream());
                connection.disconnect();
                List<Server> parsed = VlessParser.parseMany(body);
                runOnUiThread(() -> {
                    spinning = false;
                    if (parsed.isEmpty()) {
                        toast("В подписке нет vless");
                        return;
                    }
                    Store.save(this, parsed, 0);
                    reloadServers();
                    toast("Серверов: " + parsed.size());
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    spinning = false;
                    toast(error.getMessage() == null ? "Подписка не открылась" : error.getMessage());
                });
            }
        }).start();
    }

    private void reloadServers() {
        List<Server> list = Store.servers(this);
        List<String> labels = new ArrayList<>();
        for (Server server : list) labels.add(server.label());
        if (labels.isEmpty()) labels.add("Нет сервера");
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, labels);
        servers.setAdapter(adapter);
        int active = Store.active(this);
        if (!list.isEmpty() && active >= 0 && active < list.size()) servers.setSelection(active);
        servers.setEnabled(!list.isEmpty());
    }

    private static String read(InputStream stream) throws java.io.IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (builder.length() > 0) builder.append('\n');
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private void toast(String text) {
        Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
    }

    private void saveApps() {
        Store.setAppPackages(this, apps.checked());
    }

    private static final class AppRow {
        final String label;
        final String pkg;
        final Drawable icon;
        boolean checked;

        AppRow(String label, String pkg, Drawable icon) {
            this.label = label;
            this.pkg = pkg;
            this.icon = icon;
        }
    }

    private final class AppAdapter extends BaseAdapter {
        private final List<AppRow> all = new ArrayList<>();
        private final List<AppRow> shown = new ArrayList<>();
        private String query = "";

        void setAll(List<AppRow> rows, Set<String> checked) {
            all.clear();
            all.addAll(rows);
            for (AppRow row : all) row.checked = checked.contains(row.pkg);
            filter(query);
        }

        void filter(String text) {
            query = text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
            shown.clear();
            for (AppRow row : all) {
                if (query.isEmpty()
                        || row.label.toLowerCase(Locale.ROOT).contains(query)
                        || row.pkg.toLowerCase(Locale.ROOT).contains(query)) {
                    shown.add(row);
                }
            }
            notifyDataSetChanged();
        }

        void toggle(int position) {
            AppRow row = shown.get(position);
            row.checked = !row.checked;
            notifyDataSetChanged();
            saveApps();
        }

        Set<String> checked() {
            Set<String> set = new HashSet<>();
            for (AppRow row : all) if (row.checked) set.add(row.pkg);
            return set;
        }

        @Override
        public int getCount() {
            return shown.size();
        }

        @Override
        public Object getItem(int position) {
            return shown.get(position);
        }

        @Override
        public long getItemId(int position) {
            return position;
        }

        @Override
        public View getView(int position, View convert, ViewGroup parent) {
            View view = convert;
            if (view == null) view = LayoutInflater.from(MainActivity.this).inflate(R.layout.item_app, parent, false);
            AppRow row = shown.get(position);
            ((ImageView) view.findViewById(R.id.icon)).setImageDrawable(row.icon);
            ((TextView) view.findViewById(R.id.label)).setText(row.label);
            ((TextView) view.findViewById(R.id.pkg)).setText(row.pkg);
            ((CheckBox) view.findViewById(R.id.check)).setChecked(row.checked);
            return view;
        }
    }
}
