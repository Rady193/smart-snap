const { contextBridge, ipcRenderer } = require('electron');

// The fixed set of things the app window may ask of main.js.
contextBridge.exposeInMainWorld('smartSnap', {
  config: () => ipcRenderer.invoke('config'),
  ready: () => ipcRenderer.send('interface-ready'),
  setTheme: (theme) => ipcRenderer.invoke('set-theme', theme),
  snap: (mode, wait) => ipcRenderer.invoke('snap', mode, wait),
  onChanged: (callback) => ipcRenderer.on('snaps-changed', (_e, info) => callback(info)),
  onError: (callback) => ipcRenderer.on('snap-error', (_e, message) => callback(message)),
  onCopied: (callback) => ipcRenderer.on('snap-copied', (_e, info) => callback(info)),
  snaps: {
    list: () => ipcRenderer.invoke('snaps-list'),
    update: (id, change) => ipcRenderer.invoke('snaps-update', id, change),
    move: (id, step) => ipcRenderer.invoke('snaps-move', id, step),
    remove: (id) => ipcRenderer.invoke('snaps-delete', id),
    clear: () => ipcRenderer.invoke('snaps-clear'),
    copy: (id) => ipcRenderer.invoke('snaps-copy', id),
    save: (id) => ipcRenderer.invoke('snaps-save', id),
  },
  report: {
    create: (opts) => ipcRenderer.invoke('report', opts),
    copyPicture: (opts) => ipcRenderer.invoke('report-copy', opts),
    open: (file) => ipcRenderer.invoke('report-open', file),
  },
  openLink: (url) => ipcRenderer.invoke('open-link', url),
  reveal: (file) => ipcRenderer.invoke('reveal', file),
  output: {
    get: () => ipcRenderer.invoke('output-get'),
    choose: () => ipcRenderer.invoke('output-choose'),
    open: () => ipcRenderer.invoke('output-open'),
  },
  settings: (change) => ipcRenderer.invoke('settings-set', change),
  openKeyboardSettings: () => ipcRenderer.invoke('open-keyboard-settings'),
  updates: {
    status: () => ipcRenderer.invoke('update-status'),
    check: () => ipcRenderer.invoke('update-check'),
    install: () => ipcRenderer.invoke('update-install'),
    cancel: () => ipcRenderer.invoke('update-cancel'),
    setAuto: (on) => ipcRenderer.invoke('update-auto', on),
    openPage: () => ipcRenderer.invoke('update-page'),
    onStatus: (callback) => ipcRenderer.on('update-status', (_event, status) => callback(status)),
    onOpen: (callback) => ipcRenderer.on('open-updates', () => callback()),
  },
});
