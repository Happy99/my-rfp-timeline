import type { Day, Set as FestSet } from '~/data/schema';
import { effectiveEndMin } from './time';

const PRODID = '-//my-rfp-timeline//Rock for People 2026//EN';

const VTIMEZONE_PRAGUE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Prague',
  'BEGIN:STANDARD',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n');

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function foldLine(line: string): string {
  // Multi-line inputs (e.g. the VTIMEZONE block) fold per-line.
  if (line.includes('\r\n')) {
    return line.split('\r\n').map(foldLine).join('\r\n');
  }
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) {
    parts.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return parts.join('\r\n');
}

function localDateTimeStamp(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return (
    dt.getUTCFullYear().toString() +
    '-' +
    String(dt.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(dt.getUTCDate()).padStart(2, '0')
  );
}

function endDateTimeStamp(calendarDate: string, start: string, end: string, crossesMidnight: boolean): string {
  const totalMin = effectiveEndMin(start, end, crossesMidnight);
  let dayShift = 0;
  let minutes = totalMin;
  if (totalMin >= 24 * 60) {
    dayShift = 1;
    minutes = totalMin - 24 * 60;
  }
  const endDate = shiftDate(calendarDate, dayShift);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mi = String(minutes % 60).padStart(2, '0');
  return `${endDate.replace(/-/g, '')}T${hh}${mi}00`;
}

function dtstamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export type IcsContext = {
  festival: string;
  location: string;
};

export function buildIcs(
  days: Day[],
  selectedIds: ReadonlySet<string>,
  ctx: IcsContext,
): string {
  const now = dtstamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(ctx.festival + ' — My picks')}`,
    `X-WR-TIMEZONE:Europe/Prague`,
    VTIMEZONE_PRAGUE,
  ];

  for (const day of days) {
    for (const stage of day.stages) {
      for (const set of stage.sets) {
        if (!selectedIds.has(set.id)) continue;
        const calendarDate = shiftDate(day.date, set.startCalendarOffsetDays);
        const ev = buildEvent(calendarDate, stage.name, set, ctx, now);
        lines.push(ev);
      }
    }
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function buildEvent(
  calendarDate: string,
  stageName: string,
  set: FestSet,
  ctx: IcsContext,
  now: string,
): string {
  const dtstart = localDateTimeStamp(calendarDate, set.start);
  const dtend = endDateTimeStamp(calendarDate, set.start, set.end, set.crossesMidnight);
  const summary = set.country ? `${set.artist} (${set.country})` : set.artist;
  return [
    'BEGIN:VEVENT',
    `UID:rfp-2026-${set.id}@my-rfp-timeline`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/Prague:${dtstart}`,
    `DTEND;TZID=Europe/Prague:${dtend}`,
    `SUMMARY:${escapeText(summary + ' — ' + stageName)}`,
    `LOCATION:${escapeText(stageName + ', ' + ctx.festival + ', ' + ctx.location)}`,
    `DESCRIPTION:${escapeText(set.url)}`,
    `URL:${escapeText(set.url)}`,
    `CATEGORIES:${escapeText(ctx.festival)}`,
    'END:VEVENT',
  ].join('\r\n');
}
