package app.rivers;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public final class Store {
    private static final String PREF = "rivers";

    public static final class Sub {
        public String id = "";
        public String name = "";
        public String url = "";
        public long updatedAt;
    }

    private Store() {}

    public static List<Server> servers(Context context) {
        String raw = prefs(context).getString("servers", "[]");
        List<Server> list = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i++) list.add(Server.fromJson(array.getJSONObject(i)));
        } catch (JSONException ignored) {
        }
        return list;
    }

    public static int active(Context context) {
        return prefs(context).getInt("active", 0);
    }

    public static void save(Context context, List<Server> servers, int active) {
        JSONArray array = new JSONArray();
        for (Server server : servers) {
            try {
                array.put(server.toJson());
            } catch (JSONException ignored) {
            }
        }
        prefs(context).edit().putString("servers", array.toString()).putInt("active", active).apply();
    }

    public static Server selected(Context context) {
        List<Server> list = servers(context);
        if (list.isEmpty()) return null;
        String id = prefs(context).getString("activeId", "");
        if (!id.isEmpty()) {
            for (Server server : list) if (id.equals(server.id)) return server;
        }
        int index = active(context);
        if (index < 0 || index >= list.size()) index = 0;
        return list.get(index);
    }

    public static List<Sub> subscriptions(Context context) {
        List<Sub> list = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(prefs(context).getString("subs", "[]"));
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.getJSONObject(i);
                Sub sub = new Sub();
                sub.id = item.optString("id");
                sub.name = item.optString("name");
                sub.url = item.optString("url");
                sub.updatedAt = item.optLong("updatedAt");
                if (!sub.id.isEmpty()) list.add(sub);
            }
        } catch (JSONException ignored) {
        }
        return list;
    }

    public static void select(Context context, String id) {
        prefs(context).edit().putString("activeId", id == null ? "" : id).apply();
    }

    public static void addManual(Context context, List<Server> added) {
        List<Server> all = new ArrayList<>();
        String first = "";
        for (Server server : added) {
            server.subId = "";
            server.id = "manual|" + server.uuid + "@" + server.address + ":" + server.port;
            if (first.isEmpty()) first = server.id;
            all.add(server);
        }
        for (Server server : servers(context)) {
            boolean same = false;
            for (Server fresh : all) if (fresh.id.equals(server.id)) same = true;
            if (!same) all.add(server);
        }
        write(context, all, subscriptions(context));
        if (!first.isEmpty()) select(context, first);
    }

    public static void putSubscription(Context context, String url, List<Server> parsed) {
        List<Sub> subs = subscriptions(context);
        Sub sub = null;
        for (Sub item : subs) if (url.equals(item.url)) sub = item;
        if (sub == null) {
            sub = new Sub();
            sub.id = Long.toHexString(System.currentTimeMillis()) + Integer.toHexString(url.hashCode());
            sub.url = url;
            sub.name = host(url);
            subs.add(0, sub);
        }
        sub.updatedAt = System.currentTimeMillis();
        String subId = sub.id;
        List<Server> next = new ArrayList<>();
        String first = "";
        for (Server server : parsed) {
            server.subId = subId;
            server.id = subId + "|" + server.uuid + "@" + server.address + ":" + server.port;
            if (first.isEmpty()) first = server.id;
            next.add(server);
        }
        for (Server server : servers(context)) if (!subId.equals(server.subId)) next.add(server);
        write(context, next, subs);
        String current = prefs(context).getString("activeId", "");
        boolean kept = false;
        for (Server server : next) if (server.id.equals(current)) kept = true;
        if (!kept && !first.isEmpty()) select(context, first);
    }

    public static void removeSubscription(Context context, String id) {
        List<Sub> subs = new ArrayList<>();
        for (Sub sub : subscriptions(context)) if (!id.equals(sub.id)) subs.add(sub);
        List<Server> next = new ArrayList<>();
        String active = prefs(context).getString("activeId", "");
        boolean lost = false;
        for (Server server : servers(context)) {
            if (id.equals(server.subId)) {
                if (server.id.equals(active)) lost = true;
            } else {
                next.add(server);
            }
        }
        write(context, next, subs);
        if (lost) select(context, next.isEmpty() ? "" : next.get(0).id);
    }

    public static void removeServer(Context context, String id) {
        List<Server> next = new ArrayList<>();
        boolean lost = id.equals(prefs(context).getString("activeId", ""));
        for (Server server : servers(context)) if (!id.equals(server.id)) next.add(server);
        write(context, next, subscriptions(context));
        if (lost) select(context, next.isEmpty() ? "" : next.get(0).id);
    }

    private static void write(Context context, List<Server> servers, List<Sub> subs) {
        JSONArray serverArray = new JSONArray();
        for (Server server : servers) {
            try {
                serverArray.put(server.toJson());
            } catch (JSONException ignored) {
            }
        }
        JSONArray subArray = new JSONArray();
        for (Sub sub : subs) {
            try {
                JSONObject item = new JSONObject();
                item.put("id", sub.id);
                item.put("name", sub.name);
                item.put("url", sub.url);
                item.put("updatedAt", sub.updatedAt);
                subArray.put(item);
            } catch (JSONException ignored) {
            }
        }
        prefs(context).edit().putString("servers", serverArray.toString()).putString("subs", subArray.toString()).apply();
    }

    private static String host(String url) {
        try {
            String host = new java.net.URL(url).getHost();
            if (host != null && !host.isEmpty()) return host;
        } catch (java.net.MalformedURLException ignored) {
        }
        return "Подписка";
    }

    public static String appMode(Context context) {
        String mode = prefs(context).getString("appMode", "direct");
        return "vpn".equals(mode) ? "vpn" : "direct";
    }

    public static void setAppMode(Context context, String mode) {
        prefs(context).edit().putString("appMode", "vpn".equals(mode) ? "vpn" : "direct").apply();
    }

    public static String customConfig(Context context) {
        return prefs(context).getString("customConfig", "");
    }

    public static void setCustomConfig(Context context, String config) {
        prefs(context).edit().putString("customConfig", config == null ? "" : config).apply();
    }

    public static String theme(Context context) {
        return prefs(context).getString("theme", "mint");
    }

    public static void setTheme(Context context, String id) {
        prefs(context).edit().putString("theme", id).apply();
    }

    public static java.util.Set<String> appPackages(Context context) {
        java.util.Set<String> set = new java.util.LinkedHashSet<>();
        try {
            JSONArray array = new JSONArray(prefs(context).getString("appPackages", "[]"));
            for (int i = 0; i < array.length(); i++) set.add(array.getString(i));
        } catch (JSONException ignored) {
        }
        return set;
    }

    public static void setAppPackages(Context context, java.util.Collection<String> packages) {
        JSONArray array = new JSONArray();
        for (String pkg : packages) array.put(pkg);
        prefs(context).edit().putString("appPackages", array.toString()).apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }
}
