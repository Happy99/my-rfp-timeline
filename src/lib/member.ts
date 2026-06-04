const MEMBER_STORAGE_KEY = 'rfp-2026:member:v1';

type MemberStorage = {
  memberId: string;
  displayName: string;
};

const ADJECTIVES = [
  'Purple',
  'Neon',
  'Wild',
  'Cosmic',
  'Midnight',
  'Golden',
  'Electric',
  'Velvet',
  'Rusty',
  'Solar',
  'Crimson',
  'Misty',
  'Thunder',
  'Lazy',
  'Brave',
];

const NOUNS = [
  'Moose',
  'Fox',
  'Raven',
  'Wolf',
  'Otter',
  'Badger',
  'Hawk',
  'Bear',
  'Lynx',
  'Crow',
  'Stag',
  'Viper',
  'Comet',
  'Echo',
  'Spark',
];

function readStorage(): MemberStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MEMBER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MemberStorage>;
    if (typeof parsed.memberId !== 'string' || parsed.memberId.length === 0) return null;
    return {
      memberId: parsed.memberId,
      displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
    };
  } catch {
    return null;
  }
}

function writeStorage(data: MemberStorage): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MEMBER_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable
  }
}

export function generateRandomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  return `${adj} ${noun}`;
}

export function getOrCreateMemberId(): string {
  const existing = readStorage();
  if (existing?.memberId) return existing.memberId;
  const memberId = crypto.randomUUID();
  writeStorage({ memberId, displayName: existing?.displayName ?? '' });
  return memberId;
}

export function getDisplayName(): string | null {
  const stored = readStorage();
  const name = stored?.displayName?.trim() ?? '';
  return name.length >= 2 ? name : null;
}

export function setDisplayName(name: string): void {
  const trimmed = name.trim();
  const memberId = getOrCreateMemberId();
  writeStorage({ memberId, displayName: trimmed });
}

export function requireDisplayName(): string | null {
  return getDisplayName();
}

export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim().replace(/[\x00-\x1f\x7f]/g, '');
  return trimmed.length >= 2 && trimmed.length <= 24;
}

export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/[\x00-\x1f\x7f]/g, '');
}
