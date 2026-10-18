import require$$0 from "electron";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var preload$1 = {};
var hasRequiredPreload;
function requirePreload() {
  if (hasRequiredPreload) return preload$1;
  hasRequiredPreload = 1;
  const { contextBridge, ipcRenderer } = require$$0;
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
  return preload$1;
}
var preloadExports = requirePreload();
const preload = /* @__PURE__ */ getDefaultExportFromCjs(preloadExports);
export {
  preload as default
};
