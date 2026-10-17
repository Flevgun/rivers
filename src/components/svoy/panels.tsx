import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";
import { cn } from "@/lib/cn";
import { useVpn } from "@/lib/vpn/store";

const APP_VERSION = "1.5.28";
const CORE_VERSION = { xray: "Xray", "sing-box": "sing-box 1.12.12" } as const;

function bytes(value: number) {
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(2)} МБ`;
}

function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function SettingsPanel() {
  const { settings, stats, core, setSetting } = useVpn();
  const lang = settings?.lang ?? "ru";
  const en = lang === "en";
  const device = useDevice();
  const [chart, setChart] = useState(false);
  const [updateNote, setUpdateNote] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");
  useEffect(() => setChart(true), []);

  const week = useMemo(() => {
    const names = en ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
    return (stats?.days ?? []).map((item) => {
      const date = new Date(`${item.day}T00:00:00`);
      return { name: names[date.getDay()] ?? item.day.slice(5), sent: item.sent };
    });
  }, [en, stats?.days]);

  const today = stats?.days?.find((item) => item.day === todayKey());

  return (
    <div className="flex flex-col gap-3">
      <header className="mb-1">
        <h1 className="text-2xl font-semibold tracking-tight">{en ? "Settings" : "Настройки"}</h1>
      </header>

      <section className="rounded-card border border-line bg-surface p-4">
        <Switch
          label={en ? "Start with the system" : "Автозапуск с системой"}
          on={settings.autostart}
          set={(autostart) => setSetting({ autostart })}
        />
        <Switch
          label={en ? "Minimize to tray" : "Сворачивать в трей"}
          on={settings.tray}
          set={(tray) => {
            setSetting({ tray });
            void (window as unknown as { rivers?: { setTray?: (on: boolean) => void } }).rivers?.setTray?.(tray);
          }}
        />
        <button
          type="button"
          onClick={() => {
            void (window as unknown as { rivers?: { elevate?: () => Promise<{ ok?: boolean; error?: string }> } }).rivers
              ?.elevate?.()
              .then((result) => {
                if (result && result.ok === false) setUpdateNote(result.error || (en ? "Cancelled" : "Отменено"));
              });
          }}
          className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-sm">{en ? "Run as administrator" : "Запуск от администратора"}</span>
          <span className="text-sm text-accent">{en ? "Restart" : "Перезапустить"}</span>
        </button>
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-sm">{en ? "Theme" : "Тема"}</span>
          <div className="flex flex-wrap justify-end gap-2">
            {(
              [
                ["mint", en ? "Mint" : "Мята"],
                ["night", en ? "Night" : "Ночь"],
                ["paper", en ? "Paper" : "Бумага"],
                ["amber", en ? "Amber" : "Янтарь"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSetting({ theme: id })}
                className={cn(
                  "min-h-11 rounded-full px-3 text-sm",
                  (settings.theme ?? "mint") === id ? "bg-accent text-accent-ink" : "bg-raised text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className="text-sm">{en ? "Language" : "Язык"}</span>
          <div className="flex gap-2">
            {(
              [
                ["ru", "Русский"],
                ["en", "English"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSetting({ lang: id })}
                className={cn(
                  "min-h-11 rounded-full px-3 text-sm",
                  lang === id ? "bg-accent text-accent-ink" : "bg-raised text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">{en ? "Traffic" : "Статистика"}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label={en ? "Sent today" : "Отправлено сегодня"} value={bytes(today?.sent ?? 0)} />
          <Stat label={en ? "Received today" : "Получено сегодня"} value={bytes(today?.recv ?? 0)} />
          <Stat label={en ? "Sent total" : "Отправлено всего"} value={bytes(stats?.sent ?? 0)} />
          <Stat label={en ? "Received total" : "Получено всего"} value={bytes(stats?.recv ?? 0)} />
        </div>
        <p className="mt-4 text-xs text-muted">{en ? "Week" : "За неделю"}</p>
        <div className="mt-2 h-36">
          {chart && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week}>
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Bar dataKey="sent" fill="var(--color-accent)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-card border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">{en ? "About" : "О приложении"}</h2>
        <Row label={en ? "Version" : "Версия"} value={APP_VERSION} />
        <button
          type="button"
          onClick={() => {
            const bridge = (window as unknown as {
              rivers?: {
                latestRelease?: () => Promise<{ newer?: boolean; latest?: string; url?: string }>;
                openRelease?: (url: string) => Promise<boolean>;
              };
            }).rivers;
            if (updateUrl) {
              void bridge?.openRelease?.(updateUrl);
              return;
            }
            setUpdateNote(en ? "Checking…" : "Проверяю…");
            void bridge
              ?.latestRelease?.()
              .then((info) => {
                if (!info?.newer || !info.url) {
                  setUpdateNote(en ? "This is the latest version" : "Уже последняя версия");
                  return;
                }
                setUpdateUrl(info.url);
                setUpdateNote(en ? `Open ${info.latest}` : `Открыть ${info.latest}`);
              })
              .catch(() => setUpdateNote(en ? "Could not check" : "Не удалось проверить"));
          }}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-sm text-muted">{en ? "Update" : "Обновление"}</span>
          <span className="text-sm text-accent">{updateNote || (en ? "Check" : "Проверить")}</span>
        </button>
        <Row label={en ? "Core" : "Ядро"} value={CORE_VERSION[core]} />
        <Row label={en ? "System" : "Система"} value={device.system} />
        <Row label={en ? "Architecture" : "Архитектура"} value={device.arch} />
        <a
          href="mailto:Flevgun@gmail.com"
          className="flex min-h-11 items-center justify-between gap-3"
          onClick={(event) => {
            event.preventDefault();
            window.location.href = "mailto:Flevgun@gmail.com";
          }}
        >
          <span className="text-sm text-muted">Email</span>
          <span className="text-sm text-accent">Flevgun@gmail.com</span>
        </a>
        <a
          href="https://t.me/flevgun"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center justify-between gap-3"
          onClick={(event) => {
            event.preventDefault();
            window.open("https://t.me/flevgun", "_blank", "noopener,noreferrer");
          }}
        >
          <span className="text-sm text-muted">Telegram</span>
          <span className="text-sm text-accent">@flevgun</span>
        </a>
      </section>
    </div>
  );
}

export function LogsPanel() {
  const { logs, clearLogs, settings } = useVpn();
  const en = settings?.lang === "en";
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const shown = logs.filter((entry) => {
    if (errorsOnly && entry.level !== "error") return false;
    if (query && !entry.text.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  async function copyLogs() {
    const text = formatLogs(shown);
    const bridge = (window as unknown as { rivers?: { copyText?: (value: string) => Promise<{ mode?: string }> } }).rivers;
    let mode = "text";
    if (bridge?.copyText) {
      const result = await bridge.copyText(text);
      mode = result?.mode || "text";
    } else {
      await navigator.clipboard.writeText(text);
    }
    setNotice(mode === "file" ? (en ? "File is on the clipboard" : "В буфере файл") : en ? "Copied" : "Скопировано");
    window.setTimeout(() => setNotice(""), 1600);
  }

  return (
    <div>
      <header className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-between gap-3 bg-bg py-2">
        <h1 className="text-2xl font-semibold tracking-tight">{en ? "Logs" : "Логи"}</h1>
        <div className="flex flex-1 items-center justify-end gap-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={en ? "Filter" : "Фильтр"}
            className="min-h-11 w-40 rounded-full bg-raised px-4 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setErrorsOnly((value) => !value)}
            className={cn("min-h-11 rounded-full px-3 text-sm", errorsOnly ? "bg-accent text-accent-ink" : "text-muted")}
          >
            {en ? "Errors" : "Ошибки"}
          </button>
          {notice && <span className="text-xs text-muted">{notice}</span>}
          <button
            type="button"
            onClick={copyLogs}
            disabled={shown.length === 0}
            className="min-h-11 rounded-full px-3 text-sm text-accent disabled:text-muted"
          >
            {en ? "Copy" : "Копировать"}
          </button>
          <button type="button" onClick={clearLogs} className="min-h-11 rounded-full px-3 text-sm text-muted">
            {en ? "Clear" : "Очистить"}
          </button>
        </div>
      </header>
      {shown.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-8 text-sm text-muted">
          {en ? "No entries yet." : "Пока пусто."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-card border border-line bg-surface">
          {shown.map((entry, index) => (
            <li key={entry.id} className={cn("px-4 py-3 font-mono text-xs leading-5", index > 0 && "border-t border-line")}>
              <span className="text-muted">{new Date(entry.at).toLocaleString(en ? "en-GB" : "ru-RU")}</span>{" "}
              <span className={entry.level === "error" ? "text-danger" : "text-fg"}>{entry.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatLogs(logs: { at: number; level: string; text: string }[]) {
  return [...logs]
    .reverse()
    .map((entry) => `${new Date(entry.at).toLocaleString("ru-RU")} ${entry.level} ${entry.text}`)
    .join("\n");
}

function useDevice() {
  const [info, setInfo] = useState({ system: "—", arch: "—" });
  useEffect(() => {
    const ua = navigator.userAgent;
    let system = "—";
    if (/Windows/.test(ua)) system = "Windows";
    else if (/Android/.test(ua)) system = "Android";
    else if (/Mac OS/.test(ua)) system = "macOS";
    else if (/Linux/.test(ua)) system = "Linux";
    let arch = /Win64|x64|amd64|x86_64/i.test(ua) ? "x64" : /aarch64|arm64/i.test(ua) ? "arm64" : "—";
    setInfo({ system, arch });
    const data = (
      navigator as Navigator & {
        userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<{ architecture?: string; platform?: string }> };
      }
    ).userAgentData;
    if (!data?.getHighEntropyValues) return;
    void data.getHighEntropyValues(["architecture", "platform"]).then((value) => {
      setInfo({
        system: value.platform || system,
        arch: value.architecture || arch,
      });
    });
  }, []);
  return info;
}

function Switch({ label, on, set }: { label: string; on: boolean; set: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => set(!on)} className="flex min-h-12 w-full items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <span className={cn("h-7 w-12 rounded-full p-1", on ? "bg-accent" : "bg-raised")}>
        <span className={cn("block size-5 rounded-full bg-fg", on && "translate-x-5 bg-accent-ink")} />
      </span>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-sm font-semibold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
