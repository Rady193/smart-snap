const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  // { src, scale, windows }: `src` is the frozen picture, or null on the live screen.
  onImage: (callback) => ipcRenderer.once('overlay-image', (_event, data) => callback(data)),
  // On the live screen the window outlines come a moment later.
  onWindows: (callback) => ipcRenderer.once('overlay-windows', (_event, windows) => callback(windows)),
  ready: () => ipcRenderer.send('overlay-ready'),
  // { x, y, w, h } in this display's CSS pixels, plus `hwnd` when a window was
  // clicked; `null` cancels.
  done: (result) => ipcRenderer.send('overlay-done', result),
});
