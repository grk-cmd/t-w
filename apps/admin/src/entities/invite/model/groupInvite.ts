import { DAY_MS, kstDateKey, kstDayStart } from '@/shared/lib';

// 여러 명이 쓰는 초대 코드 — groupInvites/{code}. 앱 app/parts/account/group-invite.js 가 소진하고, 규칙이 인원 · 마감 · 중지를 지킨다.

/** 규칙 groupInvites/$code/maxUses 상한. */
export const GROUP_INVITE_MAX_USES = 5000;
/** 규칙 groupInvites/$code/note 상한 — 코드를 받은 사람도 읽을 수 있는 칸이다. */
export const GROUP_INVITE_NOTE_MAX = 40;

export interface GroupInviteRecord {
  issuedBy: string;
  createdAt: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: number;
  note?: string;
}

export interface GroupInviteDraft {
  maxUses: number;
  /** 이 시각부터 못 쓴다(ms). null 이면 마감 없음. */
  expiresAt: number | null;
  note: string;
}

export type GroupInviteState = 'open' | 'full' | 'expired' | 'stopped';

export interface GroupInvite {
  code: string;
  createdAt: number | null;
  maxUses: number;
  usedCount: number;
  expiresAt: number | null;
  stoppedAt: number | null;
  note: string;
}

export function isGroupMaxUses(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= GROUP_INVITE_MAX_USES;
}

/** 앱 closedReason 과 같은 순서 — 중지 · 마감 · 인원. */
export function groupInviteState(g: GroupInvite, now: number): GroupInviteState {
  if (g.stoppedAt !== null) return 'stopped';
  if (g.expiresAt !== null && g.expiresAt <= now) return 'expired';
  if (g.usedCount >= g.maxUses) return 'full';
  return 'open';
}

/** «YYYY-MM-DD» 마감 날짜(서울) → 그날이 끝나는 시각 = 다음 날 0시. 빈 값 · 모양이 틀리면 마감 없음(null). */
export function endOfDay(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = kstDayStart(date);
  return Number.isFinite(t) ? t + DAY_MS : null;
}

/** endOfDay 의 거꾸로 — 화면에 보일 마지막 날. */
export function lastDay(expiresAt: number): string {
  return kstDateKey(expiresAt - 1);
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** groupInvites 통째(관리자만 읽음) → 최근 만든 것부터. 모양이 깨진 줄은 뺀다. */
export function toGroupInvites(raw: Record<string, Record<string, unknown> | null> | null): GroupInvite[] {
  return Object.entries(raw ?? {})
    .filter(([, v]) => v && typeof v === 'object' && num(v.maxUses) !== null)
    .map(([code, v]) => ({
      code,
      createdAt: num(v!.createdAt),
      maxUses: num(v!.maxUses)!,
      usedCount: num(v!.usedCount) ?? 0,
      expiresAt: num(v!.expiresAt),
      stoppedAt: num(v!.stoppedAt),
      note: typeof v!.note === 'string' ? v!.note : '',
    }))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
