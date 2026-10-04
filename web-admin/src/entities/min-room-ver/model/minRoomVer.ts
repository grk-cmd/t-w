export const MIN_ROOM_VER_MAX = 20; // 규칙 config/minRoomVer .validate
// min-room-ver.yml 과 같은 형식 — 앱 비교는 숫자 세 마디만 보므로 -beta 같은 꼬리는 받지 않는다.
const VERSION = /^\d+\.\d+\.\d+$/;

/** 앱 app.js _verLt 와 같은 비교 — 마디마다 parseInt, 빠지거나 숫자가 아닌 마디는 0. a < b 이면 참. */
export function verLt(a: string, b: string): boolean {
  const parts = (v: string) =>
    String(v)
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

export type MinRoomVerCheck =
  { ok: true; change: 'first' | 'raise' | 'lower' } | { ok: false; reason: string };

/** 새 값을 써도 되는지와 어느 쪽으로 바뀌는지. current 가 null 이면 지금은 제한이 없다. */
export function checkMinRoomVer(next: string, current: string | null): MinRoomVerCheck {
  if (next.length > MIN_ROOM_VER_MAX)
    return { ok: false, reason: `${MIN_ROOM_VER_MAX}자 이하로 적어 주세요` };
  if (!VERSION.test(next)) return { ok: false, reason: '0.10.2 처럼 숫자 세 마디로 적어 주세요' };
  if (current === null) return { ok: true, change: 'first' };
  if (!verLt(next, current) && !verLt(current, next)) return { ok: false, reason: '지금 값과 같아요' };
  return { ok: true, change: verLt(current, next) ? 'raise' : 'lower' };
}
