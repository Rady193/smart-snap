'use strict';
const api = window.smartSnap;
const $ = (id) => document.getElementById(id);

let snaps = [];
let selected = null;
let config = null;

const MODES = { area: 'Area', window: 'Window', full: 'Full screen' };
const keyText = (k) => k.replace('Control', 'Ctrl').replace(/\+/g, ' + ');

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
function toast(text, actions = [], error = false) {
  clearTimeout(toastTimer);
  $('toast-text').textContent = text;
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
  const marked = snaps.filter((s) => s.text.trim()).length;
  $('r-note').textContent = `${snaps.length} screenshot${snaps.length === 1 ? '' : 's'}, ${marked} with a comment. They are put in the report in the order shown in the list.`;
  $('report-dlg').showModal();
  $('r-title').focus();
};
$('report-dlg').addEventListener('close', async () => {
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
$('settings-btn').onclick = async () => {
  config = await api.config();
  $('s-folder').textContent = (await api.output.get()).dir;
  $('s-login').checked = config.startWithWindows;
  $('settings-dlg').showModal();
};
$('s-choose').onclick = async () => { $('s-folder').textContent = (await api.output.choose()).dir; };
$('s-login').onchange = () => api.settings({ startWithWindows: $('s-login').checked });

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
  for (const k of document.querySelectorAll('kbd[data-key]')) k.textContent = keyText(config.shortcuts[k.dataset.key]);
  if (config.shortcutProblems.length) {
    $('s-problems').hidden = false;
    $('s-problems').textContent = `Another program already uses ${config.shortcutProblems.map(keyText).join(', ')}. Those shortcuts do not work while it runs; use the buttons or the tray icon instead.`;
  }
  $('s-version').textContent = `Smart Snap ${config.version} · SCAFFApps`;
  applyTheme(document.documentElement.dataset.theme || 'dark');
  await refresh();
  api.ready();
})();
