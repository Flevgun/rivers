const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rivers", {
  start: (payload) => ipcRenderer.invoke("core:start", payload),
  stop: () => ipcRenderer.invoke("core:stop"),
  setTray: (on) => ipcRenderer.invoke("tray:set", Boolean(on)),
  copyText: (text) => ipcRenderer.invoke("logs:copy", String(text ?? "")),
  latestRelease: () => ipcRenderer.invoke("app:latest"),
  openRelease: (url) => ipcRenderer.invoke("app:open", String(url ?? "")),
  onLog: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on("core:log", listener);
    return () => ipcRenderer.removeListener("core:log", listener);
  },
  onSpeed: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("core:speed", listener);
    return () => ipcRenderer.removeListener("core:speed", listener);
  },
});
