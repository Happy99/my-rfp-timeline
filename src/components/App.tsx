import type { Lineup } from '~/data/schema';
import { useState, useMemo } from 'preact/hooks';
import { computed } from '@preact/signals';
import { selections } from '~/lib/store';
import { findConflicts, conflictedIds } from '~/lib/conflicts';
import { DaySwitcher } from './DaySwitcher';
import { Timeline } from './Timeline';
import { SelectionPanel } from './SelectionPanel';

type Props = { lineup: Lineup };

export function App({ lineup }: Props) {
  const initialDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return lineup.days.find((d) => d.date >= today)?.date ?? lineup.days[0]!.date;
  }, [lineup]);

  const [activeDate, setActiveDate] = useState(initialDate);
  const activeDay = lineup.days.find((d) => d.date === activeDate) ?? lineup.days[0]!;

  const conflicts = computed(() => findConflicts(lineup.days, selections.value));
  const conflictIds = computed(() => conflictedIds(conflicts.value));

  const pickedPerDay = computed(() => {
    const out: Record<string, number> = {};
    for (const day of lineup.days) {
      let n = 0;
      for (const stage of day.stages) {
        for (const set of stage.sets) {
          if (selections.value.has(set.id)) n++;
        }
      }
      out[day.date] = n;
    }
    return out;
  });

  return (
    <div class="pb-44">
      <div class="sticky top-0 z-30 bg-paper/95 backdrop-blur-sm border-b-2 border-ink">
        <div class="mx-auto max-w-6xl px-3">
          <DaySwitcher
            days={lineup.days}
            activeDate={activeDay.date}
            onPick={setActiveDate}
            pickedPerDay={pickedPerDay.value}
          />
        </div>
      </div>

      <div class="mx-auto max-w-6xl px-3 mt-3">
        <Timeline day={activeDay} conflictedIds={conflictIds.value} />
      </div>

      <SelectionPanel
        days={lineup.days}
        conflicts={conflicts.value}
        festival={`${lineup.festival} ${lineup.year}`}
        location={lineup.location}
      />
    </div>
  );
}
