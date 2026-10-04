import { isPermissionDenied } from '../api/db';

export function formatDate(ts: number | undefined): string {
  if (typeof ts !== 'number') return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function errorMessage(error: unknown, fallback: string): string {
  return isPermissionDenied(error) ? '권한이 없어요 — 관리자 계정으로 로그인했는지 확인해 주세요' : fallback;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
