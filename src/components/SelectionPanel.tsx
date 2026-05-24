import type { ConflictPair } from '~/lib/conflicts';
import type { Day } from '~/data/schema';
import { selections, selectionsCount, toggleSelection } from '~/lib/store';
import { buildIcs } from '~/lib/ics';
import { useState } from 'preact/hooks';
import { ImportExportModal } from './ImportExport';

type Props = {
  days: Day[];
  conflicts: ConflictPair[];
  festival: string;
  location: string;
};

function downloadFile(name: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SelectionPanel({ days, conflicts, festival, location }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const count = selectionsCount.value;

  const daysWithPicks = days.filter((d) =>
    d.stages.some((s) => s.sets.some((set) => selections.value.has(set.id))),
  ).length;

  function handleExportIcs() {
    const ics = buildIcs(days, selections.value, { festival, location });
    downloadFile(
      `rfp-2026-my-picks-${new Date().toISOString().slice(0, 10)}.ics`,
      ics,
      'text/calendar;charset=utf-8',
    );
  }

  return (
    <>
      <div
        class={[
          'fixed bottom-0 left-0 right-0 z-40 border-t-4 border-ink bg-paper shadow-[0_-4px_0_var(--color-blood)] transition-transform',
          'pb-safe',
        ].join(' ')}
        role="region"
        aria-label="Your picks"
      >
        <div class="mx-auto max-w-5xl px-3 py-2">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 cursor-pointer"
            onClick={() => setExpanded((x) => !x)}
            aria-expanded={expanded}
          >
            <div class="flex items-baseline gap-3">
              <span class="font-display text-lg uppercase tracking-tight">
                <span class="text-blood">{count}</span> picks
              </span>
              <span class="font-mono text-xs text-ink/70">
                {daysWithPicks} day{daysWithPicks === 1 ? '' : 's'}
                {conflicts.length > 0 && (
                  <>
                    {' · '}
                    <span class="text-blood font-bold">{conflicts.length} clash{conflicts.length === 1 ? '' : 'es'}</span>
                  </>
                )}
              </span>
            </div>
            <span class="font-display text-sm">{expanded ? '▼' : '▲'}</span>
          </button>

          {expanded && (
            <div class="mt-3 max-h-[40dvh] overflow-y-auto">
              {conflicts.length > 0 && (
                <div class="mb-3 border-2 border-blood bg-blood/5 p-2">
                  <div class="font-display text-xs uppercase tracking-tight text-blood-dark mb-1">
                    Clashes — same time, different stage
                  </div>
                  <ul class="space-y-1 font-mono text-xs">
                    {conflicts.map((c) => (
                      <li key={c.a.id + c.b.id}>
                        <span class="font-bold">{c.a.artist}</span> ({c.a.start}–{c.a.end}) vs{' '}
                        <span class="font-bold">{c.b.artist}</span> ({c.b.start}–{c.b.end})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {count === 0 ? (
                <p class="font-mono text-xs text-ink/70 italic">
                  Tap any set on the timeline to add it to your picks.
                </p>
              ) : (
                <ul class="space-y-1.5 mb-3">
                  {days.map((day) => {
                    const dayPicks = day.stages.flatMap((s) =>
                      s.sets
                        .filter((set) => selections.value.has(set.id))
                        .map((set) => ({ set, stage: s.name })),
                    );
                    if (dayPicks.length === 0) return null;
                    dayPicks.sort((x, y) => x.set.start.localeCompare(y.set.start));
                    return (
                      <li key={day.date}>
                        <div class="font-display text-xs uppercase tracking-tight">
                          {day.shortLabel}
                        </div>
                        <ul class="ml-2 mt-0.5 space-y-0.5 font-mono text-xs">
                          {dayPicks.map((p) => (
                            <li key={p.set.id} class="flex items-baseline justify-between gap-2">
                              <span>
                                <span class="font-bold">{p.set.artist}</span>{' '}
                                <span class="text-ink/60">— {p.stage}</span>
                              </span>
                              <span class="flex items-center gap-2 shrink-0">
                                <span class="text-ink/70">
                                  {p.set.start}–{p.set.end}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleSelection(p.set.id)}
                                  class="text-blood font-bold cursor-pointer hover:underline"
                                  aria-label={`Remove ${p.set.artist}`}
                                >
                                  ×
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div class="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExportIcs}
              disabled={count === 0}
              class="flex-1 min-w-[140px] border-2 border-ink bg-neon px-3 py-2 font-display uppercase tracking-tight text-ink hover:shadow-[3px_3px_0_var(--color-ink)] hover:-translate-y-0.5 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              📅 Export .ics
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              class="flex-1 min-w-[140px] border-2 border-ink bg-paper px-3 py-2 font-display uppercase tracking-tight hover:bg-pink hover:shadow-[3px_3px_0_var(--color-ink)] hover:-translate-y-0.5 transition-transform cursor-pointer"
            >
              ⇅ Backup / Restore
            </button>
          </div>
        </div>
      </div>

      {showModal && <ImportExportModal onClose={() => setShowModal(false)} />}
    </>
  );
}
