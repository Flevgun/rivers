package app.rivers;

import android.util.Base64;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class VlessParser {
    private VlessParser() {}

    public static List<Server> parseMany(String text) {
        List<Server> found = parseLines(text);
        if (!found.isEmpty()) return found;
        try {
            String decoded = new String(Base64.decode(text.replaceAll("\\s", ""), Base64.DEFAULT), StandardCharsets.UTF_8);
            return parseLines(decoded);
        } catch (IllegalArgumentException ignored) {
            return found;
        }
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
