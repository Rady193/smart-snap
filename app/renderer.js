'use strict';
const api = window.smartSnap;
const $ = (id) => document.getElementById(id);

let snaps = [];
let selected = null;
let config = null;

const MODES = { area: 'Area', window: 'Window', full: 'Full screen' };
const keyText = (k) => k.replace('Control', 'Ctrl').replace('PrintScreen', 'PrtScn').replace(/\+/g, ' + ');

// ---- Appearance -------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('appTheme', JSON.stringify(theme));
  $('theme-btn').querySelector('use').setAttribute('href', theme === 'light' ? '#i-moon' : '#i-sun');
  api.setTheme(theme);
}
$('theme-btn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

// ---- Toast --------------------------------------------------------------------
let toastTimer = 0;
function toast(text, actions = [], error = false, onClick = null) {
  clearTimeout(toastTimer);
  $('toast-text').textContent = text;
  $('toast-text').onclick = onClick ? () => { hideToast(); onClick(); } : null;
  $('toast').classList.toggle('clickable', !!onClick);
  const box = $('toast-actions');
  box.replaceChildren(...actions.map(([label, fn]) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { fn(); hideToast(); };
    return b;
  }));
  $('toast').classList.toggle('error', error);
  $('toast').hidden = false;
  toastTimer = setTimeout(hideToast, actions.length ? 9000 : 3500);
}
function hideToast() { $('toast').hidden = true; }

// ---- List -------------------------------------------------------------------
const snapById = (id) => snaps.find((s) => s.id === id);

async function refresh(select) {
  snaps = await api.snaps.list();
  if (select && snapById(select)) selected = select;
  if (!snapById(selected)) selected = snaps.length ? snaps[snaps.length - 1].id : null;
  drawList();
  drawEditor();
}

function sourceLine(s) {
  return s.url || s.app.location || s.app.title || '';
}

function drawList() {
  const list = $('list');
  list.replaceChildren(...snaps.map((s, i) => {
    const li = document.createElement('li');
    li.className = s.id === selected ? 'on' : '';
    li.innerHTML = `<span class="n"></span><img class="thumb" alt=""><div class="t"><div class="a"></div><div class="s"></div><div class="c"></div></div>`;
    li.querySelector('.n').textContent = i + 1;
    li.querySelector('.thumb').src = s.src;
    const a = li.querySelector('.a');
    if (s.icon) { const img = document.createElement('img'); img.src = s.icon; a.append(img); }
    a.append(s.app.name || 'Unknown application');
    li.querySelector('.s').textContent = sourceLine(s);
    li.querySelector('.c').textContent = s.text;
    li.title = [s.app.name, s.app.title, s.url].filter(Boolean).join('\n');
    li.onclick = () => { selected = s.id; drawList(); drawEditor(); };
    return li;
  }));
  $('count').textContent = snaps.length || '';
  $('report-btn').disabled = !snaps.length;
  if (!$('copy-report-btn').busy) $('copy-report-btn').disabled = !snaps.length;
  $('clear-btn').hidden = !snaps.length;
  const on = list.querySelector('li.on');
  if (on) on.scrollIntoView({ block: 'nearest' });
}

// ---- Editor -----------------------------------------------------------------
function drawEditor() {
  const s = snapById(selected);
  $('editor').hidden = !s;
  $('empty').hidden = !!s;
  if (!s) return;
  const i = snaps.indexOf(s);
  $('app-icon').hidden = !s.icon;
  if (s.icon) $('app-icon').src = s.icon;
  $('app-name').textContent = s.app.name || 'Unknown application';
  $('app-title').textContent = s.app.title || '';
  $('app-title').title = s.app.title || '';
  $('taken').innerHTML = '';
  $('taken').append(new Date(s.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' }), document.createElement('br'),
    `${MODES[s.mode] || 'Snap'} · ${s.imgW} × ${s.imgH} px`);
  if (document.activeElement !== $('link')) $('link').value = s.url || '';
  $('link-label').textContent = 'Link';
  $('link-open').disabled = !/^https?:\/\//i.test(s.url || '');
  $('folder-row').hidden = !s.app.location;
  $('folder').textContent = s.app.location || '';
  $('folder').title = s.app.location || '';
  if (document.activeElement !== $('comment')) $('comment').value = s.text || '';
  $('up-btn').disabled = i <= 0;
  $('down-btn').disabled = i >= snaps.length - 1;
  const img = $('pic-img');
  if (img.dataset.id !== s.id) {
    img.dataset.id = s.id;
    img.src = s.src;
  }
  fitPicture();
  drawMark();
}

// The picture is drawn as large as the stage allows, never above its own size.
function fitPicture() {
  const s = snapById(selected);
  if (!s) return;
  const stage = $('stage');
  const maxW = stage.clientWidth - 24;
  const maxH = stage.clientHeight - 24;
  // At most one screen pixel per picture pixel, so the picture stays sharp;
  // very small snaps are allowed twice that, so they can be marked.
  const most = (Math.min(s.imgW, s.imgH) < 300 ? 2 : 1) / devicePixelRatio;
  const k = Math.min(maxW / s.imgW, maxH / s.imgH, most);
  const pic = $('pic');
  pic.style.width = Math.max(1, Math.round(s.imgW * k)) + 'px';
  pic.style.height = Math.max(1, Math.round(s.imgH * k)) + 'px';
}
new ResizeObserver(() => fitPicture()).observe($('stage'));

function markElement(m) {
  const el = document.createElement('div');
  const pct = (v) => (v * 100).toFixed(3) + '%';
  el.className = `mark ${m.type}`;
  el.style.left = pct(m.x);
  el.style.top = pct(m.y);
  if (m.type === 'area') { el.style.width = pct(m.w); el.style.height = pct(m.h); }
  return el;
}

function drawMark(m) {
  const s = snapById(selected);
  const mark = m || (s && s.mark);
  $('pic-mark').replaceChildren(...(mark ? [markElement(mark)] : []));
  $('unmark').hidden = !(s && s.mark);
}

async function update(change) {
  const s = snapById(selected);
  if (!s) return;
  Object.assign(s, change);
  await api.snaps.update(s.id, change);
  drawList();
}

// Click marks a spot, drag marks an area.
$('pic').addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  e.preventDefault();
  const r = $('pic').getBoundingClientRect();
  const at = (ev) => ({
    x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
  });
  const start = at(e);
  let mark = { type: 'point', ...start };
  const move = (ev) => {
    const p = at(ev);
    if (Math.abs(ev.clientX - e.clientX) < 5 && Math.abs(ev.clientY - e.clientY) < 5) { mark = { type: 'point', ...start }; return; }
    mark = { type: 'area', x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
    drawMark(mark);
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    update({ mark }).then(() => drawMark());
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
});
$('unmark').onclick = () => update({ mark: null }).then(() => drawMark());

$('comment').addEventListener('input', () => {
  const s = snapById(selected);
  if (!s) return;
  s.text = $('comment').value;
  clearTimeout($('comment').timer);
  $('comment').timer = setTimeout(() => update({ text: s.text }), 400);
});
$('comment').addEventListener('blur', () => update({ text: $('comment').value }));

$('link').addEventListener('change', () => {
  update({ url: $('link').value.trim() }).then(drawEditor);
});
$('link').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('link').blur(); });
$('link-open').onclick = () => api.openLink($('link').value.trim());

$('copy-btn').onclick = async () => {
  if (await api.snaps.copy(selected)) toast('Picture copied.');
};
$('save-btn').onclick = async () => {
  const file = await api.snaps.save(selected);
  if (file) toast('Saved to the Screenshots folder.', [['Show in folder', () => api.reveal(file)]]);
};
$('up-btn').onclick = async () => { await api.snaps.move(selected, -1); refresh(); };
$('down-btn').onclick = async () => { await api.snaps.move(selected, 1); refresh(); };
$('delete-btn').onclick = async () => {
  const i = snaps.findIndex((s) => s.id === selected);
  await api.snaps.remove(selected);
  const next = snaps[i + 1] || snaps[i - 1];
  selected = next ? next.id : null;
  refresh();
};
$('clear-btn').onclick = async () => {
  if (!confirm(`Delete all ${snaps.length} screenshots? This cannot be undone.`)) return;
  await api.snaps.clear();
  refresh();
};

// ---- Snapping ---------------------------------------------------------------
for (const b of document.querySelectorAll('.snapbtn')) {
  b.onclick = () => api.snap(b.dataset.mode, Number($('delay').value) || 0);
}

api.onChanged(async (info) => {
  await refresh(info && info.select);
  if (info && info.fresh) $('comment').focus();
});
api.onError((message) => toast(message, [], true));

// ---- Report -------------------------------------------------------------------
$('report-btn').onclick = () => {
  if (!snaps.length) return;
  $('r-author').value = config.author || '';
  $('r-keep').checked = !!config.keepAfterReport;
  resetCopy();
  // Esc leaves the last answer in place; it must not count as "create" again.
  $('report-dlg').returnValue = '';
  $('report-dlg').showModal();
  $('r-title').focus();
};

// The bar's Copy as picture: the whole report, with the title and name last
// typed in the report form, on the clipboard as one picture.
$('copy-report-btn').onclick = async () => {
  const btn = $('copy-report-btn');
  const label = btn.querySelector('span');
  if (!snaps.length || btn.busy) return;
  // Let a comment still being typed save first.
  if (document.activeElement) document.activeElement.blur();
  await new Promise((resolve) => setTimeout(resolve, 200));
  btn.busy = true;
  btn.disabled = true;
  label.textContent = 'Copying…';
  const result = await api.report.copyPicture({ title: $('r-title').value, author: config.author });
  btn.busy = false;
  btn.disabled = !snaps.length;
  label.textContent = 'Copy as picture';
  if (result && !result.error) {
    toast(`Report copied as a picture (${result.count} screenshot${result.count === 1 ? '' : 's'}): paste it into a chat, an email or a document.`);
  } else {
    toast((result && result.error) || 'The report could not be copied as a picture.', [], true);
  }
};

// The dialog's note; after a copy it says where the report went for a while.
function reportNote() {
  const marked = snaps.filter((s) => s.text.trim()).length;
  return `${snaps.length} screenshot${snaps.length === 1 ? '' : 's'}, ${marked} with a comment. They are put in the report in the order shown in the list.`;
}
function resetCopy() {
  clearTimeout($('r-copy').timer);
  $('r-copy').disabled = false;
  $('r-copy').querySelector('span').textContent = 'Copy as picture';
  $('r-note').textContent = reportNote();
  $('r-note').classList.remove('done');
  $('r-note').classList.remove('warn');
}

// The same report as one picture on the clipboard. The dialog stays open and
// the screenshots stay in Smart Snap, whatever "Keep" says.
$('r-copy').onclick = async () => {
  const btn = $('r-copy');
  const label = btn.querySelector('span');
  resetCopy();
  btn.disabled = true;
  label.textContent = 'Copying…';
  config.author = $('r-author').value.trim();
  const result = await api.report.copyPicture({ title: $('r-title').value, author: config.author });
  btn.disabled = false;
  const ok = result && !result.error;
  label.textContent = ok ? 'Copied' : 'Copy as picture';
  $('r-note').textContent = ok
    ? 'The report is on the clipboard as a picture: paste it into a chat, an email or a document. The screenshots are still here.'
    : (result && result.error) || 'The report could not be copied as a picture.';
  $('r-note').classList.toggle('done', ok);
  $('r-note').classList.toggle('warn', !ok);
  btn.timer = setTimeout(resetCopy, 6000);
};
$('report-dlg').addEventListener('close', async () => {
  clearTimeout($('r-copy').timer);
  if ($('report-dlg').returnValue !== 'create') return;
  const keep = $('r-keep').checked;
  config.author = $('r-author').value.trim();
  config.keepAfterReport = keep;
  api.settings({ keepAfterReport: keep });
  toast('Creating the report…');
  const result = await api.report.create({ title: $('r-title').value, author: config.author, keep });
  if (result.error) return toast(result.error, [], true);
  await refresh();
  toast(`Report created with ${result.count} screenshot${result.count === 1 ? '' : 's'}.`, [
    ['Open', () => api.report.open(result.file)],
    ['Show in folder', () => api.reveal(result.file)],
  ]);
});

// ---- Settings and folder ------------------------------------------------------
$('folder-btn').onclick = async () => {
  const r = await api.output.open();
  if (r.error) toast(`The folder could not be opened: ${r.error}`, [], true);
};
async function openSettings() {
  config = await api.config();
  showShortcuts();
  $('s-folder').textContent = (await api.output.get()).dir;
  $('s-login').checked = config.startWithWindows;
  renderUpdates();
  if (!$('settings-dlg').open) $('settings-dlg').showModal();
  // Opened while a new version is waiting: show that part, which comes last.
  if (updateWaiting()) requestAnimationFrame(() => { $('settings-dlg').querySelector('form').scrollTop = 1e6; });
}
$('settings-btn').onclick = openSettings;
$('s-choose').onclick = async () => { $('s-folder').textContent = (await api.output.choose()).dir; };
$('s-login').onchange = () => api.settings({ startWithWindows: $('s-login').checked });

// ---- Shortcuts ----------------------------------------------------------------
// The keys on show, the Print Screen key's switch, and what keeps a key from
// working: another program holding it, or Windows giving Print Screen to its
// Snipping Tool (checked again when Smart Snap comes back from Windows Settings).
function showShortcuts() {
  for (const k of document.querySelectorAll('kbd[data-key]')) k.textContent = keyText(config.shortcuts[k.dataset.key]);
  const prt = config.printScreen;
  const prtWorks = prt.on && !prt.windowsTakesIt && !config.shortcutProblems.includes('PrintScreen');
  // The shortcut also in each snap button's tip, for a narrow window without the key labels.
  for (const b of document.querySelectorAll('.snapbtn')) {
    if (!b.dataset.tip) b.dataset.tip = b.title;
    const keys = keyText(config.shortcuts[b.dataset.mode]) + (b.dataset.mode === 'area' && prtWorks ? ' or PrtScn' : '');
    b.title = `${b.dataset.tip} (${keys})`;
  }
  for (const row of document.querySelectorAll('.prtscn-row')) row.hidden = !prtWorks;
  $('s-prtscn').checked = prt.on;
  $('s-prtscn-windows').hidden = !(prt.on && prt.windowsTakesIt);
  $('s-problems').hidden = !config.shortcutProblems.length;
  $('s-problems').textContent = config.shortcutProblems.length
    ? `Another program already uses ${config.shortcutProblems.map(keyText).join(', ')}. Those shortcuts do not work while it runs; use the buttons or the tray icon instead.`
    : '';
}
$('s-prtscn').onchange = async () => {
  await api.settings({ printScreen: $('s-prtscn').checked });
  config = await api.config();
  showShortcuts();
};
$('s-prtscn-open').onclick = () => api.openKeyboardSettings();
window.addEventListener('focus', async () => {
  if (!$('settings-dlg').open) return;
  config = await api.config();
  showShortcuts();
});

// ---- Keep on top --------------------------------------------------------------
// The pin keeps the window above other programs (remembered for the next start).
function showPinned(on) {
  $('pin-btn').setAttribute('aria-pressed', String(on));
  $('pin-btn').title = on ? 'Smart Snap stays on top of other windows: click to stop' : 'Keep Smart Snap on top of other windows';
}
$('pin-btn').onclick = () => {
  const on = $('pin-btn').getAttribute('aria-pressed') !== 'true';
  showPinned(on);
  api.settings({ pinned: on });
};

// ---- Updates ------------------------------------------------------------------
// The main process asks GitHub for the newest release. Settings shows the
// answer, and the Settings button carries a dot while a newer version waits.
let updateInfo = null;

function h(tag, props = {}, ...children) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...children.filter((c) => c != null));
  return el;
}
const megabytes = (bytes) => (bytes / 1048576).toFixed(1);
const updateWaiting = () => !!updateInfo && ['available', 'downloading', 'installing'].includes(updateInfo.state);
const whenText = (t) => new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

const UPDATE_HOW = {
  installed: 'Windows asks for permission, then Smart Snap closes, installs the new version and opens again. Your settings and snaps are kept.',
  portable: 'The new version is saved as its own file beside this one and opened in its place; this old file is then deleted. Your settings and snaps are kept.',
};
const UPDATE_MANUAL = {
  source: 'This copy runs from source code, so it cannot update itself. Download the new version from the release page.',
  other: 'This copy cannot update itself. Download the new version from the release page.',
  'no-file': 'The release has no file for this kind of copy. Download it from the release page.',
  unverified: 'The download could not be checked against a published checksum, so it is not installed automatically. Download it from the release page.',
};

function showUpdate(status) {
  const before = updateInfo;
  updateInfo = status;
  const waiting = updateWaiting();
  $('settings-btn').classList.toggle('has-update', waiting);
  $('settings-btn').title = waiting ? `Settings: version ${status.latest.version} is available` : 'Settings';
  if ($('settings-dlg').open) renderUpdates();
  // Announced once per version; after that the dot is the reminder.
  if (status.state === 'available' && (!before || before.state !== 'available')
      && localStorage.getItem('updateAnnounced') !== status.latest.version) {
    localStorage.setItem('updateAnnounced', status.latest.version);
    toast(`Smart Snap ${status.latest.version} is available. Click here to see what is new.`, [], false, openSettings);
  }
}

// Release notes are written in Markdown. Headings, lists, paragraphs, bold and
// code are shown; the download table and the test record are left to the
// release page.
function releaseNotes(markdown) {
  const inline = (text) => text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map((part) => {
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) return h('strong', { textContent: part.slice(2, -2) });
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) return h('code', { textContent: part.slice(1, -1) });
    return document.createTextNode(part);
  });
  const box = h('div', { className: 'update-notes' });
  let list = null;
  let skip = false;
  for (const raw of String(markdown || '').split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      list = null;
      skip = /^(downloads?|tested|not tested|seen once)/i.test(heading[1]);
      if (!skip) box.append(h('h4', {}, ...inline(heading[1])));
      continue;
    }
    if (!line) { list = null; continue; }
    if (skip || line.startsWith('|')) continue;
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      if (!list) { list = h('ul'); box.append(list); }
      list.append(h('li', {}, ...inline(item[1])));
    } else {
      list = null;
      box.append(h('p', {}, ...inline(line)));
    }
  }
  return box.childNodes.length ? box : null;
}

function renderUpdates() {
  const box = $('s-updates');
  const s = updateInfo;
  box.replaceChildren(h('div', { className: 'update-head' },
    h('div', { className: 'label', textContent: 'Updates' }),
    s ? h('span', { className: 'dim', textContent: `Version ${s.current}` }) : null));
  if (!s) return;
  const l = s.latest;
  const row = (...buttons) => h('div', { className: 'update-row' }, ...buttons);
  const button = (text, onclick, primary = false, disabled = false) => h('button', { type: 'button', className: primary ? 'primary' : '', textContent: text, onclick, disabled });

  if (s.state === 'available' && l) {
    const released = l.published ? ` Released ${new Date(l.published).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}.` : '';
    box.append(h('p', { className: 'update-line' }, h('strong', { textContent: `Version ${l.version} is available.` }), released));
    const notes = releaseNotes(l.notes);
    if (notes) box.append(notes);
    if (s.error) box.append(h('p', { className: 'update-error', textContent: s.error }));
    const page = button(l.manual ? 'Open the release page' : 'Release page', () => api.updates.openPage(), !!l.manual);
    if (!l.manual) {
      box.append(row(button(`Update now${l.size ? ` (${megabytes(l.size)} MB)` : ''}`, () => api.updates.install(), true), page),
        h('p', { className: 'dim', textContent: UPDATE_HOW[s.kind] || '' }));
    } else {
      box.append(row(page), h('p', { className: 'dim', textContent: UPDATE_MANUAL[l.manual] }));
    }
  } else if (s.state === 'downloading' && l) {
    const p = s.progress || { received: 0, total: l.size };
    const share = p.total ? Math.min(100, (p.received / p.total) * 100) : 0;
    box.append(
      h('p', { className: 'update-line', textContent: `Downloading version ${l.version}: ${megabytes(p.received)} of ${megabytes(p.total)} MB (${Math.floor(share)}%)` }),
      h('div', { className: 'update-bar' }, h('span', { style: `width: ${share.toFixed(1)}%` })),
      row(button('Cancel', () => api.updates.cancel())),
      h('p', { className: 'dim', textContent: 'The file is checked against its published checksum before it is used.' }));
  } else if (s.state === 'installing') {
    box.append(h('p', {
      className: 'update-line',
      textContent: s.kind === 'portable'
        ? 'Opening the new version. This window will close.'
        : 'Starting the installer. Once Windows has your permission, Smart Snap closes and opens again when the update is done.',
    }));
  } else {
    if (s.state === 'error') box.append(h('p', { className: 'update-error', textContent: s.error }));
    else if (s.state === 'current') box.append(h('p', { className: 'update-line', textContent: 'You have the latest version.' }));
    else if (s.state === 'checking') box.append(h('p', { className: 'update-line', textContent: 'Asking GitHub for the latest version…' }));
    box.append(row(button(s.state === 'checking' ? 'Checking…' : 'Check for updates', () => api.updates.check(), false, s.state === 'checking')));
    if (s.checkedAt && s.state !== 'checking') box.append(h('p', { className: 'dim', textContent: `Last checked ${whenText(s.checkedAt)}.` }));
  }

  const auto = h('input', { type: 'checkbox', checked: s.auto });
  auto.addEventListener('change', async () => showUpdate(await api.updates.setAuto(auto.checked)));
  box.append(h('label', {
    className: 'check',
    title: 'Ask GitHub for a newer version when the app starts, and once a day while it stays open. Nothing is downloaded until you choose Update now.',
  }, auto, 'Check for updates automatically'));
}

// ---- Keys ---------------------------------------------------------------------
addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (!typing && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && snaps.length) {
    const i = snaps.findIndex((s) => s.id === selected) + (e.key === 'ArrowDown' ? 1 : -1);
    if (snaps[i]) { selected = snaps[i].id; drawList(); drawEditor(); }
    e.preventDefault();
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'c' && !typing && selected) $('copy-btn').click();
  if (e.key === 'Escape') hideToast();
});

// ---- Start --------------------------------------------------------------------
(async () => {
  config = await api.config();
  showShortcuts();
  showPinned(config.pinned);
  applyTheme(document.documentElement.dataset.theme || 'dark');
  showUpdate(await api.updates.status());
  api.updates.onStatus(showUpdate);
  api.updates.onOpen(openSettings);
  if (updateInfo.justUpdated) setTimeout(() => toast(`Smart Snap has been updated to version ${updateInfo.current}.`), 1200);
  await refresh();
  api.ready();
})();
