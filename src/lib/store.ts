import { signal, computed, effect } from '@preact/signals';

const STORAGE_KEY = 'rfp-2026:selections:v1';
const SCHEMA_VERSION = 1;
const FESTIVAL_TAG = 'RfP-2026';

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

export const selectionsCount = computed(() => selections.value.size);

let debounceHandle: number | null = null;
if (typeof window !== 'undefined') {
  effect(() => {
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

export function toggleSelection(id: string): void {
  const next = new Set(selections.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  selections.value = next;
}

export function isSelected(id: string): boolean {
  return selections.value.has(id);
}

export function clearAllSelections(): void {
  selections.value = new Set();
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

export function importSelectionsFromJson(raw: string, mode: 'replace' | 'merge' = 'replace'): ImportResult {
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
  return { ok: true, count: incoming.size, mode };
}
