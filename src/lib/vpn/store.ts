import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultDns,
  defaultGeos,
  defaultTun,
  rulesFor,
  type ConnectMode,
  type CoreName,
  type DnsSettings,
  type GeoSource,
  type PresetId,
  type RouteRule,
  type Server,
  type Subscription,
  type TunSettings,
} from "./model";

type State = {
  servers: Server[];
  subscriptions: Subscription[];
  activeId: string | null;
  connected: boolean;
  startedAt: number | null;
  preset: PresetId;
  rules: RouteRule[];
  geos: GeoSource[];
  tun: TunSettings;
  dns: DnsSettings;
  core: CoreName;
  mode: ConnectMode;
  overrides: Record<CoreName, string | null>;
  settings: {
    autostart: boolean;
    tray: boolean;
    lang: "ru" | "en";
    email: string;
    telegram: string;
  };
  stats: { sent: number; recv: number; days: { day: string; sent: number; recv: number }[] };
  logs: { id: string; at: number; level: "info" | "error"; text: string }[];
  setCore: (core: CoreName) => void;
  setMode: (mode: ConnectMode) => void;
  setOverride: (core: CoreName, text: string | null) => void;
  setSetting: (patch: Partial<State["settings"]>) => void;
  pushLog: (level: "info" | "error", text: string) => void;
  clearLogs: () => void;
  setConnected: (on: boolean) => void;
  selectServer: (id: string) => void;
  addServers: (items: Server[]) => void;
  removeServer: (id: string) => void;
  saveSubscription: (sub: Subscription, items: Server[]) => void;
  removeSubscription: (id: string) => void;
  applyPreset: (preset: PresetId) => void;
  updateRule: (id: string, patch: Partial<RouteRule>) => void;
  addRule: () => void;
  updateGeo: (id: string, patch: Partial<GeoSource>) => void;
  addGeo: () => void;
  markGeo: (id: string) => void;
  setTun: (patch: Partial<TunSettings>) => void;
  setDns: (patch: Partial<DnsSettings>) => void;
};

function emptyWeek() {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    days.push({ day: `${date.getFullYear()}-${month}-${day}`, sent: 0, recv: 0 });
  }
  return days;
}

export const useVpn = create<State>()(
  persist(
    (set) => ({
      servers: [],
      subscriptions: [],
      activeId: null,
      connected: false,
      startedAt: null,
      preset: "games",
      rules: rulesFor("games"),
      geos: defaultGeos(),
      tun: defaultTun(),
      dns: defaultDns(),
      core: "xray",
      mode: "tun",
      overrides: { xray: null, "sing-box": null },
      settings: { autostart: false, tray: true, lang: "ru", email: "", telegram: "" },
      stats: { sent: 0, recv: 0, days: emptyWeek() },
      logs: [],
      setCore: (core) => set({ core }),
      setMode: (mode) => set({ mode }),
      setOverride: (core, text) =>
        set((state) => ({ overrides: { ...state.overrides, [core]: text } })),
      setSetting: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      pushLog: (level, text) =>
        set((state) => ({
          logs: [{ id: Math.random().toString(36).slice(2, 10), at: Date.now(), level, text }, ...state.logs].slice(0, 300),
        })),
      clearLogs: () => set({ logs: [] }),
      setConnected: (on) =>
        set({ connected: on, startedAt: on ? Date.now() : null }),
      selectServer: (id) => set({ activeId: id }),
      addServers: (items) =>
        set((state) => ({
          servers: [...items, ...state.servers],
          activeId: state.activeId ?? items[0]?.id ?? null,
        })),
      removeServer: (id) =>
        set((state) => ({
          servers: state.servers.filter((server) => server.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
          connected: state.activeId === id ? false : state.connected,
        })),
      saveSubscription: (sub, items) =>
        set((state) => {
          const kept = state.servers.filter((server) => server.subId !== sub.id);
          const activeKept = kept.some((server) => server.id === state.activeId);
          const activeWasHere = state.servers.some(
            (server) => server.id === state.activeId && server.subId === sub.id,
          );
          const known = state.subscriptions.some((item) => item.id === sub.id);
          return {
            subscriptions: known
              ? state.subscriptions.map((item) => (item.id === sub.id ? sub : item))
              : [sub, ...state.subscriptions],
            servers: [...items, ...kept],
            activeId: activeKept ? state.activeId : activeWasHere || !state.activeId ? (items[0]?.id ?? null) : state.activeId,
            connected: activeKept || !activeWasHere ? state.connected : false,
          };
        }),
      removeSubscription: (id) =>
        set((state) => {
          const servers = state.servers.filter((server) => server.subId !== id);
          return {
            subscriptions: state.subscriptions.filter((item) => item.id !== id),
            servers,
            activeId: servers.some((server) => server.id === state.activeId) ? state.activeId : null,
            connected: servers.some((server) => server.id === state.activeId) ? state.connected : false,
          };
        }),
      applyPreset: (preset) => set({ preset, rules: rulesFor(preset) }),
      updateRule: (id, patch) =>
        set((state) => ({
          preset: "custom",
          rules: state.rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
        })),
      addRule: () =>
        set((state) => ({
          preset: "custom",
          rules: [
            ...state.rules,
            {
              id: Math.random().toString(36).slice(2, 10),
              label: "Новое правило",
              enabled: true,
              outbound: "direct",
              domains: "",
              ips: "",
              processes: "",
              ports: "",
              network: "",
            },
          ],
        })),
      updateGeo: (id, patch) =>
        set((state) => ({
          geos: state.geos.map((source) => (source.id === id ? { ...source, ...patch } : source)),
        })),
      addGeo: () =>
        set((state) => ({
          geos: [
            ...state.geos,
            {
              id: Math.random().toString(36).slice(2, 10),
              name: "Свой набор",
              tag: "custom-set",
              url: "https://github.com/",
              everyHours: 24,
              updatedAt: null,
            },
          ],
        })),
      markGeo: (id) =>
        set((state) => ({
          geos: state.geos.map((source) =>
            source.id === id ? { ...source, updatedAt: Date.now() } : source,
          ),
        })),
      setTun: (patch) => set((state) => ({ tun: { ...state.tun, ...patch } })),
      setDns: (patch) => set((state) => ({ dns: { ...state.dns, ...patch } })),
    }),
    {
      name: "svoy-client",
      skipHydration: true,
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...saved,
          core: saved.core ?? current.core,
          mode: saved.mode ?? current.mode,
          settings: { ...current.settings, ...saved.settings },
          stats: saved.stats ?? current.stats,
          logs: saved.logs ?? current.logs,
          overrides: { ...current.overrides, ...saved.overrides },
          tun: { ...current.tun, ...saved.tun },
          dns: { ...current.dns, ...saved.dns },
        };
      },
    },
  ),
);
