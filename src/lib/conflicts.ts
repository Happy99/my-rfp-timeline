import type { Day, Set as FestSet } from '~/data/schema';
import { setsOverlap } from './time';

export type ConflictPair = { a: FestSet; b: FestSet; date: string };

export function findConflicts(days: Day[], selectedIds: ReadonlySet<string>): ConflictPair[] {
  const conflicts: ConflictPair[] = [];
  for (const day of days) {
    const picks: FestSet[] = [];
    for (const stage of day.stages) {
      for (const set of stage.sets) {
        if (selectedIds.has(set.id)) picks.push(set);
      }
    }
    for (let i = 0; i < picks.length; i++) {
      for (let j = i + 1; j < picks.length; j++) {
        const a = picks[i]!;
        const b = picks[j]!;
        if (setsOverlap(a, b)) conflicts.push({ a, b, date: day.date });
      }
    }
  }
  return conflicts;
}

export function conflictedIds(conflicts: ConflictPair[]): Set<string> {
  const out = new Set<string>();
  for (const c of conflicts) {
    out.add(c.a.id);
    out.add(c.b.id);
  }
  return out;
}
