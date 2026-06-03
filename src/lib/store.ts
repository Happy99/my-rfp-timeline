import { signal, computed, effect } from '@preact/signals';
import { FESTIVAL_TAG, SCHEMA_VERSION, STORAGE_KEY } from '~/lib/constants';
import {
  getDisplayName,
  getOrCreateMemberId,
  normalizeDisplayName,
  setDisplayName,
} from '~/lib/member';
import type { RoomPick, RoomState, RoomSyncState } from '~/lib/room';
import {
  clearRoomFromUrl,
  createRoom,
  fetchRoom,
  persistSessionRoomCode,
  roomStateFromRow,
  roomUrl,
  setMemberPicksRemote,
  subscribeRoom,
  togglePickRemote,
  clearMemberPicksRemote,
  unsubscribeRoom,
  upsertMemberRemote,
} from '~/lib/room';

export { FESTIVAL_TAG, SCHEMA_VERSION };
export type { RoomPick };

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

const soloSelections = signal<Set<string>>(loadInitial());
export const roomCode = signal<string | null>(null);
export const roomSyncState = signal<RoomSyncState>('idle');
export const roomSyncError = signal<string | null>(null);
export const roomPicks = signal<RoomPick[]>([]);
export const roomMembers = signal<Record<string, string>>({});
export const legacyRoomIds = signal<string[]>([]);

export const roomUsesAttribution = computed(() => roomPicks.value.length > 0);

export const selections = computed(() => {
  if (!roomCode.value) return soloSelections.value;
  if (roomUsesAttribution.value) {
    const memberId = getOrCreateMemberId();
    return new Set(
      roomPicks.value.filter((p) => p.member_id === memberId).map((p) => p.set_id),
    );
  }
  return new Set(legacyRoomIds.value);
});

export const selectionsCount = computed(() => selections.value.size);
export const isInRoom = computed(() => roomCode.value !== null);

export const allRoomSetIds = computed(
  () => new Set(roomPicks.value.map((p) => p.set_id)),
);

export const pickersBySetId = computed(() => {
  const members = roomMembers.value;
  const map = new Map<string, string[]>();
  for (const pick of roomPicks.value) {
    const name = members[pick.member_id] ?? 'Unknown';
    const list = map.get(pick.set_id) ?? [];
    list.push(name);
    map.set(pick.set_id, list);
  }
  for (const [setId, names] of map) {
    map.set(setId, [...names].sort((a, b) => a.localeCompare(b)));
  }
  return map;
});

export const pickerMemberIdsBySetId = computed(() => {
  const map = new Map<string, string[]>();
  for (const pick of roomPicks.value) {
    const list = map.get(pick.set_id) ?? [];
    if (!list.includes(pick.member_id)) list.push(pick.member_id);
    map.set(pick.set_id, list);
  }
  for (const [setId, ids] of map) {
    map.set(setId, [...ids].sort());
  }
  return map;
});

export const roomMemberCount = computed(() => {
  const ids = new Set(roomPicks.value.map((p) => p.member_id));
  return ids.size;
});

export const myDisplayName = computed(() => getDisplayName());

export const conflictSelectionIds = computed(() => {
  if (!roomCode.value) return selections.value;
  if (roomUsesAttribution.value) return allRoomSetIds.value;
  return new Set(legacyRoomIds.value);
});

let applyingRemote = false;
let debounceHandle: number | null = null;

if (typeof window !== 'undefined') {
  effect(() => {
    if (roomCode.value !== null) return;
    const ids = [...soloSelections.value].sort();
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

export function applyRemoteRoomState(state: RoomState): void {
  applyingRemote = true;
  roomPicks.value = state.picks;
  roomMembers.value = state.members;
  legacyRoomIds.value = state.legacyIds;
  applyingRemote = false;
}

function setRoomSync(state: RoomSyncState, message: string | null = null): void {
  roomSyncState.value = state;
  roomSyncError.value = message;
}

function resetRoomState(): void {
  roomPicks.value = [];
  roomMembers.value = {};
  legacyRoomIds.value = [];
}

async function registerMember(displayName: string): Promise<void> {
  const code = roomCode.value;
  if (!code) return;
  const memberId = getOrCreateMemberId();
  const normalized = normalizeDisplayName(displayName);
  setDisplayName(normalized);
  const members = await upsertMemberRemote(code, memberId, normalized);
  roomMembers.value = members;
}

async function persistToggle(setId: string): Promise<void> {
  const code = roomCode.value;
  if (!code || applyingRemote) return;
  try {
    const picks = await togglePickRemote(code, setId, getOrCreateMemberId());
    roomPicks.value = picks;
  } catch (err) {
    setRoomSync('error', err instanceof Error ? err.message : 'Failed to sync pick.');
  }
}

export async function enterRoom(code: string, state: RoomState, displayName: string): Promise<void> {
  const normalized = code.trim().toUpperCase();
  unsubscribeRoom();
  roomCode.value = normalized;
  applyRemoteRoomState(state);
  persistSessionRoomCode(normalized);
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    url.searchParams.set('room', normalized);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
  await registerMember(displayName);
  subscribeRoom(
    normalized,
    (remoteState) => applyRemoteRoomState(remoteState),
    (syncState, message) => setRoomSync(syncState, message ?? null),
  );
}

export function leaveRoom(): void {
  unsubscribeRoom();
  roomCode.value = null;
  resetRoomState();
  setRoomSync('idle', null);
  persistSessionRoomCode(null);
  clearRoomFromUrl();
}

const JOIN_CONFIRM_MSG =
  'Joining will add your local picks to the group under your name. Continue?';

export async function joinRoom(
  code: string,
  displayName: string,
  options: { skipConfirm?: boolean; skipUpload?: boolean } = {},
): Promise<{ ok: true } | { ok: false; reason: string; cancelled?: boolean }> {
  const localCount = soloSelections.value.size;
  if (localCount > 0 && !options.skipConfirm) {
    if (!window.confirm(JOIN_CONFIRM_MSG)) {
      return { ok: false, reason: 'Cancelled.', cancelled: true };
    }
  }
  try {
    const row = await fetchRoom(code);
    const state = roomStateFromRow(row);
    await enterRoom(row.code, state, displayName);
    if (!options.skipUpload && localCount > 0) {
      const ids = [...soloSelections.value].sort();
      const picks = await setMemberPicksRemote(row.code, getOrCreateMemberId(), ids);
      roomPicks.value = picks;
    }
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Failed to join room.';
    setRoomSync('error', reason);
    return { ok: false, reason };
  }
}

export async function resumeRoomFromSession(
  code: string,
  displayName: string,
): Promise<boolean> {
  try {
    const row = await fetchRoom(code);
    await enterRoom(row.code, roomStateFromRow(row), displayName);
    return true;
  } catch {
    leaveRoom();
    return false;
  }
}

export async function updateMemberName(displayName: string): Promise<void> {
  const normalized = normalizeDisplayName(displayName);
  setDisplayName(normalized);
  if (roomCode.value) {
    await registerMember(normalized);
  }
}

export function toggleSelection(id: string): void {
  if (roomCode.value) {
    if (applyingRemote) return;
    const memberId = getOrCreateMemberId();
    if (roomUsesAttribution.value) {
      const exists = roomPicks.value.some((p) => p.set_id === id && p.member_id === memberId);
      if (exists) {
        roomPicks.value = roomPicks.value.filter(
          (p) => !(p.set_id === id && p.member_id === memberId),
        );
      } else {
        roomPicks.value = [...roomPicks.value, { set_id: id, member_id: memberId }];
      }
    }
    void persistToggle(id);
    return;
  }

  const had = soloSelections.value.has(id);
  const next = new Set(soloSelections.value);
  if (had) next.delete(id);
  else next.add(id);
  soloSelections.value = next;
}

export function isSelected(id: string): boolean {
  return selections.value.has(id);
}

export async function clearAllSelections(): Promise<void> {
  if (roomCode.value) {
    try {
      const picks = await clearMemberPicksRemote(roomCode.value, getOrCreateMemberId());
      roomPicks.value = picks;
    } catch (err) {
      setRoomSync('error', err instanceof Error ? err.message : 'Failed to clear picks.');
    }
    return;
  }
  soloSelections.value = new Set();
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
  const next =
    mode === 'merge' ? new Set([...selections.value, ...incoming]) : incoming;

  if (roomCode.value) {
    try {
      const picks = await setMemberPicksRemote(
        roomCode.value,
        getOrCreateMemberId(),
        [...next].sort(),
      );
      roomPicks.value = picks;
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : 'Failed to import picks.',
      };
    }
  } else {
    soloSelections.value = next;
  }
  return { ok: true, count: incoming.size, mode };
}

export function getShareableRoomLink(code: string): string {
  return roomUrl(code);
}

export async function createGroupRoom(
  displayName: string,
): Promise<{ ok: true; code: string } | { ok: false; reason: string }> {
  try {
    const row = await createRoom();
    const initialIds = [...soloSelections.value].sort();
    await enterRoom(row.code, roomStateFromRow(row), displayName);
    if (initialIds.length > 0) {
      const picks = await setMemberPicksRemote(row.code, getOrCreateMemberId(), initialIds);
      roomPicks.value = picks;
    }
    return { ok: true, code: row.code };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Failed to create room.';
    setRoomSync('error', reason);
    return { ok: false, reason };
  }
}
