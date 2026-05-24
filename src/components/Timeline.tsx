import type { Day } from '~/data/schema';
import { SetCard } from './SetCard';
import { absoluteMin, durationMin } from '~/lib/time';

const PX_PER_MIN = 2.6; // 156 px / hour — wider cards, easier to read short sets
const STAGE_LABEL_WIDTH = 132; // px
const ROW_HEIGHT = 80; // px — tall enough for two lines of bold mono

type Props = {
  day: Day;
  conflictedIds: ReadonlySet<string>;
};

function computeRange(day: Day): { startMin: number; endMin: number } {
  let startMin = Infinity;
  let endMin = -Infinity;
  for (const stage of day.stages) {
    for (const set of stage.sets) {
      const s = absoluteMin(set);
      const e = s + durationMin(set.start, set.end, set.crossesMidnight);
      if (s < startMin) startMin = s;
      if (e > endMin) endMin = e;
    }
  }
  if (!Number.isFinite(startMin)) return { startMin: 12 * 60, endMin: 24 * 60 };
  startMin = Math.floor(startMin / 60) * 60;
  endMin = Math.ceil(endMin / 60) * 60;
  return { startMin, endMin };
}

export function Timeline({ day, conflictedIds }: Props) {
  const { startMin, endMin } = computeRange(day);
  const totalMin = endMin - startMin;
  const totalWidth = totalMin * PX_PER_MIN;

  const hours: number[] = [];
  for (let m = startMin; m <= endMin; m += 60) hours.push(m);

  return (
    <div class="relative w-full overflow-x-auto overflow-y-visible">
      <div class="relative" style={{ minWidth: `${totalWidth + STAGE_LABEL_WIDTH}px` }}>
        <div
          class="sticky top-0 z-30 flex border-b-2 border-ink bg-paper/95 backdrop-blur-sm"
          style={{ paddingLeft: `${STAGE_LABEL_WIDTH}px` }}
        >
          <div class="relative h-9" style={{ width: `${totalWidth}px` }}>
            {hours.map((m) => {
              const left = (m - startMin) * PX_PER_MIN;
              const label = `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:00`;
              return (
                <div
                  key={m}
                  class="absolute top-0 bottom-0 flex items-center"
                  style={{ left: `${left}px` }}
                >
                  <span class="font-mono text-[0.7rem] -translate-x-1/2 px-1 text-ink/80">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div class="relative" style={{ minWidth: `${totalWidth + STAGE_LABEL_WIDTH}px` }}>
          {day.stages.map((stage) => (
            <div key={stage.name} class="flex border-b border-ink/30 last:border-b-0">
              <div
                class="sticky left-0 z-20 flex shrink-0 items-center bg-paper px-2 py-3 border-r-2 border-ink"
                style={{ width: `${STAGE_LABEL_WIDTH}px` }}
              >
                <span class="font-display text-[0.72rem] uppercase leading-tight tracking-tight">
                  {stage.name}
                </span>
              </div>
              <div class="relative" style={{ width: `${totalWidth}px`, height: `${ROW_HEIGHT}px` }}>
                {hours.map((m) => {
                  const left = (m - startMin) * PX_PER_MIN;
                  return (
                    <div
                      key={m}
                      class="absolute top-0 bottom-0 border-l border-ink/15"
                      style={{ left: `${left}px` }}
                    />
                  );
                })}
                {stage.sets.map((set) => (
                  <SetCard
                    key={set.id}
                    set={set}
                    dayStartMin={startMin}
                    pxPerMin={PX_PER_MIN}
                    conflictedIds={conflictedIds}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
