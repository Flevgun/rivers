const { app, BrowserWindow, shell, ipcMain, session, Tray, Menu, nativeImage, clipboard } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync, mkdirSync, unlinkSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const path = require("node:path");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let server;
let windowRef;
let coreProc;
let tray;
let trayEnabled = true;
let quitting = false;
let port = 47831;

function resourceRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", ".output");
}

function serverEntry() {
  return path.join(resourceRoot(), "server", "index.mjs");
}

function binDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "bin") : path.join(__dirname, "bin");
}

function freePort(start) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(freePort(start + 1)));
    probe.listen(start, "127.0.0.1", () => {
      const found = probe.address().port;
      probe.close(() => resolve(found));
    });
  });
}

function startServer() {
  server = spawn(process.execPath, [serverEntry()], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOST: "127.0.0.1",
      PORT: String(port),
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: String(port),
    },
    stdio: "ignore",
    windowsHide: true,
  });
}

function waitForServer() {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ hostname: "127.0.0.1", port, path: "/", timeout: 1000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (!server || server.exitCode !== null) {
          reject(new Error("Сервер Rivers остановился"));
          return;
        }
        if (Date.now() - started > 20000) {
          reject(new Error("Сервер Rivers не открылся"));
          return;
        }
        setTimeout(tick, 200);
      });
    };
    tick();
  });
}

function stopServer() {
  if (!server || server.killed) return;
  server.kill();
}

function setSystemProxy(enable, serverValue) {
  if (process.platform !== "win32") return Promise.resolve({ ok: true });
  const lines = [
    "$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'",
    `Set-ItemProperty -Path $p -Name ProxyEnable -Type DWord -Value ${enable ? 1 : 0}`,
    "Set-ItemProperty -Path $p -Name ProxyOverride -Value 'localhost;127.*;10.*;192.168.*;<local>'",
  ];
  if (enable && serverValue) {
    lines.push(`Set-ItemProperty -Path $p -Name ProxyServer -Value '${serverValue}'`);
  }
  lines.push(
    "Add-Type -Namespace Rivers -Name Inet -MemberDefinition '[DllImport(\"wininet.dll\", SetLastError=true)] public static extern bool InternetSetOption(System.IntPtr hInternet, int dwOption, System.IntPtr lpBuffer, int dwBufferLength);'",
    "[Rivers.Inet]::InternetSetOption([System.IntPtr]::Zero, 39, [System.IntPtr]::Zero, 0) | Out-Null",
    "[Rivers.Inet]::InternetSetOption([System.IntPtr]::Zero, 37, [System.IntPtr]::Zero, 0) | Out-Null",
  );
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", lines.join("; ")], { windowsHide: true });
    let text = "";
    child.stdout?.on("data", (chunk) => {
      text += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      text += chunk.toString();
    });
    child.on("exit", (code) => resolve({ ok: code === 0, error: text.trim() }));
    child.on("error", (error) => resolve({ ok: false, error: error.message }));
  });
}

function stopCore() {
  stopSpeed();
  if (coreProc && !coreProc.killed) coreProc.kill();
  coreProc = null;
  return setSystemProxy(false);
}

let speedStop = () => {};

function sendSpeed(payload) {
  if (!windowRef || windowRef.isDestroyed()) return;
  windowRef.webContents.send("core:speed", payload);
}

function stopSpeed() {
  speedStop();
  speedStop = () => {};
  sendSpeed(null);
}

function watchSpeed(core, exe) {
  stopSpeed();
  if (core === "sing-box") {
    let stopped = false;
    let req = null;
    let timer = null;
    const arm = () => {
      if (stopped) return;
      req = http.get("http://127.0.0.1:9097/traffic", (res) => {
        let buf = "";
        res.on("data", (chunk) => {
          buf += chunk.toString();
          const parts = buf.split("\n");
          buf = parts.pop() ?? "";
          for (const line of parts) {
            const text = line.trim();
            if (!text) continue;
            try {
              const data = JSON.parse(text);
              sendSpeed({ down: Number(data.down) || 0, up: Number(data.up) || 0 });
            } catch {
              /* wait for a full line */
            }
          }
        });
        res.on("end", () => {
          if (!stopped) timer = setTimeout(arm, 400);
        });
      });
      req.on("error", () => {
        if (!stopped) timer = setTimeout(arm, 400);
      });
    };
    arm();
    speedStop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      req?.destroy();
    };
    return;
  }

  let stopped = false;
  let lastDown = 0;
  let lastUp = 0;
  let seen = false;
  const timer = setInterval(() => {
    const child = spawn(exe, ["api", "statsquery", "--server=127.0.0.1:10085"], { windowsHide: true });
    let text = "";
    child.stdout?.on("data", (chunk) => {
      text += chunk.toString();
    });
    child.on("error", () => {});
    child.on("exit", () => {
      if (stopped) return;
      try {
        const data = JSON.parse(text);
        let down = 0;
        let up = 0;
        for (const item of data.stat || []) {
          const name = String(item.name || "");
          const value = Number(item.value) || 0;
          if (name === "outbound>>>proxy>>>traffic>>>downlink") down = value;
          if (name === "outbound>>>proxy>>>traffic>>>uplink") up = value;
        }
        if (seen) {
          sendSpeed({ down: Math.max(0, down - lastDown), up: Math.max(0, up - lastUp) });
        }
        lastDown = down;
        lastUp = up;
        seen = true;
      } catch {
        /* api not ready yet */
      }
    });
  }, 1000);
  speedStop = () => {
    stopped = true;
    clearInterval(timer);
  };
}

function plainError(text) {
  const clean = String(text || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (/Access is denied/i.test(clean)) return "Windows не дала создать TUN. Нужен запуск от имени администратора.";
  return clean || "ядро не запустилось";
}

function iconFile() {
  const ico = app.isPackaged ? path.join(process.resourcesPath, "icon.ico") : path.join(__dirname, "icon.ico");
  const png = app.isPackaged ? path.join(process.resourcesPath, "icon.png") : path.join(__dirname, "icon.png");
  if (process.platform === "win32" && existsSync(ico)) return ico;
  return png;
}

function emitLog(chunk) {
  const text = chunk.toString();
  if (!windowRef || windowRef.isDestroyed()) return;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/\u001b\[[0-9;]*m/g, "").trim();
    if (trimmed) windowRef.webContents.send("core:log", trimmed);
  }
}

function waitAlive(child) {
  return new Promise((resolve) => {
    let text = "";
    const take = (chunk) => {
      emitLog(chunk);
      text = (text + chunk.toString()).slice(-1200);
    };
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    const timer = setTimeout(() => resolve({ ok: true, tail: text.trim() }), 1500);
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ ok: false, error: text.trim() || `ядро завершилось, код ${code}` });
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
  });
}

ipcMain.handle("core:stop", () => stopCore());

function currentVersion() {
  try {
    return require("./package.json").version || app.getVersion();
  } catch (error) {
    return app.getVersion();
  }
}

function compareVersions(left, right) {
  const a = String(left).replace(/^v/, "").split(".").map((part) => parseInt(part, 10) || 0);
  const b = String(right).replace(/^v/, "").split(".").map((part) => parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { "User-Agent": "Rivers", Accept: "application/vnd.github+json" } },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          getJson(response.headers.location).then(resolve, reject);
          return;
        }
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          if (response.statusCode !== 200) {
            reject(new Error("http " + response.statusCode));
            return;
          }
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", reject);
    request.setTimeout(12000, () => request.destroy(new Error("timeout")));
  });
}

ipcMain.handle("app:latest", async () => {
  const data = await getJson("https://api.github.com/repos/Flevgun/rivers/releases/latest");
  const latest = String(data.tag_name || "").replace(/^v/, "");
  const current = currentVersion();
  return {
    current,
    latest,
    newer: compareVersions(latest, current) > 0,
    url: typeof data.html_url === "string" ? data.html_url : "https://github.com/Flevgun/rivers/releases/latest",
  };
});

ipcMain.handle("app:open", (_event, url) => {
  const target = String(url || "");
  if (!target.startsWith("https://github.com/Flevgun/rivers/")) return false;
  return shell.openExternal(target);
});

ipcMain.handle("logs:copy", async (_event, text) => {
  const body = String(text ?? "");
  if (Buffer.byteLength(body, "utf8") <= 32 * 1024 || process.platform !== "win32") {
    clipboard.writeText(body);
    return { mode: "text" };
  }
  const file = path.join(app.getPath("temp"), "rivers-logs.txt");
  writeFileSync(file, body, "utf8");
  const copied = await new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", `Set-Clipboard -LiteralPath '${file.replace(/'/g, "''")}'`],
      { windowsHide: true },
    );
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
  if (!copied) {
    clipboard.writeText(body);
    return { mode: "text" };
  }
  return { mode: "file" };
});

ipcMain.handle("tray:set", (_event, on) => {
  trayEnabled = Boolean(on);
  if (trayEnabled) ensureTray();
  else if (tray) {
    tray.destroy();
    tray = null;
  }
});

function showMain() {
  if (!windowRef || windowRef.isDestroyed()) return;
  windowRef.setSkipTaskbar(false);
  if (windowRef.isMinimized()) windowRef.restore();
  windowRef.show();
  windowRef.focus();
}

function ensureTray() {
  if (tray || !trayEnabled) return;
  let image = nativeImage.createFromPath(iconFile());
  if (image.isEmpty()) image = nativeImage.createFromDataURL("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAANBJREFUeNpi/P//P8NAAokE2NkYQdQ/gA4wMDAw/A/iHxgYGP4D8U8MDAz/AfEvDAwM/4H4HwYGhv9A/AcDAwM+IPqHgYGBnxD9w8DAwE8I/sHAwMBPCP7BwMDATwj+wcDAwE8I/sHAwMBPCP7BwMDATwj+wcDAwE8I/sHAwMBPCP7BwMDATwj+wcDAwE8I/sHAwMBPCP7BwMDATwj+wcDAwE8I/sHAwMBPCP7BwMDATwj+wcDAwE8I/sHAwMBPCP4D8Q8MDAz/gfgHBgYG/0D8AwMDA78h+IeBgYGfEP3DwMDAT4j+YWBg4CdE/zAwMPAjgAEA3y6vQd4n1n0AAAAASUVORK5CYII=");
  tray = new Tray(image);
  tray.setToolTip("Rivers");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Открыть", click: showMain },
      { label: "Выключить профиль", click: () => void stopCore() },
      {
        label: "Выход",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", showMain);
  tray.on("double-click", showMain);
}

function isAdmin() {
  if (process.platform !== "win32") return Promise.resolve(true);
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)",
      ],
      { windowsHide: true },
    );
    let text = "";
    child.stdout?.on("data", (chunk) => {
      text += chunk.toString();
    });
    child.on("exit", () => resolve(text.trim() === "True"));
    child.on("error", () => resolve(false));
  });
}

function relaunchElevated() {
  app.releaseSingleInstanceLock();
  const exe = process.execPath.replace(/'/g, "''");
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", `Start-Process -FilePath '${exe}' -Verb RunAs`],
      { windowsHide: true },
    );
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

ipcMain.handle("app:resume", () => {
  const file = path.join(app.getPath("userData"), "resume-tun");
  if (!existsSync(file)) return false;
  unlinkSync(file);
  return true;
});

ipcMain.handle("core:start", async (_event, payload) => {
  await stopCore();
  const core = payload?.core === "sing-box" ? "sing-box" : "xray";
  const mode = payload?.mode === "system" ? "system" : "tun";
  if (core === "sing-box" && mode === "tun" && process.platform === "win32" && !(await isAdmin())) {
    const dir = app.getPath("userData");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "resume-tun"), "1");
    const elevated = await relaunchElevated();
    if (!elevated) {
      unlinkSync(path.join(dir, "resume-tun"));
      app.requestSingleInstanceLock();
      return { ok: false, error: "Запрос прав отменён. Без них TUN не создаётся." };
    }
    quitting = true;
    app.quit();
    return { ok: false, error: "Нужны права администратора. Подтверди запрос Windows." };
  }
  const exe = path.join(binDir(), core === "sing-box" ? "sing-box.exe" : "xray.exe");
  if (!existsSync(exe)) return { ok: false, error: `В сборке нет ${path.basename(exe)}` };
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, "config.json");
  writeFileSync(configPath, String(payload?.config ?? ""), "utf8");
  emitLog(`запуск ${path.basename(exe)}`);
  const args = ["run", "-c", configPath];
  coreProc = spawn(exe, args, { cwd: binDir(), windowsHide: true });
  const alive = await waitAlive(coreProc);
  if (!alive.ok) {
    await stopCore();
    return { ok: false, error: plainError(alive.error) };
  }
  watchSpeed(core, exe);
  const running = coreProc;
  running.once("exit", (code) => {
    if (quitting || coreProc !== running) return;
    coreProc = null;
    stopSpeed();
    emitLog(`ядро остановилось, код ${code}`);
    void setSystemProxy(false);
  });
  if (core === "sing-box" && mode === "tun") {
    return {
      ok: true,
      note: "sing-box TUN. Рунет напрямую, остальное через VPN. Нужен запуск от имени администратора",
    };
  }
  const proxy = core === "xray" ? "127.0.0.1:10809" : "127.0.0.1:2080";
  const applied = await setSystemProxy(true, proxy);
  const lead =
    core === "xray"
      ? `Xray. Рунет напрямую, остальное через прокси ${proxy}`
      : `sing-box. Рунет напрямую, остальное через прокси ${proxy}`;
  const extra =
    core === "xray" && mode === "tun"
      ? " У Xray нет TUN, включён системный прокси. Весь трафик — ядро sing-box, режим TUN, от администратора."
      : "";
  if (!applied.ok) {
    return { ok: true, note: `${lead}. Системный прокси не включился: ${applied.error || "powershell"}` };
  }
  return { ok: true, note: lead + extra };
});

async function openWindow() {
  const icon = iconFile();
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 560,
    title: "Rivers",
    backgroundColor: "#07080a",
    autoHideMenuBar: true,
    icon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  windowRef = win;
  if (existsSync(icon)) win.setIcon(icon);
  win.setMenu(null);
  await session.defaultSession.setProxy({ mode: "direct" });
  const home = `http://127.0.0.1:${port}/`;
  const isOwn = (url) => url.startsWith(home) || url.startsWith("devtools://");
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isOwn(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isOwn(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  await win.loadURL(home);
  win.on("close", (event) => {
    if (trayEnabled && !quitting) {
      event.preventDefault();
      win.setSkipTaskbar(true);
      win.hide();
    }
  });
  win.on("minimize", (event) => {
    if (!trayEnabled) return;
    event.preventDefault();
    win.setSkipTaskbar(true);
    win.hide();
  });
  win.on("show", () => win.setSkipTaskbar(false));
  ensureTray();
  win.show();
}

async function shutdown() {
  await stopCore();
  stopServer();
}

app.whenReady().then(async () => {
  if (process.platform === "win32") app.setAppUserModelId("app.rivers.desktop");
  port = await freePort(47831);
  startServer();
  try {
    await waitForServer();
    await openWindow();
  } catch (error) {
    await shutdown();
    app.exit(1);
    throw error;
  }
});

app.on("second-instance", () => {
  if (!windowRef) return;
  if (windowRef.isMinimized()) windowRef.restore();
  windowRef.focus();
});

app.on("window-all-closed", () => {
  if (trayEnabled) return;
  void shutdown().finally(() => app.quit());
});

app.on("before-quit", () => {
  quitting = true;
  void stopCore();
  stopServer();
});
