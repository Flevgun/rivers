const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rivers", {
  start: (payload) => ipcRenderer.invoke("core:start", payload),
  stop: () => ipcRenderer.invoke("core:stop"),
});
