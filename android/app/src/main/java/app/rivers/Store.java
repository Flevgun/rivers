package app.rivers;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

public final class Store {
    private static final String PREF = "rivers";

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
        int index = active(context);
        if (index < 0 || index >= list.size()) index = 0;
        return list.get(index);
    }

    public static String appMode(Context context) {
        String mode = prefs(context).getString("appMode", "direct");
        return "vpn".equals(mode) ? "vpn" : "direct";
    }

    public static void setAppMode(Context context, String mode) {
        prefs(context).edit().putString("appMode", "vpn".equals(mode) ? "vpn" : "direct").apply();
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
