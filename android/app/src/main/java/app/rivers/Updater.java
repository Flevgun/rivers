package app.rivers;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class Updater {
    private Updater() {}

    public static final class Release {
        public String version = "";
        public String page = "https://github.com/Flevgun/rivers/releases/latest";
        public String apk = "";
    }

    public static Release latest() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL("https://api.github.com/repos/Flevgun/rivers/releases/latest").openConnection();
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("User-Agent", "Rivers");
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.connect();
        String body = read(connection.getInputStream());
        connection.disconnect();
        JSONObject json = new JSONObject(body);
        Release release = new Release();
        release.version = json.optString("tag_name").replaceFirst("^v", "");
        String page = json.optString("html_url");
        if (!page.isEmpty()) release.page = page;
        JSONArray assets = json.optJSONArray("assets");
        if (assets != null) {
            for (int i = 0; i < assets.length(); i++) {
                JSONObject asset = assets.getJSONObject(i);
                if ("Rivers-android.apk".equals(asset.optString("name"))) release.apk = asset.optString("browser_download_url");
            }
        }
        return release;
    }

    public static int compare(String left, String right) {
        String[] a = left.replaceFirst("^v", "").split("\\.");
        String[] b = right.replaceFirst("^v", "").split("\\.");
        int length = Math.max(a.length, b.length);
        for (int i = 0; i < length; i++) {
            int av = i < a.length ? parse(a[i]) : 0;
            int bv = i < b.length ? parse(b[i]) : 0;
            if (av != bv) return av - bv;
        }
        return 0;
    }

    private static int parse(String part) {
        try {
            return Integer.parseInt(part.replaceAll("[^0-9].*$", ""));
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private static String read(InputStream stream) throws Exception {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }
}
