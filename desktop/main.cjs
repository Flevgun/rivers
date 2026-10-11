const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let server;
let windowRef;
let port = 47831;

function serverEntry() {
  const root = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..", ".output");
  return path.join(root, "server", "index.mjs");
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  windowRef = win;
  win.setMenu(null);
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

app.whenReady().then(async () => {
  port = await freePort(47831);
  startServer();
  try {
    await waitForServer();
    await openWindow();
  } catch (error) {
    stopServer();
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
  stopServer();
  app.quit();
});

app.on("before-quit", stopServer);
