const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rivers", {
  start: (payload) => ipcRenderer.invoke("core:start", payload),
  stop: () => ipcRenderer.invoke("core:stop"),
  setTray: (on) => ipcRenderer.invoke("tray:set", Boolean(on)),
  onLog: (callback) => {
    const listener = (_event, line) => callback(line);
    ipcRenderer.on("core:log", listener);
    return () => ipcRenderer.removeListener("core:log", listener);
  },
});
