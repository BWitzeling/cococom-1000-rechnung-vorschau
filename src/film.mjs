import { createTimeline, sceneAt } from './timeline.mjs';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const ease = (value) => 1 - (1 - clamp(value)) ** 4;

export async function createFilm(canvas, { project, clients, clientScenes = {}, footage = [] }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const timeline = createTimeline(project, clients);
  await Promise.all(['Regular', 'Bold', 'Heavy'].map(async (weight) => {
    const face = new FontFace(`CocoSharp-${weight}`, `url(assets/fonts/CocoSharp-${weight}.woff2)`);
    await face.load(); document.fonts.add(face);
  }));
  const loadImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Bild fehlt: ${url}`));
    image.src = url;
  });
  const imageEntries = [
    ...clients.map((client) => [client.id, client.asset]),
    ...clients.filter((client) => clientScenes[client.id]?.image).map((client) => [`project:${client.id}`, clientScenes[client.id].image]),
    ['cococom', 'assets/cococom.png']
  ];
  const images = new Map(await Promise.all(imageEntries.map(async ([id, url]) => [id, await loadImage(url)])));
  const monochrome = { white: new Map(), black: new Map() };
  for (const [id, source] of images) {
    if (id.startsWith('project:')) continue;
    for (const [color, map] of Object.entries(monochrome)) {
      const layer = document.createElement('canvas'); layer.width = source.width; layer.height = source.height;
      const pen = layer.getContext('2d'); pen.drawImage(source, 0, 0);
      pen.globalCompositeOperation = 'source-in'; pen.fillStyle = color === 'white' ? '#fff' : '#141414';
      pen.fillRect(0, 0, layer.width, layer.height); map.set(id, layer);
    }
  }
  const videos = new Map();
  const usedVideoIds = new Set(clients.filter((client) => client.group === 'featured' && !clientScenes[client.id]?.image).map((client) => clientScenes[client.id]?.category));
  await Promise.all(footage.filter((clip) => usedVideoIds.has(clip.id)).map((clip) => new Promise((resolve, reject) => {
    const video = document.createElement('video'); video.muted = true; video.preload = 'auto'; video.playsInline = true;
    video.onloadeddata = () => { videos.set(clip.id, video); resolve(); };
    video.onerror = () => reject(new Error(`Video kann nicht geladen werden: ${clip.file}`));
    video.src = clip.file; video.load();
  })));
  const W = 1080, H = 1920;
  let currentVideo = null, isPlaying = false;
  const font = (size, weight = 'Bold') => { ctx.font = `${size}px CocoSharp-${weight}`; };
  function text(value, x, y, size = 80, color = project.colors.ink, weight = 'Bold', align = 'left') {
    ctx.fillStyle = color; ctx.textAlign = align; font(size, weight);
    const width = align === 'center' ? 920 : align === 'right' ? x - 80 : 1000 - x;
    const measured = ctx.measureText(value).width;
    if (measured > width) font(size * width / measured, weight);
    ctx.fillText(value, x, y);
  }
  function line(x1, y1, x2, y2, color, width = 2) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function logo(id, x, y, maxW, maxH, color = 'white') {
    const image = monochrome[color].get(id);
    const ratio = Math.min(maxW / image.width, maxH / image.height);
    ctx.drawImage(image, x - image.width * ratio / 2, y - image.height * ratio / 2, image.width * ratio, image.height * ratio);
  }
  function base(background, foreground, label = 'COCOCOM / 1000') {
    ctx.fillStyle = background; ctx.fillRect(0, 0, W, H);
    text('COCOCOM', 80, 215, 32, foreground);
    text(label, 1000, 215, 25, foreground, 'Regular', 'right');
    line(80, 245, 1000, 245, foreground, 1.5);
    text(project.copy.website, 1000, 1640, 26, foreground, 'Regular', 'right');
  }
  function reveal(frame, delay, draw) {
    const opacity = ease((frame - delay) / 13);
    ctx.save(); ctx.globalAlpha = opacity; ctx.translate(0, (1 - opacity) * 70); draw(); ctx.restore();
  }
  function lines(values, frame, { y = 790, gap = 160, size = 120, color = project.colors.ink, weight = 'Heavy', x = 80 } = {}) {
    values.forEach((value, index) => reveal(frame, index * 7, () => text(value, x, y + index * gap, size, color, weight)));
  }
  function projectPicture(image, progress, index) {
    const zoom = 1.015 + progress * .065;
    const width = W * zoom, height = H * zoom;
    const drift = (index % 2 ? 1 : -1) * progress * 24;
    ctx.drawImage(image, (W - width) / 2 + drift, (H - height) / 2, width, height);
  }
  function videoState(scene, localFrame) {
    if (scene.type !== 'client' || scene.client.group !== 'featured' || clientScenes[scene.client.id]?.image) return null;
    const meta = clientScenes[scene.client.id];
    const video = videos.get(meta?.category);
    if (!video) return null;
    return { video, time: ((meta.offset ?? 0) + localFrame / project.fps * .8) % Math.max(.1, video.duration - .05) };
  }
  function paint(frame) {
    ctx.save(); ctx.scale(canvas.width / W, canvas.height / H);
    const scene = sceneAt(timeline, frame), local = Math.max(0, frame - scene.start), progress = local / scene.duration;
    const { ink, paper, accent, complement } = project.colors, copy = project.copy;
    if (scene.type === 'intro') {
      base(ink, paper, 'EIN GUTER GRUND ZU FEIERN');
      ctx.strokeStyle = accent; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(835, 1235, 135 + progress * 65, 0, Math.PI * 1.7); ctx.stroke();
      lines(copy.intro, local, { y: 780, gap: 180, size: 132, color: paper });
    } else if (scene.type === 'impact') {
      base(paper, ink, 'KLEINE SCHRITTE');
      lines(copy.impact, local, { y: 810, gap: 215, size: 135, color: ink });
      ctx.fillStyle = accent; ctx.fillRect(80, 1200, 170 + progress * 750, 18);
    } else if (scene.type === 'founded') {
      base(paper, ink, 'SEIT 2019');
      reveal(local, 0, () => text(copy.founded[0], 60, 820, 360, ink, 'Heavy'));
      lines(copy.founded.slice(1), local - 6, { y: 1090, gap: 155, size: 112, color: ink });
      ctx.fillStyle = accent; ctx.fillRect(80, 1360, 180 + progress * 740, 14);
    } else if (scene.type === 'network') {
      base(ink, paper, 'GEMEINSAM');
      for (let index = 0; index < 7; index++) { ctx.fillStyle = index / 7 < progress ? accent : '#454545'; ctx.beginPath(); ctx.arc(105 + index * 144, 590, 20, 0, Math.PI * 2); ctx.fill(); }
      lines(copy.network, local, { y: 900, gap: 205, size: 122, color: paper });
    } else if (scene.type === 'projects') {
      base(accent, ink, 'UNSERE ARBEIT');
      lines(copy.projects, local, { y: 880, gap: 210, size: 142, color: ink });
      text('VIELE IDEEN. VIELE DISZIPLINEN.', 80, 1430, 31, ink, 'Regular');
    } else if (scene.type === 'region') {
      base(paper, ink, 'ÜBER GRENZEN HINWEG');
      lines(copy.region, local, { y: 780, gap: 165, size: 122, color: ink });
      ['AT', 'DE', 'CH'].forEach((country, index) => { ctx.fillStyle = index / 3 < progress ? accent : '#e9e9e9'; ctx.fillRect(80 + index * 160, 1330, 135, 135); text(country, 98 + index * 160, 1420, 45, ink); });
    } else if (scene.type === 'milestone') {
      base(accent, ink, 'DER MEILENSTEIN');
      lines(copy.milestone, local, { y: 810, gap: 225, size: 145, color: ink });
      ctx.strokeStyle = ink; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(860, 475, 85 + progress * 30, 0, Math.PI * 2); ctx.stroke();
    } else if (scene.type === 'thanks') {
      base(ink, paper, 'FÜR EUER VERTRAUEN');
      lines(copy.thanks, local, { y: 880, gap: 210, size: 146, color: paper });
      ctx.fillStyle = accent; ctx.fillRect(80, 1260, 200 + progress * 680, 16);
    } else if (scene.type === 'featuredLead' || scene.type === 'quickLead') {
      const quick = scene.type === 'quickLead';
      base(quick ? complement : paper, quick ? paper : ink, quick ? 'WEITERE KUNDINNEN' : 'UNSERE KUNDINNEN');
      reveal(local, 0, () => text(copy[scene.type], 80, 980, 143, quick ? paper : ink, 'Heavy'));
    } else if (scene.type === 'client' && scene.client.group === 'featured') {
      ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
      const still = images.get(`project:${scene.client.id}`);
      if (still) projectPicture(still, progress, scene.client.order);
      else {
        const video = videoState(scene, local)?.video;
        if (video?.readyState >= 2) {
          const zoom = 1.02 + progress * .06, scale = Math.max(W / video.videoWidth, H / video.videoHeight) * zoom;
          ctx.save(); ctx.filter = 'saturate(.35) hue-rotate(135deg) contrast(1.18)';
          ctx.drawImage(video, (W - video.videoWidth * scale) / 2, (H - video.videoHeight * scale) / 2, video.videoWidth * scale, video.videoHeight * scale); ctx.restore();
        }
        ctx.fillStyle = 'rgba(8,28,70,.35)'; ctx.fillRect(0, 0, W, H);
      }
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(0,0,0,.55)'); shade.addColorStop(.35, 'rgba(0,0,0,.17)'); shade.addColorStop(.55, 'rgba(0,0,0,.65)'); shade.addColorStop(1, 'rgba(0,0,0,.72)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
      text('COCOCOM', 80, 215, 32, paper); text('INSBESONDERE AN', 1000, 215, 25, paper, 'Regular', 'right'); line(80, 245, 1000, 245, '#ffffff99');
      text(String(scene.client.order).padStart(2, '0') + ' / 23', 80, 420, 29, paper, 'Regular');
      const opacity = ease(local / 6); ctx.save(); ctx.globalAlpha = opacity; ctx.translate(0, (1 - opacity) * 24);
      logo(scene.client.id, 540, 1000, 810, 380); ctx.restore();
      text('DANKE FÜR DIE ZUSAMMENARBEIT.', 540, 1410, 28, paper, 'Regular', 'center');
      text(copy.website, 1000, 1640, 26, paper, 'Regular', 'right');
    } else if (scene.type === 'featuredThanks') {
      base(ink, paper, 'THANK YOU / DANKE / MERCI');
      lines(copy.featuredThanks, local, { y: 740, gap: 170, size: 106, color: paper });
      ctx.fillStyle = accent; ctx.fillRect(80, 1320, 200 + progress * 740, 14);
    } else if (scene.type === 'client') {
      const quickIndex = clients.filter((client) => client.group === 'quick').indexOf(scene.client);
      const background = [ink, paper, complement][quickIndex % 3];
      const foreground = quickIndex % 3 === 1 ? ink : paper;
      base(background, foreground, 'UND DANKE AUCH AN');
      text(String(quickIndex + 1).padStart(2, '0') + ' / 29', 80, 440, 29, foreground, 'Regular');
      logo(scene.client.id, 540, 940, 820, 430, quickIndex % 3 === 1 ? 'black' : 'white');
      text(scene.client.name.toUpperCase(), 540, 1330, 31, foreground, 'Regular', 'center');
    } else if (scene.type === 'scratch') {
      base(ink, paper, 'PAUSE');
      ctx.fillStyle = paper;
      for (let index = 0; index < 13; index++) ctx.fillRect(75 + index * 75, 850 + Math.sin(index * 2.4 + progress * 20) * 100, 34, 180);
    } else if (scene.type === 'outroQuestion') {
      base(ink, paper, 'UND JETZT');
      reveal(local, 0, () => text(copy.outroQuestion, 80, 1030, 185, paper, 'Heavy'));
    } else if (scene.type === 'outroAnswer') {
      base(paper, ink, 'NA, WAS WOHL');
      reveal(local, 0, () => text(copy.outroAnswer, 80, 1030, 170, ink, 'Heavy'));
    } else if (scene.type === 'motto') {
      base(accent, ink, 'COCOCOM');
      lines(copy.motto, local, { y: 710, gap: 205, size: 140, color: ink });
    } else if (scene.type === 'outroPromise') {
      base(ink, paper, 'WIR MACHEN WEITER');
      lines(copy.outroPromise, local, { y: 820, gap: 200, size: 125, color: paper });
    } else {
      ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
      const shift = ease(progress), x = 900 - 360 * shift, y = 445 + 515 * shift;
      ctx.save(); ctx.globalAlpha = clamp((1 - progress) * 2.5); logo('cococom', x, y, 145 + 340 * shift, 170 + 370 * shift); ctx.restore();
    }
    if (scene.type !== 'outroLogo') {
      ctx.fillStyle = ['client', 'intro', 'network', 'thanks', 'featuredThanks', 'outroQuestion', 'outroPromise'].includes(scene.type) ? accent : ink;
      ctx.fillRect(80, 1700, 920 * clamp(frame / (timeline.durationInFrames - 1)), 3);
    }
    ctx.restore();
    return scene;
  }
  async function draw(frame, { exact = false } = {}) {
    const scene = sceneAt(timeline, frame);
    const state = videoState(scene, frame - scene.start);
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
