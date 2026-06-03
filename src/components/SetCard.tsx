import type { Set as FestSet } from '~/data/schema';
import { spotifySearchUrl, youtubeMusicSearchUrl } from '~/lib/musicLinks';
import {
  isInRoom,
  isSelected,
  pickersBySetId,
  roomUsesAttribution,
  selections,
  toggleSelection,
} from '~/lib/store';
import { computed } from '@preact/signals';
import { formatRange, absoluteMin, durationMin } from '~/lib/time';

type Props = {
  set: FestSet;
  dayStartMin: number;
  pxPerMin: number;
  conflictedIds: ReadonlySet<string>;
};

export function SetCard({ set, dayStartMin, pxPerMin, conflictedIds }: Props) {
  const mine = computed(() => selections.value.has(set.id));
  const othersPicked = computed(() => {
    if (!isInRoom.value || !roomUsesAttribution.value) return false;
    return pickersBySetId.value.has(set.id) && !mine.value;
  });
  const isConflicted = computed(() => isSelected(set.id) && conflictedIds.has(set.id));

  const leftPx = (absoluteMin(set) - dayStartMin) * pxPerMin;
  const widthPx = durationMin(set.start, set.end, set.crossesMidnight) * pxPerMin;

  const selected = mine.value;
  const othersOnly = othersPicked.value;
  const conflict = isConflicted.value;

  const cls = [
    'set-card',
    'absolute top-1 bottom-1 select-none overflow-hidden',
    'rounded-sm border-2 transition-transform',
    selected
      ? 'border-ink bg-neon text-ink shadow-[3px_3px_0_var(--color-ink)] rotate-[-1deg] z-20'
      : othersOnly
        ? 'border-neon/80 bg-ink/90 text-paper hover:bg-blood hover:-translate-y-0.5 z-15 ring-1 ring-neon/40'
        : 'border-ink bg-ink text-paper hover:bg-blood hover:-translate-y-0.5 z-10',
    conflict ? 'ring-4 ring-blood' : '',
  ].join(' ');

  const linkCls =
    'font-mono text-[0.55rem] leading-none opacity-80 hover:opacity-100 underline-offset-2 hover:underline';

  return (
    <div
      class={cls}
      style={{ left: `${leftPx}px`, width: `${Math.max(widthPx, 64)}px` }}
      title={`${set.artist} ${formatRange(set.start, set.end)}`}
    >
      <div class="relative flex h-full flex-col justify-between px-2 py-1 gap-0.5">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          onClick={() => toggleSelection(set.id)}
          class="absolute inset-0 z-0 cursor-pointer rounded-[inherit]"
          aria-label={`${set.artist}, ${formatRange(set.start, set.end)}`}
        />
        <div class="relative z-10 pointer-events-none flex items-start gap-1.5 min-w-0">
          <span class="font-mono font-bold text-[0.92rem] leading-[1.05] line-clamp-2 flex-1 break-words">
            {set.artist}
          </span>
          {set.country && (
            <span class="font-mono text-[0.6rem] opacity-70 mt-0.5 shrink-0">{set.country}</span>
          )}
        </div>
        <div class="relative z-10 pointer-events-none flex items-center justify-between font-mono text-[0.7rem] leading-none opacity-90 shrink-0 gap-1">
          <span class="tabular-nums shrink-0">{formatRange(set.start, set.end)}</span>
          {conflict && (
            <span class="font-display text-[0.65rem] tracking-tighter text-blood bg-paper px-1 -mr-1 shrink-0" title="Time conflict">
              ⚠ CLASH
            </span>
          )}
        </div>
        <div class="relative z-20 flex items-center justify-start gap-1.5 shrink-0">
          <a
            href={spotifySearchUrl(set.artist)}
            target="_blank"
            rel="noopener noreferrer"
            class={`pointer-events-auto ${linkCls}`}
            title={`Search ${set.artist} on Spotify`}
            aria-label={`Search ${set.artist} on Spotify`}
            onClick={(e) => e.stopPropagation()}
          >
            Spotify
          </a>
          <span class="pointer-events-none font-mono text-[0.55rem] leading-none opacity-50" aria-hidden="true">
            |
          </span>
          <a
            href={youtubeMusicSearchUrl(set.artist)}
            target="_blank"
            rel="noopener noreferrer"
            class={`pointer-events-auto ${linkCls}`}
            title={`Search ${set.artist} on YouTube Music`}
            aria-label={`Search ${set.artist} on YouTube Music`}
            onClick={(e) => e.stopPropagation()}
          >
            YT Music
          </a>
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
    </div>
  );
}
