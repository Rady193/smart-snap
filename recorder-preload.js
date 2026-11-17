const { contextBridge, ipcRenderer } = require('electron');

// The fixed set of things the recorder window (never shown) may tell main.js.
contextBridge.exposeInMainWorld('recorder', {
  // { crop: { x, y, w, h } as fractions of the display, size, fps, system, mic }
  onSetup: (callback) => ipcRenderer.once('recorder-setup', (_event, setup) => callback(setup)),
  // "start", "pause", "resume" or "stop"
  onCommand: (callback) => ipcRenderer.on('recorder-command', (_event, command) => callback(command)),
  // { sound: { system, mic, systemMissing, micMissing }, mime }
  ready: (info) => ipcRenderer.send('recorder-ready', info),
  // The video so far, a second at a time, in order.
  chunk: (bytes) => ipcRenderer.send('recorder-chunk', bytes),
  // { duration (seconds), width, height, mime }, after the last chunk.
  done: (info) => ipcRenderer.send('recorder-done', info),
  failed: (message) => ipcRenderer.send('recorder-failed', String(message || '')),
  // The display is no longer there to record.
  ended: () => ipcRenderer.send('recorder-ended'),
});
