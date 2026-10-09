import { useMutation } from '@tanstack/react-query';
import { removeAllow, setAllow, useRefreshRoomServer } from '@/entities/room-server';
import { useDb } from '@/shared/api';

/** 드롭다운의 «Firebase(기본)» — allow/{코드} 칸이 없다는 뜻. */
export const FIREBASE_OPTION = '';

export interface ServerOption {
  value: string;
  label: string;
}

/**
 * 사용자 한 명의 서버 드롭다운 — «Firebase(기본)» + 등록된 서버 이름.
 * 지금 값이 표에 없는 서버면(서버를 뺐거나 이름이 바뀜) 그 이름도 남겨 보여 준다 — 앱은 그 사람을 Firebase 로 보낸다.
 */
export function serverOptions(servers: readonly string[], current: string | null): ServerOption[] {
  const list = [...servers].sort();
  const out: ServerOption[] = [{ value: FIREBASE_OPTION, label: 'Firebase(기본)' }];
  out.push(...list.map((s) => ({ value: s, label: s })));
  if (current && !list.includes(current))
    out.push({ value: current, label: `${current} (표에 없음 — Firebase)` });
  return out;
}

export type AllowChange = { kind: 'none' } | { kind: 'set'; server: string } | { kind: 'remove' };

/** 드롭다운에서 고른 값 → 할 일. 같은 값이면 아무것도 안 한다. */
export function allowChange(before: string | null, picked: string): AllowChange {
  const next = picked === FIREBASE_OPTION ? null : picked;
  if (next === before) return { kind: 'none' };
  return next === null ? { kind: 'remove' } : { kind: 'set', server: next };
}

/** 확인 창 글. who 는 이름(친구 코드) 처럼 사람이 알아볼 이름. */
export function allowConfirmText(who: string, before: string | null, change: AllowChange): string {
  const from = before ?? 'Firebase(기본)';
  if (change.kind === 'remove') return `${who} — ${from} → Firebase(기본). 다음에 만드는 방부터 Firebase`;
  if (change.kind === 'set') return `${who} — ${from} → ${change.server}. 다음에 만드는 방부터 이 서버로`;
  return '';
}

/** allow/{코드} 쓰기 · 지우기(작업 기록 roomServer.allow · roomServer.allowDelete). */
export function useChangeAllow() {
  const db = useDb();
  const refresh = useRefreshRoomServer();
  return useMutation({
    mutationFn: ({
      userCode,
      before,
      change,
    }: {
      userCode: string;
      before: string | null;
      change: AllowChange;
    }): Promise<void> => {
      if (change.kind === 'set') return setAllow(db, userCode, change.server, before);
      if (change.kind === 'remove' && before) return removeAllow(db, userCode, before);
      return Promise.resolve();
    },
    onSuccess: refresh,
  });
}
