package app.rivers;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
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
import java.util.List;

public class MainActivity extends android.app.Activity {
    private static final int REQ_VPN = 7;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Spinner servers;
    private TextView status;
    private TextView logs;
    private Button power;
    private boolean spinning;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            status.setText(RiversVpnService.status);
            logs.setText(LogBuffer.text());
            power.setText(RiversVpnService.running ? "Выключить" : "Включить");
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
        reloadServers();
        power.setOnClickListener(view -> {
            if (RiversVpnService.running) {
                startService(new Intent(this, RiversVpnService.class).setAction(RiversVpnService.ACTION_STOP));
            } else {
                askVpn();
            }
        });
        findViewById(R.id.addLink).setOnClickListener(view -> askText("Ссылка vless://", this::addText));
        findViewById(R.id.addSub).setOnClickListener(view -> askText("Ссылка подписки", this::loadSubscription));
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
}
