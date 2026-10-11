const { app, BrowserWindow, shell, ipcMain, session } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync, mkdirSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let server;
let windowRef;
let coreProc;
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
  if (process.platform !== "win32") return Promise.resolve();
  const lines = [
    "$p='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'",
    `Set-ItemProperty -Path $p -Name ProxyEnable -Type DWord -Value ${enable ? 1 : 0}`,
    "Set-ItemProperty -Path $p -Name ProxyOverride -Value 'localhost;127.0.0.1;<local>'",
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
    child.on("exit", () => resolve());
    child.on("error", () => resolve());
  });
}

function stopCore() {
  if (coreProc && !coreProc.killed) coreProc.kill();
  coreProc = null;
  return setSystemProxy(false);
}

function waitAlive(child) {
  return new Promise((resolve) => {
    let text = "";
    const take = (chunk) => {
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

ipcMain.handle("core:start", async (_event, payload) => {
  await stopCore();
  const core = payload?.core === "sing-box" ? "sing-box" : "xray";
  const exe = path.join(binDir(), core === "sing-box" ? "sing-box.exe" : "xray.exe");
  if (!existsSync(exe)) return { ok: false, error: `В сборке нет ${path.basename(exe)}` };
  const dir = app.getPath("userData");
  mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, "config.json");
  writeFileSync(configPath, String(payload?.config ?? ""), "utf8");
  const args = ["run", "-c", configPath];
  coreProc = spawn(exe, args, { cwd: binDir(), windowsHide: true });
  const alive = await waitAlive(coreProc);
  if (!alive.ok) {
    await stopCore();
    return { ok: false, error: alive.error };
  }
  const mode = payload?.mode === "system" ? "system" : "tun";
  if (core === "xray") {
    const proxy = mode === "system" ? "127.0.0.1:10809" : "socks=127.0.0.1:10808";
    await setSystemProxy(true, proxy);
    return {
      ok: true,
      note:
        mode === "system"
          ? "Xray запущен, системный прокси 127.0.0.1:10809"
          : "Xray не поднимает TUN. Включён системный прокси socks://127.0.0.1:10808",
    };
  }
  if (mode === "tun") {
    return { ok: true, note: "sing-box TUN запущен. Если сети нет, открой Rivers от имени администратора" };
  }
  return { ok: true, note: "sing-box запущен, системный прокси включён" };
});

async function openWindow() {
  const icon = path.join(__dirname, "icon.png");
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
  win.show();
}

async function shutdown() {
  await stopCore();
  stopServer();
}

app.whenReady().then(async () => {
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
  void shutdown().finally(() => app.quit());
});

app.on("before-quit", () => {
  void stopCore();
  stopServer();
});
