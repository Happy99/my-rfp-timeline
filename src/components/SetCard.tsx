import type { Set as FestSet } from '~/data/schema';
import { selections, toggleSelection } from '~/lib/store';
import { computed } from '@preact/signals';
import { formatRange, absoluteMin, durationMin } from '~/lib/time';

type Props = {
  set: FestSet;
  dayStartMin: number;
  pxPerMin: number;
  conflictedIds: ReadonlySet<string>;
};

export function SetCard({ set, dayStartMin, pxPerMin, conflictedIds }: Props) {
  const isSelected = computed(() => selections.value.has(set.id));
  const isConflicted = computed(() => isSelected.value && conflictedIds.has(set.id));

  const leftPx = (absoluteMin(set) - dayStartMin) * pxPerMin;
  const widthPx = durationMin(set.start, set.end, set.crossesMidnight) * pxPerMin;

  const selected = isSelected.value;
  const conflict = isConflicted.value;

  const cls = [
    'set-card',
    'absolute top-1 bottom-1 cursor-pointer select-none overflow-hidden',
    'rounded-sm border-2 transition-transform',
    selected
      ? 'border-ink bg-neon text-ink shadow-[3px_3px_0_var(--color-ink)] rotate-[-1deg] z-20'
      : 'border-ink bg-ink text-paper hover:bg-blood hover:-translate-y-0.5 z-10',
    conflict ? 'ring-4 ring-blood' : '',
  ].join(' ');

  return (
    <button
      type="button"
      class={cls}
      style={{ left: `${leftPx}px`, width: `${Math.max(widthPx, 64)}px` }}
      onClick={() => toggleSelection(set.id)}
      aria-pressed={selected}
      title={`${set.artist} ${formatRange(set.start, set.end)}`}
    >
      <div class="flex h-full flex-col justify-between px-2 py-1.5 text-left gap-1">
        <div class="flex items-start gap-1.5 min-w-0">
          <span class="font-mono font-bold text-[0.92rem] leading-[1.05] line-clamp-2 flex-1 break-words">
            {set.artist}
          </span>
          {set.country && (
            <span class="font-mono text-[0.6rem] opacity-70 mt-0.5 shrink-0">{set.country}</span>
          )}
        </div>
        <div class="flex items-center justify-between font-mono text-[0.7rem] leading-none opacity-90">
          <span class="tabular-nums">{formatRange(set.start, set.end)}</span>
          {conflict && (
            <span class="font-display text-[0.65rem] tracking-tighter text-blood bg-paper px-1 -mr-1" title="Time conflict">
              ⚠ CLASH
            </span>
          )}
        </div>
      </div>
      {selected && (
        <span
          class="pointer-events-none absolute -right-1 -top-2 select-none font-marker text-[0.7rem] leading-none text-blood opacity-95 rotate-[8deg]"
          aria-hidden="true"
        >
          ✕ PICKED
        </span>
      )}
    </button>
  );
}
