package app.rivers;

import org.json.JSONException;
import org.json.JSONObject;

public class Server {
    public String id = "";
    public String name = "";
    public String address = "";
    public int port;
    public String uuid = "";
    public String flow = "";
    public String sni = "";
    public String fp = "firefox";
    public String pbk = "";
    public String sid = "";
    public String subId = "";
    public String security = "";
    public String network = "";
    public String host = "";
    public String path = "";
    public String serviceName = "";
    public String mode = "";
    public String extra = "";
    public String alpn = "";
    public String spiderX = "";

    public JSONObject toJson() throws JSONException {
        JSONObject item = new JSONObject();
        item.put("id", id);
        item.put("name", name);
        item.put("address", address);
        item.put("port", port);
        item.put("uuid", uuid);
        item.put("flow", flow);
        item.put("sni", sni);
        item.put("fp", fp);
        item.put("pbk", pbk);
        item.put("sid", sid);
        item.put("subId", subId);
        item.put("security", security);
        item.put("network", network);
        item.put("host", host);
        item.put("path", path);
        item.put("serviceName", serviceName);
        item.put("mode", mode);
        item.put("extra", extra);
        item.put("alpn", alpn);
        item.put("spiderX", spiderX);
        return item;
    }

    public static Server fromJson(JSONObject item) throws JSONException {
        Server server = new Server();
        server.name = item.optString("name");
        server.address = item.optString("address");
        server.port = item.optInt("port");
        server.uuid = item.optString("uuid");
        server.flow = item.optString("flow");
        server.sni = item.optString("sni");
        server.fp = item.optString("fp", "firefox");
        server.pbk = item.optString("pbk");
        server.sid = item.optString("sid");
        server.subId = item.optString("subId");
        server.security = item.optString("security");
        server.network = item.optString("network");
        server.host = item.optString("host");
        server.path = item.optString("path");
        server.serviceName = item.optString("serviceName");
        server.mode = item.optString("mode");
        server.extra = item.optString("extra");
        server.alpn = item.optString("alpn");
        server.spiderX = item.optString("spiderX");
        server.id = item.optString("id");
        if (server.id.isEmpty()) server.id = server.subId + "|" + server.uuid + "@" + server.address + ":" + server.port;
        return server;
    }

    public String label() {
        if (name != null && !name.isEmpty()) return name;
        return address + ":" + port;
    }
}
