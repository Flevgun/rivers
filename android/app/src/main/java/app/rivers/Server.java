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
        server.id = item.optString("id");
        if (server.id.isEmpty()) server.id = server.subId + "|" + server.uuid + "@" + server.address + ":" + server.port;
        return server;
    }

    public String label() {
        if (name != null && !name.isEmpty()) return name;
        return address + ":" + port;
    }
}
