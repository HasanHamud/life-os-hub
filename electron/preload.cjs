const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] Script loaded, exposing api...");

contextBridge.exposeInMainWorld("api", {
  db: {
    getAll: (store) => ipcRenderer.invoke("db:getAll", store),
    getOne: (store, id) => ipcRenderer.invoke("db:getOne", store, id),
    putOne: (store, value) => ipcRenderer.invoke("db:putOne", store, value),
    delOne: (store, id) => ipcRenderer.invoke("db:delOne", store, id),
    clearAll: () => ipcRenderer.invoke("db:clearAll"),
    clearStore: (store) => ipcRenderer.invoke("db:clearStore", store),
    exportAll: () => ipcRenderer.invoke("db:exportAll"),
    importAll: (data) => ipcRenderer.invoke("db:importAll", data),
  },
  onBridgeChanged: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("bridge:changed", listener);
    return () => ipcRenderer.removeListener("bridge:changed", listener);
  },
});
