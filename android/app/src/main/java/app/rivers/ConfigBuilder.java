package app.rivers;

import java.util.Locale;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ConfigBuilder {
    public static final int SOCKS_PORT = 2080;

    public static final class Prepared {
        public final String json;
        public final int port;

        private Prepared(String json, int port) {
            this.json = json;
            this.port = port;
        }

        public static Prepared from(String raw) throws JSONException {
            JSONObject root = new JSONObject(raw);
            JSONArray inbounds = root.optJSONArray("inbounds");
            if (inbounds == null) {
                inbounds = new JSONArray();
                root.put("inbounds", inbounds);
            }
            int port = 0;
            for (int i = 0; i < inbounds.length(); i++) {
                JSONObject inbound = inbounds.optJSONObject(i);
                if (inbound == null) continue;
                String protocol = inbound.optString("protocol");
                if (!"socks".equals(protocol) && !"mixed".equals(protocol)) continue;
                int found = inbound.optInt("port", 0);
                if (found > 0) {
                    port = found;
                    break;
                }
            }
            if (port == 0) {
                port = SOCKS_PORT;
                inbounds.put(new JSONObject()
                        .put("tag", "socks")
                        .put("listen", "127.0.0.1")
                        .put("port", port)
                        .put("protocol", "socks")
                        .put("settings", new JSONObject().put("udp", true))
                        .put("sniffing", new JSONObject()
                                .put("enabled", true)
                                .put("routeOnly", true)
                                .put("destOverride", new JSONArray().put("http").put("tls"))));
            }
            return new Prepared(root.toString(2), port);
        }
    }

    private ConfigBuilder() {}

    public static String xray(Server server) throws JSONException {
        JSONObject root = new JSONObject();
        root.put("log", new JSONObject().put("loglevel", "info"));
        root.put("dns", new JSONObject()
                .put("queryStrategy", "UseIPv4")
                .put("servers", new JSONArray()
                        .put(new JSONObject()
                                .put("address", "77.88.8.8")
                                .put("skipFallback", true)
                                .put("domains", new JSONArray()
                                        .put("domain:ru")
                                        .put("domain:su")
                                        .put("domain:xn--p1ai")
                                        .put("geosite:category-ru")))
                        .put("1.1.1.1")
                        .put("8.8.8.8")));
        root.put("inbounds", new JSONArray().put(new JSONObject()
                .put("tag", "socks")
                .put("listen", "127.0.0.1")
                .put("port", SOCKS_PORT)
                .put("protocol", "socks")
                .put("settings", new JSONObject().put("udp", true))
                .put("sniffing", new JSONObject()
                        .put("enabled", true)
                        .put("routeOnly", true)
                        .put("destOverride", new JSONArray().put("http").put("tls")))));

        String security = securityOf(server);
        JSONObject proxy = new JSONObject()
                .put("tag", "proxy")
                .put("protocol", "vless")
                .put("settings", new JSONObject().put("vnext", new JSONArray().put(new JSONObject()
                        .put("address", server.address)
                        .put("port", server.port)
                        .put("users", new JSONArray().put(user(server, security))))))
                .put("streamSettings", stream(server, security));
        root.put("outbounds", new JSONArray()
                .put(proxy)
                .put(new JSONObject().put("tag", "direct").put("protocol", "freedom")
                        .put("streamSettings", new JSONObject()
                                .put("sockopt", new JSONObject().put("domainStrategy", "UseIPv4"))))
                .put(new JSONObject().put("tag", "block").put("protocol", "blackhole").put("settings", new JSONObject())));
        root.put("routing", new JSONObject()
                .put("domainStrategy", "AsIs")
                .put("rules", new JSONArray()
                        .put(new JSONObject().put("type", "field").put("outboundTag", "block")
                                .put("network", "udp").put("port", "443"))
                        .put(new JSONObject().put("type", "field").put("outboundTag", "proxy")
                                .put("port", "53")
                                .put("ip", new JSONArray().put("1.1.1.1").put("8.8.8.8")))
                        .put(new JSONObject().put("type", "field").put("outboundTag", "direct")
                                .put("ip", new JSONArray().put("10.0.0.0/8").put("172.16.0.0/12").put("192.168.0.0/16").put("127.0.0.0/8")))
                        .put(new JSONObject().put("type", "field").put("outboundTag", "direct")
                                .put("domain", new JSONArray()
                                        .put("geosite:category-ru")
                                        .put("domain:ru")
                                        .put("domain:su")
                                        .put("domain:xn--p1ai")))
                        .put(new JSONObject().put("type", "field").put("outboundTag", "direct")
                                .put("ip", new JSONArray().put("geoip:ru")))));
        return root.toString(2);
    }

    private static JSONObject user(Server server, String security) throws JSONException {
        JSONObject user = new JSONObject().put("id", server.uuid).put("encryption", "none");
        if (!"none".equals(security) && !blank(server.flow)) user.put("flow", server.flow);
        return user;
    }

    private static JSONObject xhttpSettings(Server server) throws JSONException {
        JSONObject extra = new JSONObject();
        if (!blank(server.extra)) {
            try {
                extra = new JSONObject(server.extra);
            } catch (JSONException ignored) {
            }
        }
        String mode = first(server.mode, extra.optString("mode"));
        String path = first(server.path, extra.optString("path"), "/");
        String host = first(server.host, extra.optString("host"));
        JSONObject xhttp = new JSONObject().put("path", path).put("extra", extra);
        if (!blank(mode)) xhttp.put("mode", mode);
        if (!blank(host)) xhttp.put("host", host);
        return xhttp;
    }

    private static String first(String... values) {
        for (String value : values) if (!blank(value)) return value;
        return "";
    }

    private static JSONObject stream(Server server, String security) throws JSONException {
        String network = networkOf(server);
        JSONObject stream = new JSONObject().put("network", network).put("security", security);
        if ("reality".equals(security)) {
            String key = keyOf(server);
            stream.put("realitySettings", new JSONObject()
                    .put("serverName", blank(server.sni) ? server.address : server.sni)
                    .put("fingerprint", blank(server.fp) ? "firefox" : server.fp)
                    .put("password", key)
                    .put("publicKey", key)
                    .put("shortId", server.sid == null ? "" : server.sid)
                    .put("spiderX", blank(server.spiderX) ? "/" : server.spiderX));
        } else if ("tls".equals(security)) {
            JSONObject tls = new JSONObject()
                    .put("serverName", blank(server.sni) ? server.address : server.sni)
                    .put("fingerprint", blank(server.fp) ? "firefox" : server.fp);
            JSONArray alpn = alpnOf(server.alpn);
            if (alpn.length() > 0) tls.put("alpn", alpn);
            stream.put("tlsSettings", tls);
        }
        if ("ws".equals(network)) {
            JSONObject ws = new JSONObject().put("path", blank(server.path) ? "/" : server.path);
            if (!blank(server.host)) ws.put("headers", new JSONObject().put("Host", server.host));
            stream.put("wsSettings", ws);
        } else if ("grpc".equals(network)) {
            stream.put("grpcSettings", new JSONObject().put("serviceName", server.serviceName == null ? "" : server.serviceName));
        } else if ("xhttp".equals(network)) {
            stream.put("xhttpSettings", xhttpSettings(server));
        } else if ("http".equals(network)) {
            JSONObject http = new JSONObject().put("path", blank(server.path) ? "/" : server.path);
            if (!blank(server.host)) http.put("host", new JSONArray().put(server.host));
            stream.put("httpSettings", http);
        }
        stream.put("sockopt", new JSONObject().put("domainStrategy", "UseIPv4"));
        return stream;
    }

    private static String securityOf(Server server) {
        String raw = server.security == null ? "" : server.security.trim().toLowerCase(Locale.US);
        String key = keyOf(server);
        if ("none".equals(raw)) return "none";
        if ("reality".equals(raw) && !key.isEmpty()) return "reality";
        if ("tls".equals(raw) || "xtls".equals(raw)) return "tls";
        if (!key.isEmpty()) return "reality";
        if (!blank(server.sni)) return "tls";
        return "none";
    }

    private static String networkOf(Server server) {
        String raw = server.network == null ? "" : server.network.trim().toLowerCase(Locale.US);
        if ("ws".equals(raw) || "grpc".equals(raw)) return raw;
        if ("xhttp".equals(raw) || "splithttp".equals(raw)) return "xhttp";
        if ("http".equals(raw) || "h2".equals(raw)) return "http";
        return "tcp";
    }

    private static String keyOf(Server server) {
        return server.pbk == null ? "" : server.pbk.trim().replace(' ', '+');
    }

    private static JSONArray alpnOf(String value) {
        JSONArray alpn = new JSONArray();
        if (blank(value)) return alpn;
        for (String part : value.split(",")) if (!part.trim().isEmpty()) alpn.put(part.trim());
        return alpn;
    }

    private static boolean blank(String value) {
        return value == null || value.isEmpty();
    }
}
