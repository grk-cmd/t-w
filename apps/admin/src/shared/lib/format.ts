import { isApiAuthError } from '../api/api';
import { isPermissionDenied } from '../api/db';

export function formatDate(ts: number | undefined): string {
  if (typeof ts !== 'number') return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 초 → «12.3시간»(소수 한 자리). 0 이면 «—». */
export function formatHours(sec: number): string {
  return sec ? `${Math.round(sec / 360) / 10}시간` : '—';
}

const DENIED = '권한이 없어요 — 관리자 계정으로 로그인했는지 확인해 주세요';

export function errorMessage(error: unknown, fallback: string): string {
  // API 401 은 토큰이 없거나 만료 — 권한 문제와 달리 다시 로그인하면 풀린다
  if (isApiAuthError(error))
    return error.status === 401 ? '로그인이 풀렸어요 — 다시 로그인해 주세요' : DENIED;
  return isPermissionDenied(error) ? DENIED : fallback;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
