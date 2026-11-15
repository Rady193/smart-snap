const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  onImage: (callback) => ipcRenderer.once('overlay-image', (_event, data) => callback(data)),
  ready: () => ipcRenderer.send('overlay-ready'),
  // { x, y, w, h } in this display's CSS pixels, plus `hwnd` when a window was
  // clicked; `null` cancels.
  done: (result) => ipcRenderer.send('overlay-done', result),
});
