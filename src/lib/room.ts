import type { RealtimeChannel } from '@supabase/supabase-js';
import { FESTIVAL_TAG } from '~/lib/constants';
import { getSupabase, isSupabaseConfigured } from '~/lib/supabase';

const CODE_LENGTH = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SESSION_KEY = 'rfp-2026:room:v1';

export type RoomSyncState = 'idle' | 'connecting' | 'synced' | 'error' | 'offline';

export type FestivalRoomRow = {
  code: string;
  festival: string;
  ids: string[];
  updated_at: string;
};

let activeChannel: RealtimeChannel | null = null;

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

function parseIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string');
}

function rowFromRecord(row: Record<string, unknown>): FestivalRoomRow | null {
  if (typeof row.code !== 'string' || typeof row.festival !== 'string') return null;
  return {
    code: row.code,
    festival: row.festival,
    ids: parseIds(row.ids),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : '',
  };
}

export function persistSessionRoomCode(code: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (code) window.sessionStorage.setItem(SESSION_KEY, code);
    else window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

export function readSessionRoomCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? normalizeRoomCode(raw) : null;
  } catch {
    return null;
  }
}

export function roomUrl(code: string): string {
  if (typeof window === 'undefined') return `?room=${code}`;
  const url = new URL(window.location.href);
  url.searchParams.set('room', code);
  return url.toString();
}

export function clearRoomFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

export function readRoomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URL(window.location.href).searchParams.get('room');
  return raw ? normalizeRoomCode(raw) : null;
}

export async function createRoom(): Promise<FestivalRoomRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const supabase = getSupabase();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from('festival_rooms')
      .insert({ code, festival: FESTIVAL_TAG, ids: [] })
      .select('code, festival, ids, updated_at')
      .single();

    if (!error && data) {
      const row = rowFromRecord(data as Record<string, unknown>);
      if (row) return row;
    }
    if (error?.code !== '23505') throw new Error(error?.message ?? 'Failed to create room.');
  }

  throw new Error('Could not create a unique room code. Try again.');
}

export async function fetchRoom(code: string): Promise<FestivalRoomRow> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const normalized = normalizeRoomCode(code);
  if (normalized.length < 6) throw new Error('Room code is too short.');

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('festival_rooms')
    .select('code, festival, ids, updated_at')
    .eq('code', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Room not found. Check the code and try again.');

  const row = rowFromRecord(data as Record<string, unknown>);
  if (!row) throw new Error('Invalid room data.');
  if (row.festival !== FESTIVAL_TAG) {
    throw new Error(`Room is for "${row.festival}", expected "${FESTIVAL_TAG}".`);
  }
  return row;
}

export async function togglePickRemote(code: string, setId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('toggle_pick', {
    p_code: normalizeRoomCode(code),
    p_set_id: setId,
  });
  if (error) throw new Error(error.message);
  return parseIds(data);
}

export async function setRoomIdsRemote(code: string, ids: string[]): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('set_room_ids', {
    p_code: normalizeRoomCode(code),
    p_ids: ids,
  });
  if (error) throw new Error(error.message);
  return parseIds(data);
}

export function unsubscribeRoom(): void {
  if (activeChannel) {
    const supabase = isSupabaseConfigured() ? getSupabase() : null;
    if (supabase) void supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}

export function subscribeRoom(
  code: string,
  onIds: (ids: string[]) => void,
  onStatus: (state: RoomSyncState, message?: string) => void,
): void {
  if (!isSupabaseConfigured()) {
    onStatus('offline', 'Supabase is not configured.');
    return;
  }

  unsubscribeRoom();
  onStatus('connecting');

  const supabase = getSupabase();
  const normalized = normalizeRoomCode(code);

  activeChannel = supabase
    .channel(`room:${normalized}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'festival_rooms',
        filter: `code=eq.${normalized}`,
      },
      (payload) => {
        const row = rowFromRecord((payload.new ?? {}) as Record<string, unknown>);
        if (row) onIds(row.ids);
      },
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        onStatus('synced');
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onStatus('error', err?.message ?? 'Realtime connection failed.');
        return;
      }
      if (status === 'CLOSED') {
        onStatus('offline');
      }
    });
}
