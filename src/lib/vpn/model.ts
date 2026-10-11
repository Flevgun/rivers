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
    stack: "mixed",
    autoRoute: true,
    strictRoute: true,
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
      url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-ru.srs",
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
      tag: "geosite-ads",
      url: "https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-category-ads-all.srs",
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
      rule("ARC Raiders", "direct", { processes: "PioneerGame.exe" }),
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
      pbk: query.get("pbk") || "",
      sid: query.get("sid") || "",
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

function domainRule(domains: string[]) {
  const set = domains.filter((item) => item.startsWith("geosite:") || item.startsWith("rule-set:"));
  const plain = domains.filter((item) => !item.startsWith("geosite:") && !item.startsWith("rule-set:"));
  const rules = [];
  if (plain.length) rules.push({ domain: plain });
  if (set.length) rules.push({ rule_set: set.map((item) => item.split(":")[1] || item) });
  return rules;
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
        flow: server.flow || undefined,
        tls: {
          enabled: true,
          server_name: server.sni,
          utls: { enabled: true, fingerprint: server.fp || "firefox" },
          reality: {
            enabled: true,
            public_key: server.pbk,
            short_id: server.sid,
          },
        },
      }
    : { type: "direct", tag: "proxy" };

  const routeRules = [];
  if (tun.sniff) {
    routeRules.push({ action: "sniff" });
  }
  routeRules.push({
    ip_cidr: ["10.0.0.0/8", "192.168.0.0/16", "127.0.0.0/8"],
    outbound: "direct",
  });

  for (const item of rules.filter((entry) => entry.enabled)) {
    const domains = splitList(item.domains);
    const ips = splitList(item.ips);
    const processes = splitList(item.processes);
    const base: Record<string, unknown> = { outbound: item.outbound };
    if (item.network) base.network = item.network;
    if (item.ports) base.port = splitList(item.ports).map((port) => Number(port) || port);
    if (processes.length) {
      routeRules.push({ ...base, process_name: processes });
    }
    if (ips.length) {
      routeRules.push({ ...base, ip_cidr: ips.filter((ip) => !ip.startsWith("geoip:")) });
      const sets = ips.filter((ip) => ip.startsWith("geoip:")).map((ip) => ip.slice(6));
      if (sets.length) routeRules.push({ ...base, rule_set: sets.map((name) => `geoip-${name}`) });
    }
    for (const piece of domainRule(domains)) {
      routeRules.push({ ...base, ...piece });
    }
    if (!domains.length && !ips.length && !processes.length && (item.ports || item.network)) {
      routeRules.push(base);
    }
  }

  return {
    log: { level: "info" },
    dns: {
      servers: [
        { tag: "local", address: dns.local, detour: "direct" },
        { tag: "remote", address: dns.remote, detour: "proxy" },
      ],
      rules: [{ domain_suffix: splitList(dns.suffixes), server: "local" }],
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
            set_system_proxy: true,
          }
        : {
            type: "tun",
            tag: "tun-in",
            address: [tun.address],
            mtu: tun.mtu,
            auto_route: tun.autoRoute,
            strict_route: tun.strictRoute,
            stack: tun.stack,
            inet6_address: tun.ipv6 ? "fdfe:dcba:9876::1/126" : undefined,
          },
    ],
    outbounds: [proxy, { type: "direct", tag: "direct" }, { type: "block", tag: "block" }],
    route: {
      rule_set: geos
        .filter((source) => source.url.endsWith(".srs"))
        .map((source) => ({
          tag: source.tag,
          type: "remote",
          format: "binary",
          url: source.url,
          download_detour: "direct",
          update_interval: `${source.everyHours}h`,
        })),
      rules: routeRules,
      final: "proxy",
      auto_detect_interface: true,
    },
  };
}

function xrayDomain(item: string) {
  if (/^(geosite:|domain:|full:|keyword:|regexp:)/.test(item)) return item;
  return `domain:${item.replace(/^\./, "")}`;
}

export function buildXray(input: {
  server: Server | null;
  rules: RouteRule[];
  dns: DnsSettings;
  mode: ConnectMode;
}) {
  const { server, rules, dns, mode } = input;
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
                  flow: server.flow || undefined,
                },
              ],
            },
          ],
        },
        streamSettings: {
          network: "tcp",
          security: "reality",
          realitySettings: {
            serverName: server.sni,
            fingerprint: server.fp || "firefox",
            publicKey: server.pbk,
            shortId: server.sid,
            spiderX: "/",
          },
        },
      }
    : { tag: "proxy", protocol: "freedom", settings: { domainStrategy: "UseIPv4" } };

  const routing: Record<string, unknown>[] = [
    {
      type: "field",
      ip: ["10.0.0.0/8", "192.168.0.0/16", "127.0.0.0/8"],
      outboundTag: "direct",
    },
  ];

  for (const item of rules.filter((entry) => entry.enabled)) {
    const domains = splitList(item.domains);
    const ips = splitList(item.ips);
    const processes = splitList(item.processes);
    const rule: Record<string, unknown> = { type: "field", outboundTag: item.outbound };
    if (domains.length) rule.domain = domains.map(xrayDomain);
    if (ips.length) rule.ip = ips;
    if (processes.length) rule.process = processes;
    if (item.network) rule.network = item.network;
    if (item.ports) rule.port = splitList(item.ports).join(",");
    if (domains.length || ips.length || processes.length || item.network || item.ports) routing.push(rule);
  }

  return {
    log: { loglevel: "warning" },
    dns: {
      queryStrategy: dns.strategy === "ipv4_only" ? "UseIPv4" : "UseIP",
      servers: [
        {
          address: dns.local,
          domains: splitList(dns.suffixes).map((item) => `domain:${item.replace(/^\./, "")}`),
          skipFallback: true,
        },
        dns.remote,
      ],
    },
    inbounds:
      mode === "system"
        ? [
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
          ]
        : [
            {
              tag: "socks",
              listen: "127.0.0.1",
              port: 10808,
              protocol: "socks",
              settings: { udp: true },
              sniffing: { enabled: true, destOverride: ["http", "tls", "quic"], routeOnly: true },
            },
          ],
    outbounds: [
      proxy,
      { tag: "direct", protocol: "freedom", settings: { domainStrategy: "UseIPv4" } },
      { tag: "block", protocol: "blackhole", settings: {} },
    ],
    routing: { domainStrategy: "IPIfNonMatch", rules: routing },
  };
}
