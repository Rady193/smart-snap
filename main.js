const {
  app, BrowserWindow, ipcMain, shell, nativeImage, dialog, screen, desktopCapturer,
  globalShortcut, Tray, Menu, clipboard, net,
} = require('electron');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const path = require('path');
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
};
const MODE_NAMES = { area: 'Area', window: 'Window', full: 'Full screen' };

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stamp = () => {
  const d = new Date();
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

// A picture of every display, at its full resolution.
async function captureDisplays() {
  const displays = screen.getAllDisplays();
  const size = { width: 1, height: 1 };
  for (const d of displays) {
    size.width = Math.max(size.width, Math.round(d.size.width * d.scaleFactor));
    size.height = Math.max(size.height, Math.round(d.size.height * d.scaleFactor));
  }
  const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: size });
  return displays.map((d, i) => {
    const source = sources.find((s) => s.display_id === String(d.id)) || sources[i];
    const phys = physicalBounds(d);
    let image = source ? source.thumbnail : null;
    // Thumbnails are scaled to fit the largest display; a smaller display's
    // picture is brought back to its own pixel size.
    if (image && !image.isEmpty() && image.getSize().width > phys.width + 1) {
      image = image.resize({ width: Math.round(phys.width), height: Math.round(phys.height), quality: 'best' });
    }
    return { display: d, phys, image };
  }).filter((s) => s.image && !s.image.isEmpty());
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
// One borderless window per display shows that display's frozen picture. Drag
// to choose an area, or click a window to take that window. Esc cancels.
let overlays = [];
let overlayDone = null;

function closeOverlays(result) {
  const done = overlayDone;
  overlayDone = null;
  for (const o of overlays) if (!o.win.isDestroyed()) o.win.destroy();
  overlays = [];
  globalShortcut.unregister('Escape');
  if (done) done(result);
}

function selectArea(shots, snapshot) {
  return new Promise((resolve) => {
    overlayDone = resolve;
    // Esc cancels even if no overlay has the keyboard.
    try { globalShortcut.register('Escape', () => closeOverlays(null)); } catch { /* the overlay's own Esc still works */ }
    const cursor = screen.getCursorScreenPoint();
    overlays = shots.map((shot, index) => {
      const d = shot.display;
      const win = new BrowserWindow({
        x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height,
        frame: false, show: false, resizable: false, movable: false, minimizable: false, maximizable: false,
        fullscreenable: false, skipTaskbar: true, hasShadow: false, enableLargerThanScreen: true,
        alwaysOnTop: true, backgroundColor: '#000000', title: 'Smart Snap selection',
        webPreferences: { preload: path.join(__dirname, 'overlay-preload.js'), contextIsolation: true, nodeIntegration: false },
      });
      win.setAlwaysOnTop(true, 'screen-saver');
      win.setBounds(d.bounds);
      // Window outlines in this display's own coordinates (CSS pixels).
      const k = d.bounds.width / shot.phys.width;
      const windows = (snapshot && snapshot.windows || [])
        .filter((w) => overlapArea(winRect(w), shot.phys) > 0)
        .map((w) => ({ hwnd: w.hwnd, x: (w.x - shot.phys.x) * k, y: (w.y - shot.phys.y) * k, w: w.w * k, h: w.h * k, title: w.title }));
      win.loadFile(path.join(__dirname, 'app', 'overlay.html'), { query: { index: String(index) } });
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('overlay-image', {
          // JPEG is quick to encode; the snap itself is cut from the original.
          src: 'data:image/jpeg;base64,' + shot.image.toJPEG(94).toString('base64'),
          windows,
        });
      });
      return { win, shot, index, cursorHere: contains(d.bounds, cursor.x, cursor.y) };
    });
  });
}

// Each overlay says when its picture is drawn; it is shown only then, so the
// screen does not flash black.
ipcMain.on('overlay-ready', (event) => {
  const o = overlays.find((x) => !x.win.isDestroyed() && x.win.webContents === event.sender);
  if (!o) return;
  o.win.show();
  if (o.cursorHere) o.win.focus();
});

ipcMain.on('overlay-done', (event, result) => {
  const from = overlays.find((o) => !o.win.isDestroyed() && o.win.webContents === event.sender);
  if (!from || !result) return closeOverlays(null);
  closeOverlays({ index: from.index, ...result });
});

// ---- Snaps --------------------------------------------------------------------
const snapsDir = () => path.join(app.getPath('userData'), 'snaps');
const snapsFile = () => path.join(snapsDir(), 'snaps.json');
const snapImage = (id) => path.join(snapsDir(), `${id}.png`);
const snapIcon = (id) => path.join(snapsDir(), `${id}-icon.png`);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
let mainWin = null;
let tray = null;

function notify(channel, payload) {
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send(channel, payload);
}

async function storeSnap(image, mode, info, displayName) {
  const id = crypto.randomUUID();
  fs.mkdirSync(snapsDir(), { recursive: true });
  fs.writeFileSync(snapImage(id), image.toPNG());
  let hasIcon = false;
  if (info && info.exe) {
    try {
      const icon = await app.getFileIcon(info.exe, { size: 'large' });
      if (!icon.isEmpty()) { fs.writeFileSync(snapIcon(id), icon.toPNG()); hasIcon = true; }
    } catch { /* no icon */ }
  }
  const size = image.getSize();
  const a = info || {};
  const snap = {
    id,
    time: Date.now(),
    mode,
    imgW: size.width,
    imgH: size.height,
    display: displayName || '',
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

// Takes one snap. `mode` is "area", "window" or "full".
async function snap(mode, wait = 0) {
  if (snapping || overlayDone) return;
  snapping = true;
  let hidOwn = false;
  try {
    // A snap started from Smart Snap's own window must not show that window.
    if (mainWin && !mainWin.isDestroyed() && mainWin.isVisible() && mainWin.isFocused()) {
      mainWin.hide();
      hidOwn = true;
      await delay(300);
    }
    if (wait > 0) await delay(wait * 1000);

    const snapshot = await ask('snapshot');
    const shots = await captureDisplays();
    if (!shots.length) throw new Error('Windows did not hand over a picture of the screen.');
    const all = screen.getAllDisplays();
    const nameOf = (shot) => displayLabel(shot.display, all.findIndex((d) => d.id === shot.display.id), all.length);

    let image = null;
    let hwnd = 0;
    let displayName = '';

    if (mode === 'area') {
      const picked = await selectArea(shots, snapshot);
      if (!picked) { if (hidOwn) showMain(); return; }
      const shot = shots[picked.index];
      const k = shot.phys.width / shot.display.bounds.width;
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

    const info = hwnd ? await ask(`info ${hwnd}`) : null;
    const saved = await storeSnap(image, mode, info && !info.error ? info : null, displayName);
    showMain();
    notify('snaps-changed', { select: saved.id, fresh: true });
  } catch (err) {
    showMain();
    notify('snap-error', String(err && err.message || err));
  } finally {
    snapping = false;
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
  // A4 with 14 mm margins leaves 182 mm across; the picture is kept short
  // enough for the snap and its details to share a page.
  const ratio = n.imgW / n.imgH;
  let w = 182; let h = w / ratio;
  if (h > 150) { h = 150; w = h * ratio; }
  // Small snaps are not blown up beyond about their size on screen.
  const naturalW = n.imgW * 0.2;
  if (w > naturalW && naturalW > 40) { w = naturalW; h = w / ratio; }
  const mark = n.mark ? markHtml(n.mark, number, { x: 0, y: 0, w: 1, h: 1 }) : '';
  let detail = '';
  if (n.mark) {
    const c = closeUp(n);
    const aspect = (c.w * n.imgW) / (c.h * n.imgH);
    let dw = 66; let dh = dw / aspect;
    if (dh > 52) { dh = 52; dw = dh * aspect; }
    detail = `<div class="detail"><div class="img" style="width:${dw.toFixed(1)}mm;height:${dh.toFixed(1)}mm"><img src="${src}" style="left:${pct(-c.x / c.w)};top:${pct(-c.y / c.h)};width:${pct(1 / c.w)};height:${pct(1 / c.h)}">${markHtml(n.mark, number, c)}</div><div class="cap">Close-up of the marked ${n.mark.type === 'area' ? 'area' : 'spot'}</div></div>`;
  }
  const icon = n.hasIcon && fs.existsSync(snapIcon(n.id)) ? `<img class="appicon" src="${pathToFileURL(snapIcon(n.id)).href}">` : '';
  const rows = [
    ['Application', esc(appLine(a))],
    a.title ? ['Window', esc(a.title)] : null,
    n.url ? ['Link', linkHtml(n.url)] : null,
    !n.url && a.location ? ['Folder', esc(a.location)] : null,
    ['Taken', esc(`${new Date(n.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })} · ${MODE_NAMES[n.mode] || 'Snap'}${n.display ? ` on ${n.display}` : ''} · ${n.imgW} × ${n.imgH} px`)],
    a.exe ? ['Program', esc(a.exe)] : null,
  ].filter(Boolean).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
  return `<section class="snap">
  <div class="head"><span class="num">${number}</span>${icon}<div class="who"><b>${esc(a.name || a.process || 'Unknown application')}</b><span>${esc(a.title || '')}</span></div></div>
  ${n.text ? `<p class="text">${esc(n.text).replace(/\n/g, '<br>')}</p>` : ''}
  <div class="img shot" style="width:${w.toFixed(1)}mm;height:${h.toFixed(1)}mm"><img src="${src}" style="width:100%;height:100%">${mark}</div>
  <div class="facts">${detail}<table class="meta">${rows}</table></div>
</section>`;
}

function reportHtml(list, opts) {
  const apps = [...new Set(list.map((n) => (n.app && (n.app.name || n.app.process)) || 'Unknown'))];
  const summary = list.map((n, i) => {
    const a = n.app || {};
    const where = n.url ? linkHtml(n.url) : esc(a.location || a.title || '');
    return `<tr><td class="n">${i + 1}</td><td>${esc(a.name || a.process || 'Unknown')}</td><td class="where">${where}</td><td>${esc(new Date(n.time).toLocaleTimeString([], { timeStyle: 'short' }))}</td></tr>`;
  }).join('');
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
</style></head><body>
<header>
  <div class="brand"><img src="${pathToFileURL(ICON).href}" alt="">${APP_NAME}</div>
  <h1>${esc(opts.title)}</h1>
  <div class="cards">
    ${opts.author ? `<div><b>Prepared by</b>${esc(opts.author)}</div>` : ''}
    <div class="wide"><b>Taken</b>${esc(period)}</div>
    <div><b>Screenshots</b>${list.length}</div>
    <div class="wide"><b>Applications</b>${esc(apps.join(', '))}</div>
  </div>
  <table class="sum"><tr><th>#</th><th>Application</th><th>Page, window or folder</th><th>Time</th></tr>${summary}</table>
</header>
${list.map((n, i) => snapHtml(n, i + 1)).join('')}
</body></html>`;
}

async function createReport(opts) {
  const ids = Array.isArray(opts.ids) ? new Set(opts.ids.map(String)) : null;
  const list = readSnaps().filter((n) => (!ids || ids.has(n.id)) && UUID.test(n.id) && fs.existsSync(snapImage(n.id)));
  if (!list.length) return { error: 'There are no screenshots to report.' };
  const title = String(opts.title || '').trim().slice(0, 150) || 'Screenshot report';
  const author = String(opts.author || '').trim().slice(0, 150);
  const s = loadSettings();
  if (s.author !== author) { s.author = author; saveSettings(); }
  const htmlFile = path.join(snapsDir(), 'report.html');
  let win;
  try {
    fs.writeFileSync(htmlFile, reportHtml(list, { title, author }));
    win = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { javascript: false } });
    await win.loadFile(htmlFile);
    // Margins are in inches; the footer carries the page number.
    const pdf = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.55, bottom: 0.75, left: 0.55, right: 0.55 },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 14mm;display:flex;justify-content:space-between;font:7.5pt Segoe UI,sans-serif;color:#8b93a5"><span>${esc(title)} · ${APP_NAME}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
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
  } finally {
    if (win && !win.isDestroyed()) win.destroy();
    fs.rmSync(htmlFile, { force: true });
  }
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

ipcMain.handle('config', () => ({
  shortcuts: SHORTCUTS,
  shortcutProblems: shortcutProblems,
  author: loadSettings().author || '',
  startWithWindows: app.getLoginItemSettings().openAtLogin,
  keepAfterReport: !!loadSettings().keepAfterReport,
  version: app.getVersion(),
  platform: process.platform,
}));

ipcMain.handle('snap', (_e, mode, wait) => {
  if (!['area', 'window', 'full'].includes(mode)) return;
  snap(mode, Math.min(30, Math.max(0, Number(wait) || 0)));
});

ipcMain.handle('snaps-list', () => readSnaps().map((n) => ({
  ...n,
  src: pathToFileURL(snapImage(n.id)).href,
  icon: n.hasIcon ? pathToFileURL(snapIcon(n.id)).href : null,
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

ipcMain.handle('snaps-delete', (_e, id) => {
  writeSnaps(readSnaps().filter((n) => n.id !== id));
  removeSnapFiles(String(id));
});

ipcMain.handle('snaps-clear', () => {
  for (const n of readSnaps()) removeSnapFiles(n.id);
  writeSnaps([]);
});

ipcMain.handle('snaps-copy', (_e, id) => {
  if (!UUID.test(String(id)) || !fs.existsSync(snapImage(id))) return false;
  clipboard.writeImage(nativeImage.createFromPath(snapImage(id)));
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
});

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
// A stand-in for GitHub can be named for tests.
const UPDATE_API = process.env.SMART_SNAP_UPDATE_API || `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;
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
    const res = await net.fetch(UPDATE_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': UPDATE_AGENT },
      cache: 'no-store',
    });
    if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting how often it can be asked. Try again in an hour.');
    if (res.status === 404) throw new Error('No release has been published yet.');
    if (!res.ok) throw new Error(`GitHub answered with error ${res.status}. Try again later.`);
    const release = await res.json();
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
  const width = Math.min(1280, area.width - 40);
  const height = Math.min(860, area.height - 40);
  mainWin = new BrowserWindow({
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width, height, minWidth: 820, minHeight: 560,
    show: false,
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

function buildTray() {
  const image = nativeImage.createFromPath(ICON).resize({ width: 32, height: 32, quality: 'best' });
  tray = new Tray(image);
  tray.setToolTip(APP_NAME);
  const key = (k) => k.replace('Control', 'Ctrl');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Snap an area', accelerator: key(SHORTCUTS.area), click: () => snap('area', 0.3) },
    { label: 'Snap the window in front', accelerator: key(SHORTCUTS.window), click: () => snap('window', 0.3) },
    { label: 'Snap the full screen', accelerator: key(SHORTCUTS.full), click: () => snap('full', 0.3) },
    { label: 'Snap an area in 5 seconds', click: () => snap('area', 5) },
    { type: 'separator' },
    { label: 'Open Smart Snap', click: () => showMain() },
    { label: 'Open the output folder', click: () => shell.openPath(outputFolder()) },
    { label: 'Check for updates', click: () => { showMain(); notify('open-updates'); checkForUpdates(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => showMain());
}

let shortcutProblems = [];
function registerShortcuts() {
  globalShortcut.unregisterAll();
  shortcutProblems = [];
  for (const [mode, keys] of Object.entries(SHORTCUTS)) {
    let ok = false;
    try { ok = globalShortcut.register(keys, () => snap(mode)); } catch { ok = false; }
    if (!ok) shortcutProblems.push(keys);
  }
}

if (app.hasSingleInstanceLock()) {
  app.whenReady().then(() => {
    app.setAppUserModelId('com.scaffapps.smartsnap');
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

app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (helper) { try { helper.stdin.write('quit\n'); } catch { /* already gone */ } helper.kill(); }
});
// The tray keeps the app running when its window is closed.
app.on('window-all-closed', () => {});
