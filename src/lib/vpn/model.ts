export type OutboundTag = "proxy" | "direct" | "block";

export type Server = {
  id: string;
  name: string;
  address: string;
  port: number;
  uuid: string;
  flow: string;
  sni: string;
  fp: string;
  pbk: string;
  sid: string;
  subId?: string;
  security?: string;
  network?: string;
  host?: string;
  path?: string;
  serviceName?: string;
  mode?: string;
  alpn?: string;
  spiderX?: string;
};

export type Subscription = {
  id: string;
  name: string;
  url: string;
  updatedAt: number | null;
};

export type RouteRule = {
  id: string;
  label: string;
  enabled: boolean;
  outbound: OutboundTag;
  domains: string;
  ips: string;
  processes: string;
  ports: string;
  network: "" | "tcp" | "udp";
};

export type GeoSource = {
  id: string;
  name: string;
  url: string;
  tag: string;
  everyHours: number;
  updatedAt: number | null;
};

export type TunSettings = {
  mtu: number;
  stack: "mixed" | "system" | "gvisor";
  autoRoute: boolean;
  strictRoute: boolean;
  ipv6: boolean;
  sniff: boolean;
  address: string;
  dnsHijack: string;
};

export type DnsSettings = {
  local: string;
  remote: string;
  suffixes: string;
  strategy: "ipv4_only" | "prefer_ipv4";
};

export type CoreName = "sing-box" | "xray";
export type ConnectMode = "tun" | "system";

export type PresetId = "all-proxy" | "ru-direct" | "games" | "custom";

export const PRESET_LABEL: Record<PresetId, string> = {
  "all-proxy": "Всё в прокси",
  "ru-direct": "RU напрямую",
  games: "Игры и RU",
  custom: "Свой набор",
};

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function defaultTun(): TunSettings {
  return {
    mtu: 1400,
    stack: "system",
    autoRoute: true,
    strictRoute: false,
    ipv6: false,
    sniff: true,
    address: "172.19.0.1/30",
    dnsHijack: "172.19.0.2",
  };
}

export function defaultDns(): DnsSettings {
  return {
    local: "77.88.8.8",
    remote: "https://1.1.1.1/dns-query",
    suffixes: ".ru, .su, .рф",
    strategy: "ipv4_only",
  };
}

export function defaultGeos(): GeoSource[] {
  return [
    {
      id: "geosite-ru",
      name: "geosite RU",
      tag: "geosite-ru",
      url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-ru.srs",
      everyHours: 24,
      updatedAt: null,
    },
    {
      id: "geoip-ru",
      name: "geoip RU",
      tag: "geoip-ru",
      url: "https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-ru.srs",
      everyHours: 24,
      updatedAt: null,
    },
    {
      id: "ads",
      name: "Реклама",
      tag: "geosite-category-ads-all",
      url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-ads-all.srs",
      everyHours: 24,
      updatedAt: null,
    },
    {
      id: "geosite-steam",
      name: "Steam",
      tag: "geosite-steam",
      url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-steam.srs",
      everyHours: 24,
      updatedAt: null,
    },
    {
      id: "runet",
      name: "runetfreedom",
      tag: "geosite-runet",
      url: "https://github.com/runetfreedom/russia-v2ray-rules-dat",
      everyHours: 24,
      updatedAt: null,
    },
  ];
}

function rule(
  label: string,
  outbound: OutboundTag,
  extra: Partial<RouteRule> = {},
): RouteRule {
  return {
    id: uid(),
    label,
    enabled: true,
    outbound,
    domains: "",
    ips: "",
    processes: "",
    ports: "",
    network: "",
    ...extra,
  };
}

export function rulesFor(preset: PresetId): RouteRule[] {
  if (preset === "all-proxy") {
    return [
      rule("Реклама", "block", { domains: "geosite:category-ads-all" }),
      rule("Локальная сеть", "direct", { ips: "10.0.0.0/8,192.168.0.0/16,127.0.0.0/8" }),
    ];
  }
  if (preset === "ru-direct") {
    return [
      rule("Реклама", "block", { domains: "geosite:category-ads-all" }),
      rule("Локальная сеть", "direct", { ips: "10.0.0.0/8,192.168.0.0/16,127.0.0.0/8" }),
      rule("Домены RU", "direct", { domains: "geosite:ru,.ru,.su,.рф" }),
      rule("Сети RU", "direct", { ips: "geoip:ru" }),
    ];
  }
  if (preset === "games") {
    return [
      rule("Реклама", "block", { domains: "geosite:category-ads-all" }),
      rule("Локальная сеть", "direct", { ips: "10.0.0.0/8,192.168.0.0/16,127.0.0.0/8" }),
      rule("Домены RU", "direct", { domains: "geosite:ru,.ru,.su,.рф" }),
      rule("Сети RU", "direct", { ips: "geoip:ru" }),
      rule("Steam", "direct", {
        domains: "steampowered.com,steamserver.net,steamcommunity.com,geosite:steam",
      }),
      rule("EA / Apex", "direct", {
        domains: "ea.com,origin.com,easports.com,apexlegends.com",
        processes: "r5apex.exe,r5apex_dx12.exe,EADesktop.exe",
      }),
      rule("Riot", "direct", {
        domains: "riotgames.com,leagueoflegends.com,pvp.net",
        processes: "RiotClientServices.exe,LeagueClient.exe",
      }),
      rule("ARC Raiders", "direct", {
        domains: "embark.net,embark.games,arcraiders.com",
        processes: "PioneerGame.exe,start_protected_game.exe,EasyAntiCheat_EOS.exe,EasyAntiCheat.exe",
      }),
      rule("Space Marine 2", "direct", {
        processes: "Warhammer 40000 Space Marine 2.exe,start_protected_game.exe",
        network: "udp",
      }),
    ];
  }
  return [
    rule("Локальная сеть", "direct", { ips: "10.0.0.0/8,192.168.0.0/16,127.0.0.0/8" }),
    rule("Своё правило", "direct", { domains: "" }),
  ];
}

export function splitList(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseVless(raw: string): Server | null {
  const line = raw.trim();
  if (!line.toLowerCase().startsWith("vless://")) return null;
  try {
    const body = line.slice("vless://".length);
    const hash = body.indexOf("#");
    const withoutHash = hash >= 0 ? body.slice(0, hash) : body;
    const name = hash >= 0 ? decodeURIComponent(body.slice(hash + 1)) : "Сервер";
    const q = withoutHash.indexOf("?");
    const base = q >= 0 ? withoutHash.slice(0, q) : withoutHash;
    const query = q >= 0 ? new URLSearchParams(withoutHash.slice(q + 1)) : new URLSearchParams();
    const at = base.lastIndexOf("@");
    if (at < 0) return null;
    const uuid = decodeURIComponent(base.slice(0, at));
    const hostport = base.slice(at + 1);
    const colon = hostport.lastIndexOf(":");
    if (colon < 0) return null;
    const address = hostport.slice(0, colon).replace(/^\[|\]$/g, "");
    const port = Number(hostport.slice(colon + 1));
    if (!uuid || !address || !port) return null;
    return {
      id: uid(),
      name: name || address,
      address,
      port,
      uuid,
      flow: query.get("flow") || "",
      sni: query.get("sni") || query.get("serverName") || "",
      fp: query.get("fp") || "firefox",
      pbk: query.get("pbk") || query.get("password") || query.get("publicKey") || "",
      sid: query.get("sid") || query.get("shortId") || "",
      security: query.get("security") || "",
      network: query.get("type") || "tcp",
      host: query.get("host") || "",
      path: query.get("path") || "",
      serviceName: query.get("serviceName") || "",
      mode: query.get("mode") || "",
      alpn: query.get("alpn") || "",
      spiderX: query.get("spx") || query.get("spiderX") || "",
    };
  } catch {
    return null;
  }
}

export function parseMany(text: string): Server[] {
  const found: Server[] = [];
  const chunks = text.split(/\s+/).join("\n").split("\n");
  for (const chunk of chunks) {
    const server = parseVless(chunk);
    if (server) found.push(server);
  }
  if (found.length) return found;
  try {
    const decoded = atob(text.replace(/\s/g, ""));
    return parseMany(decoded);
  } catch {
    return [];
  }
}

function isAppOnly(rule: RouteRule) {
  return (
    splitList(rule.processes).length > 0 &&
    !splitList(rule.domains).length &&
    !splitList(rule.ips).length &&
    !splitList(rule.ports).length &&
    !rule.network
  );
}

function orderedRules(rules: RouteRule[]) {
  const enabled = rules.filter((entry) => entry.enabled);
  return [...enabled.filter(isAppOnly), ...enabled.filter((entry) => !isAppOnly(entry))];
}

function processNames(value: string) {
  return splitList(value).map((item) => (item.includes(".") ? item : `${item}.exe`));
}

function singboxPorts(value: string) {
  const ranges = splitList(value).flatMap((item) => {
    const range = item.match(/^(\d{1,5})\s*[-:]\s*(\d{1,5})$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start > 65535 || end > 65535) return [];
      return [`${Math.min(start, end)}:${Math.max(start, end)}`];
    }
    const port = Number(item);
    if (!Number.isInteger(port) || port < 0 || port > 65535) return [];
    return [`${port}:${port}`];
  });
  return ranges.length ? { port_range: ranges } : null;
}

function xrayPorts(value: string) {
  return splitList(value)
    .flatMap((item) => {
      const range = item.match(/^(\d{1,5})\s*[-:]\s*(\d{1,5})$/);
      if (range) {
        const start = Number(range[1]);
        const end = Number(range[2]);
        if (start > 65535 || end > 65535) return [];
        return [`${Math.min(start, end)}-${Math.max(start, end)}`];
      }
      const port = Number(item);
      if (!Number.isInteger(port) || port < 0 || port > 65535) return [];
      return [String(port)];
    })
    .join(",");
}

function suffixName(item: string) {
  const bare = item.replace(/^\./, "").toLowerCase();
  if (bare === "рф") return "xn--p1ai";
  return bare;
}

function ruleSetTag(item: string) {
  const name = item.slice(item.indexOf(":") + 1);
  if (item.startsWith("geosite:")) return `geosite-${name}`;
  if (item.startsWith("geoip:")) return `geoip-${name}`;
  return name;
}

function domainPieces(domains: string[], known: Set<string>) {
  const sets = domains.filter((item) => item.startsWith("geosite:") || item.startsWith("rule-set:"));
  const keywords = domains.filter((item) => item.startsWith("keyword:")).map((item) => item.slice("keyword:".length));
  const exact = domains.filter((item) => item.startsWith("full:")).map((item) => suffixName(item.slice("full:".length)));
  const plain = domains.filter(
    (item) =>
      !item.startsWith("geosite:") &&
      !item.startsWith("rule-set:") &&
      !item.startsWith("keyword:") &&
      !item.startsWith("full:"),
  );
  const rules: Record<string, unknown>[] = [];
  const suffixes = plain.map(suffixName);
  if (exact.length) rules.push({ domain: exact });
  if (suffixes.length) rules.push({ domain_suffix: suffixes });
  if (keywords.length) rules.push({ domain_keyword: keywords });
  const tags = sets.map(ruleSetTag).filter((tag) => known.has(tag));
  if (tags.length) rules.push({ rule_set: tags });
  return rules;
}

function singboxDnsServer(tag: string, address: string, detour: string) {
  const raw = address.trim();
  const prefixed = raw.match(/^(udp|tcp|tls|https|quic|h3|dhcp):\/\/(.+)$/i);
  const type = prefixed ? prefixed[1].toLowerCase() : "udp";
  const body = prefixed ? prefixed[2] : raw;
  if (type === "dhcp") return detour && detour !== "direct" ? { type, tag, detour } : { type, tag };
  const slash = body.indexOf("/");
  const route = slash >= 0 ? body.slice(slash) : "";
  const hostport = slash >= 0 ? body.slice(0, slash) : body;
  let server = hostport;
  let serverPort = 0;
  if (hostport.startsWith("[")) {
    const end = hostport.indexOf("]");
    server = hostport.slice(1, end);
    if (hostport[end + 1] === ":") serverPort = Number(hostport.slice(end + 2)) || 0;
  } else {
    const colon = hostport.lastIndexOf(":");
    const port = colon > 0 ? Number(hostport.slice(colon + 1)) : 0;
    if (port) {
      server = hostport.slice(0, colon);
      serverPort = port;
    }
  }
  return {
    type,
    tag,
    server,
    ...(detour && detour !== "direct" ? { detour } : {}),
    ...((type === "https" || type === "tls" || type === "quic" || type === "h3") && server
      ? { tls: { enabled: true, server_name: server } }
      : {}),
    ...(serverPort ? { server_port: serverPort } : {}),
    ...(route && route !== "/" ? { path: route } : {}),
  };
}

export function buildSingbox(input: {
  server: Server | null;
  rules: RouteRule[];
  tun: TunSettings;
  dns: DnsSettings;
  geos: GeoSource[];
  mode: ConnectMode;
}) {
  const { server, rules, tun, dns, geos, mode } = input;
  const proxy = server
    ? {
        type: "vless",
        tag: "proxy",
        server: server.address,
        server_port: server.port,
        uuid: server.uuid,
        flow: linkSecurity(server) === "none" ? undefined : server.flow || undefined,
        tls: linkSecurity(server) === "none"
          ? undefined
          : {
              enabled: true,
              server_name: server.sni || server.address,
              utls: { enabled: true, fingerprint: server.fp || "firefox" },
              reality:
                linkSecurity(server) === "reality"
                  ? { enabled: true, public_key: server.pbk, short_id: server.sid }
                  : undefined,
              alpn: alpnList(server.alpn),
            },
        transport: singboxTransport(server),
      }
    : { type: "direct", tag: "proxy" };

  const routeRules = [];
  if (mode === "tun") {
    routeRules.push({ network: "udp", port: [53], action: "hijack-dns" });
    routeRules.push({ network: "tcp", port: [53], action: "reject" });
  }
  if (tun.sniff) routeRules.push({ action: "sniff" });
  const serverCidr = server ? hostCidr(server.address) : "";
  if (serverCidr) routeRules.push({ ip_cidr: [serverCidr], action: "route", outbound: "direct" });
  else if (server?.address) routeRules.push({ domain: [server.address], action: "route", outbound: "direct" });
  routeRules.push({ ip_is_private: true, action: "route", outbound: "direct" });

  const known = new Set(geos.filter((source) => bundledRuleFile(source.url)).map((source) => source.tag));

  const enabled = orderedRules(rules);

  for (const item of enabled) {
    const domains = splitList(item.domains);
    const ips = splitList(item.ips);
    const processes = processNames(item.processes);
    const base: Record<string, unknown> = { action: "route", outbound: item.outbound };
    if (item.network) base.network = item.network;
    const ports = singboxPorts(item.ports);
    if (ports) Object.assign(base, ports);
    if (processes.length) {
      routeRules.push({ ...base, process_name: processes });
    }
    if (ips.length) {
      const plainIps = ips.filter((ip) => !ip.startsWith("geoip:"));
      if (plainIps.length) routeRules.push({ ...base, ip_cidr: plainIps });
      const sets = ips
        .filter((ip) => ip.startsWith("geoip:"))
        .map((ip) => `geoip-${ip.slice(6)}`)
        .filter((tag) => known.has(tag));
      if (sets.length) routeRules.push({ ...base, rule_set: sets });
    }
    for (const piece of domainPieces(domains, known)) {
      routeRules.push({ ...base, ...piece });
    }
    if (!domains.length && !ips.length && !processes.length && (ports || item.network)) {
      routeRules.push(base);
    }
  }

  return {
    log: { level: "warn" },
    dns: {
      servers: [
        singboxDnsServer("local", dns.local, "direct"),
        singboxDnsServer("remote", dns.remote, "proxy"),
      ],
      rules: [
        ...(known.has("geosite-ru") ? [{ rule_set: ["geosite-ru"], server: "local" }] : []),
        { domain_suffix: splitList(dns.suffixes).map(suffixName), server: "local" },
      ],
      final: "remote",
      strategy: dns.strategy,
      independent_cache: true,
    },
    inbounds: [
      mode === "system"
        ? {
            type: "mixed",
            tag: "mixed-in",
            listen: "127.0.0.1",
            listen_port: 2080,
          }
        : {
            type: "tun",
            tag: "tun-in",
            address: [tun.address],
            mtu: tun.mtu,
            auto_route: true,
            strict_route: true,
            stack: "mixed",
            endpoint_independent_nat: true,
            udp_timeout: "10m",
            ...(serverCidr ? { route_exclude_address: [serverCidr] } : {}),
          },
    ],
    outbounds: [proxy, { type: "direct", tag: "direct" }, { type: "block", tag: "block" }],
    route: {
      rule_set: geos.flatMap((source) => {
        const file = bundledRuleFile(source.url);
        if (!file) return [];
        return [{ tag: source.tag, type: "local", format: "binary", path: `rules/${file}` }];
      }),
      rules: routeRules,
      final: "proxy",
      auto_detect_interface: true,
      default_domain_resolver: "local",
      ...(enabled.some((entry) => processNames(entry.processes).length > 0) ? { find_process: true } : {}),
    },
    experimental: {
      clash_api: {
        external_controller: "127.0.0.1:9097",
      },
    },
  };
}

function hostCidr(address: string) {
  const host = address.trim().replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return `${host}/32`;
  if (host.includes(":")) return `${host}/128`;
  return "";
}

function bundledRuleFile(url: string) {
  const file = url.split("/").pop() ?? "";
  const bundled = new Set([
    "geosite-category-ru.srs",
    "geoip-ru.srs",
    "geosite-category-ads-all.srs",
    "geosite-steam.srs",
  ]);
  return bundled.has(file) ? file : "";
}

function linkSecurity(server: Server) {
  const raw = (server.security || "").trim().toLowerCase();
  if (raw === "none") return "none";
  if (raw === "reality" && server.pbk) return "reality";
  if (raw === "tls" || raw === "xtls") return "tls";
  if (server.pbk) return "reality";
  if (server.sni) return "tls";
  return "none";
}

function linkNetwork(server: Server) {
  const raw = (server.network || "tcp").trim().toLowerCase();
  if (raw === "ws" || raw === "grpc") return raw;
  if (raw === "xhttp" || raw === "splithttp") return "xhttp";
  if (raw === "http" || raw === "h2") return "http";
  return "tcp";
}

function alpnList(value?: string) {
  const items = (value || "").split(",").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function singboxTransport(server: Server) {
  const network = linkNetwork(server);
  if (network === "ws") {
    return { type: "ws", path: server.path || "/", headers: server.host ? { Host: server.host } : undefined };
  }
  if (network === "grpc") return { type: "grpc", service_name: server.serviceName || "" };
  return undefined;
}

function xrayStream(server: Server) {
  const security = linkSecurity(server);
  const network = linkNetwork(server);
  const stream: Record<string, unknown> = { network, security };
  if (security === "reality") {
    stream.realitySettings = {
      serverName: server.sni || server.address,
      fingerprint: server.fp || "firefox",
      password: server.pbk,
      publicKey: server.pbk,
      shortId: server.sid,
      spiderX: server.spiderX || "/",
    };
  } else if (security === "tls") {
    stream.tlsSettings = {
      serverName: server.sni || server.address,
      fingerprint: server.fp || "firefox",
      alpn: alpnList(server.alpn),
    };
  }
  if (network === "ws") {
    stream.wsSettings = { path: server.path || "/", headers: server.host ? { Host: server.host } : undefined };
  } else if (network === "grpc") {
    stream.grpcSettings = { serviceName: server.serviceName || "" };
  } else if (network === "xhttp") {
    stream.xhttpSettings = {
      path: server.path || "/",
      host: server.host || undefined,
      mode: server.mode || undefined,
      extra: { scMaxEachPostBytes: 65536, scMinPostsIntervalMs: 30 },
    };
  } else if (network === "http") {
    stream.httpSettings = { path: server.path || "/", host: server.host ? [server.host] : undefined };
  }
  return stream;
}

function xrayDomain(item: string) {
  if (item === "geosite:ru" || item === "geosite:category-ru") return "geosite:category-ru";
  if (/^(keyword:|regexp:|full:|geosite:|geoip:)/.test(item)) return item;
  if (item.startsWith("domain:")) return `domain:${suffixName(item.slice("domain:".length))}`;
  return `domain:${suffixName(item)}`;
}

export function buildXray(input: {
  server: Server | null;
  rules: RouteRule[];
  dns: DnsSettings;
  mode: ConnectMode;
}) {
  const { server, rules, dns } = input;
  const proxy = server
    ? {
        tag: "proxy",
        protocol: "vless",
        settings: {
          vnext: [
            {
              address: server.address,
              port: server.port,
              users: [
                {
                  id: server.uuid,
                  encryption: "none",
                  flow: linkSecurity(server) === "none" ? undefined : server.flow || undefined,
                },
              ],
            },
          ],
        },
        streamSettings: xrayStream(server),
      }
    : { tag: "proxy", protocol: "freedom", settings: { domainStrategy: "UseIPv4" } };

  const routing: Record<string, unknown>[] = [
    {
      type: "field",
      ip: ["10.0.0.0/8", "192.168.0.0/16", "127.0.0.0/8"],
      outboundTag: "direct",
    },
  ];

  for (const item of orderedRules(rules)) {
    const domains = splitList(item.domains).map(xrayDomain);
    const ips = splitList(item.ips);
    const processes = processNames(item.processes);
    const extra: Record<string, unknown> = { type: "field", outboundTag: item.outbound };
    if (item.network) extra.network = item.network;
    const ports = xrayPorts(item.ports);
    if (ports) extra.port = ports;
    if (domains.length) routing.push({ ...extra, domain: domains });
    if (ips.length) routing.push({ ...extra, ip: ips });
    if (processes.length) routing.push({ ...extra, process: processes });
    if (!domains.length && !ips.length && !processes.length && (ports || item.network)) routing.push(extra);
  }

  return {
    log: { loglevel: "info" },
    stats: {},
    policy: {
      system: {
        statsOutboundUplink: true,
        statsOutboundDownlink: true,
      },
    },
    api: { tag: "api", services: ["StatsService"] },
    dns: {
      queryStrategy: dns.strategy === "ipv4_only" ? "UseIPv4" : "UseIP",
      servers: [
        {
          address: dns.local,
          domains: [...splitList(dns.suffixes).map((item) => `domain:${suffixName(item)}`), "geosite:category-ru"],
          skipFallback: true,
        },
        dns.remote,
      ],
    },
    inbounds: [
      {
        tag: "api",
        listen: "127.0.0.1",
        port: 10085,
        protocol: "dokodemo-door",
        settings: { address: "127.0.0.1" },
      },
      {
        tag: "socks",
        listen: "127.0.0.1",
        port: 10808,
        protocol: "socks",
        settings: { udp: true },
        sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
      },
      {
        tag: "http",
        listen: "127.0.0.1",
        port: 10809,
        protocol: "http",
        sniffing: { enabled: true, destOverride: ["http", "tls"] },
      },
    ],
    outbounds: [
      proxy,
      { tag: "direct", protocol: "freedom", settings: { domainStrategy: "UseIPv4" } },
      { tag: "block", protocol: "blackhole", settings: {} },
    ],
    routing: {
      domainStrategy: "AsIs",
      rules: [{ type: "field", inboundTag: ["api"], outboundTag: "api" }, ...routing],
    },
  };
}
