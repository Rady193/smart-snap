const {
  app, BrowserWindow, ipcMain, shell, nativeImage, dialog, screen, desktopCapturer,
  globalShortcut, Tray, Menu, clipboard, net, session,
} = require('electron');
const crypto = require('crypto');
const os = require('os');
const { spawn, execFile } = require('child_process');
const path = require('path');
const registration = require('./registration');
const releases = require('./releases');
const fs = require('fs');
const { pathToFileURL } = require('url');

const APP_NAME = 'Smart Snap';
const ICON = path.join(__dirname, 'app', 'icon.png');
const STARTED_HIDDEN = process.argv.includes('--hidden') && !process.argv.includes('--updated');

// One copy at a time: starting it again brings the running one forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMain());
}

const CUSTOM_TITLE_BAR = process.platform === 'win32';
const TITLE_BAR_HEIGHT = 34;
// Must match --surface / --text in app/style.css.
const TITLE_BAR = {
  dark: { color: '#191a1b', symbolColor: '#cccccc' },
  light: { color: '#ffffff', symbolColor: '#17141c' },
};

const SHORTCUTS = {
  area: 'Control+Alt+S',
  window: 'Control+Alt+W',
  full: 'Control+Alt+F',
  record: 'Control+Alt+R',   // records a video; pressed again, stops it
};
// The Print Screen key also snaps an area, unless it is switched off in Settings.
const PRINT_SCREEN = 'PrintScreen';
const MODE_NAMES = { area: 'Area', window: 'Window', full: 'Full screen', video: 'Video' };

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stamp = (time = Date.now()) => {
  const d = new Date(time);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
};
const safeName = (s, fallback) => String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || fallback;

// ---- Settings and the output folder ----------------------------------------
// Everything the app produces goes under one folder: screenshots in
// "Screenshots", reports in "Reports". The folder is chosen in the installer;
// without an installer (the portable app) it is asked on first start.
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
const installChoiceFile = () => path.join(app.getPath('userData'), 'install-output.txt');
const defaultOutputFolder = () => path.join(app.getPath('documents'), APP_NAME);
let settings = null;

function loadSettings() {
  if (settings) return settings;
  try { settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) || {}; } catch { settings = {}; }
  if (process.env.SMART_SNAP_OUTPUT_DIR) settings.outputDir = process.env.SMART_SNAP_OUTPUT_DIR;
  // The installer leaves its choice in a small text file. Adopt it when it is
  // new, so reinstalling with a different folder takes effect, while a later
  // change made in the app's Settings is not undone on every start.
  try {
    const chosen = fs.readFileSync(installChoiceFile(), 'utf16le').replace(/^﻿/, '').trim();
    if (chosen && chosen !== settings.installerDir) {
      settings.installerDir = chosen;
      settings.outputDir = chosen;
      saveSettings();
    }
  } catch { /* not installed with the installer */ }
  return settings;
}

function saveSettings() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 1));
  } catch { /* keep running with the in-memory value */ }
}

const outputFolder = () => loadSettings().outputDir || defaultOutputFolder();
const outputDir = (kind) => path.join(outputFolder(), kind);
const reportsDir = () => outputDir('Reports');
const recordingsDir = () => outputDir('Recordings');

function setOutputFolder(dir) {
  loadSettings().outputDir = dir;
  saveSettings();
}

async function chooseOutputFolder(win) {
  const picked = await dialog.showOpenDialog(win, {
    title: 'Choose the output folder',
    defaultPath: outputFolder(),
    properties: ['openDirectory', 'createDirectory'],
  });
  if (picked.canceled || !picked.filePaths[0]) return false;
  setOutputFolder(picked.filePaths[0]);
  return true;
}

// First start without an installer choice: ask once.
async function ensureOutputFolder(win) {
  if (loadSettings().outputDir) return;
  const fallback = defaultOutputFolder();
  const answer = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Output folder',
    message: 'Where should Smart Snap save its files?',
    detail: `Screenshots and PDF reports are saved in one folder, each in its own subfolder.\n\nDefault: ${fallback}\n\nYou can change this later in Settings.`,
    buttons: ['Use the default folder', 'Choose a folder…'],
    defaultId: 0,
    cancelId: 0,
  });
  if (answer.response !== 1 || !(await chooseOutputFolder(win))) setOutputFolder(fallback);
}

// ---- Window helper (windows.ps1) -------------------------------------------
// A PowerShell process kept running for the app's lifetime. It lists the
// windows on screen and, for one window, names its application and reads the
// address from a browser's address bar. Answers come back one JSON line each,
// in the order the questions were asked.
let helper = null;
let helperBuffer = '';
const helperQueue = [];

function startHelper() {
  if (process.platform !== 'win32') return;
  // PowerShell cannot read a script from inside the app's archive, so a copy is
  // written next to the settings.
  const script = path.join(app.getPath('userData'), 'windows.ps1');
  try {
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'windows.ps1')));
  } catch { return; }
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-OwnPid', String(process.pid)], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  helper = child;
  helperBuffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    helperBuffer += chunk;
    let i;
    while ((i = helperBuffer.indexOf('\n')) >= 0) {
      const line = helperBuffer.slice(0, i).trim();
      helperBuffer = helperBuffer.slice(i + 1);
      if (!line) continue;
      let value = null;
      try { value = JSON.parse(line); } catch { /* ignored below */ }
      if (value && value.ready) continue;
      const waiting = helperQueue.shift();
      if (waiting) waiting.resolve(value);
    }
  });
  child.on('exit', () => {
    if (helper === child) helper = null;
    while (helperQueue.length) helperQueue.shift().resolve(null);
  });
  child.on('error', () => { if (helper === child) helper = null; });
}

// Asks the helper one question. Never rejects: no answer is `null`.
function ask(command, ms = 6000) {
  if (!helper) startHelper();
  if (!helper) return Promise.resolve(null);
  return new Promise((resolve) => {
    const entry = { resolve };
    const timer = setTimeout(() => {
      // A stuck helper is replaced, so the next snap is not held up too.
      entry.resolve = () => {};
      resolve(null);
      if (helper) { helper.kill(); helper = null; }
    }, ms);
    const done = entry.resolve;
    entry.resolve = (v) => { clearTimeout(timer); done(v); };
    helperQueue.push(entry);
    try { helper.stdin.write(command + '\n'); } catch { entry.resolve(null); }
  });
}

// ---- Screens ----------------------------------------------------------------
// The helper speaks in physical pixels; Electron places windows in DIPs. Each
// display's physical rectangle connects the two.
function physicalBounds(d) {
  if (process.platform === 'win32') return screen.dipToScreenRect(null, d.bounds);
  const s = d.scaleFactor;
  return { x: d.bounds.x * s, y: d.bounds.y * s, width: d.bounds.width * s, height: d.bounds.height * s };
}

const contains = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
const overlapArea = (a, b) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const winRect = (w) => ({ x: w.x, y: w.y, width: w.w, height: w.h });

// A display's exact physical rectangle: the helper's (`monitors`, from the
// snapshot) that matches it. Electron's own can be a pixel too big, from
// rounding a scaled size (2560 x 1600 at 150% comes back as 2561 x 1601).
function exactPhys(d, monitors) {
  const p = physicalBounds(d);
  const m = (monitors || []).find((r) => Math.abs(r.x - p.x) <= 2 && Math.abs(r.y - p.y) <= 2
    && Math.abs(r.w - p.width) <= 3 && Math.abs(r.h - p.height) <= 3);
  return m ? { x: m.x, y: m.y, width: m.w, height: m.h }
    : { x: Math.round(p.x), y: Math.round(p.y), width: Math.round(p.width), height: Math.round(p.height) };
}

// A picture of each display (or of those in `only`, display ids) at its own
// resolution, never resized: desktopCapturer fits every display into one size,
// which stretched the others slightly, so each size is asked for on its own.
async function captureDisplays(monitors, only) {
  const all = screen.getAllDisplays();
  const groups = new Map();
  for (const d of all) {
    if (only && !only.includes(d.id)) continue;
    const phys = exactPhys(d, monitors);
    const key = `${phys.width}x${phys.height}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ d, phys });
  }
  const shots = [];
  for (const group of groups.values()) {
    const { width, height } = group[0].phys;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    for (const { d, phys } of group) {
      const source = sources.find((s) => s.display_id === String(d.id)) || sources[all.indexOf(d)];
      let image = source ? source.thumbnail : null;
      if (!image || image.isEmpty()) continue;
      const size = image.getSize();
      if (size.width !== width || size.height !== height) image = image.resize({ width, height, quality: 'best' });
      shots.push({ display: d, phys, image });
    }
  }
  return all.map((d) => shots.find((s) => s.display.id === d.id)).filter(Boolean);
}

// The displays a snap needs: the one under the mouse for the full screen, the
// one showing most of the window in front for a window; all for a frozen area.
function displaysFor(mode, snapshot) {
  const monitors = snapshot && snapshot.monitors;
  if (mode === 'full') return [screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id];
  if (mode === 'window') {
    const w = (snapshot && snapshot.windows || []).find((x) => x.hwnd === snapshot.foreground);
    if (!w) return null;
    const best = screen.getAllDisplays()
      .map((d) => ({ id: d.id, area: overlapArea(winRect(w), exactPhys(d, monitors)) }))
      .sort((a, b) => b.area - a.area)[0];
    return best && best.area > 0 ? [best.id] : null;
  }
  return null;
}

// Cuts a physical-pixel rectangle out of one display's picture.
function cropPhysical(shot, rect) {
  const k = shot.image.getSize().width / shot.phys.width;
  const x = Math.max(0, Math.round((rect.x - shot.phys.x) * k));
  const y = Math.max(0, Math.round((rect.y - shot.phys.y) * k));
  const size = shot.image.getSize();
  const right = Math.min(size.width, Math.round((rect.x + rect.width - shot.phys.x) * k));
  const bottom = Math.min(size.height, Math.round((rect.y + rect.height - shot.phys.y) * k));
  if (right - x < 2 || bottom - y < 2) return null;
  return shot.image.crop({ x, y, width: right - x, height: bottom - y });
}

// The topmost window covering a physical point.
function windowAt(snapshot, x, y) {
  return (snapshot && snapshot.windows || []).find((w) => contains(winRect(w), x, y)) || null;
}

// ---- Area selection overlay -------------------------------------------------
// One borderless window per display. Press, drag and release to choose an area;
// click a window to take that window; Enter takes the whole display; Esc or a
// right-click cancels.
//
// Live (the usual way): the windows are see-through and never take the
// keyboard, so the screen goes on moving under them and the program in front
// stays in front. The picture is taken once the area is chosen; the windows
// are left out of it. Frozen (after a delay): they show each display's picture
// taken beforehand. A window on top closes open menus and hover effects, so
// the delay that is there for snapping those freezes the screen first.
//
// The chosen display's window then stays, the area still outlined, and asks
// for the snap's comment in a box beside it, as Multi Screens asks for a
// note's. The box opens the moment the area is chosen; the picture is taken
// meanwhile, the box left out of it, and the answer waits for it if need be.
let overlays = [];
let overlayDone = null;     // the selection, while it is being made
let overlayPurpose = 'snap';  // "snap", or "record" for a video (see Recording a video)
let commentDone = null;     // the comment box, while it is open
let commentAnswer = null;   // what the box answers (a promise), from the moment it opens

// Windows 10 2004 and later leave a window out of pictures of the screen
// altogether; before that it would show black, so it is hidden instead (and
// the box waits for the picture, not to blink).
const LEFT_OUT_OF_CAPTURE = process.platform === 'win32' && Number(os.release().split('.')[2]) >= 19041;

function endOverlays() {
  for (const o of overlays) if (!o.win.isDestroyed()) o.win.destroy();
  overlays = [];
  globalShortcut.unregister('Escape');
  globalShortcut.unregister('Enter');
}

// Opens the comment box on overlay `o`, with the keyboard (which a live
// selection never took). `video`: the box is for a video just recorded.
function openComment(o, area, video = false) {
  commentAnswer = new Promise((resolve) => { commentDone = resolve; });
  if (o.live) {
    try { o.win.setFocusable(true); } catch { /* typing may need a click first */ }
    o.win.setSkipTaskbar(true);              // (taking the keyboard would give it a taskbar button)
  }
  o.win.webContents.send('overlay-comment', { area, number: o.number, video });
  o.win.show();
  o.win.focus();
  o.win.webContents.focus();
  if (o.live) o.win.setContentProtection(true);
}

// Ends the selection: `null` cancels and closes everything; a chosen area keeps
// its display's window, which asks for the comment at once.
function closeOverlays(result) {
  const done = overlayDone;
  overlayDone = null;
  if (!result) endOverlays();
  else {
    for (const o of overlays) if (o.display.id !== result.displayId && !o.win.isDestroyed()) o.win.destroy();
    overlays = overlays.filter((o) => o.display.id === result.displayId);
    globalShortcut.unregister('Enter');      // Enter is typed in the comment now
    const o = overlays[0];
    // (A video's area gets the recording bar instead, from record().)
    if (overlayPurpose === 'snap' && o && (!o.live || LEFT_OUT_OF_CAPTURE)) openComment(o, { x: result.x, y: result.y, w: result.w, h: result.h });
  }
  if (done) done(result);
}

function finishComment(answer) {
  const done = commentDone;
  commentDone = null;
  endOverlays();
  if (done) done(answer);
}

// Esc cancels the selection or a video not yet recording, or discards the snap
// while its comment is asked.
function escape() {
  if (overlayDone) closeOverlays(null);
  else if (rec && rec.stage === 'ready') rec.answerStart(null);
  else if (rec && rec.stage === 'starting') rec.cancelStart();
  else if (commentDone) finishComment({ action: 'discard' });
  else endOverlays();
}

// The comment for the snap just taken: { action: "save" | "open" | "discard",
// text }. Opens the box now if it could not open with the selection.
function askComment(displayId, area) {
  if (commentAnswer) return commentAnswer;
  const o = overlays.find((x) => x.display.id === displayId && !x.win.isDestroyed());
  if (!o) return Promise.resolve({ action: 'open', text: '' });
  openComment(o, area);
  return commentAnswer;
}

// The application's name, once it is known, for the comment box's heading.
function tellCommentApp(name) {
  for (const o of overlays) if (!o.win.isDestroyed()) o.win.webContents.send('overlay-app', String(name || ''));
}

ipcMain.on('overlay-comment-done', (event, answer) => {
  const from = overlays.find((o) => !o.win.isDestroyed() && o.win.webContents === event.sender);
  if (!from || !commentDone) return;
  const a = answer && typeof answer === 'object' ? answer : {};
  finishComment({
    action: ['save', 'open'].includes(a.action) ? a.action : 'discard',
    text: String(a.text || '').slice(0, 5000),
  });
});

// Window outlines in one display's own coordinates (CSS pixels).
function outlinesOn(snapshot, d, phys) {
  const k = d.bounds.width / phys.width;
  return (snapshot && snapshot.windows || [])
    .filter((w) => overlapArea(winRect(w), phys) > 0)
    .map((w) => ({ hwnd: w.hwnd, x: (w.x - phys.x) * k, y: (w.y - phys.y) * k, w: w.w * k, h: w.h * k, title: w.title }));
}

// The whole display under the mouse.
function takeWholeDisplay() {
  const c = screen.getCursorScreenPoint();
  const o = overlays.find((x) => contains(x.display.bounds, c.x, c.y)) || overlays[0];
  if (o) closeOverlays({ displayId: o.display.id, x: 0, y: 0, w: o.display.bounds.width, h: o.display.bounds.height });
}

// `screens`: [{ display, phys, image }], the image only for a frozen
// selection. `snapshot`: the windows on screen, or a promise of them (live:
// the outlines appear when it is ready). Resolves to the chosen area in the
// display's CSS pixels with its `displayId`, or null. `number`: the snap's
// number, for the comment box. `purpose`: "snap", or "record" for a video.
function selectArea(screens, snapshot, live, number, purpose = 'snap') {
  return new Promise((resolve) => {
    overlayDone = resolve;
    overlayPurpose = purpose;
    // Esc and Enter work without the keyboard; a live selection never has it.
    try { globalShortcut.register('Escape', escape); } catch { /* the overlay's own Esc still works */ }
    try { globalShortcut.register('Enter', takeWholeDisplay); } catch { /* the overlay's own Enter still works */ }
    const cursor = screen.getCursorScreenPoint();
    overlays = screens.map((s) => {
      const d = s.display;
      const win = new BrowserWindow({
        x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
        frame: false, show: false, resizable: false, movable: false, minimizable: false, maximizable: false,
        fullscreenable: false, skipTaskbar: true, hasShadow: false, enableLargerThanScreen: true,
        alwaysOnTop: true, title: 'Smart Snap selection',
        ...(live ? { transparent: true, backgroundColor: '#00000000', focusable: false } : { backgroundColor: '#000000' }),
        webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false },
      });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setBounds(d.bounds);
      win.loadFile(path.join(__dirname, 'app', 'overlay.html'));
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('overlay-image', {
          // JPEG is quick to encode; the snap itself is cut from the original.
          src: s.image ? 'data:image/jpeg;base64,' + s.image.toJPEG(94).toString('base64') : null,
          scale: d.scaleFactor,
          windows: live ? [] : outlinesOn(snapshot, d, s.phys),
          theme: TITLE_BAR[loadSettings().appTheme] ? loadSettings().appTheme : 'dark',
          purpose,
        });
      });
      return { win, display: d, live, number, cursorHere: contains(d.bounds, cursor.x, cursor.y) };
    });
    if (live) {
      Promise.resolve(snapshot).then((snap) => {
        for (const o of overlays) {
          if (!o.win.isDestroyed()) o.win.webContents.send('overlay-windows', outlinesOn(snap, o.display, physicalBounds(o.display)));
        }
      });
    }
  });
}

// Each overlay says when it is drawn; it is shown only then, so the screen
// does not flash black.
ipcMain.on('overlay-ready', (event) => {
  const o = overlays.find((x) => !x.win.isDestroyed() && x.win.webContents === event.sender);
  if (!o) return;
  if (o.live) {
    o.win.showInactive();
    // Never in the picture of the screen. Windows ignores this for a window
    // that is not shown yet, so it is set once the window is on screen.
    o.win.setContentProtection(true);
    return;
  }
  o.win.show();
  if (o.cursorHere) o.win.focus();
});

ipcMain.on('overlay-done', (event, result) => {
  const from = overlays.find((o) => !o.win.isDestroyed() && o.win.webContents === event.sender);
  if (!from || !result) return closeOverlays(null);
  closeOverlays({ ...result, displayId: from.display.id });
});

// ---- Snaps --------------------------------------------------------------------
const snapsDir = () => path.join(app.getPath('userData'), 'snaps');
const snapsFile = () => path.join(snapsDir(), 'snaps.json');
const snapImage = (id) => path.join(snapsDir(), `${id}.png`);   // a video's: its first picture
const snapIcon = (id) => path.join(snapsDir(), `${id}-icon.png`);
const snapVideoPart = (id) => path.join(snapsDir(), `${id}.video-part`);   // a video while it is recorded
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VIDEO_FILE = /\.(mp4|webm)$/i;

function readSnaps() {
  try { return JSON.parse(fs.readFileSync(snapsFile(), 'utf8')); } catch { return []; }
}
function writeSnaps(list) {
  fs.mkdirSync(snapsDir(), { recursive: true });
  fs.writeFileSync(snapsFile(), JSON.stringify(list, null, 1));
}
function removeSnapFiles(id) {
  if (!UUID.test(String(id))) return;
  fs.rmSync(snapImage(id), { force: true });
  fs.rmSync(snapIcon(id), { force: true });
  fs.rmSync(snapVideoPart(id), { force: true });
}

// A video's file is in the Recordings folder, the only copy: deleting the video
// in Smart Snap moves it to the Recycle Bin, where it can still be restored.
async function trashVideo(n) {
  const file = n && n.video && n.video.file;
  if (!file || !VIDEO_FILE.test(file) || !fs.existsSync(file)) return;
  try { await shell.trashItem(file); } catch { /* left where it is */ }
}

// What an address bar shows is not always a full address: Chrome and Edge hide
// "https://". The scheme is put back so the link in the report works.
function normaliseUrl(text) {
  const t = String(text || '').trim();
  if (!t || /\s/.test(t)) return '';
  if (/^[a-z][\w+.-]*:/i.test(t)) return t;
  if (/^(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(t)) return 'http://' + t;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(t)) return 'https://' + t;
  return '';
}

const unit = (v) => Math.min(1, Math.max(0, Number(v) || 0));
function cleanMark(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.type === 'area') {
    const mark = { type: 'area', x: unit(m.x), y: unit(m.y), w: unit(m.w), h: unit(m.h) };
    mark.w = Math.min(mark.w, 1 - mark.x); mark.h = Math.min(mark.h, 1 - mark.y);
    return mark.w > 0.002 && mark.h > 0.002 ? mark : null;
  }
  if (m.type === 'point') return { type: 'point', x: unit(m.x), y: unit(m.y) };
  return null;
}

let snapping = false;
let rec = null;   // the video being recorded (see Recording a video)
let mainWin = null;
let tray = null;

function notify(channel, payload) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, payload);
}

// A program's icon for its snaps, as a PNG, or null. Windows draws it (the
// helper's `icon`), as Explorer and the taskbar show it. Electron's
// app.getFileIcon cannot read icons stored as PNG pictures (every SCAFFApps
// app's, and many other programs') and gives Windows' plain program icon for
// them instead, so it is only the fallback for when the helper cannot answer.
async function programIcon(exe) {
  const answer = await ask(`icon ${exe}`, 4000);
  if (answer && answer.png) return Buffer.from(answer.png, 'base64');
  try {
    const icon = await app.getFileIcon(exe, { size: 'large' });
    if (!icon.isEmpty()) return icon.toPNG();
  } catch { /* no icon */ }
  return null;
}

// The program's icon, saved beside the snap `id`. True when there is one.
async function storeIcon(id, info) {
  if (!info || !info.exe) return false;
  const icon = await programIcon(info.exe);
  if (!icon) return false;
  fs.writeFileSync(snapIcon(id), icon);
  return true;
}

// What a snap records about where it came from (the helper's `info`, or null).
function appFields(info) {
  const a = info || {};
  return {
    app: {
      name: String(a.name || a.process || '').slice(0, 200),
      process: String(a.process || '').slice(0, 200),
      exe: String(a.exe || '').slice(0, 1000),
      company: String(a.company || '').slice(0, 200),
      version: String(a.version || '').slice(0, 60),
      title: String(a.title || '').slice(0, 1000),
      browser: !!a.browser,
      location: String(a.location || '').slice(0, 2000),
      detectedUrl: String(a.url || '').slice(0, 4000),
    },
    url: normaliseUrl(a.url).slice(0, 4000),
  };
}

async function storeSnap(image, mode, info, displayName) {
  const id = crypto.randomUUID();
  fs.mkdirSync(snapsDir(), { recursive: true });
  fs.writeFileSync(snapImage(id), image.toPNG());
  const hasIcon = await storeIcon(id, info);
  const size = image.getSize();
  const snap = {
    id,
    time: Date.now(),
    mode,
    imgW: size.width,
    imgH: size.height,
    display: displayName || '',
    ...appFields(info),
    text: '',
    mark: null,
    hasIcon,
  };
  const list = readSnaps();
  list.push(snap);
  writeSnaps(list);
  return snap;
}

function displayLabel(d, index, count) {
  if (d.label) return d.label;
  return count > 1 ? `Display ${index + 1}` : 'Display';
}

// A snap or a video started from Smart Snap's own window must not show that
// window: it is hidden (`own`). Pinned on top of the program being snapped, it
// would be in the picture too: it steps aside (`pinned`), and comes back
// afterwards without taking the focus (comeBack). `settle`: wait until the
// screen is drawn without it (a live selection takes its picture later, when
// the window is long gone).
async function stepAside(settle) {
  const away = { own: false, pinned: false };
  if (mainWin && !mainWin.isDestroyed() && mainWin.isVisible() && mainWin.isFocused()) {
    mainWin.hide();
    away.own = true;
  } else if (mainWin && !mainWin.isDestroyed() && mainWin.isAlwaysOnTop() && mainWin.isVisible() && !mainWin.isMinimized()) {
    mainWin.hide();
    away.pinned = true;
  }
  if (settle && (away.own || away.pinned)) await delay(300);
  return away;
}

function comeBack(away) {
  if (away.pinned && mainWin && !mainWin.isDestroyed() && !mainWin.isVisible()) mainWin.showInactive();
}

// Takes one snap. `mode` is "area", "window" or "full".
async function snap(mode, wait = 0) {
  if (snapping || overlayDone) return;
  snapping = true;
  let hidOwn = false;
  let hidPinned = false;
  // An area without a delay is chosen on the live screen (see selectArea).
  const live = mode === 'area' && !(wait > 0);
  try {
    ({ own: hidOwn, pinned: hidPinned } = await stepAside(!live));
    if (wait > 0) await delay(wait * 1000);

    let snapshot = ask('snapshot');
    let shots = null;
    let picked = null;
    if (live) {
      const screens = screen.getAllDisplays().map((d) => ({ display: d, phys: physicalBounds(d), image: null }));
      picked = await selectArea(screens, snapshot, true, readSnaps().length + 1);
      if (!picked) { if (hidOwn) showMain(); return; }
      snapshot = await snapshot;
      // Only the display the area is on.
      const only = [picked.displayId];
      if (LEFT_OUT_OF_CAPTURE) {
        shots = await captureDisplays(snapshot && snapshot.monitors, only);
      } else {
        // Hidden for the picture, the screen drawn again without it, then back.
        for (const o of overlays) o.win.hide();
        await delay(120);
        shots = await captureDisplays(snapshot && snapshot.monitors, only);
        for (const o of overlays) if (!o.win.isDestroyed()) { o.win.showInactive(); o.win.setContentProtection(true); }
      }
    } else {
      snapshot = await snapshot;
      shots = await captureDisplays(snapshot && snapshot.monitors, displaysFor(mode, snapshot));
    }
    if (!shots.length) throw new Error('Windows did not hand over a picture of the screen.');
    const all = screen.getAllDisplays();
    const nameOf = (shot) => displayLabel(shot.display, all.findIndex((d) => d.id === shot.display.id), all.length);

    let image = null;
    let hwnd = 0;
    let displayName = '';

    if (mode === 'area') {
      if (!live) picked = await selectArea(shots, snapshot, false, readSnaps().length + 1);
      if (!picked) { if (hidOwn) showMain(); return; }
      const shot = shots.find((s) => s.display.id === picked.displayId);
      if (!shot) throw new Error('That display could not be snapped. Try again.');
      const k = shot.display.scaleFactor;     // the selection's CSS pixels are the display's DIPs
      const rect = {
        x: shot.phys.x + picked.x * k, y: shot.phys.y + picked.y * k,
        width: picked.w * k, height: picked.h * k,
      };
      image = cropPhysical(shot, rect);
      hwnd = picked.hwnd || (windowAt(snapshot, rect.x + rect.width / 2, rect.y + rect.height / 2) || {}).hwnd || 0;
      displayName = nameOf(shot);
    } else if (mode === 'window') {
      const w = (snapshot && snapshot.windows || []).find((x) => x.hwnd === snapshot.foreground);
      if (!w) throw new Error('There is no window to snap. Click the window first, then press the shortcut.');
      hwnd = w.hwnd;
      // The display showing most of the window; a window across two displays
      // is cut at the display's edge.
      const shot = shots.slice().sort((a, b) => overlapArea(winRect(w), b.phys) - overlapArea(winRect(w), a.phys))[0];
      image = cropPhysical(shot, winRect(w));
      displayName = nameOf(shot);
    } else {
      // The display the mouse is on.
      const cursor = screen.dipToScreenPoint(screen.getCursorScreenPoint());
      const shot = shots.find((s) => contains(s.phys, cursor.x, cursor.y)) || shots[0];
      image = shot.image;
      displayName = nameOf(shot);
      const front = (snapshot && snapshot.windows || []).find((x) => x.hwnd === snapshot.foreground);
      const onIt = front && overlapArea(winRect(front), shot.phys) > 0
        ? front
        : (snapshot && snapshot.windows || []).find((x) => overlapArea(winRect(x), shot.phys) > 0);
      hwnd = onIt ? onIt.hwnd : 0;
    }
    if (!image || image.isEmpty()) return;

    // The snap is stored while its comment is asked: its application is looked
    // up meanwhile, and named in the comment box once known.
    const storing = (async () => {
      const info = hwnd ? await ask(`info ${hwnd}`) : null;
      return storeSnap(image, mode, info && !info.error ? info : null, displayName);
    })();
    if (mode !== 'area') {
      const saved = await storing;
      showMain();
      notify('snaps-changed', { select: saved.id, fresh: true });
      return;
    }
    storing.then((s) => tellCommentApp(s.app.name), () => {});
    const answer = await askComment(picked.displayId, { x: picked.x, y: picked.y, w: picked.w, h: picked.h });
    const saved = await storing;
    if (answer.action === 'discard') {
      writeSnaps(readSnaps().filter((n) => n.id !== saved.id));
      removeSnapFiles(saved.id);
      notify('snaps-changed', {});
      if (hidOwn) showMain();
      return;
    }
    if (answer.text.trim()) {
      const list = readSnaps();
      const n = list.find((x) => x.id === saved.id);
      if (n) { n.text = answer.text; writeSnaps(list); }
    }
    // Saved with Enter (or Save): this snap alone goes on the clipboard as a
    // picture, drawn meanwhile, so the next snap can start at once.
    if (answer.action === 'save') queueSnapPicture(saved.id);
    // Saved from the box, Smart Snap stays out of the way, unless asked to open
    // or the snap was started from its own window.
    notify('snaps-changed', { select: saved.id, fresh: answer.action === 'open' });
    if (answer.action === 'open' || hidOwn) showMain();
  } catch (err) {
    endOverlays();
    showMain();
    notify('snap-error', String(err && err.message || err));
  } finally {
    commentDone = null;
    commentAnswer = null;
    endOverlays();
    snapping = false;
    comeBack({ pinned: hidPinned });
  }
}

// ---- Recording a video --------------------------------------------------------
// The area is chosen as for an area snap (selectArea, "record"): drag an area,
// click a window, or Enter for the whole display. That display's window then
// shows a bar beside the area: Start (Enter), the computer's sound, the
// microphone, Cancel (Esc). Start counts down three seconds while the recorder
// gets ready, then records until Stop: on the bar, Ctrl+Alt+R or the tray. All
// the while the window stays over the screen, left out of the video, the area
// outlined and the bar beside it; the mouse goes through it to the programs
// underneath, except on the bar. After Stop the comment box opens, as after an
// area snap, and the video is saved meanwhile in the Recordings folder.
//
// The video itself is made in a window that is never shown (app/recorder.html):
// Chromium records the display, keeps the area of each frame and encodes it as
// MP4 (H.264, with AAC sound), handing it over a second at a time.
//
// `rec.stage`: ready (the bar asks for Start), starting (counting down),
// recording, paused, stopping, comment (the comment box is open).
const COUNTDOWN_MS = 3000;
let recorder = null;            // the recorder window, while it is open
let quitAfterRecording = false; // quitting waits for the video to be saved

const recordingLive = () => !!rec && (rec.stage === 'recording' || rec.stage === 'paused');

// The recording's state, for the tray and Smart Snap's window.
function tellRecording() {
  notify('recording', { stage: rec ? rec.stage : null });
  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(recordingLive() ? `${APP_NAME}: recording a video` : APP_NAME);
    tray.setContextMenu(trayMenu());
  }
}

// What the bar beside the area shows: { stage, area, sound, countdown }, or
// { press: "start" } for Enter.
function recordBar(state) {
  if (rec && rec.o && !rec.o.win.isDestroyed()) rec.o.win.webContents.send('overlay-record', state);
}

// While the video is starting and recording, the overlay lets the mouse
// through to the programs underneath, except on the bar.
function passThrough(o, on) {
  if (!o || o.win.isDestroyed()) return;
  if (on) o.win.setIgnoreMouseEvents(true, { forward: true });
  else o.win.setIgnoreMouseEvents(false);
}

const fromRecordOverlay = (event) => !!rec && !!rec.o && !rec.o.win.isDestroyed() && event.sender === rec.o.win.webContents;

ipcMain.on('overlay-pointer', (event, overBar) => {
  if (fromRecordOverlay(event) && ['starting', 'recording', 'paused'].includes(rec.stage)) passThrough(rec.o, !overBar);
});

ipcMain.on('overlay-record-action', (event, action, sound) => {
  if (!fromRecordOverlay(event)) return;
  if (rec.stage === 'ready') {
    if (action === 'start') rec.answerStart({ system: !!(sound && sound.system), mic: !!(sound && sound.mic) });
    else if (action === 'cancel') rec.answerStart(null);
  } else if (rec.stage === 'starting') {
    if (action === 'cancel') rec.cancelStart();
  } else if (recordingLive()) {
    if (action === 'pause') pauseRecording(true);
    else if (action === 'resume') pauseRecording(false);
    else if (action === 'stop') rec.end('save');
    else if (action === 'discard') rec.end('discard');
  }
});

function pauseRecording(on) {
  if (!recordingLive() || !recorder || on === (rec.stage === 'paused')) return;
  recorder.command(on ? 'pause' : 'resume');
  rec.stage = on ? 'paused' : 'recording';
  recordBar({ stage: rec.stage });
  tellRecording();
}

// The recorder: a window never shown, recording display `source`. `setup`:
// { crop (fractions of the display), size, fps, system, mic }. Its video is
// written to the snap's part file as it comes. `ready` resolves to { sound,
// mime } once it can start; `result` to { duration, width, height, mime, part,
// bytes } once it has stopped and the file is complete.
function openRecorder(id, source, setup) {
  const partition = 'smart-snap-recorder';
  const ses = session.fromPartition(partition);
  ses.setDisplayMediaRequestHandler((request, callback) => callback(setup.system && request.audioRequested
    ? { video: source, audio: 'loopback' } : { video: source }));
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'media'));
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media');
  fs.mkdirSync(snapsDir(), { recursive: true });
  const r = { id, part: snapVideoPart(id), bytes: 0, error: null, mime: '' };
  r.out = fs.createWriteStream(r.part);
  r.out.on('error', (err) => { r.error = r.error || err; });
  r.ready = new Promise((resolve, reject) => { r.readyDone = resolve; r.readyFailed = reject; });
  r.result = new Promise((resolve, reject) => { r.finished = resolve; r.broke = reject; });
  r.ready.catch(() => {});
  r.result.catch(() => {});
  r.win = new BrowserWindow({
    show: false, width: 320, height: 240, skipTaskbar: true, title: 'Smart Snap recorder',
    webPreferences: {
      partition, preload: path.join(__dirname, 'recorder-preload.js'), contextIsolation: true, nodeIntegration: false,
      // Never shown, it must still run at full speed, and play sound into the video.
      backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required',
    },
  });
  r.command = (c) => { if (!r.win.isDestroyed()) r.win.webContents.send('recorder-command', c); };
  r.win.webContents.once('did-finish-load', () => r.win.webContents.send('recorder-setup', setup));
  r.win.webContents.on('render-process-gone', () => recorderFailed(r, 'The recorder stopped unexpectedly.'));
  r.win.loadFile(path.join(__dirname, 'app', 'recorder.html'));
  recorder = r;
  return r;
}

function recorderFailed(r, message) {
  const err = new Error(message || 'The recorder stopped unexpectedly.');
  err.recorder = true;
  r.readyFailed(err);
  r.broke(err);
  // While recording, what was recorded so far is kept (rescueVideo).
  if (recorder === r && recordingLive()) rec.end('failed');
}

function closeRecorder(r) {
  if (!r.win.isDestroyed()) r.win.destroy();
  if (recorder === r) recorder = null;
  if (!r.out.closed) r.out.destroy();
  // Saved, it has been moved away; otherwise it is not wanted.
  setTimeout(() => fs.rm(r.part, { force: true }, () => {}), 500);
}

const fromRecorder = (event) => !!recorder && !recorder.win.isDestroyed() && event.sender === recorder.win.webContents;

ipcMain.on('recorder-ready', (event, info) => {
  if (!fromRecorder(event)) return;
  recorder.mime = String((info && info.mime) || '');
  recorder.readyDone(info || {});
});
ipcMain.on('recorder-chunk', (event, bytes) => {
  if (!fromRecorder(event) || !bytes) return;
  const chunk = Buffer.from(bytes);
  recorder.bytes += chunk.length;
  recorder.out.write(chunk);
});
ipcMain.on('recorder-done', (event, info) => {
  if (!fromRecorder(event)) return;
  const r = recorder;
  const a = info || {};
  r.out.end(() => (r.error ? r.broke(r.error) : r.finished({
    duration: Math.max(0, Number(a.duration) || 0),
    width: Math.round(Number(a.width) || 0),
    height: Math.round(Number(a.height) || 0),
    mime: String(a.mime || r.mime || ''),
    part: r.part,
    bytes: r.bytes,
  })));
});
ipcMain.on('recorder-failed', (event, message) => { if (fromRecorder(event)) recorderFailed(recorder, String(message || '')); });
// The display stopped being recorded (it was unplugged): the video ends there.
ipcMain.on('recorder-ended', (event) => { if (fromRecorder(event) && recordingLive()) rec.end('save'); });

// The area to record, in physical pixels: at least 64 each way (grown around
// its middle), inside its display, and an even number of pixels each way, as
// the video encoder needs.
function recordRect(phys, picked, k) {
  const even = (v) => Math.floor(v / 2) * 2;
  const w = Math.min(phys.width, Math.max(64, Math.round(picked.w * k)));
  const h = Math.min(phys.height, Math.max(64, Math.round(picked.h * k)));
  let x = Math.round(phys.x + picked.x * k + (picked.w * k - w) / 2);
  let y = Math.round(phys.y + picked.y * k + (picked.h * k - h) / 2);
  x = Math.min(phys.x + phys.width - w, Math.max(phys.x, x));
  y = Math.min(phys.y + phys.height - h, Math.max(phys.y, y));
  return { x: phys.x + even(x - phys.x), y: phys.y + even(y - phys.y), width: even(w), height: even(h) };
}

// The video's picture in the list and the report: the area as it was when the
// recording started, taken as a snap is.
async function takePoster(d, monitors, rect) {
  try {
    await delay(150);
    const shot = (await captureDisplays(monitors, [d.id])).find((s) => s.display.id === d.id);
    return shot ? cropPhysical(shot, rect) : null;
  } catch { return null; }
}

// A plain dark picture the video's shape, for when none could be taken.
function blankPicture(w, h) {
  const k = Math.max(w, h, 1) / 64;
  const bw = Math.max(2, Math.round(w / k));
  const bh = Math.max(2, Math.round(h / k));
  const pixels = Buffer.alloc(bw * bh * 4, 0x24);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 0xff;
  return nativeImage.createFromBitmap(pixels, { width: bw, height: bh });
}

// A video's length in whole seconds, rounded down as video players show it.
const durationText = (seconds) => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const p = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  return h ? `${h}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}` : `${Math.floor(s / 60)}:${p(s % 60)}`;
};

// A new file in the Recordings folder, named after the application and time.
function recordingFile(appName, time, ext) {
  const dir = recordingsDir();
  fs.mkdirSync(dir, { recursive: true });
  const base = `${safeName(appName, 'Recording')} ${stamp(time)}`;
  for (let i = 1; ; i++) {
    const file = path.join(dir, `${base}${i > 1 ? ` (${i})` : ''}.${ext}`);
    if (!fs.existsSync(file)) return file;
  }
}

function moveFile(from, to) {
  try { fs.renameSync(from, to); } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    fs.copyFileSync(from, to);       // (another drive)
    fs.rmSync(from, { force: true });
  }
}

const videoExt = (mime) => (/webm/i.test(mime) ? 'webm' : 'mp4');

// Keeps the finished video as a snap: its file in the Recordings folder, its
// first picture and the program's icon beside the snaps.
async function storeVideo(id, done, c) {
  const file = recordingFile(c.info && (c.info.name || c.info.process), c.time, videoExt(done.mime));
  moveFile(done.part, file);
  const picture = c.poster && !c.poster.isEmpty() ? c.poster : blankPicture(done.width, done.height);
  fs.writeFileSync(snapImage(id), picture.toPNG());
  const hasIcon = await storeIcon(id, c.info);
  const snap = {
    id,
    time: c.time,
    mode: 'video',
    imgW: done.width || picture.getSize().width,
    imgH: done.height || picture.getSize().height,
    display: c.displayName || '',
    ...appFields(c.info),
    text: '',
    mark: null,
    hasIcon,
    video: { file, duration: Math.floor(done.duration * 10) / 10, bytes: done.bytes, sound: { system: !!c.sound.system, mic: !!c.sound.mic } },
  };
  const list = readSnaps();
  list.push(snap);
  writeSnaps(list);
  return snap;
}

// When the recording breaks off, what was recorded is kept in the Recordings
// folder (the video so far plays). True when there was something to keep.
async function rescueVideo(r) {
  try {
    if (!r.bytes || !fs.existsSync(r.part)) return false;
    if (!r.out.closed) await new Promise((resolve) => r.out.end(resolve));
    moveFile(r.part, recordingFile('', Date.now(), videoExt(r.mime)));
    return true;
  } catch { return false; }
}

// A video on the clipboard as a file, as Explorer's Copy leaves it, to paste
// into a chat, an email or a folder.
async function copyVideo(n) {
  if (!n || !n.video || !fs.existsSync(n.video.file)) return false;
  const answer = await ask(`copyfile ${n.video.file}`, 8000);
  return !!(answer && answer.ok);
}

function recordError(err, kept) {
  const text = String((err && err.message) || err || '');
  let message;
  if (/NotAllowed|Permission/i.test(text)) message = 'Windows did not let Smart Snap record the screen.';
  else if (/timed out/i.test(text)) message = 'The recording did not start. Try again.';
  else message = `The video could not be recorded. ${text}`.trim();
  return kept ? `${message} What was recorded until then is in the Recordings folder.` : message;
}

// Records a video. While one is being recorded, the same (the shortcut, the
// tray's item, Record in the window) stops it; while its bar asks, starts it.
async function record() {
  if (rec) {
    if (rec.stage === 'ready') recordBar({ press: 'start' });   // the bar answers, with the sound chosen
    else if (recordingLive()) rec.end('save');
    return;
  }
  if (snapping || overlayDone) return;
  snapping = true;
  let away = { own: false, pinned: false };
  let r = null;
  try {
    away = await stepAside(false);
    let snapshot = ask('snapshot');
    const screens = screen.getAllDisplays().map((d) => ({ display: d, phys: physicalBounds(d), image: null }));
    const picked = await selectArea(screens, snapshot, true, readSnaps().length + 1, 'record');
    const o = picked && overlays.find((x) => x.display.id === picked.displayId && !x.win.isDestroyed());
    if (!o) { if (away.own) showMain(); return; }

    // The bar asks for Start. Esc (still the selection's) and Enter answer it.
    rec = { stage: 'ready', o };
    const started = new Promise((resolve) => { rec.answerStart = (v) => { rec.answerStart = () => {}; resolve(v); }; });
    rec.cancelStart = () => {};
    rec.end = () => {};
    try { globalShortcut.register('Enter', () => record()); } catch { /* the bar's button still works */ }
    snapshot = await snapshot;
    const d = o.display;
    const k = d.scaleFactor;
    const phys = exactPhys(d, snapshot && snapshot.monitors);
    const rect = recordRect(phys, picked, k);
    const area = { x: (rect.x - phys.x) / k, y: (rect.y - phys.y) / k, w: rect.width / k, h: rect.height / k };
    const hwnd = picked.hwnd || (windowAt(snapshot, rect.x + rect.width / 2, rect.y + rect.height / 2) || {}).hwnd || 0;
    const info = hwnd ? ask(`info ${hwnd}`) : Promise.resolve(null);
    const all = screen.getAllDisplays();
    const displayName = displayLabel(d, all.findIndex((x) => x.id === d.id), all.length);
    const s = loadSettings();
    recordBar({ stage: 'ready', area, sound: { system: !!s.recordSystemSound, mic: !!s.recordMic } });
    tellRecording();
    const sound = await started;
    globalShortcut.unregister('Enter');
    if (!sound) { if (away.own) showMain(); return; }
    if (s.recordSystemSound !== sound.system || s.recordMic !== sound.mic) {
      s.recordSystemSound = sound.system;
      s.recordMic = sound.mic;
      saveSettings();
    }

    // Counting down, while the recorder gets ready. Esc or Cancel still stop it.
    rec.stage = 'starting';
    const cancelled = new Promise((resolve) => { rec.cancelStart = () => resolve(null); });
    passThrough(o, true);
    recordBar({ stage: 'starting', countdown: COUNTDOWN_MS });
    tellRecording();
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    const source = sources.find((x) => x.display_id === String(d.id)) || sources[all.findIndex((x) => x.id === d.id)];
    if (!source) throw new Error('Windows did not offer this display for recording.');
    r = openRecorder(crypto.randomUUID(), source, {
      crop: { x: (rect.x - phys.x) / phys.width, y: (rect.y - phys.y) / phys.height, w: rect.width / phys.width, h: rect.height / phys.height },
      size: { width: rect.width, height: rect.height },
      fps: 30,
      system: sound.system,
      mic: sound.mic,
    });
    const go = await Promise.race([
      Promise.all([withTimeout(r.ready, 20000), delay(COUNTDOWN_MS)]).then(([ready]) => ready),
      cancelled,
    ]);
    globalShortcut.unregister('Escape');     // from now on Esc belongs to the programs being recorded
    if (!go) { if (away.own) showMain(); return; }

    const ended = new Promise((resolve) => { rec.end = (how) => { rec.end = () => {}; resolve(how); }; });
    // Before Windows 10 2004 the overlay would show black in the video: it is
    // hidden instead, and the shortcut or the tray stops the recording.
    if (!LEFT_OUT_OF_CAPTURE) o.win.hide();
    r.command('start');
    const time = Date.now();
    rec.stage = 'recording';
    recordBar({ stage: 'recording', sound: go.sound || {} });
    tellRecording();
    const poster = takePoster(d, snapshot && snapshot.monitors, rect);

    const how = await ended;
    rec.stage = 'stopping';
    tellRecording();
    r.command('stop');
    if (how === 'discard') {
      await withTimeout(r.result, 10000).catch(() => {});
      if (away.own) showMain();
      return;                                  // (the part file is removed with the recorder)
    }
    if (how === 'failed') throw await r.result.then(() => new Error('The recorder stopped unexpectedly.'), (err) => err);

    // The comment box opens at once; the video is saved meanwhile.
    const storing = (async () => {
      const done = await withTimeout(r.result, 60000);
      const facts = await info;
      return storeVideo(r.id, done, { time, info: facts && !facts.error ? facts : null, displayName, poster: await poster, sound: go.sound || {} });
    })();
    storing.catch(() => {});
    let answer = { action: 'save', text: '', quiet: true };
    if (how !== 'quit' && !quitAfterRecording && !o.win.isDestroyed()) {
      rec.stage = 'comment';
      tellRecording();
      storing.then((v) => tellCommentApp(v.app.name), () => {});
      passThrough(o, false);
      if (!LEFT_OUT_OF_CAPTURE) o.win.showInactive();
      openComment(o, area, true);
      answer = await commentAnswer;
    }
    const saved = await storing;
    if (answer.action === 'discard') {
      writeSnaps(readSnaps().filter((n) => n.id !== saved.id));
      removeSnapFiles(saved.id);
      await trashVideo(saved);
      notify('snaps-changed', {});
      if (away.own) showMain();
      return;
    }
    if (answer.text.trim()) {
      const list = readSnaps();
      const n = list.find((x) => x.id === saved.id);
      if (n) { n.text = answer.text; writeSnaps(list); }
    }
    // Saved with Enter (or Save): the video goes on the clipboard as a file.
    if (answer.action === 'save' && !answer.quiet) {
      const number = readSnaps().findIndex((n) => n.id === saved.id) + 1;
      copyVideo(saved).then((ok) => (ok
        ? notify('snap-copied', { number, video: true })
        : notify('snap-error', `Video ${number} is saved, but it could not be copied. Copy video in Smart Snap copies it.`)));
    }
    notify('snaps-changed', { select: saved.id, fresh: answer.action === 'open' });
    if (answer.action === 'open' || away.own) showMain();
  } catch (err) {
    endOverlays();
    const kept = !!r && await rescueVideo(r);
    showMain();
    notify('snap-error', recordError(err, kept));
  } finally {
    globalShortcut.unregister('Enter');
    if (r) closeRecorder(r);
    commentDone = null;
    commentAnswer = null;
    endOverlays();
    rec = null;
    snapping = false;
    tellRecording();
    comeBack(away);
    if (quitAfterRecording) { quitting = true; app.quit(); }
  }
}

// ---- Report -----------------------------------------------------------------
const pct = (v) => (v * 100).toFixed(3) + '%';

// The part of the screenshot shown as the close-up, in fractions of the image.
function closeUp(n) {
  const m = n.mark;
  const ratio = n.imgW / n.imgH;
  let x, y, w, h;
  if (m.type === 'area') {
    const pad = 0.04;
    w = m.w + 2 * pad; h = m.h + 2 * pad * ratio;
    x = m.x - pad; y = m.y - pad * ratio;
  } else {
    w = 0.3; h = w * ratio * 0.62;
    x = m.x - w / 2; y = m.y - h / 2;
  }
  w = Math.min(1, w); h = Math.min(1, h);
  x = Math.min(1 - w, Math.max(0, x)); y = Math.min(1 - h, Math.max(0, y));
  return { x, y, w, h };
}

// The mark drawn over an image that shows region `f` of the screenshot.
function markHtml(m, number, f) {
  const pos = `left:${pct((m.x - f.x) / f.w)};top:${pct((m.y - f.y) / f.h)}`;
  return m.type === 'area'
    ? `<div class="mark area" style="${pos};width:${pct(m.w / f.w)};height:${pct(m.h / f.h)}"><span>${number}</span></div>`
    : `<div class="mark point" style="${pos}"><span>${number}</span></div>`;
}

function appLine(a) {
  const parts = [a.name || a.process || 'Unknown application'];
  if (a.version) parts.push(a.version);
  return parts.join(' ') + (a.company && a.company !== a.name ? ` · ${a.company}` : '');
}

function linkHtml(url) {
  return /^(https?|file|ftp):/i.test(url) ? `<a href="${esc(url)}">${esc(url)}</a>` : esc(url);
}

function snapHtml(n, number) {
  const src = pathToFileURL(snapImage(n.id)).href;
  const a = n.app || {};
  // A4 with 14 mm margins leaves 182 mm across, and the snap's card (5 mm
  // padding and a border each side) 171 mm inside it; the picture is kept short
  // enough for the snap and its details to share a page.
  const ratio = n.imgW / n.imgH;
  let w = 171; let h = w / ratio;
  if (h > 150) { h = 150; w = h * ratio; }
  // Small snaps are not blown up beyond about their size on screen.
  const naturalW = n.imgW * 0.2;
  if (w > naturalW && naturalW > 40) { w = naturalW; h = w / ratio; }
  const v = n.video;
  const videoUrl = v && v.file ? pathToFileURL(v.file).href : '';
  // A video: its first picture, with a play sign and its length, opening the file.
  const mark = v ? `<a class="play" href="${esc(videoUrl)}"><span></span></a><span class="length">${esc(durationText(v.duration))}</span>`
    : n.mark ? markHtml(n.mark, number, { x: 0, y: 0, w: 1, h: 1 }) : '';
  let detail = '';
  if (n.mark && !v) {
    const c = closeUp(n);
    const aspect = (c.w * n.imgW) / (c.h * n.imgH);
    let dw = 66; let dh = dw / aspect;
    if (dh > 52) { dh = 52; dw = dh * aspect; }
    detail = `<div class="detail"><div class="img" style="width:${dw.toFixed(1)}mm;height:${dh.toFixed(1)}mm"><img src="${src}" style="left:${pct(-c.x / c.w)};top:${pct(-c.y / c.h)};width:${pct(1 / c.w)};height:${pct(1 / c.h)}">${markHtml(n.mark, number, c)}</div><div class="cap">Close-up of the marked ${n.mark.type === 'area' ? 'area' : 'spot'}</div></div>`;
  }
  const icon = n.hasIcon && fs.existsSync(snapIcon(n.id)) ? `<img class="appicon" src="${pathToFileURL(snapIcon(n.id)).href}">` : '';
  const sounds = v && v.sound ? [v.sound.system && 'the computer', v.sound.mic && 'the microphone'].filter(Boolean) : [];
  const rows = [
    ['Application', esc(appLine(a))],
    a.title ? ['Window', esc(a.title)] : null,
    n.url ? ['Link', linkHtml(n.url)] : null,
    !n.url && a.location ? ['Folder', esc(a.location)] : null,
    v ? ['Video', `<a href="${esc(videoUrl)}">${esc(path.basename(v.file))}</a> · ${esc(durationText(v.duration))} · ${sounds.length ? `sound from ${esc(sounds.join(' and '))}` : 'no sound'}`] : null,
    [v ? 'Recorded' : 'Taken', esc(`${new Date(n.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })} · ${MODE_NAMES[n.mode] || 'Snap'}${n.display ? ` on ${n.display}` : ''} · ${n.imgW} × ${n.imgH} px`)],
    a.exe ? ['Program', esc(a.exe)] : null,
  ].filter(Boolean).map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join('');
  return `<section class="snap">
  <div class="head"><span class="num">${number}</span>${icon}<div class="who"><b>${esc(a.name || a.process || 'Unknown application')}</b><span>${esc(a.title || '')}</span></div></div>
  ${n.text ? `<p class="text">${esc(n.text).replace(/\n/g, '<br>')}</p>` : ''}
  <div class="img shot${v ? ' video' : ''}" style="width:${w.toFixed(1)}mm;height:${h.toFixed(1)}mm"><img src="${src}" style="width:100%;height:100%">${mark}</div>
  <div class="facts">${detail}<table class="meta">${rows}</table></div>
</section>`;
}

// `opts.picture`: drawn for one tall picture instead of printed pages. The page
// then keeps the A4 width and its margins itself, on white, without a scrollbar.
// `opts.single`: one snap's part alone, without the report's heading and
// summary, numbered `opts.number` as in the list.
function reportHtml(list, opts) {
  const apps = [...new Set(list.map((n) => (n.app && (n.app.name || n.app.process)) || 'Unknown'))];
  const summary = list.map((n, i) => {
    const a = n.app || {};
    const where = n.url ? linkHtml(n.url) : esc(a.location || a.title || '');
    const tag = n.video ? ` <span class="tag">Video ${esc(durationText(n.video.duration))}</span>` : '';
    return `<tr><td class="n">${i + 1}</td><td>${esc(a.name || a.process || 'Unknown')}${tag}</td><td class="where">${where}</td><td>${esc(new Date(n.time).toLocaleTimeString([], { timeStyle: 'short' }))}</td></tr>`;
  }).join('');
  const videos = list.filter((n) => n.video).length;
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const counted = videos
    ? `<div class="wide"><b>Snaps</b>${[list.length - videos && plural(list.length - videos, 'screenshot'), plural(videos, 'video')].filter(Boolean).join(', ')}</div>`
    : `<div><b>Screenshots</b>${list.length}</div>`;
  const first = Math.min(...list.map((n) => n.time));
  const last = Math.max(...list.map((n) => n.time));
  const fmt = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const period = first === last || new Date(first).toDateString() === new Date(last).toDateString() && fmt(first) === fmt(last)
    ? fmt(first) : `${fmt(first)} – ${new Date(first).toDateString() === new Date(last).toDateString() ? new Date(last).toLocaleTimeString([], { timeStyle: 'short' }) : fmt(last)}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title><style>
  * { box-sizing: border-box; }
  body { margin: 0; color: #17141c; font: 10.5pt/1.45 "Segoe UI", system-ui, sans-serif; }
  a { color: #5b2c83; text-decoration: none; }
  header { margin-bottom: 6mm; }
  .brand { display: flex; align-items: center; gap: 2mm; margin-bottom: 4mm; color: #6a6175; font-size: 9pt; font-weight: 600; letter-spacing: .2pt; }
  .brand img { width: 5.5mm; height: 5.5mm; }
  h1 { margin: 0 0 3mm; font-size: 20pt; letter-spacing: -.2pt; overflow-wrap: anywhere; }
  .cards { display: flex; gap: 3mm; }
  .cards div { flex: 1; min-width: 0; padding: 2.4mm 3.2mm; background: #f6f5f8; border: .25mm solid #e7e4ec; border-radius: 2.5mm; font-size: 10.5pt; font-weight: 600; overflow-wrap: anywhere; }
  .cards div.wide { flex: 2; }
  .cards b { display: block; margin-bottom: .8mm; color: #6a6175; font-size: 7.5pt; font-weight: 600; letter-spacing: .4pt; text-transform: uppercase; }
  table.sum { width: 100%; margin-top: 4mm; border-collapse: collapse; font-size: 9pt; }
  .sum th, .sum td { padding: 1.3mm 2mm; text-align: left; vertical-align: top; border-bottom: .2mm solid #e7e4ec; }
  .sum th { color: #6a6175; font-weight: 600; }
  .sum td.n { width: 8mm; color: #6a6175; }
  .sum td.where { overflow-wrap: anywhere; word-break: break-word; }
  .snap { margin-bottom: 6mm; padding: 5mm; border: .3mm solid #e7e4ec; border-radius: 3mm; break-inside: avoid; }
  .head { display: flex; align-items: center; gap: 2.5mm; margin-bottom: 3mm; }
  .num { flex: none; display: inline-grid; place-items: center; width: 7mm; height: 7mm; color: #fff; background: #5b2c83; border-radius: 50%; font-size: 10pt; font-weight: 700; }
  .appicon { flex: none; width: 7mm; height: 7mm; }
  .who { min-width: 0; display: flex; flex-direction: column; }
  .who b { font-size: 12pt; }
  .who span { color: #6a6175; font-size: 9pt; overflow-wrap: anywhere; }
  .text { margin: 0 0 4mm; padding: 3mm 3.5mm; background: #fff7f7; border: .25mm solid #f3d4d5; border-left: 1.1mm solid #e5484d; border-radius: 2mm; font-size: 11pt; overflow-wrap: anywhere; }
  .img { position: relative; overflow: hidden; border: .25mm solid #d4d0dc; border-radius: 1.5mm; background: #f6f5f8; }
  .img img { position: absolute; left: 0; top: 0; display: block; }
  .shot { margin: 0 auto; }
  .facts { display: flex; gap: 5mm; align-items: flex-start; margin-top: 4mm; }
  .detail { flex: none; }
  .cap { margin: 1.2mm 0 0; color: #6a6175; font-size: 8pt; }
  table.meta { flex: 1; min-width: 0; border-collapse: collapse; font-size: 9pt; }
  .meta th { width: 24mm; padding: 1mm 2mm 1mm 0; color: #6a6175; font-weight: 600; text-align: left; vertical-align: top; }
  .meta td { padding: 1mm 0; overflow-wrap: anywhere; word-break: break-word; }
  .mark { position: absolute; }
  .mark.area { border: .7mm solid #e5484d; border-radius: 1mm; background: rgba(229, 72, 77, .10); }
  .mark.area span { position: absolute; left: -.7mm; top: -.7mm; transform: translate(-40%, -60%); }
  .mark.point { width: 0; height: 0; }
  .mark.point::before { content: ""; position: absolute; left: -5mm; top: -5mm; width: 10mm; height: 10mm; border: .7mm solid #e5484d; border-radius: 50%; background: rgba(229, 72, 77, .12); }
  .mark span { display: inline-grid; place-items: center; min-width: 5mm; height: 5mm; padding: 0 1mm; color: #fff; background: #e5484d; border-radius: 2.5mm; font-size: 8pt; font-weight: 700; line-height: 1; }
  .mark.point span { position: absolute; left: 3mm; top: -8mm; }
  .sum .tag { margin-left: 1mm; padding: 0 1.2mm; color: #5b2c83; background: #f1ebf6; border-radius: 1mm; font-size: 7.5pt; font-weight: 600; white-space: nowrap; }
  .shot.video .play { position: absolute; inset: 0; display: grid; place-items: center; }
  .shot.video .play span { width: 15mm; height: 15mm; border-radius: 50%; background: rgba(23, 20, 28, .62); box-shadow: 0 0 0 .5mm rgba(255, 255, 255, .8); }
  .shot.video .play span::before { content: ""; display: block; margin: 4.3mm 0 0 5.6mm; border-style: solid; border-width: 3.2mm 0 3.2mm 5.2mm; border-color: transparent transparent transparent #fff; }
  .shot.video .length { position: absolute; right: 2mm; bottom: 2mm; padding: .4mm 1.6mm; color: #fff; background: rgba(23, 20, 28, .75); border-radius: 1mm; font-size: 8pt; font-weight: 600; }
  ${opts.picture ? 'html { background: #fff; scrollbar-width: none; } body { padding: 12mm 14mm 9mm; } .snap:last-child { margin-bottom: 0; }' : ''}
  ${opts.single ? 'body { padding: 6mm 8mm; }' : ''}
</style></head><body>
${opts.single ? snapHtml(list[0], opts.number || 1) : `<header>
  <div class="brand"><img src="${pathToFileURL(ICON).href}" alt="">${APP_NAME}</div>
  <h1>${esc(opts.title)}</h1>
  <div class="cards">
    ${opts.author ? `<div><b>Prepared by</b>${esc(opts.author)}</div>` : ''}
    <div class="wide"><b>Taken</b>${esc(period)}</div>
    ${counted}
    <div class="wide"><b>Applications</b>${esc(apps.join(', '))}</div>
  </div>
  <table class="sum"><tr><th>#</th><th>Application</th><th>Page, window or folder</th><th>Time</th></tr>${summary}</table>
</header>
${list.map((n, i) => snapHtml(n, i + 1)).join('')}`}
</body></html>`;
}

// The screenshots that go into a report, with its title and author. The author
// is remembered for the next report.
function reportInput(opts) {
  const ids = Array.isArray(opts.ids) ? new Set(opts.ids.map(String)) : null;
  const list = readSnaps().filter((n) => (!ids || ids.has(n.id)) && UUID.test(n.id) && fs.existsSync(snapImage(n.id)));
  const title = String(opts.title || '').trim().slice(0, 150) || 'Screenshot report';
  const author = String(opts.author || '').trim().slice(0, 150);
  const s = loadSettings();
  if (s.author !== author) { s.author = author; saveSettings(); }
  return { list, title, author };
}

// Draws the report in a window of its own that is never shown, hands its page
// to `use`, and closes it. A picture needs the window drawn off screen: Chromium
// does not paint a hidden window, so there would be nothing to capture.
async function withReportPage(list, opts, use) {
  // A picture's page has a name of its own: one snap's picture may still be
  // drawing while the next one, or the whole report's, starts.
  const htmlFile = path.join(snapsDir(), opts.picture ? `picture-${crypto.randomUUID()}.html` : 'report.html');
  let win;
  try {
    fs.writeFileSync(htmlFile, reportHtml(list, opts));
    win = new BrowserWindow({
      show: false, width: 900, height: 1200, useContentSize: true,
      webPreferences: { javascript: false, offscreen: !!opts.picture },
    });
    await win.loadFile(htmlFile);
    return await use(win.webContents);
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    fs.rmSync(htmlFile, { force: true });
  }
}

async function createReport(opts) {
  const { list, title, author } = reportInput(opts);
  if (!list.length) return { error: 'There are no screenshots to report.' };
  try {
    // Margins are in inches; the footer carries the page number.
    const pdf = await withReportPage(list, { title, author }, (wc) => wc.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.55, bottom: 0.75, left: 0.55, right: 0.55 },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 14mm;display:flex;justify-content:space-between;font:7.5pt Segoe UI,sans-serif;color:#8b93a5"><span>${esc(title)} · ${APP_NAME}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    }));
    const dir = reportsDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${safeName(title, 'Screenshot report')} - ${stamp()}.pdf`);
    fs.writeFileSync(file, pdf);
    // The report now holds these screenshots, so they leave the app, unless
    // asked to keep them. Only once the PDF is on disk.
    if (!opts.keep) {
      const reported = new Set(list.map((n) => n.id));
      writeSnaps(readSnaps().filter((n) => !reported.has(n.id)));
      for (const id of reported) removeSnapFiles(id);
    }
    return { file, count: list.length, cleared: !opts.keep };
  } catch (err) {
    return { error: 'The report could not be created.' };
  }
}

// The same report as one tall picture on the clipboard, to paste into a chat,
// an email or a document. Nothing is saved and the screenshots stay in the app.
// The page is drawn at the A4 width, twice as sharp as on screen; a report too
// long for that is drawn smaller, so the picture stays within PICTURE_MAX_H.
const PICTURE_W = 794; // A4 at 96 dpi, in CSS pixels
const PICTURE_MAX_H = 16000; // in pixels; Chromium cannot capture much taller
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), ms))]);

// The report's page (`opts` as for reportHtml, `picture` added) as one picture.
async function reportPicture(list, opts) {
  const image = await withReportPage(list, { ...opts, picture: true }, async (wc) => {
    wc.debugger.attach('1.3');
    const send = (method, params) => wc.debugger.sendCommand(method, params);
    const metrics = (height, deviceScaleFactor) =>
      send('Emulation.setDeviceMetricsOverride', { width: PICTURE_W, height, deviceScaleFactor, mobile: false });
    // Measured in a short view: the content is never counted shorter than the
    // view, and one snap alone can be shorter than a tall one.
    await metrics(100, 1);
    const { cssContentSize } = await send('Page.getLayoutMetrics');
    const height = Math.ceil(cssContentSize.height);
    await metrics(height, Math.min(2, PICTURE_MAX_H / height));
    // Closing the window (on a timeout) ends a capture that never finishes.
    const { data } = await withTimeout(send('Page.captureScreenshot', { format: 'png' }), 20000);
    return nativeImage.createFromBuffer(Buffer.from(data, 'base64'));
  });
  if (image.isEmpty()) throw new Error('empty picture');
  return image;
}

async function copyReport(opts) {
  const { list, title, author } = reportInput(opts);
  if (!list.length) return { error: 'There are no screenshots to report.' };
  try {
    const image = await reportPicture(list, { title, author });
    clipboard.writeImage(image);
    return { ...image.getSize(), count: list.length };
  } catch (err) {
    return { error: 'The report could not be copied as a picture.' };
  }
}

// One snap as a picture on the clipboard: its part of the report alone (its
// number, application, comment, screenshot and details), as it is now. Snaps
// saved one after another are copied in turn, so the last one saved is the one
// left on the clipboard. The window, when it is open, says so.
let snapPictures = Promise.resolve();
function queueSnapPicture(id) {
  snapPictures = snapPictures.then(async () => {
    const list = readSnaps();
    const i = list.findIndex((n) => n.id === id);
    if (i < 0 || !fs.existsSync(snapImage(id))) return;      // deleted or reported meanwhile
    try {
      const image = await reportPicture([list[i]], { title: APP_NAME, single: true, number: i + 1 });
      clipboard.writeImage(image);
      notify('snap-copied', { number: i + 1 });
    } catch {
      notify('snap-error', `Snap ${i + 1} is saved, but it could not be copied as a picture. Copy picture in Smart Snap copies its screenshot alone.`);
    }
  });
}

// ---- Interface ----------------------------------------------------------------
ipcMain.handle('set-theme', (event, theme) => {
  const name = TITLE_BAR[theme] ? theme : 'dark';
  if (loadSettings().appTheme !== name) { settings.appTheme = name; saveSettings(); }
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  win.setBackgroundColor(TITLE_BAR[name].color);
  if (CUSTOM_TITLE_BAR) win.setTitleBarOverlay({ ...TITLE_BAR[name], height: TITLE_BAR_HEIGHT });
});

ipcMain.handle('config', async () => ({
  shortcuts: SHORTCUTS,
  shortcutProblems: printScreenState === 'held' ? [...shortcutProblems, PRINT_SCREEN] : shortcutProblems,
  printScreen: { on: loadSettings().printScreen !== false, windowsTakesIt: await windowsTakesPrintScreen() },
  pinned: !!loadSettings().pinned,
  author: loadSettings().author || '',
  startWithWindows: app.getLoginItemSettings().openAtLogin,
  keepAfterReport: !!loadSettings().keepAfterReport,
  recording: rec ? rec.stage : null,
  version: app.getVersion(),
  platform: process.platform,
}));

ipcMain.handle('snap', (_e, mode, wait) => {
  if (!['area', 'window', 'full'].includes(mode)) return;
  snap(mode, Math.min(30, Math.max(0, Number(wait) || 0)));
});

// Record a video, or stop the one being recorded.
ipcMain.handle('record', () => { record(); });

ipcMain.handle('snaps-list', () => readSnaps().map((n) => ({
  ...n,
  src: pathToFileURL(snapImage(n.id)).href,
  icon: n.hasIcon ? pathToFileURL(snapIcon(n.id)).href : null,
  video: n.video ? { ...n.video, src: pathToFileURL(n.video.file).href, missing: !fs.existsSync(n.video.file) } : null,
})));

ipcMain.handle('snaps-update', (_e, id, change) => {
  const list = readSnaps();
  const n = list.find((x) => x.id === id);
  if (!n || !change || typeof change !== 'object') return false;
  if ('text' in change) n.text = String(change.text || '').slice(0, 5000);
  if ('url' in change) n.url = String(change.url || '').trim().slice(0, 4000);
  if ('mark' in change) n.mark = cleanMark(change.mark);
  writeSnaps(list);
  return true;
});

ipcMain.handle('snaps-move', (_e, id, step) => {
  const list = readSnaps();
  const i = list.findIndex((x) => x.id === id);
  const j = i + (step < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  writeSnaps(list);
  return true;
});

ipcMain.handle('snaps-delete', async (_e, id) => {
  const list = readSnaps();
  writeSnaps(list.filter((n) => n.id !== id));
  removeSnapFiles(String(id));
  await trashVideo(list.find((n) => n.id === id));
});

ipcMain.handle('snaps-clear', async () => {
  const list = readSnaps();
  for (const n of list) removeSnapFiles(n.id);
  writeSnaps([]);
  for (const n of list) await trashVideo(n);
});

// A screenshot goes on the clipboard as a picture ("picture"), a video as its
// file ("video").
ipcMain.handle('snaps-copy', async (_e, id) => {
  const n = readSnaps().find((x) => x.id === id);
  if (n && n.video) return (await copyVideo(n)) ? 'video' : false;
  if (!UUID.test(String(id)) || !fs.existsSync(snapImage(id))) return false;
  clipboard.writeImage(nativeImage.createFromPath(snapImage(id)));
  return 'picture';
});

// A video's file, shown in its folder.
ipcMain.handle('snaps-show-video', (_e, id) => {
  const n = readSnaps().find((x) => x.id === id);
  if (!n || !n.video || !fs.existsSync(n.video.file)) return false;
  shell.showItemInFolder(n.video.file);
  return true;
});

// Saves the picture on its own, as a PNG in the Screenshots folder.
ipcMain.handle('snaps-save', (_e, id) => {
  const n = readSnaps().find((x) => x.id === id);
  if (!n || !fs.existsSync(snapImage(n.id))) return null;
  const dir = outputDir('Screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const t = new Date(n.time);
  const p = (v) => String(v).padStart(2, '0');
  const when = `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}.${p(t.getMinutes())}.${p(t.getSeconds())}`;
  const file = path.join(dir, `${safeName(n.app && n.app.name, 'Screenshot')} ${when}.png`);
  fs.copyFileSync(snapImage(n.id), file);
  return file;
});

ipcMain.handle('report', (_e, opts) => createReport(opts || {}));
ipcMain.handle('report-copy', (_e, opts) => copyReport(opts || {}));

// Opens a report, and only a report: a PDF inside the reports folder.
ipcMain.handle('report-open', (_e, file) => {
  const full = path.resolve(String(file));
  if (path.dirname(full) === path.resolve(reportsDir()) && full.toLowerCase().endsWith('.pdf')) return shell.openPath(full);
  return null;
});

ipcMain.handle('reveal', (_e, file) => {
  const full = path.resolve(String(file));
  if (full.startsWith(path.resolve(outputFolder()) + path.sep)) shell.showItemInFolder(full);
});

// Opens a snap's link in the default browser; web and file addresses only.
ipcMain.handle('open-link', (_e, url) => {
  if (/^https?:\/\//i.test(String(url))) shell.openExternal(String(url));
});

ipcMain.handle('output-get', () => ({ dir: outputFolder() }));
ipcMain.handle('output-choose', async (event) => {
  await chooseOutputFolder(BrowserWindow.fromWebContents(event.sender));
  return { dir: outputFolder() };
});
ipcMain.handle('output-open', async () => {
  const dir = outputFolder();
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* shown as an error below */ }
  const problem = await shell.openPath(dir);
  return { dir, error: problem || null };
});

ipcMain.handle('settings-set', (_e, change) => {
  if (!change || typeof change !== 'object') return;
  if ('startWithWindows' in change) {
    app.setLoginItemSettings({ openAtLogin: !!change.startWithWindows, args: ['--hidden'] });
  }
  if ('keepAfterReport' in change) {
    loadSettings().keepAfterReport = !!change.keepAfterReport;
    saveSettings();
  }
  if ('printScreen' in change) {
    loadSettings().printScreen = !!change.printScreen;
    saveSettings();
    registerShortcuts();
  }
  if ('pinned' in change) {
    loadSettings().pinned = !!change.pinned;
    saveSettings();
    if (mainWin && !mainWin.isDestroyed()) mainWin.setAlwaysOnTop(!!change.pinned);
  }
});

// Where Windows' own use of the Print Screen key is switched off.
ipcMain.handle('open-keyboard-settings', () => shell.openExternal('ms-settings:easeofaccess-keyboard'));

ipcMain.on('interface-ready', () => {
  if (mainWin && !mainWin.isDestroyed() && !mainWin.isVisible() && !STARTED_HIDDEN) revealMain();
});

// ---- Updates ----------------------------------------------------------------
// New versions are published as releases on GitHub. The app asks GitHub which
// release is the latest. Only when the user chooses "Update now" does it
// download the file that matches how it was installed (installer or portable),
// check it against the SHA-256 checksums that GitHub and the release notes give
// for it, and run it.
const UPDATE_REPO = 'Rady193/smart-snap';
const UPDATE_PAGE = `https://github.com/${UPDATE_REPO}/releases/latest`;
// The newest release is asked of the SCAFFApps website first (releases.js), GitHub's API last. A stand-in for
// GitHub's releases/latest can be named for tests; it is then asked alone.
const UPDATE_TEST = process.env.SMART_SNAP_UPDATE_API || null;
const UPDATE_EVERY = 24 * 60 * 60 * 1000;
const UPDATE_AGENT = `SmartSnap/${app.getVersion()}`;
const UPDATE_FILES = {
  installed: /^Smart-Snap-Setup-\d+(\.\d+)*\.exe$/i,
  portable: /^Smart-Snap-\d+(\.\d+)*-portable\.exe$/i,
};
// The installer starts the new version with this argument when it is done.
const JUST_UPDATED = process.argv.includes('--updated');

const update = {
  state: 'idle',   // idle | checking | current | available | downloading | installing | error
  latest: null,    // the newest release: { version, name, notes, page, published, asset }
  progress: null,  // { received, total } while downloading
  error: null,
  checkedAt: 0,
};
let updateAbort = null;

// How this copy was installed decides what "Update now" downloads.
function installKind() {
  if (!app.isPackaged) return 'source';
  if (process.platform !== 'win32') return 'other';
  if (process.env.PORTABLE_EXECUTABLE_FILE) return 'portable';
  if (fs.existsSync(path.join(path.dirname(process.execPath), 'Uninstall Smart Snap.exe'))) return 'installed';
  return 'other';
}

function versionParts(v) {
  return String(v).replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
}

function isNewer(a, b) {
  const x = versionParts(a);
  const y = versionParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

// The checksum a download must have. GitHub works one out for every file it
// holds, and the release notes list one per file; where both exist they must
// agree. Returns null when there is none, 'mismatch' when they differ.
function expectedChecksum(asset, notes) {
  const sums = new Set();
  const digest = /^sha256:([0-9a-f]{64})$/i.exec(asset.digest || '');
  if (digest) sums.add(digest[1].toLowerCase());
  for (const line of String(notes || '').split('\n')) {
    if (!line.includes(asset.name)) continue;
    const listed = /\b[0-9a-f]{64}\b/i.exec(line);
    if (listed) sums.add(listed[0].toLowerCase());
  }
  if (!sums.size) return null;
  return sums.size === 1 ? [...sums][0] : 'mismatch';
}

function updateMessage(err) {
  const text = String((err && err.message) || err || '');
  if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_NETWORK|ERR_TIMED_OUT|ERR_PROXY/i.test(text)) {
    return 'GitHub could not be reached. Check the internet connection and try again.';
  }
  return text || 'Something went wrong.';
}

function updateStatus() {
  const l = update.latest;
  const kind = installKind();
  return {
    current: app.getVersion(),
    kind,
    auto: loadSettings().updateAuto !== false,
    state: update.state,
    checkedAt: update.checkedAt || loadSettings().updateCheckedAt || 0,
    latest: l && {
      version: l.version,
      name: l.name,
      notes: l.notes,
      published: l.published,
      size: l.asset ? l.asset.size : 0,
      // Why "Update now" cannot be offered, if it cannot.
      manual: kind === 'source' ? 'source'
        : kind === 'other' ? 'other'
          : !l.asset ? 'no-file'
            : !l.asset.sha256 || l.asset.sha256 === 'mismatch' ? 'unverified' : null,
      file: l.asset ? l.asset.name : null,
    },
    progress: update.progress,
    error: update.error,
    justUpdated: JUST_UPDATED,
  };
}

function sendUpdate() {
  const status = updateStatus();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update-status', status);
  }
}

async function checkForUpdates() {
  if (['checking', 'downloading', 'installing'].includes(update.state)) return updateStatus();
  update.state = 'checking';
  update.error = null;
  sendUpdate();
  try {
    const release = await releases.latest(UPDATE_REPO, { agent: UPDATE_AGENT, test: UPDATE_TEST });
    const version = String(release.tag_name || '').replace(/^v/i, '');
    if (!/^\d+(\.\d+)*$/.test(version)) throw new Error('The latest release has no version number.');
    const pattern = UPDATE_FILES[installKind()];
    const asset = pattern && (release.assets || []).find((a) => pattern.test(a.name || ''));
    const page = /^https:\/\/github\.com\//.test(release.html_url || '') ? release.html_url : UPDATE_PAGE;
    update.latest = {
      version,
      name: String(release.name || `Smart Snap ${version}`),
      notes: String(release.body || ''),
      page,
      published: release.published_at || null,
      asset: asset ? {
        name: asset.name,
        url: asset.browser_download_url,
        size: Number(asset.size) || 0,
        sha256: expectedChecksum(asset, release.body),
      } : null,
    };
    update.state = isNewer(version, app.getVersion()) ? 'available' : 'current';
    update.checkedAt = Date.now();
    loadSettings().updateCheckedAt = update.checkedAt;
    saveSettings();
  } catch (err) {
    // A newer version found by an earlier check is still on offer.
    update.state = update.latest && isNewer(update.latest.version, app.getVersion()) ? 'available' : 'error';
    update.error = updateMessage(err);
  }
  sendUpdate();
  return updateStatus();
}

function sha256File(file) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('error', () => resolve(null))
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

// Downloads a release file into the first of the folders that can be written
// to and returns its path. It is written under a temporary name and only
// given its real name once its checksum is right.
async function downloadVerified(asset, folders) {
  let handle = null;
  let dest = null;
  for (const dir of folders) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const candidate = path.join(dir, asset.name);
      // Already downloaded by an earlier attempt that did not finish: use it.
      if (fs.existsSync(candidate) && await sha256File(candidate) === asset.sha256) return candidate;
      handle = await fs.promises.open(candidate + '.part', 'w');
      dest = candidate;
      break;
    } catch { /* not writable: try the next folder */ }
  }
  if (!handle) throw new Error('There is no folder the update can be saved in.');
  const part = dest + '.part';
  updateAbort = new AbortController();
  try {
    const res = await net.fetch(asset.url, { headers: { 'User-Agent': UPDATE_AGENT }, signal: updateAbort.signal });
    if (!res.ok || !res.body) throw new Error(`The download failed (error ${res.status}). Try again later.`);
    const total = asset.size || Number(res.headers.get('content-length')) || 0;
    const hash = crypto.createHash('sha256');
    const reader = res.body.getReader();
    let received = 0;
    let shown = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      await handle.write(value);
      received += value.length;
      if (Date.now() - shown > 200) {
        shown = Date.now();
        update.progress = { received, total };
        sendUpdate();
      }
    }
    await handle.close();
    handle = null;
    if (total && received !== total) throw new Error('The download was incomplete. Try again.');
    if (hash.digest('hex') !== asset.sha256) {
      throw new Error('The downloaded file did not match its published checksum, so it was not used.');
    }
    fs.renameSync(part, dest);
    return dest;
  } catch (err) {
    if (handle) await handle.close().catch(() => {});
    try { fs.unlinkSync(part); } catch { /* already gone */ }
    throw err;
  } finally {
    updateAbort = null;
  }
}

// The installer needs administrator rights, so it is started through Windows,
// which asks for permission first. It runs without its pages, closes this copy
// if it is still open, and opens the new version when it is done.
function runInstaller(file) {
  const command = "try { Start-Process -FilePath $env:SMART_SNAP_SETUP -ArgumentList '--updated','/S','--force-run' -Verb RunAs -ErrorAction Stop } catch { exit 1 }";
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { env: { ...process.env, SMART_SNAP_SETUP: file }, windowsHide: true },
      (err) => (err
        ? reject(new Error('The installer did not start. If Windows asked for permission and it was refused, choose Update now again.'))
        : resolve()));
  });
}

// A portable copy cannot replace itself while it runs: the new file is saved
// beside it and started instead, and told which file it replaces so it can
// delete it once this copy has closed. This copy first lets go of the "one
// copy at a time" lock and the shortcuts, so the new one can take them.
function runPortable(file) {
  return new Promise((resolve, reject) => {
    app.releaseSingleInstanceLock();
    globalShortcut.unregisterAll();
    const args = ['--updated'];
    if (process.env.PORTABLE_EXECUTABLE_FILE) args.push(`--replaces=${process.env.PORTABLE_EXECUTABLE_FILE}`);
    const child = spawn(file, args, { detached: true, stdio: 'ignore' });
    child.once('error', () => {
      app.requestSingleInstanceLock();
      registerShortcuts();
      reject(new Error(`The new version could not be started. It is saved at ${file}.`));
    });
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

async function installUpdate() {
  const l = update.latest;
  const kind = installKind();
  if (update.state !== 'available' || !l || !l.asset || !UPDATE_FILES[kind]) return updateStatus();
  if (!l.asset.sha256 || l.asset.sha256 === 'mismatch') return updateStatus();
  update.state = 'downloading';
  update.error = null;
  update.progress = { received: 0, total: l.asset.size };
  sendUpdate();
  let file;
  try {
    const folders = kind === 'portable'
      ? [process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.env.PORTABLE_EXECUTABLE_FILE), app.getPath('downloads')]
      : [path.join(app.getPath('temp'), 'Smart Snap update')];
    file = await downloadVerified(l.asset, folders);
  } catch (err) {
    update.state = 'available';
    update.progress = null;
    update.error = err && err.name === 'AbortError' ? null : updateMessage(err);
    sendUpdate();
    return updateStatus();
  }
  update.state = 'installing';
  update.progress = null;
  sendUpdate();
  try {
    if (kind === 'installed') await runInstaller(file);
    else await runPortable(file);
  } catch (err) {
    update.state = 'available';
    update.error = updateMessage(err);
    sendUpdate();
    return updateStatus();
  }
  // Give the interface a moment to say what is happening, then make way.
  setTimeout(() => app.quit(), 1500);
  return updateStatus();
}

// After an update, what the old version left behind is removed: the old
// portable file, or the downloaded installer. The old copy may still be
// closing, so this is tried for a while.
function cleanUpAfterUpdate() {
  if (!JUST_UPDATED) return;
  const targets = [];
  const arg = process.argv.find((a) => a.startsWith('--replaces='));
  const old = arg ? path.resolve(arg.slice('--replaces='.length)) : '';
  const self = process.env.PORTABLE_EXECUTABLE_FILE ? path.resolve(process.env.PORTABLE_EXECUTABLE_FILE) : '';
  // Only ever an older Smart Snap portable file, never this one.
  if (old && old.toLowerCase() !== self.toLowerCase() && UPDATE_FILES.portable.test(path.basename(old))) targets.push(old);
  if (installKind() === 'installed') targets.push(path.join(app.getPath('temp'), 'Smart Snap update'));
  let tries = 0;
  const attempt = () => {
    for (let i = targets.length - 1; i >= 0; i--) {
      try { fs.rmSync(targets[i], { recursive: true, force: true }); } catch { continue; }
      if (!fs.existsSync(targets[i])) targets.splice(i, 1);
    }
    if (targets.length && ++tries < 30) setTimeout(attempt, 2000);
  };
  setTimeout(attempt, 1500);
}

ipcMain.handle('update-status', () => updateStatus());
ipcMain.handle('update-check', () => checkForUpdates());
ipcMain.handle('update-install', () => installUpdate());
ipcMain.handle('update-cancel', () => { if (updateAbort) updateAbort.abort(); });
ipcMain.handle('update-auto', (_e, on) => {
  loadSettings().updateAuto = !!on;
  saveSettings();
  return updateStatus();
});
ipcMain.handle('update-page', () => shell.openExternal(update.latest ? update.latest.page : UPDATE_PAGE));

// Checks a few seconds after start, then once a day while the app stays open,
// unless automatic checks are turned off in Settings.
function scheduleUpdateChecks() {
  const auto = () => { if (loadSettings().updateAuto !== false) checkForUpdates(); };
  setTimeout(auto, 8000);
  setInterval(auto, UPDATE_EVERY);
}

// ---- Main window and tray -----------------------------------------------------
let quitting = false;
let toldAboutTray = false;

function createMain() {
  const colors = TITLE_BAR[loadSettings().appTheme] || TITLE_BAR.dark;
  const area = screen.getPrimaryDisplay().workArea;
  // Wide enough for the toolbar to show its shortcuts (1343 px), where the screen allows.
  const width = Math.min(1400, area.width - 40);
  const height = Math.min(860, area.height - 40);
  mainWin = new BrowserWindow({
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width, height, minWidth: 820, minHeight: 560,
    show: false,
    alwaysOnTop: !!loadSettings().pinned,   // pinned on top of other programs (the pin in the bar)
    backgroundColor: colors.color,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: ICON,
    ...(CUSTOM_TITLE_BAR ? { titleBarStyle: 'hidden', titleBarOverlay: { ...colors, height: TITLE_BAR_HEIGHT } } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  // Closing the window keeps Smart Snap in the tray, where the shortcuts work.
  mainWin.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    mainWin.hide();
    if (!toldAboutTray && tray) {
      toldAboutTray = true;
      tray.displayBalloon({
        iconType: 'info',
        title: 'Smart Snap is still running',
        content: `Take a snap with ${SHORTCUTS.area.replace(/\+/g, ' + ').replace('Control', 'Ctrl')}. Quit from the tray icon.`,
      });
    }
  });
  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWin.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWin.loadFile(path.join(__dirname, 'app', 'index.html'));
  if (!STARTED_HIDDEN) setTimeout(() => revealMain(), 3500);
}

function revealMain() {
  if (!mainWin || mainWin.isDestroyed() || mainWin.isVisible()) return;
  mainWin.show();
  ensureOutputFolder(mainWin);
}

function showMain() {
  if (!mainWin || mainWin.isDestroyed()) createMain();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
  if (!loadSettings().outputDir) ensureOutputFolder(mainWin);
}

// While a video is recorded, its item stops it and the snaps wait.
function trayMenu() {
  const key = (k) => k.replace('Control', 'Ctrl');
  const idle = !rec;
  return Menu.buildFromTemplate([
    { label: 'Snap an area', accelerator: key(SHORTCUTS.area), click: () => snap('area', 0.3), enabled: idle },
    { label: 'Snap the window in front', accelerator: key(SHORTCUTS.window), click: () => snap('window', 0.3), enabled: idle },
    { label: 'Snap the full screen', accelerator: key(SHORTCUTS.full), click: () => snap('full', 0.3), enabled: idle },
    { label: 'Snap an area in 5 seconds', click: () => snap('area', 5), enabled: idle },
    recordingLive()
      ? { label: 'Stop recording', accelerator: key(SHORTCUTS.record), click: () => { if (recordingLive()) rec.end('save'); } }
      : { label: 'Record a video', accelerator: key(SHORTCUTS.record), click: () => record(), enabled: idle },
    { type: 'separator' },
    { label: 'Open Smart Snap', click: () => showMain() },
    { label: 'Open the output folder', click: () => shell.openPath(outputFolder()) },
    { label: 'Check for updates', click: () => { showMain(); notify('open-updates'); checkForUpdates(); } },
    { type: 'separator' },
    { label: 'Quit Smart Snap', click: () => { quitting = true; app.quit(); } },
  ]);
}

function buildTray() {
  const image = nativeImage.createFromPath(ICON).resize({ width: 32, height: 32, quality: 'best' });
  tray = new Tray(image);
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(trayMenu());
  tray.on('click', () => showMain());
}

let shortcutProblems = [];
function registerShortcuts() {
  globalShortcut.unregisterAll();
  shortcutProblems = [];
  for (const [mode, keys] of Object.entries(SHORTCUTS)) {
    let ok = false;
    try { ok = globalShortcut.register(keys, () => (mode === 'record' ? record() : snap(mode))); } catch { ok = false; }
    if (!ok) shortcutProblems.push(keys);
  }
  if (loadSettings().printScreen !== false) { printScreenRetries = 0; startPrintScreen(); }
  else stopPrintScreen();
}

// ---- The Print Screen key -----------------------------------------------------
// Electron takes "PrintScreen" as a shortcut and says it is registered, but never
// asks Windows for the key, so it never fires. printscreen.ps1 claims it from
// Windows instead and says "ready", "held" (another program has it) or "pressed".
// It ends with Smart Snap, when its input closes, and Windows gives the key back.
let printScreenHelper = null;
let printScreenState = 'off';     // off, starting, ready, held
let printScreenRetries = 0;

function startPrintScreen() {
  if (process.platform !== 'win32' || printScreenHelper) return;   // already has the key, or is asking for it
  // PowerShell cannot read a script from inside the app's archive (see startHelper).
  const script = path.join(app.getPath('userData'), 'printscreen.ps1');
  try {
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.writeFileSync(script, fs.readFileSync(path.join(__dirname, 'printscreen.ps1')));
  } catch { return; }
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  printScreenHelper = child;
  printScreenState = 'starting';
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (printScreenHelper !== child) return;
      if (line === 'ready') { printScreenState = 'ready'; printScreenRetries = 0; }
      else if (line === 'held') printScreenState = 'held';
      else if (line === 'pressed') snap('area');
    }
  });
  child.on('error', () => {});
  child.on('exit', () => {
    if (printScreenHelper !== child) return;
    printScreenHelper = null;
    if (printScreenState !== 'held') printScreenState = 'off';
    // Held by another program (an older copy still closing after an update), or
    // ended unexpectedly: asked again a few times, while the key is wanted.
    if (!quitting && loadSettings().printScreen !== false && printScreenRetries < 3) {
      printScreenRetries++;
      setTimeout(() => { if (!printScreenHelper && !quitting && loadSettings().printScreen !== false) startPrintScreen(); }, 4000);
    }
  });
}

function stopPrintScreen() {
  const child = printScreenHelper;
  printScreenHelper = null;
  printScreenState = 'off';
  printScreenRetries = 0;
  if (!child) return;
  try { child.stdin.end(); } catch { /* already gone */ }
  setTimeout(() => { try { child.kill(); } catch { /* already gone */ } }, 1500);
}

// Windows 11 can send the Print Screen key to its Snipping Tool before any app
// sees it ("Use the Print screen key to open screen capture", in Settings >
// Accessibility > Keyboard). Not set means on in Windows 11, off in Windows 10.
function windowsTakesPrintScreen() {
  if (process.platform !== 'win32') return Promise.resolve(false);
  return new Promise((resolve) => {
    execFile('reg.exe', ['query', 'HKCU\\Control Panel\\Keyboard', '/v', 'PrintScreenKeyForSnippingEnabled'],
      { windowsHide: true, timeout: 5000 }, (_err, out) => {
        const m = /PrintScreenKeyForSnippingEnabled\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(String(out || ''));
        resolve(m ? parseInt(m[1], 16) !== 0 : Number(os.release().split('.')[2]) >= 22000);
      });
  });
}

if (app.hasSingleInstanceLock()) {
  app.whenReady().then(async () => {
    app.setAppUserModelId('com.scaffapps.smartsnap');
    // the user's name and e-mail, asked once for every SCAFFApps app (registration.js); required, even when started hidden
    const who = await registration.ensure({ appId: 'smart-snap', appName: 'Smart Snap', version: app.getVersion(),
      icon: ICON, theme: loadSettings().appTheme });
    if (!who) { app.quit(); return; }
    startHelper();
    buildTray();
    registerShortcuts();
    createMain();
    scheduleUpdateChecks();
    cleanUpAfterUpdate();
    // Started by an update: the old copy may hold the shortcuts for a moment.
    if (JUST_UPDATED && shortcutProblems.length) setTimeout(registerShortcuts, 4000);
  });
}

app.on('before-quit', (e) => {
  quitting = true;
  // A video being recorded is saved first, without asking for its comment
  // (record() quits once it is saved); one whose comment is being written is
  // saved with what it has.
  if (rec && !quitAfterRecording && ['recording', 'paused', 'stopping', 'comment'].includes(rec.stage)) {
    e.preventDefault();
    quitAfterRecording = true;
    if (recordingLive()) rec.end('quit');
    else if (rec.stage === 'comment' && commentDone) finishComment({ action: 'save', text: '', quiet: true });
  }
});
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopPrintScreen();
  if (helper) { try { helper.stdin.write('quit\n'); } catch { /* already gone */ } helper.kill(); }
});
// The tray keeps the app running when its window is closed.
app.on('window-all-closed', () => {});
