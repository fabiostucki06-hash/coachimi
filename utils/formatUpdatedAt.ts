export function formatUpdatedAt(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;

  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) return `heute um ${time} Uhr`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `gestern um ${time} Uhr`;

  const day = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `am ${day} um ${time} Uhr`;
}
