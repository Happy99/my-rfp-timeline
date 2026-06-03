import { useState } from 'preact/hooks';
import { isSupabaseConfigured } from '~/lib/supabase';
import { normalizeRoomCode } from '~/lib/room';
import {
  createGroupRoom,
  getShareableRoomLink,
  isInRoom,
  joinRoom,
  leaveRoom,
  roomCode,
  roomSyncError,
  roomSyncState,
  selectionsCount,
} from '~/lib/store';

type Props = { onClose: () => void };

export function GroupRoomModal({ onClose }: Props) {
  const [joinInput, setJoinInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const configured = isSupabaseConfigured();
  const activeCode = roomCode.value;
  const inRoom = isInRoom.value;

  async function handleCreate() {
    setError(null);
    setStatus(null);
    setBusy(true);
    const result = await createGroupRoom();
    setBusy(false);
    if (result.ok) {
      const link = getShareableRoomLink(result.code);
      setCreatedLink(link);
      setStatus(`Group created. Share code ${result.code} with friends.`);
    } else {
      setError(result.reason);
    }
  }

  async function handleJoin() {
    setError(null);
    setStatus(null);
    const code = normalizeRoomCode(joinInput);
    if (code.length < 6) {
      setError('Enter a valid room code (at least 6 characters).');
      return;
    }
    setBusy(true);
    const result = await joinRoom(code);
    setBusy(false);
    if (result.ok) {
      setStatus(`Joined group ${roomCode.value}.`);
      setJoinInput('');
      setCreatedLink(null);
    } else if (!result.cancelled) {
      setError(result.reason);
    }
  }

  function handleLeave() {
    leaveRoom();
    setCreatedLink(null);
    setStatus('Left the group. Your picks stay on this device.');
    setError(null);
  }

  async function handleCopyLink() {
    const link = createdLink ?? (activeCode ? getShareableRoomLink(activeCode) : null);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Link copied to clipboard.');
      setError(null);
    } catch {
      setError('Could not copy — select the link and copy manually.');
    }
  }

  const syncLabel =
    roomSyncState.value === 'synced'
      ? 'Live'
      : roomSyncState.value === 'connecting'
        ? 'Connecting…'
        : roomSyncState.value === 'error'
          ? 'Sync error'
          : roomSyncState.value;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4"
      onClick={onClose}
    >
      <div
        class="relative w-full max-w-md border-2 border-ink bg-paper p-5 shadow-[6px_6px_0_var(--color-blood)] rotate-[0.5deg]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          class="absolute -right-3 -top-3 size-8 border-2 border-ink bg-neon font-display text-base rotate-[-6deg] cursor-pointer"
          aria-label="Close"
        >
          ×
        </button>
        <h2 class="font-display text-xl uppercase tracking-tight">Plan with friends</h2>
        <p class="font-mono text-xs mt-1 text-ink/80">
          Share one pick list in real time. Everyone with the link or code sees the same sets.
        </p>

        {!configured && (
          <p class="mt-3 font-mono text-xs border-l-4 border-blood bg-blood/10 px-2 py-1 text-blood-dark">
            Group sync is not configured on this deployment (missing Supabase env vars).
          </p>
        )}

        {configured && inRoom && activeCode && (
          <div class="mt-4 border-2 border-neon bg-neon/20 p-3">
            <div class="font-display text-sm uppercase tracking-tight">
              {syncLabel} · room <span class="text-blood">{activeCode}</span>
            </div>
            <p class="font-mono text-xs mt-1 text-ink/80">
              {selectionsCount.value} shared pick{selectionsCount.value === 1 ? '' : 's'}
            </p>
            {roomSyncError.value && (
              <p class="mt-1 font-mono text-xs text-blood-dark">{roomSyncError.value}</p>
            )}
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                class="flex-1 min-w-[120px] border-2 border-ink bg-paper px-3 py-2 font-display text-xs uppercase tracking-tight hover:bg-pink cursor-pointer"
              >
                Copy link
              </button>
              <button
                type="button"
                onClick={handleLeave}
                class="flex-1 min-w-[120px] border-2 border-blood bg-paper px-3 py-2 font-display text-xs uppercase tracking-tight text-blood hover:bg-blood hover:text-paper cursor-pointer"
              >
                Leave group
              </button>
            </div>
          </div>
        )}

        {configured && !inRoom && (
          <div class="mt-4 space-y-3">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={busy}
              class="w-full border-2 border-ink bg-neon px-3 py-2 font-display uppercase tracking-tight hover:shadow-[3px_3px_0_var(--color-ink)] hover:-translate-y-0.5 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Start a group
            </button>
            <p class="font-mono text-[0.65rem] text-ink/70">
              Creates a new room. Your current picks (if any) become the starting list.
            </p>

            <div class="border-2 border-ink p-3">
              <label class="font-mono text-xs uppercase tracking-wide">Join with code</label>
              <input
                type="text"
                value={joinInput}
                onInput={(e) => setJoinInput((e.target as HTMLInputElement).value)}
                placeholder="e.g. AB12CD34"
                class="mt-2 w-full border-2 border-ink bg-paper px-2 py-1.5 font-mono text-sm uppercase tracking-wider"
                autocapitalize="characters"
                autocomplete="off"
                spellcheck={false}
              />
              <button
                type="button"
                onClick={() => void handleJoin()}
                disabled={busy}
                class="mt-2 w-full border-2 border-ink bg-paper px-3 py-2 font-display uppercase tracking-tight hover:bg-pink cursor-pointer disabled:opacity-40"
              >
                Join group
              </button>
              {selectionsCount.value > 0 && (
                <p class="mt-2 font-mono text-[0.65rem] text-ink/70">
                  You have local picks — joining replaces them with the group list.
                </p>
              )}
            </div>

            {createdLink && (
              <div class="border-2 border-dashed border-ink/60 p-2">
                <p class="font-mono text-[0.65rem] break-all">{createdLink}</p>
                <button
                  type="button"
                  onClick={() => void handleCopyLink()}
                  class="mt-2 w-full border-2 border-ink bg-paper px-2 py-1 font-mono text-xs hover:bg-neon cursor-pointer"
                >
                  Copy invite link
                </button>
              </div>
            )}
          </div>
        )}

        {configured && inRoom && (
          <p class="mt-3 font-mono text-[0.65rem] text-ink/70">
            Backup / restore and .ics export still work; changes sync to the group.
          </p>
        )}

        {status && (
          <p class="mt-3 font-mono text-xs border-l-4 border-neon bg-neon/30 px-2 py-1">{status}</p>
        )}
        {error && (
          <p class="mt-3 font-mono text-xs border-l-4 border-blood bg-blood/10 px-2 py-1 text-blood-dark">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
