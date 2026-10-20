/** 버전 숫자 세 칸(주 . 부 . 수) — 칸마다 입력 중인 글자 그대로(빈 칸 ''). */
export type VersionParts = [string, string, string];

export const VERSION_PART_MAX_DIGITS = 4;

/**
 * «0.11.3-beta.1» → 세 칸 ['0','11','3'] + 꼬리 '-beta.1'. 앞의 v 는 뗀다.
 * 값이 없으면 fill 로 채운다(최소 버전 카드는 '0', 비워 둘 수 있는 칸은 '').
 */
export function toVersionParts(
  v: string | null | undefined,
  fill = '',
): { parts: VersionParts; tail: string } {
  const s = (v ?? '').trim().replace(/^v/i, '');
  if (!s) return { parts: [fill, fill, fill], tail: '' };
  const at = s.indexOf('-');
  const core = at < 0 ? s : s.slice(0, at);
  const [a = fill, b = fill, c = fill] = core.split('.');
  return { parts: [a, b, c], tail: at < 0 ? '' : s.slice(at) };
}

/** 칸에 들어갈 글자 — 숫자만, 네 자리까지. */
export const cleanVersionPart = (raw: string) => raw.replace(/\D/g, '').slice(0, VERSION_PART_MAX_DIGITS);

/** 몇 칸이 찼나 — 'none'(모두 빈 칸) · 'some'(일부만) · 'all'. */
export function versionPartsFilled(parts: readonly string[]): 'none' | 'some' | 'all' {
  const n = parts.filter((p) => p.trim() !== '').length;
  return n === 0 ? 'none' : n === parts.length ? 'all' : 'some';
}

/** 세 칸 → «0.11.3» (앞자리 0 정리). 빈 칸이 있으면 null — 빈 칸을 0 으로 보지 않는다. */
export function joinVersionParts(parts: readonly string[]): string | null {
  if (versionPartsFilled(parts) !== 'all') return null;
  return parts.map((p) => String(parseInt(p, 10) || 0)).join('.');
}
