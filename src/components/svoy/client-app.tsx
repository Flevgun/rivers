import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronRight,
  Copy,
  Cpu,
  Gauge,
  Globe,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Route,
  Server,
  Settings2,
  ScrollText,
  Settings,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  buildSingbox,
  buildXray,
  parseMany,
  PRESET_LABEL,
  uid,
  type ConnectMode,
  type CoreName,
  type PresetId,
  type RouteRule,
  type Server as VpnServer,
} from "@/lib/vpn/model";
import { fetchSubscription } from "@/lib/vpn/fetch-sub";
import { probeServer } from "@/lib/vpn/probe";
import { LogsPanel, SettingsPanel } from "@/components/svoy/panels";
import { useVpn } from "@/lib/vpn/store";

type Tab = "home" | "servers" | "routes" | "core" | "geo" | "tun" | "settings" | "logs";

const NAV: { id: Tab; icon: typeof Power }[] = [
  { id: "home", icon: Power },
  { id: "servers", icon: Server },
  { id: "routes", icon: Route },
  { id: "core", icon: Cpu },
  { id: "geo", icon: Globe },
  { id: "tun", icon: Settings2 },
  { id: "logs", icon: ScrollText },
  { id: "settings", icon: Settings },
];

const NAV_TEXT = {
  ru: {
    home: "Связь",
    servers: "Серверы",
    routes: "Маршруты",
    core: "Ядро",
    geo: "Гео",
    tun: "TUN",
    logs: "Логи",
    settings: "Настройки",
  },
  en: {
    home: "Home",
    servers: "Servers",
    routes: "Routes",
    core: "Core",
    geo: "Geo",
    tun: "TUN",
    logs: "Logs",
    settings: "Settings",
  },
} as const;

type RiversBridge = {
  start: (payload: { core: string; mode: string; config: string }) => Promise<{ ok: boolean; error?: string; note?: string }>;
  stop: () => Promise<void>;
};

function useClock(active: boolean, startedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  if (!active || !startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ClientApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [delay, setDelay] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [coreNote, setCoreNote] = useState("");
  const state = useVpn();
  const opened = useRef(false);
  useEffect(() => {
    void useVpn.persist.rehydrate();
    if (opened.current) return;
    opened.current = true;
    useVpn.getState().pushLog("info", "клиент открыт");
  }, []);
  const lang = state.settings?.lang ?? "ru";
  const navText = NAV_TEXT[lang];
  const server = state.servers.find((item) => item.id === state.activeId) ?? null;
  const clock = useClock(state.connected, state.startedAt);
  const generated = useMemo(
    () =>
      state.core === "xray"
        ? buildXray({ server, rules: state.rules, dns: state.dns, mode: state.mode })
        : buildSingbox({
            server,
            rules: state.rules,
            tun: state.tun,
            dns: state.dns,
            geos: state.geos,
            mode: state.mode,
          }),
    [server, state.core, state.mode, state.rules, state.tun, state.dns, state.geos],
  );
  const profile = state.overrides?.[state.core] ?? JSON.stringify(generated, null, 2);

  async function copyProfile() {
    await navigator.clipboard.writeText(profile);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col md:flex-row">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
          <Brand />
          <nav className="mt-8 flex flex-col gap-1">
            {NAV.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                label={navText[item.id]}
                active={tab === item.id}
                onClick={() => setTab(item.id)}
              />
            ))}
          </nav>
        </aside>

        <section className="flex min-h-dvh flex-1 flex-col px-4 pt-5 pb-24 md:px-8 md:pb-8">
          {tab !== "home" && (
            <div className="mb-4 flex items-center justify-between md:hidden">
              <Brand />
              <span className="text-sm text-muted">{state.connected ? clock : "не выбран"}</span>
            </div>
          )}

          {tab === "home" && (
            <Home
              server={server}
              connected={state.connected}
              clock={clock}
              preset={state.preset}
              onPreset={state.applyPreset}
              onToggle={() => {
                void (async () => {
                  if (!server) {
                    setTab("servers");
                    return;
                  }
                  const next = !state.connected;
                  const bridge = (window as unknown as { rivers?: RiversBridge }).rivers;
                  if (!next) {
                    await bridge?.stop();
                    state.setConnected(false);
                    setCoreNote("");
                    state.pushLog("info", "профиль выключен");
                    return;
                  }
                  if (bridge) {
                    const result = await bridge.start({ core: state.core, mode: state.mode, config: profile });
                    if (!result.ok) {
                      const message = result.error || "ядро не запустилось";
                      setCoreNote(message);
                      state.pushLog("error", message);
                      return;
                    }
                    setCoreNote(result.note || "");
                    if (result.note) state.pushLog("info", result.note);
                  }
                  state.setConnected(true);
                  state.pushLog("info", "профиль включён");
                })();
              }}
              mode={state.mode}
              onMode={state.setMode}
              lang={lang}
              note={coreNote}
              testing={testing}
              delay={delay}
              failed={failed}
              onTest={() => {
                if (!server) {
                  setTab("servers");
                  return;
                }
                setTesting(true);
                setFailed(false);
                setDelay(null);
                void probeServer({ data: { host: server.address, port: server.port } })
                  .then((result) => {
                    if (result.ok) {
                      setDelay(result.ms);
                      state.pushLog("info", `${server.name}: ${result.ms} мс`);
                    } else {
                      setFailed(true);
                      state.pushLog("error", `${server.name}: нет ответа`);
                    }
                  })
                  .catch(() => {
                    setFailed(true);
                    state.pushLog("error", `${server.name}: нет ответа`);
                  })
                  .finally(() => setTesting(false));
              }}
            />
          )}
          {tab === "servers" && <Servers />}
          {tab === "routes" && <Routes />}
          {tab === "core" && (
            <Core
              core={state.core}
              profile={profile}
              custom={Boolean(state.overrides?.[state.core])}
              copied={copied}
              onCore={(core) => {
                state.setCore(core);
                state.pushLog("info", `ядро ${core}`);
              }}
              onChange={(text) => state.setOverride(state.core, text)}
              onReset={() => state.setOverride(state.core, null)}
              onCopy={copyProfile}
              mode={state.mode}
            />
          )}
          {tab === "geo" && <Geo />}
          {tab === "tun" && <Tun />}
          {tab === "settings" && <SettingsPanel />}
          {tab === "logs" && <LogsPanel />}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 backdrop-blur md:hidden">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-2 py-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex min-h-11 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl text-xs",
                tab === item.id ? "text-accent" : "text-muted",
              )}
            >
              <item.icon size={18} />
              {navText[item.id]}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img src="/favicon.svg" alt="" className="size-9" />
      <div>
        <div className="text-sm font-semibold tracking-wide">Rivers</div>
        <div className="text-xs text-muted">личный клиент</div>
      </div>
    </div>
  );
}

function NavButton({
  item,
  label,
  active,
  onClick,
}: {
  item: (typeof NAV)[number];
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-left text-sm",
        active ? "bg-raised text-fg" : "text-muted hover:bg-surface",
      )}
    >
      <item.icon size={16} />
      {label}
    </button>
  );
}

function Home({
  server,
  connected,
  clock,
  preset,
  onPreset,
  onToggle,
  mode,
  onMode,
  testing,
  delay,
  failed,
  onTest,
  lang,
  note,
}: {
  server: VpnServer | null;
  connected: boolean;
  clock: string;
  preset: PresetId;
  onPreset: (preset: PresetId) => void;
  onToggle: () => void;
  mode: ConnectMode;
  onMode: (mode: ConnectMode) => void;
  testing: boolean;
  delay: number | null;
  failed: boolean;
  onTest: () => void;
  lang: "ru" | "en";
  note?: string;
}) {
  const en = lang === "en";
  const presets: Record<PresetId, string> = en
    ? { "all-proxy": "All via proxy", "ru-direct": "RU direct", games: "Games and RU", custom: "Custom" }
    : PRESET_LABEL;
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start justify-between">
        <button
          type="button"
          aria-label="Проверить сервер"
          onClick={onTest}
          disabled={testing}
          className={cn(
            "grid size-11 place-items-center rounded-full bg-raised",
            failed ? "text-danger" : "text-muted",
          )}
        >
          {testing ? <Loader2 size={18} className="animate-spin" /> : <Gauge size={18} />}
        </button>
        <div className="text-right font-mono text-sm leading-5">
          <div>{delay != null ? `${delay} мс` : "—"}</div>
          <div className="text-muted">↓ —</div>
          <div className="text-muted">↑ —</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-6">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={connected}
          className={cn(
            "grid size-44 place-items-center rounded-full border-2 transition duration-200",
            connected
              ? "border-accent bg-accent text-accent-ink orb-on"
              : "border-line bg-surface text-fg hover:border-muted",
          )}
        >
          <Power size={52} strokeWidth={1.6} />
        </button>
        <p className="mt-6 text-lg font-semibold">{connected ? (en ? "Profile on" : "Профиль включён") : en ? "Off" : "Выключен"}</p>
        <p className="mt-1 max-w-md text-center text-sm text-muted">{server ? server.name : en ? "Add a server first" : "Сначала добавь сервер"}</p>
        {note ? (
          <p className={cn("mt-2 max-w-md text-center text-sm", connected ? "text-muted" : "text-danger")}>{note}</p>
        ) : null}
        <div className="mt-3 grid w-full max-w-xs grid-cols-2 gap-2">
          {(
            [
              ["tun", "TUN"],
              ["system", en ? "System proxy" : "Системный прокси"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onMode(id)}
              className={cn(
                "min-h-11 rounded-full px-3 text-sm",
                mode === id ? "bg-accent text-accent-ink" : "bg-raised text-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-6 text-center text-sm">
          <Stat label="сессия" value={connected ? clock : "—"} />
          <Stat label="порт" value={server ? String(server.port) : "—"} />
          <Stat label="отпеч." value={server?.fp || "—"} />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {(Object.keys(PRESET_LABEL) as PresetId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPreset(id)}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm",
              preset === id ? "bg-accent text-accent-ink" : "bg-raised text-muted",
            )}
          >
            {presets[id]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-base font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Servers() {
  const { servers, subscriptions, activeId, selectServer, addServers, removeServer, saveSubscription, removeSubscription } =
    useVpn();
  const [open, setOpen] = useState<"link" | "sub" | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  function close() {
    setOpen(null);
    setText("");
    setName("");
    setError("");
  }

  function importLinks() {
    const parsed = parseMany(text);
    if (!parsed.length) {
      setError("Нужна ссылка vless://");
      return;
    }
    addServers(parsed);
    close();
  }

  async function pull(url: string, id: string, title: string) {
    setBusy(id);
    setError("");
    try {
      const result = await fetchSubscription({ data: { url } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const parsed = parseMany(result.text).map((server) => ({ ...server, subId: id }));
      if (!parsed.length) {
        setError("В подписке нет VLESS-ссылок.");
        return;
      }
      saveSubscription({ id, name: title, url, updatedAt: Date.now() }, parsed);
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "не удалось скачать");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <Header title="Серверы" hint="Одна ссылка или подписка с панели. Обновление подтягивает список заново." />
      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setError("");
            setOpen("sub");
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
        >
          <Plus size={16} />
          Подписка
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setOpen("link");
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-raised px-4 text-sm"
        >
          Ссылка
        </button>
      </div>

      {subscriptions.length === 0 && servers.length === 0 && (
        <Empty text="Пока пусто. Подписка с панели или одна ссылка vless." />
      )}

      <div className="flex flex-col gap-4">
        {subscriptions.map((sub) => {
          const inside = servers.filter((server) => server.subId === sub.id);
          return (
            <section key={sub.id} className="overflow-hidden rounded-card border border-line bg-surface">
              <div className="flex items-center gap-2 bg-raised px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs tracking-wide text-accent">подписка</div>
                  <div className="truncate font-semibold">{sub.name}</div>
                  <div className="truncate text-xs text-muted">
                    {inside.length} {serverWord(inside.length)}
                    {sub.updatedAt ? ` · ${new Date(sub.updatedAt).toLocaleString("ru-RU")}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Обновить"
                  disabled={busy === sub.id}
                  onClick={() => pull(sub.url, sub.id, sub.name)}
                  className="grid size-11 place-items-center rounded-full text-muted"
                >
                  <RefreshCw size={16} className={busy === sub.id ? "animate-spin" : ""} />
                </button>
                <button
                  type="button"
                  aria-label="Удалить подписку"
                  onClick={() => removeSubscription(sub.id)}
                  className="grid size-11 place-items-center rounded-full text-muted hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {inside.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">В этой подписке серверов нет.</p>
              ) : (
                <ul>
                  {inside.map((server) => (
                    <li key={server.id} className="border-t border-line">
                      <button
                        type="button"
                        onClick={() => selectServer(server.id)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 px-4 text-left",
                          server.id === activeId && "bg-bg",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            server.id === activeId ? "bg-accent" : "bg-line",
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{server.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {server.address}:{server.port}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {servers.some((server) => !server.subId) && (
          <section className="overflow-hidden rounded-card border border-line bg-surface">
            <div className="bg-raised px-4 py-3">
              <div className="text-xs tracking-wide text-muted">вручную</div>
              <div className="font-semibold">Отдельные ссылки</div>
            </div>
            <ul>
              {servers
                .filter((server) => !server.subId)
                .map((server) => (
                  <li key={server.id} className="flex items-center border-t border-line">
                    <button
                      type="button"
                      onClick={() => selectServer(server.id)}
                      className={cn(
                        "flex min-h-14 flex-1 items-center gap-3 px-4 text-left",
                        server.id === activeId && "bg-bg",
                      )}
                    >
                      <span
                        className={cn("size-2 shrink-0 rounded-full", server.id === activeId ? "bg-accent" : "bg-line")}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{server.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {server.address}:{server.port}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Удалить"
                      onClick={() => removeServer(server.id)}
                      className="grid size-11 place-items-center rounded-full text-muted hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        )}
      </div>
      {error && !open && <p className="mt-3 text-sm text-danger">{error}</p>}

      {open && (
        <div className="fixed inset-0 z-20 grid place-items-end bg-bg/70 p-4 md:place-items-center">
          <div className="w-full max-w-lg rounded-card border border-line bg-surface p-4">
            <h2 className="text-lg font-semibold">{open === "sub" ? "Подписка" : "Ссылка"}</h2>
            {open === "sub" ? (
              <>
                <Field label="название" value={name} onChange={setName} />
                <Field label="ссылка подписки" value={text} onChange={setText} />
              </>
            ) : (
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="vless://..."
                className="mt-3 h-36 w-full resize-none rounded-2xl border border-line bg-bg p-3 font-mono text-sm outline-none"
              />
            )}
            {error && <p className="mt-2 text-sm text-danger">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={close} className="min-h-11 rounded-full px-4 text-sm text-muted">
                Отмена
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  if (open === "link") importLinks();
                  else {
                    const title = name.trim() || safeHost(text);
                    void pull(text, uid(), title);
                  }
                }}
                className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink"
              >
                {busy ? "Качаю" : "Добавить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function serverWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "сервер";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сервера";
  return "серверов";
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Подписка";
  }
}

const OUTBOUND_LABEL = { direct: "напрямую", proxy: "прокси", block: "блок" } as const;

function ruleHint(rule: RouteRule) {
  const chunk = [rule.domains, rule.processes, rule.ips, rule.ports].find((value) => value.trim());
  if (!chunk) return "без условий";
  const first = chunk.split(/[\s,;]+/).filter(Boolean)[0] ?? "";
  const extra = chunk.split(/[\s,;]+/).filter(Boolean).length - 1;
  return extra > 0 ? `${first} +${extra}` : first;
}

function Routes() {
  const { rules, updateRule, addRule } = useVpn();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div>
      <Header title="Маршруты" hint="Нажми строку, чтобы поправить. Остальное уходит в прокси." />
      <ul className="overflow-hidden rounded-card border border-line bg-surface">
        {rules.map((rule, index) => {
          const open = openId === rule.id;
          return (
            <li key={rule.id} className={index > 0 ? "border-t border-line" : ""}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : rule.id)}
                className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
              >
                <span className={cn("size-2 shrink-0 rounded-full", rule.enabled ? "bg-accent" : "bg-line")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm font-semibold", !rule.enabled && "text-muted")}>
                    {rule.label}
                  </span>
                  <span className="block truncate text-xs text-muted">{ruleHint(rule)}</span>
                </span>
                <span className="text-xs text-muted">{OUTBOUND_LABEL[rule.outbound]}</span>
                <ChevronRight size={16} className={cn("shrink-0 text-muted transition", open && "rotate-90")} />
              </button>
              {open && (
                <div className="px-4 pb-4">
                  <div className="mb-2 flex gap-2">
                    {(["direct", "proxy", "block"] as const).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => updateRule(rule.id, { outbound: tag })}
                        className={cn(
                          "min-h-11 flex-1 rounded-full text-sm",
                          rule.outbound === tag ? "bg-accent text-accent-ink" : "bg-raised text-muted",
                        )}
                      >
                        {OUTBOUND_LABEL[tag]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => updateRule(rule.id, { enabled: !rule.enabled })}
                    className="mb-1 min-h-11 text-sm text-accent"
                  >
                    {rule.enabled ? "Выключить" : "Включить"}
                  </button>
                  <Field label="название" value={rule.label} onChange={(label) => updateRule(rule.id, { label })} />
                  <Field label="домены" value={rule.domains} onChange={(domains) => updateRule(rule.id, { domains })} />
                  <Field label="ip" value={rule.ips} onChange={(ips) => updateRule(rule.id, { ips })} />
                  <Field
                    label="процессы"
                    value={rule.processes}
                    onChange={(processes) => updateRule(rule.id, { processes })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={addRule} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-accent">
        <Plus size={16} />
        Правило
      </button>
    </div>
  );
}

function Geo() {
  const { geos, updateGeo, addGeo, markGeo } = useVpn();
  return (
    <div>
      <Header
        title="Геоданные"
        hint="Наборы sing-box с GitHub. Ядро скачивает .srs само, раз в выбранный срок."
      />
      <ul className="flex flex-col gap-2">
        {geos.map((source) => (
          <li key={source.id} className="rounded-card border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <input
                value={source.name}
                onChange={(event) => updateGeo(source.id, { name: event.target.value })}
                className="min-h-11 flex-1 bg-transparent font-semibold outline-none"
              />
              <select
                value={source.everyHours}
                onChange={(event) => updateGeo(source.id, { everyHours: Number(event.target.value) })}
                className="min-h-11 rounded-full bg-raised px-3 text-sm"
              >
                <option value={12}>12 ч</option>
                <option value={24}>сутки</option>
                <option value={168}>неделя</option>
              </select>
            </div>
            <Field label="url" value={source.url} onChange={(url) => updateGeo(source.id, { url })} />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>
                {source.updatedAt
                  ? `отметка ${new Date(source.updatedAt).toLocaleString("ru-RU")}`
                  : "ещё не отмечался"}
              </span>
              <button type="button" onClick={() => markGeo(source.id)} className="min-h-11 text-sm text-accent">
                Отметить обновление
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={addGeo} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-accent">
        <Plus size={16} />
        Источник
      </button>
    </div>
  );
}

function Core({
  core,
  profile,
  custom,
  copied,
  onCore,
  onChange,
  onReset,
  onCopy,
  mode,
}: {
  core: CoreName;
  profile: string;
  custom: boolean;
  copied: boolean;
  onCore: (core: CoreName) => void;
  onChange: (text: string) => void;
  onReset: () => void;
  onCopy: () => void;
  mode: ConnectMode;
}) {
  const broken = useMemo(() => {
    try {
      JSON.parse(profile);
      return false;
    } catch {
      return true;
    }
  }, [profile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Header
        title="Ядро"
        hint={
          core === "xray"
            ? mode === "tun"
              ? "Режим TUN. Xray слушает SOCKS 127.0.0.1:10808, туннель вокруг него поднимает клиент на компьютере."
              : "Системный прокси: HTTP 127.0.0.1:10809 и SOCKS 10808."
            : mode === "tun"
              ? "Режим TUN: sing-box забирает весь трафик в интерфейс."
              : "Системный прокси 127.0.0.1:2080. Игры и программы вне прокси его не увидят."
        }
      />
      <div className="mb-3 grid grid-cols-2 gap-2">
        {(["xray", "sing-box"] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onCore(name)}
            className={cn(
              "min-h-11 rounded-full text-sm font-semibold",
              core === name ? "bg-accent text-accent-ink" : "bg-raised text-muted",
            )}
          >
            {name === "xray" ? "Xray" : "sing-box"}
          </button>
        ))}
      </div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{custom ? "свой конфиг" : "собран из настроек"}</span>
        <div className="flex gap-2">
          <button type="button" onClick={onReset} className="min-h-11 rounded-full px-3 text-sm text-muted">
            Собрать заново
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-raised px-4 text-sm"
          >
            <Copy size={14} />
            {copied ? "Скопировано" : "Копировать"}
          </button>
        </div>
      </div>
      {broken && <p className="mb-2 text-sm text-danger">Это уже не JSON. Ядро такой файл не прочитает.</p>}
      <textarea
        value={profile}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="no-scrollbar min-h-80 w-full flex-1 resize-none rounded-card border border-line bg-surface p-4 font-mono text-xs leading-5 outline-none"
      />
    </div>
  );
}

function Tun() {
  const { tun, dns, mode, setTun, setDns } = useVpn();
  return (
    <div className="flex flex-col gap-3">
      <Header
        title="TUN и DNS"
        hint={
          mode === "tun"
            ? "Эти поля попадают в TUN. Служебный адрес туннеля в direct не уходит."
            : "Сейчас включён системный прокси. MTU и стек применятся, когда переключишься на TUN."
        }
      />
      <Card>
        <Row label="MTU">
          <select
            value={tun.mtu}
            onChange={(event) => setTun({ mtu: Number(event.target.value) })}
            className="min-h-11 rounded-full bg-raised px-3 text-sm"
          >
            <option value={1500}>1500</option>
            <option value={1400}>1400</option>
            <option value={1280}>1280</option>
          </select>
        </Row>
        <Row label="Стек">
          <select
            value={tun.stack}
            onChange={(event) => setTun({ stack: event.target.value as typeof tun.stack })}
            className="min-h-11 rounded-full bg-raised px-3 text-sm"
          >
            <option value="mixed">mixed</option>
            <option value="system">system</option>
            <option value="gvisor">gvisor</option>
          </select>
        </Row>
        <Toggle label="Автомаршрут" on={tun.autoRoute} set={(autoRoute) => setTun({ autoRoute })} />
        <Toggle label="Строгий маршрут" on={tun.strictRoute} set={(strictRoute) => setTun({ strictRoute })} />
        <Toggle label="IPv6" on={tun.ipv6} set={(ipv6) => setTun({ ipv6 })} />
        <Toggle label="Sniff" on={tun.sniff} set={(sniff) => setTun({ sniff })} />
        <Field label="адрес TUN" value={tun.address} onChange={(address) => setTun({ address })} />
        <Field label="DNS hijack" value={tun.dnsHijack} onChange={(dnsHijack) => setTun({ dnsHijack })} />
      </Card>
      <Card>
        <Field label="локальный DNS" value={dns.local} onChange={(local) => setDns({ local })} />
        <Field label="удалённый DNS" value={dns.remote} onChange={(remote) => setDns({ remote })} />
        <Field label="суффиксы напрямую" value={dns.suffixes} onChange={(suffixes) => setDns({ suffixes })} />
        <Row label="Стратегия">
          <select
            value={dns.strategy}
            onChange={(event) => setDns({ strategy: event.target.value as typeof dns.strategy })}
            className="min-h-11 rounded-full bg-raised px-3 text-sm"
          >
            <option value="ipv4_only">только IPv4</option>
            <option value="prefer_ipv4">сначала IPv4</option>
          </select>
        </Row>
      </Card>
    </div>
  );
}

function Header({ title, hint }: { title: string; hint: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-xl text-sm leading-5 text-muted">{hint}</p>
    </header>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-card border border-dashed border-line px-4 py-8 text-sm text-muted">{text}</p>;
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-card border border-line bg-surface p-4">{children}</div>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => set(!on)} className="flex min-h-12 w-full items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <span className={cn("h-7 w-12 rounded-full p-1 transition", on ? "bg-accent" : "bg-raised")}>
        <span className={cn("block size-5 rounded-full bg-fg transition", on && "translate-x-5 bg-accent-ink")} />
      </span>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-2 block">
      <span className="text-xs text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-2xl border border-line bg-bg px-3 text-sm outline-none"
      />
    </label>
  );
}
