/**
 * Smoke tests for conflict detection + .ics export.
 * Not Vitest yet — runs via `tsx scripts/verify.ts`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LineupSchema, type Set as FestSet } from '../src/data/schema.ts';
import { findConflicts, conflictedIds } from '../src/lib/conflicts.ts';
import { buildIcs } from '../src/lib/ics.ts';
import { setsOverlap } from '../src/lib/time.ts';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const lineup = LineupSchema.parse(JSON.parse(readFileSync(resolve(HERE, '../src/data/lineup.json'), 'utf8')));

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log('  ✓', msg);
  else {
    console.error('  ✗', msg);
    failures++;
  }
}
function section(t: string) {
  console.log('\n', t);
}

section('overlap math');
const A = { start: '20:00', end: '21:30', crossesMidnight: false, startCalendarOffsetDays: 0 as const };
const B = { start: '21:00', end: '22:00', crossesMidnight: false, startCalendarOffsetDays: 0 as const };
const C = { start: '22:00', end: '23:30', crossesMidnight: false, startCalendarOffsetDays: 0 as const };
const D = { start: '23:30', end: '00:45', crossesMidnight: true, startCalendarOffsetDays: 0 as const };
const E = { start: '00:30', end: '01:15', crossesMidnight: false, startCalendarOffsetDays: 1 as const };
assert(setsOverlap(A, B) === true, 'overlapping sets detect');
assert(setsOverlap(A, C) === false, 'touching at boundary do not overlap');
assert(setsOverlap(B, C) === false, 'adjacent do not overlap');
assert(setsOverlap(D, E) === true, 'midnight-crossing overlaps next-day set');

section('selecting Iron Maiden + Gorillaz produces no conflicts (different days)');
const allSets: FestSet[] = lineup.days.flatMap((d) => d.stages.flatMap((s) => s.sets));
const im = allSets.find((s) => s.artist.toLowerCase().includes('iron maiden'))!;
const gz = allSets.find((s) => s.artist.toLowerCase().includes('gorillaz'))!;
assert(im && gz, 'fixtures present');
const conflicts1 = findConflicts(lineup.days, new Set([im.id, gz.id]));
assert(conflicts1.length === 0, 'no clash across days');

section('picking 2 sets at overlapping times on Mastercard + Karaoke same day = clash');
const wedSets = lineup.days.find((d) => d.date === '2026-06-10')!.stages.flatMap((s) => s.sets);
const setX = wedSets.find((s) => s.artist.toLowerCase().includes('gorillaz'))!;
const sameTimeOther = wedSets.find((s) => {
  if (s.id === setX.id) return false;
  return setsOverlap(s, setX);
});
assert(sameTimeOther !== undefined, 'found a same-day overlapping set');
if (sameTimeOther) {
  const c2 = findConflicts(lineup.days, new Set([setX.id, sameTimeOther.id]));
  assert(c2.length === 1, 'detects exactly one clash');
  const ids = conflictedIds(c2);
  assert(ids.has(setX.id) && ids.has(sameTimeOther.id), 'both involved IDs marked');
}

section('.ics emitter');
const ics = buildIcs(lineup.days, new Set([im.id, gz.id]), {
  festival: 'Rock for People 2026',
  location: 'Hradec Králové, CZ',
});
const lines = ics.split('\r\n');
assert(lines[0] === 'BEGIN:VCALENDAR', 'starts with VCALENDAR');
assert(ics.includes('END:VCALENDAR'), 'ends with VCALENDAR');
assert(ics.split('BEGIN:VEVENT').length - 1 === 2, 'emits one VEVENT per picked set');
assert(ics.includes('TZID:Europe/Prague'), 'VTIMEZONE present');
assert(ics.includes(`UID:rfp-2026-${im.id}@my-rfp-timeline`), 'stable UID format');
assert(/DTSTART;TZID=Europe\/Prague:20260614T204000/.test(ics), 'Iron Maiden DTSTART correct');
assert(/DTEND;TZID=Europe\/Prague:20260614T225000/.test(ics), 'Iron Maiden DTEND correct');
assert(ics.includes(im.artist), 'artist name in summary');

section('GLEB matches source bucketing (Thu 11.6.), calendar shifts to Fri');
const gleb = allSets.find((s) => s.artist.toLowerCase() === 'gleb');
assert(gleb !== undefined, 'GLEB present in dataset');
if (gleb) {
  const gDay = lineup.days.find((d) => d.stages.some((s) => s.sets.some((set) => set.id === gleb.id)))!;
  assert(gDay.date === '2026-06-11', `GLEB shown under Thu 11.6. (was: ${gDay.date})`);
  assert(gleb.startCalendarOffsetDays === 1, 'GLEB flagged as late-night calendar offset');
  const icsGleb = buildIcs(lineup.days, new Set([gleb.id]), {
    festival: 'Rock for People 2026',
    location: 'Hradec Králové, CZ',
  });
  assert(
    /DTSTART;TZID=Europe\/Prague:20260612T004500/.test(icsGleb),
    'GLEB .ics DTSTART is Fri Jun 12 00:45 (Thu-night → Fri morning)',
  );
  assert(
    /DTEND;TZID=Europe\/Prague:20260612T014500/.test(icsGleb),
    'GLEB .ics DTEND is Fri Jun 12 01:45',
  );
}

section('after-midnight set DTEND rolls to next day');
const lateSet = allSets.find((s) => s.crossesMidnight);
if (lateSet) {
  console.log('    sample crossing-midnight set:', lateSet.artist, lateSet.start, '→', lateSet.end);
  const icsLate = buildIcs(lineup.days, new Set([lateSet.id]), {
    festival: 'Rock for People 2026',
    location: 'Hradec Králové, CZ',
  });
  // We don't pin the exact date here — just assert the day part of DTEND > DTSTART
  const dtstart = icsLate.match(/DTSTART;TZID=Europe\/Prague:(\d{8})T/)?.[1];
  const dtend = icsLate.match(/DTEND;TZID=Europe\/Prague:(\d{8})T/)?.[1];
  assert(dtstart && dtend && dtend > dtstart, `DTEND day > DTSTART day (${dtstart} → ${dtend})`);
} else {
  console.log('    (no crossing-midnight set in current data — skipped)');
}

section('lineup invariants');
assert(lineup.days.length === 5, 'has 5 days');
const setsTotal = lineup.days.reduce(
  (n, d) => n + d.stages.reduce((m, s) => m + s.sets.length, 0),
  0,
);
assert(setsTotal >= 60, `>= 60 sets (got ${setsTotal})`);
const ids = new Set<string>();
let dupes = 0;
for (const d of lineup.days) for (const s of d.stages) for (const set of s.sets) {
  if (ids.has(set.id)) dupes++;
  ids.add(set.id);
}
assert(dupes === 0, 'all set IDs unique');

console.log('\n', failures === 0 ? '✓ all checks passed' : `✗ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
