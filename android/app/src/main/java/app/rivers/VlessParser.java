package app.rivers;

import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class VlessParser {
    private VlessParser() {}

    public static List<Server> parseMany(String text) {
        List<Server> json = parseXrayJson(text);
        if (!json.isEmpty()) return json;
        List<Server> found = parseLines(text);
        if (!found.isEmpty()) return found;
        try {
            String decoded = new String(Base64.decode(text.replaceAll("\\s", ""), Base64.DEFAULT), StandardCharsets.UTF_8);
            json = parseXrayJson(decoded);
            if (!json.isEmpty()) return json;
            return parseLines(decoded);
        } catch (IllegalArgumentException ignored) {
            return found;
        }
    }

    private static List<Server> parseXrayJson(String text) {
        List<Server> found = new ArrayList<>();
        if (text == null || !text.trim().startsWith("{")) return found;
        try {
            JSONObject root = new JSONObject(text);
            JSONArray outbounds = root.optJSONArray("outbounds");
            if (outbounds == null) return found;
            for (int i = 0; i < outbounds.length(); i++) {
                JSONObject outbound = outbounds.optJSONObject(i);
                if (outbound == null || !"vless".equalsIgnoreCase(outbound.optString("protocol"))) continue;
                JSONObject settings = outbound.optJSONObject("settings");
                JSONArray vnext = settings == null ? null : settings.optJSONArray("vnext");
                JSONObject hop = vnext == null ? null : vnext.optJSONObject(0);
                JSONArray users = hop == null ? null : hop.optJSONArray("users");
                JSONObject user = users == null ? null : users.optJSONObject(0);
                JSONObject stream = outbound.optJSONObject("streamSettings");
                if (hop == null || user == null || stream == null) continue;
                Server server = new Server();
                server.address = hop.optString("address");
                server.port = hop.optInt("port");
                server.uuid = user.optString("id");
                server.flow = user.optString("flow");
                server.name = root.optString("remarks", server.address);
                server.network = stream.optString("network", "tcp");
                server.security = stream.optString("security");
                JSONObject tls = stream.optJSONObject("tlsSettings");
                if (tls == null) tls = stream.optJSONObject("realitySettings");
                if (tls != null) {
                    server.sni = tls.optString("serverName");
                    server.fp = tls.optString("fingerprint", "firefox");
                    server.pbk = first(tls.optString("publicKey"), tls.optString("password"));
                    server.sid = tls.optString("shortId");
                    server.spiderX = tls.optString("spiderX");
                    JSONArray alpn = tls.optJSONArray("alpn");
                    if (alpn != null) {
                        StringBuilder joined = new StringBuilder();
                        for (int n = 0; n < alpn.length(); n++) {
                            if (n > 0) joined.append(',');
                            joined.append(alpn.optString(n));
                        }
                        server.alpn = joined.toString();
                    }
                }
                JSONObject xhttp = stream.optJSONObject("xhttpSettings");
                if (xhttp == null) xhttp = stream.optJSONObject("splithttpSettings");
                if (xhttp != null) {
                    server.mode = xhttp.optString("mode");
                    server.host = xhttp.optString("host");
                    server.path = xhttp.optString("path");
                    JSONObject extra = xhttp.optJSONObject("extra");
                    if (extra != null) server.extra = extra.toString();
                }
                JSONObject ws = stream.optJSONObject("wsSettings");
                if (ws != null) {
                    server.path = ws.optString("path", server.path);
                    JSONObject headers = ws.optJSONObject("headers");
                    if (headers != null && blank(server.host)) server.host = headers.optString("Host");
                }
                JSONObject grpc = stream.optJSONObject("grpcSettings");
                if (grpc != null) server.serviceName = grpc.optString("serviceName");
                if (!server.uuid.isEmpty() && !server.address.isEmpty() && server.port > 0) found.add(server);
            }
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
        return found;
    }

    private static boolean blank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static List<Server> parseLines(String text) {
        List<Server> found = new ArrayList<>();
        if (text == null) return found;
        String[] lines = text.split("\\s+");
        for (String line : lines) {
            Server server = parse(line.trim());
            if (server != null) found.add(server);
        }
        return found;
    }

    public static Server parse(String line) {
        if (line == null || !line.toLowerCase().startsWith("vless://")) return null;
        try {
            String body = line.substring("vless://".length());
            int hash = body.indexOf('#');
            String withoutHash = hash >= 0 ? body.substring(0, hash) : body;
            String name = hash >= 0 ? urlDecode(body.substring(hash + 1)) : "Сервер";
            int queryAt = withoutHash.indexOf('?');
            String base = queryAt >= 0 ? withoutHash.substring(0, queryAt) : withoutHash;
            String query = queryAt >= 0 ? withoutHash.substring(queryAt + 1) : "";
            int at = base.lastIndexOf('@');
            if (at < 0) return null;
            String uuid = urlDecode(base.substring(0, at));
            String hostport = base.substring(at + 1);
            int colon = hostport.lastIndexOf(':');
            if (colon < 0) return null;
            String address = hostport.substring(0, colon).replaceAll("^\\[|\\]$", "");
            int port = Integer.parseInt(hostport.substring(colon + 1));
            if (uuid.isEmpty() || address.isEmpty() || port <= 0) return null;
            Server server = new Server();
            server.name = name.isEmpty() ? address : name;
            server.address = address;
            server.port = port;
            server.uuid = uuid;
            server.flow = queryValue(query, "flow");
            String sni = queryValue(query, "sni");
            if (sni.isEmpty()) sni = queryValue(query, "serverName");
            server.sni = sni;
            String fp = queryValue(query, "fp");
            if (fp.isEmpty()) fp = queryValue(query, "fingerprint");
            server.fp = fp.isEmpty() ? "firefox" : fp;
            server.pbk = first(queryValue(query, "pbk"), queryValue(query, "password"), queryValue(query, "publicKey"));
            server.sid = first(queryValue(query, "sid"), queryValue(query, "shortId"));
            server.security = queryValue(query, "security");
            String type = queryValue(query, "type");
            server.network = type.isEmpty() ? "tcp" : type;
            server.host = queryValue(query, "host");
            server.path = queryValue(query, "path");
            server.serviceName = queryValue(query, "serviceName");
            server.mode = queryValue(query, "mode");
            server.extra = queryValue(query, "extra");
            server.alpn = queryValue(query, "alpn");
            server.spiderX = first(queryValue(query, "spx"), queryValue(query, "spiderX"));
            return server;
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static String first(String... values) {
        for (String value : values) if (value != null && !value.isEmpty()) return value;
        return "";
    }

    private static String queryValue(String query, String key) {
        for (String part : query.split("&")) {
            int eq = part.indexOf('=');
            if (eq <= 0) continue;
            if (key.equalsIgnoreCase(urlDecode(part.substring(0, eq)))) return urlDecode(part.substring(eq + 1));
        }
        return "";
    }

    private static String urlDecode(String value) {
        try {
            return URLDecoder.decode(value.replace("+", "%2B"), "UTF-8").trim();
        } catch (Exception ignored) {
            return value == null ? "" : value.trim();
        }
    }
}
