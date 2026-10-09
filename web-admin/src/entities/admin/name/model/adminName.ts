/*
 * 관리자 이름 — adminNames/{uid} = { name, at }. 관리자만 읽고, 쓰기는 본인 칸만(규칙).
 * admins 는 규칙상 아무도 못 읽어서, 관리자 목록 · 이름은 여기서만 안다.
 * 웹 관리자에 들어올 때 구글 이름으로 본인 칸을 채운다 — 한 번도 안 들어온 관리자는 목록에 없다.
 */
export const ADMIN_NAMES_ROOT = 'adminNames';
export const ADMIN_NAME_MAX = 40; // 규칙 adminNames/$uid/name

/** uid → 이름. 모양이 틀린 칸은 뺀다. */
export function toAdminNames(raw: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!raw || typeof raw !== 'object') return out;
  for (const [uid, v] of Object.entries(raw as Record<string, unknown>)) {
    const name = (v as { name?: unknown } | null)?.name;
    if (typeof name === 'string' && name.trim()) out.set(uid, name.trim());
  }
  return out;
}

/** 이름을 모르면 uid 앞 6자 — 작업 기록(whoLabel)과 같은 모양. */
export const shortUid = (uid: string) => (uid.length > 6 ? `${uid.slice(0, 6)}…` : uid);

export const adminNameOf = (uid: string, names: ReadonlyMap<string, string>) =>
  names.get(uid) ?? shortUid(uid);

/** 구글 이름 → 저장할 이름. 비었으면 null(쓰지 않는다). */
export function cleanAdminName(displayName: string | null | undefined): string | null {
  const name = (displayName ?? '').trim().slice(0, ADMIN_NAME_MAX);
  return name || null;
}

/** 본인 칸 쓰기 — 이름이 없거나 저장된 것과 같으면 null(쓰지 않는다). */
export function adminNameWrite(
  uid: string,
  displayName: string | null | undefined,
  current: string | null,
  now: unknown,
): Record<string, unknown> | null {
  const name = cleanAdminName(displayName);
  if (!name || name === current) return null;
  return { [`${ADMIN_NAMES_ROOT}/${uid}`]: { name, at: now } };
}

/** 드롭다운 순서 — 이름 가나다순. */
export const adminOptions = (names: ReadonlyMap<string, string>) =>
  [...names.entries()]
    .map(([uid, name]) => ({ uid, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
