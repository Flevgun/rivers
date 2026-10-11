package app.rivers;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ConfigBuilder {
    public static final int SOCKS_PORT = 2080;

    private ConfigBuilder() {}

    public static String singbox(Server server) throws JSONException {
        JSONObject root = new JSONObject();
        root.put("log", new JSONObject().put("level", "info"));

        JSONArray dnsServers = new JSONArray()
                .put(new JSONObject().put("tag", "local").put("address", "77.88.8.8").put("detour", "direct"))
                .put(new JSONObject().put("tag", "remote").put("address", "https://1.1.1.1/dns-query").put("detour", "proxy"));
        JSONArray dnsRules = new JSONArray()
                .put(new JSONObject().put("rule_set", new JSONArray().put("geosite-ru")).put("server", "local"))
                .put(new JSONObject()
                        .put("domain_suffix", new JSONArray().put("ru").put("su").put("xn--p1ai"))
                        .put("server", "local"));
        root.put("dns", new JSONObject()
                .put("servers", dnsServers)
                .put("rules", dnsRules)
                .put("final", "remote")
                .put("strategy", "ipv4_only")
                .put("independent_cache", true));

        root.put("inbounds", new JSONArray().put(new JSONObject()
                .put("type", "mixed")
                .put("tag", "mixed-in")
                .put("listen", "127.0.0.1")
                .put("listen_port", SOCKS_PORT)));

        JSONObject tls = new JSONObject()
                .put("enabled", true)
                .put("server_name", server.sni)
                .put("utls", new JSONObject().put("enabled", true).put("fingerprint", blank(server.fp) ? "firefox" : server.fp))
                .put("reality", new JSONObject()
                        .put("enabled", true)
                        .put("public_key", server.pbk)
                        .put("short_id", server.sid));
        JSONObject proxy = new JSONObject()
                .put("type", "vless")
                .put("tag", "proxy")
                .put("server", server.address)
                .put("server_port", server.port)
                .put("uuid", server.uuid)
                .put("tls", tls);
        if (!blank(server.flow)) proxy.put("flow", server.flow);

        root.put("outbounds", new JSONArray()
                .put(proxy)
                .put(new JSONObject().put("type", "direct").put("tag", "direct"))
                .put(new JSONObject().put("type", "block").put("tag", "block")));

        JSONArray sets = new JSONArray()
                .put(localSet("geosite-ru", "geosite-category-ru.srs"))
                .put(localSet("geoip-ru", "geoip-ru.srs"))
                .put(localSet("geosite-category-ads-all", "geosite-category-ads-all.srs"));
        JSONArray rules = new JSONArray()
                .put(new JSONObject().put("action", "sniff"))
                .put(new JSONObject().put("ip_is_private", true).put("outbound", "direct"))
                .put(new JSONObject().put("rule_set", new JSONArray().put("geosite-category-ads-all")).put("outbound", "block"))
                .put(new JSONObject().put("ip_cidr", new JSONArray().put("10.0.0.0/8").put("192.168.0.0/16").put("127.0.0.0/8")).put("outbound", "direct"))
                .put(new JSONObject().put("domain_suffix", new JSONArray().put("ru").put("su").put("xn--p1ai")).put("outbound", "direct"))
                .put(new JSONObject().put("rule_set", new JSONArray().put("geosite-ru")).put("outbound", "direct"))
                .put(new JSONObject().put("rule_set", new JSONArray().put("geoip-ru")).put("outbound", "direct"));
        root.put("route", new JSONObject()
                .put("rule_set", sets)
                .put("rules", rules)
                .put("final", "proxy")
                .put("auto_detect_interface", true)
                .put("default_domain_resolver", "local"));
        return root.toString(2);
    }

    private static JSONObject localSet(String tag, String file) throws JSONException {
        return new JSONObject()
                .put("tag", tag)
                .put("type", "local")
                .put("format", "binary")
                .put("path", "rules/" + file);
    }

    private static boolean blank(String value) {
        return value == null || value.isEmpty();
    }
}
