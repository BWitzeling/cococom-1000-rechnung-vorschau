import { createFilm } from './film.mjs';
import { createTimeline, sceneAt, sceneNames, secondsToTime } from './timeline.mjs';

const $ = (id) => document.getElementById(id);
const readJson = async (path) => { const response = await fetch(path); if (!response.ok) throw new Error(`Datei fehlt: ${path}`); return response.json(); };
const [baseProject, clients, clientScenes, footage] = await Promise.all(['project', 'clients', 'client-scenes', 'footage'].map((name) => readJson(`src/${name}.json`)));
let project = structuredClone(baseProject), film, frame = 0, playing = false, lastTick = 0, busy = false;
const storageKey = 'cococom-1000-project-v1';
const renderMode = new URLSearchParams(location.search).has('render');
if (!renderMode) { try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved) project = validateProject(saved); } catch { /* Ein beschädigter Browserstand wird ignoriert. */ } }
function validateProject(value) {
  if (!value || value.fps !== 30 || value.width !== 1080 || value.height !== 1920) throw new Error('Projektformat muss 1080 × 1920 bei 30 FPS bleiben.');
  for (const field of Object.keys(baseProject.timing)) if (!Number.isFinite(value.timing?.[field]) || value.timing[field] < .25 || value.timing[field] > 30) throw new Error('Standzeiten müssen zwischen 0,25 und 30 Sekunden liegen.');
  for (const field of ['ink', 'paper', 'accent']) if (!/^#[\da-f]{6}$/i.test(value.colors?.[field])) throw new Error('Die Farben müssen sechsstellige Hexwerte sein.');
  if (typeof value.audio !== 'string' || !/^assets\/[\w./-]+$/.test(value.audio) || value.audio.split('/').includes('..')) throw new Error('Die Audiodatei muss lokal unter assets/ liegen.');
  for (const [key, original] of Object.entries(baseProject.copy)) {
    const text = value.copy?.[key];
    if (Array.isArray(original) ? !Array.isArray(text) || text.length !== original.length || text.some((v) => typeof v !== 'string' || v.length > 80) : typeof text !== 'string' || text.length > 80) throw new Error(`Ungültiger Text: ${key}`);
  }
  return structuredClone(value);
}
const audio = new Audio(project.audio); audio.loop = false; audio.volume = .65; audio.muted = true;
function status(message) { $('status').textContent = message; }
async function initialize() {
  const canvas = $('film');
  if (renderMode) { document.body.className = 'render-only'; document.body.appendChild(canvas); canvas.width = 1080; canvas.height = 1920; }
  film = await createFilm(canvas, { project, clients, clientScenes, footage });
  await film.draw(renderMode ? frame : 45, { exact: true });
  window.__film = {
    get durationInFrames() { return film.timeline.durationInFrames; }, get project() { return project; },
    seek: async (value) => { frame = Math.max(0, Math.min(film.timeline.durationInFrames - 1, Math.round(value))); await film.draw(frame, { exact: true }); return { frame, scene: sceneAt(film.timeline, frame).id }; },
    setProject: async (value) => { project = validateProject(value); film = await createFilm(canvas, { project, clients, clientScenes, footage }); return film.timeline.durationInFrames; }
  };
  if (!renderMode) { $('loading').hidden = true; $('play').disabled = false; renderPanels(); updateFields(); updateTransport(); requestAnimationFrame(tick); }
  document.documentElement.dataset.ready = 'true';
}
function groupedChapters() {
  const t = film.timeline, first = t.scenes.find((s) => s.type === 'client'), last = t.scenes.find((s) => s.type === 'outro');
  return [...t.scenes.filter((s) => !['client', 'outro'].includes(s.type)).map((s) => ({ ...s, title: sceneNames[s.type] })), { id: 'clients', type: 'clients', start: first.start, duration: last.start - first.start, title: 'Danke an unsere Kund:innen' }, { ...last, title: sceneNames.outro }];
}
const chapterDescriptions = { intro: 'Ein starker Auftakt', founded: 'Der Anfang einer Geschichte', network: 'Kreativität im Netzwerk', milestone: 'Der Moment, den wir feiern', thanks: 'Vertrauen verbindet', clients: '51 Logos · 23 länger, 28 schneller', outro: 'Gemeinsam geht es weiter' };
function renderPanels() {
  $('seek').max = film.timeline.durationInFrames - 1;
  $('duration-spec').textContent = `${Math.round(film.timeline.duration)} SEK.`;
  $('timeline-end').textContent = secondsToTime(film.timeline.duration);
  $('chapter-list').replaceChildren(...groupedChapters().map((s, i) => {
    const button = document.createElement('button'); button.className = 'chapter'; button.dataset.scene = s.id;
    const num = document.createElement('span'); num.className = 'chapter-index'; num.textContent = String(i + 1).padStart(2, '0');
    const title = document.createElement('span'); title.className = 'chapter-title'; title.textContent = s.title;
    const desc = document.createElement('small'); desc.textContent = chapterDescriptions[s.type]; title.append(desc);
    const time = document.createElement('span'); time.className = 'chapter-time'; time.textContent = secondsToTime(s.start / project.fps);
    button.append(num, title, time); button.onclick = () => seek(s.start); return button;
  }));
  $('timeline').replaceChildren(...film.timeline.scenes.map((s) => {
    const button = document.createElement('button'); button.style.flex = s.duration; button.dataset.type = s.type; button.dataset.scene = s.id;
    button.title = `${s.client?.name ?? sceneNames[s.type]} · ${(s.duration / project.fps).toFixed(1)} Sek.`; button.setAttribute('aria-label', button.title);
    if (s.type === 'client') { const img = document.createElement('img'); img.src = s.client.asset; img.alt = ''; button.append(img); } else { button.textContent = sceneNames[s.type]; }
    button.onclick = () => seek(s.start); return button;
  })); renderClients();
}
function renderClients() {
  const query = $('client-search').value.toLocaleLowerCase('de');
  $('client-list').replaceChildren(...film.timeline.scenes.filter((s) => s.client && s.client.name.toLocaleLowerCase('de').includes(query)).map((s) => {
    const button = document.createElement('button'); button.className = 'client-row';
    const n = document.createElement('small'); n.textContent = String(clients.indexOf(s.client) + 1).padStart(2, '0');
    const img = document.createElement('img'); img.src = s.client.asset; img.alt = '';
    const name = document.createElement('span'); name.textContent = s.client.name;
    const duration = document.createElement('span'); duration.className = 'fast'; duration.textContent = `${(s.duration / project.fps).toLocaleString('de')} s`;
    button.append(n, img, name, duration); button.onclick = () => seek(s.start); return button;
  }));
}
function updateTransport() {
  const t = film.timeline, s = sceneAt(t, frame);
  $('time').textContent = `${secondsToTime(frame / project.fps)} / ${secondsToTime(t.duration)}`; $('seek').value = frame;
  $('scene-label').textContent = s.client ? `${s.client.name} / ${s.client.group === 'featured' ? 'Längere Standzeit' : 'Schneller Wechsel'}` : sceneNames[s.type];
  document.querySelectorAll('[data-scene]').forEach((el) => el.classList.toggle('active', el.dataset.scene === s.id || el.dataset.scene === 'clients' && s.type === 'client'));
}
function setPlaying(value) {
  playing = value; film.setPlaying(value); $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? 'Video pausieren' : 'Video abspielen');
  if (playing) { if (frame >= film.timeline.durationInFrames - 1) frame = 0; lastTick = performance.now() - frame / project.fps * 1000; audio.currentTime = frame / project.fps; if (!audio.muted) audio.play().catch(() => status('Ton bitte erneut einschalten.')); } else audio.pause();
}
async function seek(value) { setPlaying(false); frame = Math.round(Number(value)); await film.draw(frame, { exact: true }); audio.currentTime = frame / project.fps; updateTransport(); }
async function tick(now) {
  if (playing && !busy) {
    const next = Math.min(film.timeline.durationInFrames - 1, Math.floor((now - lastTick) / 1000 * project.fps));
    if (next !== frame) { frame = next; busy = true; await film.draw(frame); busy = false; updateTransport(); }
    if (frame >= film.timeline.durationInFrames - 1) setPlaying(false);
  }
  requestAnimationFrame(tick);
}
$('play').onclick = () => setPlaying(!playing); $('restart').onclick = () => seek(0); $('seek').oninput = (e) => seek(e.target.value);
$('sound').onclick = () => { audio.muted = !audio.muted; $('sound').textContent = audio.muted ? 'Ton aus' : 'Ton an'; $('sound').setAttribute('aria-pressed', String(!audio.muted)); if (playing && !audio.muted) { audio.currentTime = frame / project.fps; audio.play().catch(() => status('Audio konnte nicht gestartet werden.')); } else audio.pause(); };
$('safe-toggle').onclick = () => { $('safe-overlay').hidden = !$('safe-overlay').hidden; $('safe-toggle').setAttribute('aria-pressed', String(!$('safe-overlay').hidden)); };
$('fullscreen').onclick = () => { const wrapper = document.querySelector('.canvas-wrap'); wrapper.requestFullscreen?.().catch(() => status('Vollbild wird vom Browser nicht unterstützt.')); };
$('client-search').oninput = renderClients;
const tabButtons = [...document.querySelectorAll('[role=tab]')];
tabButtons.forEach((button, index) => { button.onclick = () => { tabButtons.forEach((tab) => { const active = tab === button; tab.setAttribute('aria-selected', active); tab.tabIndex = active ? 0 : -1; $(tab.getAttribute('aria-controls')).hidden = !active; }); }; button.onkeydown = (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = tabButtons[(index + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length]; next.click(); next.focus(); } }; });
function updateFields() { $('edit-intro').value = project.copy.intro[0]; $('edit-milestone').value = project.copy.milestone; $('edit-note').value = project.copy.milestoneNote; $('edit-featured').value = project.timing.featured; $('edit-quick').value = project.timing.quick; $('edit-accent').value = project.colors.accent; }
async function applyProject(value) {
  try { const next = validateProject(value); setPlaying(false); project = next; audio.src = project.audio; film = await createFilm($('film'), { project, clients, clientScenes, footage }); frame = Math.min(frame, film.timeline.durationInFrames - 1); await film.draw(frame, { exact: true });
    try { localStorage.setItem(storageKey, JSON.stringify(project)); } catch { /* Private Browser können lokalen Speicher sperren. */ }
    document.documentElement.style.setProperty('--accent', project.colors.accent); renderPanels(); updateFields(); updateTransport(); status('Projektstand aktualisiert. Jetzt sichern für den Export.');
  } catch (error) { status(error.message); }
}
$('apply').onclick = () => { const next = structuredClone(project); next.copy.intro[0] = $('edit-intro').value; next.copy.milestone = $('edit-milestone').value; next.copy.milestoneNote = $('edit-note').value; next.timing.featured = Number($('edit-featured').value); next.timing.quick = Number($('edit-quick').value); next.colors.accent = $('edit-accent').value; applyProject(next); };
$('reset').onclick = () => applyProject(structuredClone(baseProject));
$('import-config').onchange = async (e) => { const file = e.target.files?.[0]; if (file) { try { await applyProject(JSON.parse(await file.text())); } catch { status('Die Datei enthält kein gültiges JSON-Projekt.'); } } };
$('download-config').onclick = () => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2) + '\n'], { type: 'application/json' })); link.download = 'project.json'; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); status('Gesichert. In VS Code die Datei src/project.json ersetzen.'); };
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName)) { e.preventDefault(); setPlaying(!playing); } });
initialize().catch((error) => { console.error(error); $('loading').classList.add('error-message'); $('loading').textContent = `Vorschau konnte nicht geladen werden: ${error.message}`; document.documentElement.dataset.error = error.message; });
