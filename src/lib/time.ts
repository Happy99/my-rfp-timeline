export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

export function durationMin(start: string, end: string, crossesMidnight: boolean): number {
  const a = timeToMin(start);
  const b = timeToMin(end);
  return crossesMidnight ? b + 24 * 60 - a : b - a;
}

export function effectiveEndMin(start: string, end: string, crossesMidnight: boolean): number {
  return timeToMin(start) + durationMin(start, end, crossesMidnight);
}

// Absolute minute since 00:00 of the festival-night bucket date. Late-night
// sets (startCalendarOffsetDays=1) get +24h, so they sort and render after
// the evening on the same day's view.
export function absoluteMin(set: {
  start: string;
  startCalendarOffsetDays: 0 | 1;
}): number {
  return timeToMin(set.start) + set.startCalendarOffsetDays * 24 * 60;
}

export function setsOverlap(
  a: { start: string; end: string; crossesMidnight: boolean; startCalendarOffsetDays: 0 | 1 },
  b: { start: string; end: string; crossesMidnight: boolean; startCalendarOffsetDays: 0 | 1 },
): boolean {
  const aStart = absoluteMin(a);
  const aEnd = aStart + durationMin(a.start, a.end, a.crossesMidnight);
  const bStart = absoluteMin(b);
  const bEnd = bStart + durationMin(b.start, b.end, b.crossesMidnight);
  return aStart < bEnd && bStart < aEnd;
}

export function formatRange(start: string, end: string): string {
  return `${start}–${end}`;
}
