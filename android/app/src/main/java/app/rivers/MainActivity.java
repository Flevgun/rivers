package app.rivers;

import android.Manifest;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.ColorStateList;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.graphics.drawable.ColorDrawable;
import android.view.LayoutInflater;
import android.view.Gravity;
import android.view.WindowInsetsController;
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
    private TextView serverName;
    private TextView status;
    private TextView logs;
    private TextView appsHint;
    private TextView brandTitle;
    private TextView brandSub;
    private TextView homeHint;
    private TextView themeLabel;
    private TextView titleApps;
    private TextView titleLogs;
    private TextView titleServers;
    private TextView titleSettings;
    private TextView serversHint;
    private View power;
    private View powerHalo;
    private ImageView powerIcon;
    private View logCard;
    private View tabBar;
    private View modeTrack;
    private LinearLayout themes;
    private LinearLayout serverBlocks;
    private Button addLink;
    private Button addSub;
    private Button copyLogs;
    private EditText appSearch;
    private ImageView tabHome;
    private ImageView tabServers;
    private ImageView tabSettings;
    private TextView openApps;
    private TextView openLogs;
    private TextView backApps;
    private TextView backLogs;
    private TextView modeDirect;
    private TextView modeVpn;
    private View pageHome;
    private View pageServers;
    private View pageApps;
    private View pageLogs;
    private View pageSettings;
    private AppAdapter apps;
    private boolean spinning;
    private int tab;
    private final Set<String> folded = new HashSet<>();

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            boolean on = RiversVpnService.running;
            status.setText(on ? "Профиль включён" : RiversVpnService.status);
            paintChrome();
            if (pageLogs.getVisibility() == View.VISIBLE) logs.setText(LogBuffer.text());
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
        powerHalo = findViewById(R.id.powerHalo);
        powerIcon = findViewById(R.id.powerIcon);
        brandTitle = findViewById(R.id.brandTitle);
        brandSub = findViewById(R.id.brandSub);
        homeHint = findViewById(R.id.homeHint);
        themeLabel = findViewById(R.id.themeLabel);
        titleApps = findViewById(R.id.titleApps);
        titleLogs = findViewById(R.id.titleLogs);
        titleServers = findViewById(R.id.titleServers);
        titleSettings = findViewById(R.id.titleSettings);
        serversHint = findViewById(R.id.serversHint);
        serverName = findViewById(R.id.serverName);
        serverBlocks = findViewById(R.id.serverBlocks);
        logCard = findViewById(R.id.logCard);
        tabBar = findViewById(R.id.tabBar);
        modeTrack = findViewById(R.id.modeTrack);
        themes = findViewById(R.id.themes);
        addLink = findViewById(R.id.addLink);
        addSub = findViewById(R.id.addSub);
        copyLogs = findViewById(R.id.copyLogs);
        appSearch = findViewById(R.id.appSearch);
        appsHint = findViewById(R.id.appsHint);
        pageHome = findViewById(R.id.pageHome);
        pageServers = findViewById(R.id.pageServers);
        pageApps = findViewById(R.id.pageApps);
        pageLogs = findViewById(R.id.pageLogs);
        pageSettings = findViewById(R.id.pageSettings);
        tabHome = findViewById(R.id.tabHome);
        tabServers = findViewById(R.id.tabServers);
        tabSettings = findViewById(R.id.tabSettings);
        openApps = findViewById(R.id.openApps);
        openLogs = findViewById(R.id.openLogs);
        backApps = findViewById(R.id.backApps);
        backLogs = findViewById(R.id.backLogs);
        modeDirect = findViewById(R.id.modeDirect);
        modeVpn = findViewById(R.id.modeVpn);
        apps = new AppAdapter();
        ListView list = findViewById(R.id.appList);
        list.setAdapter(apps);
        list.setOnItemClickListener((parent, view, position, id) -> {
            apps.toggle(position);
            toast(RiversVpnService.running ? "Переподключи, чтобы применить" : "Сохранено");
        });
        ((EditText) appSearch).addTextChangedListener(new TextWatcher() {
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
        tabServers.setOnClickListener(view -> showTab(1));
        tabSettings.setOnClickListener(view -> showTab(2));
        openApps.setOnClickListener(view -> showTab(3));
        openLogs.setOnClickListener(view -> showTab(4));
        backApps.setOnClickListener(view -> showTab(2));
        backLogs.setOnClickListener(view -> showTab(2));
        serverName.setOnClickListener(view -> showTab(1));
        modeDirect.setOnClickListener(view -> setMode("direct"));
        modeVpn.setOnClickListener(view -> setMode("vpn"));
        paintMode();
        buildThemes();
        reloadServers();
        loadApps();
        applyTheme();
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
        pageServers.setVisibility(next == 1 ? View.VISIBLE : View.GONE);
        pageSettings.setVisibility(next == 2 ? View.VISIBLE : View.GONE);
        pageApps.setVisibility(next == 3 ? View.VISIBLE : View.GONE);
        pageLogs.setVisibility(next == 4 ? View.VISIBLE : View.GONE);
        paintTab(tabHome, next == 0);
        paintTab(tabServers, next == 1);
        paintTab(tabSettings, next >= 2);
        if (next == 4) logs.setText(LogBuffer.text());
    }

    private void setMode(String mode) {
        Store.setAppMode(this, mode);
        paintMode();
        toast(RiversVpnService.running ? "Переподключи, чтобы применить" : "Сохранено");
    }

    private void paintMode() {
        boolean vpn = "vpn".equals(Store.appMode(this));
        paintSegment(modeDirect, !vpn);
        paintSegment(modeVpn, vpn);
        appsHint.setText(vpn
                ? "Только отмеченные идут в VPN. Остальные приложения — напрямую, мимо правил конфига. Применится после переподключения."
                : "Отмеченные идут напрямую, мимо VPN. Остальные — по конфигу: рунет напрямую, прочее через VPN. Применится после переподключения.");
    }

    private void paintChrome() {
        Palette palette = Palette.current(this);
        boolean on = RiversVpnService.running;
        status.setTextColor(on ? palette.accent : palette.fg);
        int stroke = Math.max(2, (int) Palette.dp(this, 2));
        power.setBackground(Palette.circle(on ? palette.accent : palette.surface, on ? palette.accent : palette.line, stroke));
        powerHalo.setBackground(Palette.circle((palette.accent & 0x00FFFFFF) | 0x2E000000, 0, 0));
        powerHalo.setVisibility(on ? View.VISIBLE : View.INVISIBLE);
        powerIcon.setImageTintList(ColorStateList.valueOf(on ? palette.ink : palette.fg));
    }

    private void applyTheme() {
        Palette palette = Palette.current(this);
        getWindow().setStatusBarColor(palette.bg);
        getWindow().setNavigationBarColor(palette.bg);
        getWindow().getDecorView().setBackgroundColor(palette.bg);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance("paper".equals(palette.id) ? mask : 0, mask);
            }
        }
        brandTitle.setTextColor(palette.fg);
        brandSub.setTextColor(palette.muted);
        homeHint.setTextColor(palette.muted);
        themeLabel.setTextColor(palette.fg);
        titleApps.setTextColor(palette.fg);
        titleLogs.setTextColor(palette.fg);
        titleServers.setTextColor(palette.fg);
        titleSettings.setTextColor(palette.fg);
        serversHint.setTextColor(palette.muted);
        appsHint.setTextColor(palette.muted);
        backApps.setTextColor(palette.accent);
        backLogs.setTextColor(palette.accent);
        openApps.setTextColor(palette.fg);
        openLogs.setTextColor(palette.fg);
        openApps.setBackground(Palette.round(this, palette.surface, palette.line, 16));
        openLogs.setBackground(Palette.round(this, palette.surface, palette.line, 16));
        logs.setTextColor(palette.fg);
        pill(addLink, palette.raised, palette.fg);
        pill(addSub, palette.accent, palette.ink);
        pill(copyLogs, palette.raised, palette.fg);
        modeTrack.setBackground(Palette.round(this, palette.surface, palette.line, 16));
        appSearch.setBackground(Palette.round(this, palette.bg, palette.line, 16));
        appSearch.setTextColor(palette.fg);
        appSearch.setHintTextColor(palette.muted);
        logCard.setBackground(Palette.round(this, palette.surface, palette.line, 20));
        tabBar.setBackgroundColor(palette.bg);
        serverName.setTextColor(palette.fg);
        serverName.setBackground(Palette.round(this, palette.raised, 0, 24));
        paintChrome();
        paintMode();
        showTab(tab);
        paintThemeChips();
        renderServers();
        if (apps != null) apps.notifyDataSetChanged();
    }

    private void pill(Button button, int fill, int text) {
        button.setBackground(Palette.round(this, fill, 0, 22));
        button.setTextColor(text);
    }

    private void buildThemes() {
        themes.removeAllViews();
        int pad = (int) Palette.dp(this, 16);
        for (Palette palette : Palette.all()) {
            TextView chip = new TextView(this);
            chip.setText(palette.name);
            chip.setGravity(Gravity.CENTER);
            chip.setTextSize(14);
            chip.setPadding(pad, 0, pad, 0);
            chip.setTag(palette.id);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, (int) Palette.dp(this, 44));
            params.setMarginEnd((int) Palette.dp(this, 8));
            chip.setLayoutParams(params);
            chip.setOnClickListener(view -> {
                Store.setTheme(this, palette.id);
                applyTheme();
            });
            themes.addView(chip);
        }
    }

    private void paintThemeChips() {
        Palette palette = Palette.current(this);
        for (int i = 0; i < themes.getChildCount(); i++) {
            TextView chip = (TextView) themes.getChildAt(i);
            boolean on = palette.id.equals(chip.getTag());
            chip.setBackground(Palette.round(this, on ? palette.accent : palette.raised, 0, 22));
            chip.setTextColor(on ? palette.ink : palette.muted);
        }
    }

    private void paintTab(ImageView view, boolean on) {
        Palette palette = Palette.current(this);
        view.setImageTintList(ColorStateList.valueOf(on ? palette.accent : palette.muted));
        view.setBackground(on ? Palette.round(this, (palette.accent & 0x00FFFFFF) | 0x24000000, 0, 20) : null);
    }

    private void paintSegment(TextView view, boolean on) {
        Palette palette = Palette.current(this);
        view.setBackground(Palette.round(this, on ? palette.accent : 0x00000000, 0, 12));
        view.setTextColor(on ? palette.ink : palette.muted);
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
        if (Store.selected(this) == null) {
            toast("Сначала добавь сервер");
            return;
        }
        Intent intent = new Intent(this, RiversVpnService.class).setAction(RiversVpnService.ACTION_START);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent);
        else startService(intent);
    }

    private void askText(String title, java.util.function.Consumer<String> onOk) {
        EditText input = new EditText(this);
        input.setMinLines(3);
        input.setTextColor(0xFFE7EFE9);
        input.setBackgroundColor(0xFF101614);
        input.setPadding(32, 24, 32, 24);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(title)
                .setView(input)
                .setPositiveButton("Добавить", (d, which) -> onOk.accept(input.getText().toString().trim()))
                .setNegativeButton("Отмена", null)
                .create();
        dialog.show();
        Palette palette = Palette.current(this);
        if (dialog.getWindow() != null) dialog.getWindow().setBackgroundDrawable(new ColorDrawable(palette.surface));
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(palette.accent);
        dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setTextColor(palette.muted);
    }

    private void addText(String text) {
        List<Server> parsed = VlessParser.parseMany(text);
        if (parsed.isEmpty()) {
            toast("В тексте нет vless://");
            return;
        }
        Store.addManual(this, parsed);
        renderServers();
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
                    Store.putSubscription(this, url, parsed);
                    renderServers();
                    showTab(1);
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

    private void renderServers() {
        Palette palette = Palette.current(this);
        Server selected = Store.selected(this);
        serverName.setText(selected == null ? "Нет сервера" : selected.label());
        serverBlocks.removeAllViews();
        List<Server> all = Store.servers(this);
        List<Store.Sub> subs = Store.subscriptions(this);
        if (subs.isEmpty() && all.isEmpty()) {
            serverBlocks.addView(note("Пока пусто. Добавь подписку или ссылку.", palette));
            return;
        }
        for (Store.Sub sub : subs) {
            List<Server> inside = new ArrayList<>();
            for (Server server : all) if (sub.id.equals(server.subId)) inside.add(server);
            serverBlocks.addView(subscriptionBlock(sub, inside, selected, palette));
        }
        List<Server> manual = new ArrayList<>();
        for (Server server : all) if (server.subId == null || server.subId.isEmpty()) manual.add(server);
        if (!manual.isEmpty()) serverBlocks.addView(manualBlock(manual, selected, palette));
    }

    private View subscriptionBlock(Store.Sub sub, List<Server> inside, Server selected, Palette palette) {
        return groupBlock(sub.id, "подписка", sub.name, inside, selected, palette, false, () -> loadSubscription(sub.url), () -> {
            Store.removeSubscription(this, sub.id);
            folded.remove(sub.id);
            renderServers();
            toast(RiversVpnService.running ? "Переподключи, чтобы применить" : "Подписка удалена");
        });
    }

    private View manualBlock(List<Server> manual, Server selected, Palette palette) {
        return groupBlock("manual", "вручную", "Отдельные ссылки", manual, selected, palette, true, null, null);
    }

    private View groupBlock(
            String id,
            String kind,
            String title,
            List<Server> inside,
            Server selected,
            Palette palette,
            boolean manual,
            Runnable refresh,
            Runnable remove
    ) {
        boolean open = !folded.contains(id);
        LinearLayout card = card(palette);
        card.setClipToOutline(true);
        LinearLayout header = row();
        header.setBackgroundColor(palette.raised);
        header.setMinimumHeight((int) Palette.dp(this, 72));
        TextView chevron = action(open ? "▾" : "▸", palette.accent);
        chevron.setTextSize(18);
        header.addView(chevron);
        LinearLayout titles = new LinearLayout(this);
        titles.setOrientation(LinearLayout.VERTICAL);
        titles.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        TextView kindView = caption(kind, palette.accent);
        kindView.setTextSize(11);
        kindView.setPadding(pad(), 0, pad(), 0);
        TextView name = caption(title, palette.fg);
        name.setTextSize(16);
        name.setTypeface(null, Typeface.BOLD);
        titles.addView(kindView);
        titles.addView(name);
        titles.addView(caption(countLabel(inside.size()), palette.muted));
        header.addView(titles);
        if (refresh != null) {
            TextView refreshView = action("Обновить", palette.muted);
            refreshView.setOnClickListener(view -> refresh.run());
            header.addView(refreshView);
        }
        if (remove != null) {
            TextView removeView = action("Удалить", palette.danger);
            removeView.setOnClickListener(view -> remove.run());
            header.addView(removeView);
        }
        header.setOnClickListener(view -> {
            if (open) folded.add(id);
            else folded.remove(id);
            renderServers();
        });
        card.addView(header);
        if (!open) return card;
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setBackgroundColor(palette.bg);
        body.setPadding(0, (int) Palette.dp(this, 4), 0, (int) Palette.dp(this, 4));
        if (inside.isEmpty()) {
            body.addView(note("В этой подписке серверов нет.", palette));
        } else {
            for (int i = 0; i < inside.size(); i++) {
                if (i > 0) body.addView(hairline(palette));
                body.addView(serverRow(inside.get(i), selected, palette, manual));
            }
        }
        card.addView(body);
        return card;
    }

    private static String countLabel(int count) {
        int mod10 = count % 10;
        int mod100 = count % 100;
        if (mod10 == 1 && mod100 != 11) return count + " сервер";
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return count + " сервера";
        return count + " серверов";
    }

    private View hairline(Palette palette) {
        View line = new View(this);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, Math.max(1, (int) Palette.dp(this, 1)));
        params.setMarginStart(pad());
        params.setMarginEnd(pad());
        line.setLayoutParams(params);
        line.setBackgroundColor(palette.line);
        return line;
    }

    private View serverRow(Server server, Server selected, Palette palette, boolean manual) {
        boolean on = selected != null && server.id.equals(selected.id);
        LinearLayout row = row();
        row.setBackgroundColor(on ? ((palette.accent & 0x00FFFFFF) | 0x24000000) : 0x00000000);
        View dot = new View(this);
        int size = (int) Palette.dp(this, 8);
        LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(size, size);
        dotParams.setMarginEnd(pad());
        dot.setLayoutParams(dotParams);
        dot.setBackground(Palette.circle(on ? palette.accent : palette.line, 0, 0));
        row.addView(dot);
        LinearLayout text = new LinearLayout(this);
        text.setOrientation(LinearLayout.VERTICAL);
        text.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        text.addView(caption(server.label(), palette.fg));
        text.addView(caption(server.address + ":" + server.port, palette.muted));
        row.addView(text);
        row.setOnClickListener(view -> {
            Store.select(this, server.id);
            renderServers();
            toast(RiversVpnService.running ? "Переподключи, чтобы применить" : "Выбран " + server.label());
        });
        if (manual) {
            TextView remove = action("Удалить", palette.muted);
            remove.setOnClickListener(view -> {
                Store.removeServer(this, server.id);
                renderServers();
            });
            row.addView(remove);
        }
        return row;
    }

    private LinearLayout card(Palette palette) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(Palette.round(this, palette.surface, palette.line, 20));
        card.setPadding(0, 0, 0, 0);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = pad();
        card.setLayoutParams(params);
        return card;
    }

    private LinearLayout row() {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(pad(), pad() / 2, pad() / 2, pad() / 2);
        row.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return row;
    }

    private TextView caption(String text, int color) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(13);
        view.setPadding(pad(), 0, pad(), 0);
        return view;
    }

    private TextView note(String text, Palette palette) {
        TextView view = caption(text, palette.muted);
        view.setPadding(pad(), pad() / 2, pad(), pad() / 2);
        return view;
    }

    private TextView action(String text, int color) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(13);
        view.setGravity(Gravity.CENTER);
        int side = (int) Palette.dp(this, 10);
        view.setPadding(side, side, side, side);
        return view;
    }

    private int pad() {
        return (int) Palette.dp(this, 14);
    }

    private void reloadServers() {
        renderServers();
    }

    private View tintSpinner(View view, boolean drop) {
        Palette palette = Palette.current(this);
        if (view instanceof TextView) {
            ((TextView) view).setTextColor(palette.fg);
            view.setBackgroundColor(drop ? palette.surface : 0x00000000);
        }
        return view;
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
            Palette palette = Palette.current(MainActivity.this);
            ((ImageView) view.findViewById(R.id.icon)).setImageDrawable(row.icon);
            TextView label = view.findViewById(R.id.label);
            TextView pkg = view.findViewById(R.id.pkg);
            CheckBox check = view.findViewById(R.id.check);
            label.setText(row.label);
            label.setTextColor(palette.fg);
            pkg.setText(row.pkg);
            pkg.setTextColor(palette.muted);
            check.setChecked(row.checked);
            check.setButtonTintList(ColorStateList.valueOf(palette.accent));
            return view;
        }
    }
}
