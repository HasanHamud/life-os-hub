const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
  db: {
    getAll: (store) => ipcRenderer.invoke("db:getAll", store),
    getOne: (store, id) => ipcRenderer.invoke("db:getOne", store, id),
    putOne: (store, value) => ipcRenderer.invoke("db:putOne", store, value),
    delOne: (store, id) => ipcRenderer.invoke("db:delOne", store, id),
    clearAll: () => ipcRenderer.invoke("db:clearAll"),
    exportAll: () => ipcRenderer.invoke("db:exportAll"),
    importAll: (data) => ipcRenderer.invoke("db:importAll", data)
  },
  pin: {
    getHash: () => ipcRenderer.invoke("pin:getHash"),
    setHash: (hash) => ipcRenderer.invoke("pin:setHash", hash),
    verify: (pin) => ipcRenderer.invoke("pin:verify", pin),
    set: (pin) => ipcRenderer.invoke("pin:set", pin),
    exists: () => ipcRenderer.invoke("pin:exists")
  }
});
