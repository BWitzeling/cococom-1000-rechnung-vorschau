export function createTimeline(project, clients) {
  const fps = project.fps;
  let cursor = 0;
  const scenes = [];
  const add = (type, seconds, extra = {}) => {
    const duration = Math.max(1, Math.round(seconds * fps));
    scenes.push({ id: extra.client?.id ?? type, type, start: cursor, duration, end: cursor + duration, ...extra });
    cursor += duration;
  };
  for (const type of ['intro', 'impact', 'founded', 'network', 'projects', 'region', 'milestone', 'thanks', 'featuredLead']) add(type, project.timing[type]);
  for (const client of clients.filter((item) => item.group === 'featured')) add('client', client.duration ?? project.timing.featured, { client });
  add('featuredThanks', project.timing.featuredThanks);
  add('quickLead', project.timing.quickLead);
  for (const client of clients.filter((item) => item.group === 'quick')) add('client', client.duration ?? project.timing.quick, { client });
  for (const type of ['scratch', 'outroQuestion', 'outroAnswer', 'motto', 'outroPromise', 'outroLogo']) add(type, project.timing[type]);
  return { scenes, durationInFrames: cursor, duration: cursor / fps };
}

export function sceneAt(timeline, frame) {
  const clamped = Math.max(0, Math.min(timeline.durationInFrames - 1, Math.floor(frame)));
  return timeline.scenes.find((scene) => clamped >= scene.start && clamped < scene.end);
}

export const sceneNames = {
  intro: 'Momente feiern', impact: 'Kleine Schritte', founded: 'Seit 2019', network: 'Großes Netzwerk',
  projects: 'Projekte', region: 'Drei Länder', milestone: '1.000. Rechnung', thanks: 'Danke',
  featuredLead: 'Insbesondere an', featuredThanks: 'Thank you · Danke · Merci', quickLead: 'Und danke auch an',
  scratch: 'Musikstopp', outroQuestion: 'Und jetzt?', outroAnswer: 'Na, was wohl', motto: 'Be creative',
  outroPromise: 'Die nächsten 1.000', outroLogo: 'COCOCOM'
};
export const secondsToTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
