import { createTimeline, sceneAt } from './timeline.mjs';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (v) => 1 - (1 - clamp(v)) ** 4;

export async function createFilm(canvas, { project, clients, clientScenes = {}, footage = [] }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const timeline = createTimeline(project, clients);
  await Promise.all(['Regular', 'Bold', 'Heavy'].map(async (weight) => {
    const font = new FontFace(`CocoSharp-${weight}`, `url(assets/fonts/CocoSharp-${weight}.woff2)`);
    await font.load(); document.fonts.add(font);
  }));
  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error(`Logo fehlt: ${url}`)); img.src = url;
  });
  const images = new Map(await Promise.all([...clients.map((c) => [c.id, c.asset]), ['cococom', 'assets/cococom.png']].map(async ([id, path]) => [id, await loadImage(path)])));
  const tinted = new Map();
  for (const [id, img] of images) {
    const layer = document.createElement('canvas'); layer.width = img.width; layer.height = img.height;
    const lctx = layer.getContext('2d'); lctx.drawImage(img, 0, 0); lctx.globalCompositeOperation = 'source-in'; lctx.fillStyle = '#fff'; lctx.fillRect(0, 0, img.width, img.height); tinted.set(id, layer);
  }
  const videos = new Map();
  await Promise.all(footage.map((clip) => new Promise((resolve, reject) => {
    const video = document.createElement('video'); video.muted = true; video.preload = 'auto'; video.playsInline = true;
    video.onloadeddata = () => { videos.set(clip.id, video); resolve(); };
    video.onerror = () => reject(new Error(`Video kann nicht geladen werden: ${clip.file}. Bitte Pfad und H.264-Unterstützung des Browsers prüfen.`)); video.src = clip.file; video.load();
  })));
  const W = 1080, H = 1920;
  let currentVideo = null;
  let isPlaying = false;
  function font(size, weight = 'Bold') { ctx.font = `${size}px CocoSharp-${weight}`; }
  function text(value, x, y, size = 80, color = project.colors.ink, weight = 'Bold', align = 'left') {
    ctx.fillStyle = color; ctx.textAlign = align; font(size, weight);
    const available = align === 'center' ? 920 : align === 'right' ? x - 80 : 1000 - x;
    const measured = ctx.measureText(value).width;
    if (measured > available) font(size * available / measured, weight);
    ctx.fillText(value, x, y);
  }
  function fitText(value, x, y, size, maxWidth, color = project.colors.ink, weight = 'Heavy') {
    font(size, weight); const measured = ctx.measureText(value).width;
    text(value, x, y, Math.min(size, size * maxWidth / Math.max(1, measured)), color, weight);
  }
  function line(x1, y1, x2, y2, color, width = 2) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function logo(id, x, y, maxW, maxH, white = false) {
    const img = (white ? tinted : images).get(id); const ratio = Math.min(maxW / img.width, maxH / img.height);
    ctx.drawImage(img, x - img.width * ratio / 2, y - img.height * ratio / 2, img.width * ratio, img.height * ratio);
  }
  function base(color, dark = false) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
    const ink = dark ? project.colors.paper : project.colors.ink;
    text('COCOCOM', 80, 216, 32, ink);
    text('SEIT 2019', 998, 216, 27, ink, 'Regular', 'right');
    line(80, 246, 1000, 246, ink, 1.5);
    text('IDEEN VERBINDEN.', 80, 1640, 26, ink, 'Regular');
    text(project.copy.website, 1000, 1640, 26, ink, 'Regular', 'right');
  }
  function star(x, y, radius, rotation, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.strokeStyle = color; ctx.lineWidth = 11;
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(radius * .26, 0); ctx.lineTo(radius, 0); ctx.stroke(); } ctx.restore();
  }
  function reveal(local, delay, fn) {
    const e = ease((local - delay) / 13); ctx.save(); ctx.globalAlpha = e; ctx.translate(0, (1 - e) * 90); fn(); ctx.restore();
  }
  function videoTime(scene, local) {
    const meta = clientScenes[scene.client?.id] ?? { category: 'business', offset: 0 };
    const clip = videos.get(meta.category) ?? videos.values().next().value;
    if (!clip) return null;
    return { video: clip, time: ((meta.offset ?? 0) + local / project.fps * .8) % Math.max(.1, clip.duration - .05), meta };
  }
  function paint(frame) {
    ctx.save(); ctx.scale(canvas.width / W, canvas.height / H);
    const s = sceneAt(timeline, frame); const f = Math.max(0, frame - s.start), p = f / s.duration;
    const { ink, paper, accent } = project.colors; const c = project.copy;
    if (s.type === 'intro') {
      base(ink, true);
      reveal(f, 1, () => text(c.intro[0], 80, 690, 128, paper, 'Heavy'));
      reveal(f, 8, () => text(c.intro[1], 80, 865, 160, paper, 'Heavy'));
      reveal(f, 15, () => text(c.intro[2], 80, 1040, 160, accent, 'Heavy'));
      star(890, 1290, 100, p * .6, accent);
      text('EIN MEILENSTEIN. VIELE MENSCHEN.', 80, 1470, 29, paper, 'Regular');
    } else if (s.type === 'founded') {
      base(paper); text('DER ANFANG', 80, 434, 30, ink, 'Regular');
      reveal(f, 1, () => fitText(c.foundedNumber, 60, 900, 380, 950));
      reveal(f, 6, () => { text(c.founded[0], 80, 1110, 108); text(c.founded[1], 80, 1245, 108); });
      ctx.fillStyle = accent; ctx.fillRect(80, 1320, 150 + p * 770, 14);
      text('GEGRÜNDET IM JÄNNER 2019.', 80, 1470, 28, ink, 'Regular');
    } else if (s.type === 'network') {
      base(paper); text('GEMEINSAM WEITER', 80, 434, 30, ink, 'Regular');
      for (let i = 0; i < 7; i++) { ctx.fillStyle = i === Math.floor(p * 7) ? ink : '#dbd9d2'; ctx.beginPath(); ctx.arc(105 + i * 144, 570, 21, 0, Math.PI * 2); ctx.fill(); }
      reveal(f, 1, () => text(c.networkNumber, 60, 990, 400, ink, 'Heavy'));
      reveal(f, 7, () => { text(c.network[0], 80, 1180, 104); text(c.network[1], 80, 1310, 104); });
      text('KREATIVITÄT HAT VIELE PERSPEKTIVEN.', 80, 1470, 28, ink, 'Regular');
    } else if (s.type === 'milestone') {
      base(accent); text('UND JETZT …', 80, 434, 30, ink, 'Regular');
      const number = f < 20 ? Math.round(1000 * ease(f / 20)).toLocaleString('de-AT') : c.milestoneNumber;
      reveal(f, 0, () => fitText(number, 55, 1000, 370, 970));
      reveal(f, 16, () => text(c.milestone, 80, 1170, 115, ink, 'Heavy'));
      reveal(f, 23, () => text(c.milestoneNote, 80, 1345, 44, ink, 'Regular'));
      star(875, 535, 84, p * 1.2, ink);
      text('DAS FEIERN WIR.', 80, 1470, 30, ink, 'Bold');
    } else if (s.type === 'thanks') {
      base(ink, true);
      reveal(f, 0, () => text(c.thanks[0], 80, 850, 225, paper, 'Heavy'));
      reveal(f, 7, () => text(c.thanks[1], 80, 1075, 205, accent, 'Heavy'));
      text('FÜR EUER VERTRAUEN.', 80, 1390, 36, paper, 'Regular');
    } else if (s.type === 'client') {
      const v = videoTime(s, f); ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
      if (v && v.video.readyState >= 2) {
        const z = 1.01 + .045 * p, scale = Math.max(W / v.video.videoWidth, H / v.video.videoHeight) * z;
        ctx.save(); ctx.filter = 'saturate(0.65)';
        ctx.drawImage(v.video, (W - v.video.videoWidth * scale) / 2, (H - v.video.videoHeight * scale) / 2, v.video.videoWidth * scale, v.video.videoHeight * scale); ctx.restore();
      }
      const shade = ctx.createLinearGradient(0, 0, 0, H); shade.addColorStop(0, 'rgba(0,0,0,.55)'); shade.addColorStop(.3, 'rgba(0,0,0,.38)'); shade.addColorStop(.52, 'rgba(0,0,0,.62)'); shade.addColorStop(1, 'rgba(0,0,0,.68)'); ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
      text('COCOCOM', 80, 216, 32, '#fff'); text('DANKE AN', 1000, 216, 27, '#fff', 'Regular', 'right'); line(80, 246, 1000, 246, '#ffffff66', 1.5);
      text(String(clients.indexOf(s.client) + 1).padStart(2, '0') + ' / ' + clients.length, 80, 420, 27, '#ffffffc0', 'Regular');
      const e = s.client.group === 'quick' ? 1 : ease(f / 6);
      ctx.save(); ctx.globalAlpha = e; ctx.translate(0, (1 - e) * 25); logo(s.client.id, 540, 920, 810, 390, true); ctx.restore();
      text('FÜR DAS GEMEINSAME WEITERDENKEN.', 540, 1330, 27, '#fff', 'Regular', 'center');
      text('1.000 RECHNUNGEN. UNZÄHLIGE IDEEN.', 80, 1640, 25, '#fff', 'Regular');
    } else {
      base(ink, true); logo('cococom', 900, 445, 140, 158, true);
      reveal(f, 0, () => text(c.outro[0], 80, 765, 132, paper, 'Heavy'));
      reveal(f, 7, () => text(c.outro[1], 80, 930, 132, paper, 'Heavy'));
      reveal(f, 14, () => fitText(c.outro[2], 62, 1190, 260, 920, accent));
      text('SCHÖN, DASS IHR TEIL DAVON SEID.', 80, 1400, 30, paper, 'Regular');
    }
    // Unaufdringlicher Fortschrittsstrich; innerhalb der Reel-Sicherheitszone.
    ctx.fillStyle = s.type === 'client' ? '#ffffffa0' : (s.type === 'intro' || s.type === 'thanks' || s.type === 'outro' ? accent : ink);
    ctx.fillRect(80, 1700, 920 * clamp(frame / (timeline.durationInFrames - 1)), 3);
    ctx.restore(); return s;
  }
  async function draw(frame, { exact = false } = {}) {
    const s = sceneAt(timeline, frame);
    const state = s.type === 'client' ? videoTime(s, frame - s.start) : null;
    if (currentVideo && currentVideo !== state?.video) currentVideo.pause();
    currentVideo = state?.video ?? null;
    if (state) {
      const video = state.video;
      if (exact || Math.abs(video.currentTime - state.time) > .18) {
        if (Math.abs(video.currentTime - state.time) > .001) await new Promise((resolve) => {
          const timer = setTimeout(() => { video.removeEventListener('seeked', done); resolve(); }, 5000);
          const done = () => { clearTimeout(timer); resolve(); };
          video.addEventListener('seeked', done, { once: true }); video.currentTime = state.time;
        });
      }
      if (isPlaying && !exact) { video.playbackRate = .8; video.play().catch(() => {}); } else video.pause();
    }
    return paint(frame);
  }
  function setPlaying(value) { isPlaying = value; if (!value) for (const video of videos.values()) video.pause(); }
  return { draw, paint, setPlaying, timeline, project, clients };
}
