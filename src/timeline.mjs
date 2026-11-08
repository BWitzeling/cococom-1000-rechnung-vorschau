export function createTimeline(project, clients) {
  const fps = project.fps;
  let cursor = 0;
  const result = [];
  const add = (type, seconds, extra = {}) => {
    const duration = Math.max(1, Math.round(seconds * fps));
    result.push({ id: extra.client?.id ?? type, type, start: cursor, duration, end: cursor + duration, ...extra });
    cursor += duration;
  };
  for (const type of ['intro', 'founded', 'network', 'milestone', 'thanks']) add(type, project.timing[type]);
  for (const client of clients) add('client', client.duration ?? project.timing[client.group], { client });
  add('outro', project.timing.outro);
  return { scenes: result, durationInFrames: cursor, duration: cursor / fps };
}

export function sceneAt(timeline, frame) {
  const clamped = Math.max(0, Math.min(timeline.durationInFrames - 1, Math.floor(frame)));
  return timeline.scenes.find((s) => clamped >= s.start && clamped < s.end);
}

export const sceneNames = { intro: 'Gute Ideen', founded: 'Seit 2019', network: '70+ Expert:innen', milestone: '1.000 Rechnungen', thanks: 'Danke an euch', outro: 'Auf die nächsten 1.000' };
export const secondsToTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
