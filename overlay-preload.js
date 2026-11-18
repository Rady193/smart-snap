const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  // { pixels, width, height, scale, windows }: `pixels` is the frozen picture
  // (raw, blue first), or null on the live screen.
  onImage: (callback) => ipcRenderer.once('overlay-image', (_event, data) => callback(data)),
  // On the live screen the window outlines come a moment later.
  onWindows: (callback) => ipcRenderer.once('overlay-windows', (_event, windows) => callback(windows)),
  // The page is drawn (still hidden); then, once Windows' opening animation is
  // over, main.js says to show it, and is told when it shows.
  ready: () => ipcRenderer.send('overlay-ready'),
  onReveal: (callback) => ipcRenderer.once('overlay-reveal', () => callback()),
  revealed: () => ipcRenderer.send('overlay-revealed'),
  // { x, y, w, h } in this display's CSS pixels, plus `hwnd` when a window was
  // clicked; `null` cancels.
  done: (result) => ipcRenderer.send('overlay-done', result),
  // Once the picture is taken: { area, number } to ask for the snap's comment
  // beside the area; then the application's name, when it is known.
  onComment: (callback) => ipcRenderer.once('overlay-comment', (_event, data) => callback(data)),
  onApp: (callback) => ipcRenderer.on('overlay-app', (_event, name) => callback(name)),
  // { action: "save" | "open" | "discard", text }
  commentDone: (answer) => ipcRenderer.send('overlay-comment-done', answer),
  // Recording a video, what the bar beside the area shows: { stage: "ready" |
  // "starting" | "recording" | "paused", area, sound, countdown }, or
  // { press: "start" } when Enter is pressed.
  onRecord: (callback) => ipcRenderer.on('overlay-record', (_event, state) => callback(state)),
  // "start" (with the sounds chosen, { system, mic }), "cancel", "pause",
  // "resume", "stop" or "discard".
  record: (action, sound) => ipcRenderer.send('overlay-record-action', action, sound ? { system: !!sound.system, mic: !!sound.mic } : null),
  // The mouse is over the bar (true) or elsewhere (false): only the bar takes it while recording.
  pointer: (overBar) => ipcRenderer.send('overlay-pointer', !!overBar),
});
