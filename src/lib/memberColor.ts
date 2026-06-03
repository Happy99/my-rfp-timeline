const MEMBER_PALETTE = [
  '#fff03a', // neon
  '#ff3da6', // pink
  '#4ade80', // green
  '#60a5fa', // blue
  '#fb923c', // orange
  '#c084fc', // purple
  '#2dd4bf', // teal
  '#f87171', // coral
  '#facc15', // amber
  '#a3e635', // lime
] as const;

function hashMemberId(memberId: string): number {
  let h = 0;
  for (let i = 0; i < memberId.length; i++) {
    h = (h * 31 + memberId.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function memberColor(memberId: string): string {
  return MEMBER_PALETTE[hashMemberId(memberId) % MEMBER_PALETTE.length]!;
}

export function segmentedBorderGradient(memberIds: readonly string[]): string | null {
  if (memberIds.length === 0) return null;
  if (memberIds.length === 1) return memberColor(memberIds[0]!);
  const slice = 360 / memberIds.length;
  const stops = memberIds.map((id, i) => {
    const start = i * slice;
    const end = (i + 1) * slice;
    return `${memberColor(id)} ${start}deg ${end}deg`;
  });
  return `conic-gradient(from -45deg, ${stops.join(', ')})`;
}

export function segmentedBorderBackground(
  memberIds: readonly string[],
  fill: string,
): string | null {
  const gradient = segmentedBorderGradient(memberIds);
  if (!gradient) return null;
  return `linear-gradient(${fill}, ${fill}) padding-box, ${gradient} border-box`;
}
