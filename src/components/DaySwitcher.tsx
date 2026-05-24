import type { Day } from '~/data/schema';

type Props = {
  days: Day[];
  activeDate: string;
  onPick: (date: string) => void;
  pickedPerDay: Record<string, number>;
};

export function DaySwitcher({ days, activeDate, onPick, pickedPerDay }: Props) {
  return (
    <div class="flex w-full snap-x snap-mandatory gap-2 overflow-x-auto py-2">
      {days.map((d, i) => {
        const active = d.date === activeDate;
        const picked = pickedPerDay[d.date] ?? 0;
        const rotate = ['rotate-[-1.5deg]', 'rotate-[1deg]', 'rotate-[-0.5deg]', 'rotate-[1.5deg]', 'rotate-[-1deg]'][i % 5];
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onPick(d.date)}
            class={[
              'snap-start shrink-0 cursor-pointer select-none px-3 py-2 border-2 border-ink font-display uppercase tracking-tight transition-transform',
              rotate,
              active
                ? 'bg-blood text-paper shadow-[4px_4px_0_var(--color-ink)] -translate-y-0.5'
                : 'bg-paper text-ink hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--color-ink)]',
            ].join(' ')}
          >
            <span class="block text-[0.65rem] leading-none opacity-90">{d.label.split(' ')[0]}</span>
            <span class="block text-base leading-none mt-0.5">{d.shortLabel.split(' ').slice(1).join(' ')}</span>
            {picked > 0 && (
              <span class="block font-mono text-[0.6rem] mt-1 leading-none">{picked} picked</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
