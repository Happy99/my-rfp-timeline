import { signal, computed, effect } from '@preact/signals';
import { FESTIVAL_TAG, SCHEMA_VERSION, STORAGE_KEY } from '~/lib/constants';
import type { RoomSyncState } from '~/lib/room';
import {
  clearRoomFromUrl,
  createRoom,
  fetchRoom,
  persistSessionRoomCode,
  setRoomIdsRemote,
  subscribeRoom,
  togglePickRemote,
  unsubscribeRoom,
  roomUrl,
} from '~/lib/room';

export { FESTIVAL_TAG, SCHEMA_VERSION };

type Envelope = {
  version: number;
  festival: string;
  exportedAt?: string;
  ids: string[];
};

function loadInitial(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Envelope;
    if (parsed?.version !== SCHEMA_VERSION || !Array.isArray(parsed.ids)) return new Set();
    return new Set(parsed.ids.filter((s) => typeof s === 'string'));
  } catch {
    return new Set();
  }
}

export const selections = signal<Set<string>>(loadInitial());
export const roomCode = signal<string | null>(null);
export const roomSyncState = signal<RoomSyncState>('idle');
export const roomSyncError = signal<string | null>(null);

export const selectionsCount = computed(() => selections.value.size);
export const isInRoom = computed(() => roomCode.value !== null);

let applyingRemote = false;
let debounceHandle: number | null = null;

if (typeof window !== 'undefined') {
  effect(() => {
    if (roomCode.value !== null) return;
    const ids = [...selections.value].sort();
    if (debounceHandle !== null) window.clearTimeout(debounceHandle);
    debounceHandle = window.setTimeout(() => {
      const envelope: Envelope = { version: SCHEMA_VERSION, festival: FESTIVAL_TAG, ids };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      } catch {
        // localStorage may be unavailable (private mode); silently skip.
      }
    }, 200);
  });
}

export function applyRemoteIds(ids: string[]): void {
  applyingRemote = true;
  selections.value = new Set(ids.filter((s) => typeof s === 'string'));
  applyingRemote = false;
}

function setRoomSync(state: RoomSyncState, message: string | null = null): void {
  roomSyncState.value = state;
  roomSyncError.value = message;
}

async function persistRoomIds(ids: string[]): Promise<void> {
  const code = roomCode.value;
  if (!code || applyingRemote) return;
  try {
    await setRoomIdsRemote(code, [...ids].sort());
  } catch (err) {
    setRoomSync('error', err instanceof Error ? err.message : 'Failed to sync picks.');
  }
}

async function persistToggle(setId: string): Promise<void> {
  const code = roomCode.value;
  if (!code || applyingRemote) return;
  try {
    await togglePickRemote(code, setId);
  } catch (err) {
    setRoomSync('error', err instanceof Error ? err.message : 'Failed to sync pick.');
  }
}

export async function enterRoom(code: string, ids: string[]): Promise<void> {
  const normalized = code.trim().toUpperCase();
  unsubscribeRoom();
  roomCode.value = normalized;
  applyRemoteIds(ids);
  persistSessionRoomCode(normalized);
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('room', normalized);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
  subscribeRoom(
    normalized,
    (remoteIds) => applyRemoteIds(remoteIds),
    (state, message) => setRoomSync(state, message ?? null),
  );
}

export function leaveRoom(): void {
  unsubscribeRoom();
  roomCode.value = null;
  setRoomSync('idle', null);
  persistSessionRoomCode(null);
  clearRoomFromUrl();
}

const JOIN_CONFIRM_MSG =
  'Joining this group will replace your picks in this browser with the shared group list. Continue?';

export async function joinRoom(
  code: string,
  options: { skipConfirm?: boolean } = {},
): Promise<{ ok: true } | { ok: false; reason: string; cancelled?: boolean }> {
  if (selectionsCount.value > 0 && !options.skipConfirm) {
    if (!window.confirm(JOIN_CONFIRM_MSG)) {
      return { ok: false, reason: 'Cancelled.', cancelled: true };
    }
  }
  try {
    const row = await fetchRoom(code);
    await enterRoom(row.code, row.ids);
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Failed to join room.';
    setRoomSync('error', reason);
    return { ok: false, reason };
  }
}

export async function resumeRoomFromSession(code: string): Promise<boolean> {
  try {
    const row = await fetchRoom(code);
    await enterRoom(row.code, row.ids);
    return true;
  } catch {
    leaveRoom();
    return false;
  }
}

export function toggleSelection(id: string): void {
  const had = selections.value.has(id);
  const next = new Set(selections.value);
  if (had) next.delete(id);
  else next.add(id);
  selections.value = next;

  if (roomCode.value && !applyingRemote) {
    void persistToggle(id);
  }
}

export function isSelected(id: string): boolean {
  return selections.value.has(id);
}

export async function clearAllSelections(): Promise<void> {
  selections.value = new Set();
  if (roomCode.value) await persistRoomIds([]);
}

export function exportSelectionsAsJson(): string {
  const envelope: Envelope = {
    version: SCHEMA_VERSION,
    festival: FESTIVAL_TAG,
    exportedAt: new Date().toISOString(),
    ids: [...selections.value].sort(),
  };
  return JSON.stringify(envelope, null, 2);
}

export type ImportResult =
  | { ok: true; count: number; mode: 'replace' | 'merge' }
  | { ok: false; reason: string };

export async function importSelectionsFromJson(
  raw: string,
  mode: 'replace' | 'merge' = 'replace',
): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'File is not valid JSON.' };
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as Envelope).version !== SCHEMA_VERSION ||
    !Array.isArray((parsed as Envelope).ids)
  ) {
    return { ok: false, reason: `Unsupported file format (expected version ${SCHEMA_VERSION}).` };
  }
  const env = parsed as Envelope;
  if (env.festival !== FESTIVAL_TAG) {
    return { ok: false, reason: `File is for "${env.festival}", expected "${FESTIVAL_TAG}".` };
  }
  const incoming = new Set(env.ids.filter((s) => typeof s === 'string'));
  const next = mode === 'merge' ? new Set([...selections.value, ...incoming]) : incoming;
  selections.value = next;
  if (roomCode.value) {
    await persistRoomIds([...next]);
  }
  return { ok: true, count: incoming.size, mode };
}

export function getShareableRoomLink(code: string): string {
  return roomUrl(code);
}

export async function createGroupRoom(): Promise<
  { ok: true; code: string } | { ok: false; reason: string }
> {
  try {
    const row = await createRoom();
    const initialIds = [...selections.value].sort();
    await enterRoom(row.code, initialIds);
    if (initialIds.length > 0) {
      await setRoomIdsRemote(row.code, initialIds);
    }
    return { ok: true, code: row.code };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Failed to create room.';
    setRoomSync('error', reason);
    return { ok: false, reason };
  }
}
