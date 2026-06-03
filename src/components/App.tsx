import type { Lineup } from '~/data/schema';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import { computed } from '@preact/signals';
import { isSupabaseConfigured } from '~/lib/supabase';
import { clearRoomFromUrl, readRoomFromUrl, readSessionRoomCode } from '~/lib/room';
import { getDisplayName } from '~/lib/member';
import {
  conflictSelectionIds,
  joinRoom,
  resumeRoomFromSession,
  roomCode,
  selections,
} from '~/lib/store';
import { findConflicts, conflictedIds } from '~/lib/conflicts';
import { DaySwitcher } from './DaySwitcher';
import { Timeline } from './Timeline';
import { SelectionPanel } from './SelectionPanel';
import { GroupRoomModal } from './GroupRoomModal';

type Props = { lineup: Lineup };

export function App({ lineup }: Props) {
  const initialDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return lineup.days.find((d) => d.date >= today)?.date ?? lineup.days[0]!.date;
  }, [lineup]);

  const [activeDate, setActiveDate] = useState(initialDate);
  const [showNameGate, setShowNameGate] = useState(false);
  const [pendingRoomCode, setPendingRoomCode] = useState<string | null>(null);
  const activeDay = lineup.days.find((d) => d.date === activeDate) ?? lineup.days[0]!;
  const roomBootstrapped = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured() || roomBootstrapped.current) return;
    roomBootstrapped.current = true;

    void (async () => {
      const fromUrl = readRoomFromUrl();
      if (fromUrl) {
        const name = getDisplayName();
        if (!name) {
          setPendingRoomCode(fromUrl);
          setShowNameGate(true);
          return;
        }
        const result = await joinRoom(fromUrl, name, { skipConfirm: true });
        if (!result.ok && result.cancelled) clearRoomFromUrl();
        return;
      }
      if (roomCode.value) return;
      const fromSession = readSessionRoomCode();
      if (fromSession) {
        const name = getDisplayName();
        if (!name) {
          setPendingRoomCode(fromSession);
          setShowNameGate(true);
          return;
        }
        await resumeRoomFromSession(fromSession, name);
      }
    })();
  }, []);

  const conflicts = computed(() => findConflicts(lineup.days, conflictSelectionIds.value));
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

      {showNameGate && pendingRoomCode && (
        <GroupRoomModal
          initialJoinCode={pendingRoomCode}
          onJoined={() => {
            setShowNameGate(false);
            setPendingRoomCode(null);
          }}
          onClose={() => {
            setShowNameGate(false);
            clearRoomFromUrl();
            setPendingRoomCode(null);
          }}
        />
      )}
    </div>
  );
}
