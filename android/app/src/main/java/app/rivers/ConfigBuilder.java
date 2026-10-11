package app.rivers;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ConfigBuilder {
    public static final int SOCKS_PORT = 2080;

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
                        .put("https://1.1.1.1/dns-query")));
        root.put("inbounds", new JSONArray().put(new JSONObject()
                .put("tag", "socks")
                .put("listen", "127.0.0.1")
                .put("port", SOCKS_PORT)
                .put("protocol", "socks")
                .put("settings", new JSONObject().put("udp", true))
                .put("sniffing", new JSONObject()
                        .put("enabled", true)
                        .put("destOverride", new JSONArray().put("http").put("tls").put("quic")))));

        JSONObject proxy = new JSONObject()
                .put("tag", "proxy")
                .put("protocol", "vless")
                .put("settings", new JSONObject().put("vnext", new JSONArray().put(new JSONObject()
                        .put("address", server.address)
                        .put("port", server.port)
                        .put("users", new JSONArray().put(user(server))))))
                .put("streamSettings", new JSONObject()
                        .put("network", "tcp")
                        .put("security", "reality")
                        .put("realitySettings", new JSONObject()
                                .put("serverName", server.sni)
                                .put("fingerprint", blank(server.fp) ? "firefox" : server.fp)
                                .put("publicKey", server.pbk)
                                .put("shortId", server.sid)
                                .put("spiderX", "/")));
        root.put("outbounds", new JSONArray()
                .put(proxy)
                .put(new JSONObject().put("tag", "direct").put("protocol", "freedom")
                        .put("settings", new JSONObject().put("domainStrategy", "UseIPv4")))
                .put(new JSONObject().put("tag", "block").put("protocol", "blackhole").put("settings", new JSONObject())));
        root.put("routing", new JSONObject()
                .put("domainStrategy", "AsIs")
                .put("rules", new JSONArray()
                        .put(new JSONObject().put("type", "field").put("outboundTag", "direct")
                                .put("ip", new JSONArray().put("10.0.0.0/8").put("192.168.0.0/16").put("127.0.0.0/8")))
                        .put(new JSONObject().put("type", "field").put("outboundTag", "block")
                                .put("domain", new JSONArray().put("geosite:category-ads-all")))
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

    private static JSONObject user(Server server) throws JSONException {
        JSONObject user = new JSONObject().put("id", server.uuid).put("encryption", "none");
        if (!blank(server.flow)) user.put("flow", server.flow);
        return user;
    }

    private static boolean blank(String value) {
        return value == null || value.isEmpty();
    }
}
