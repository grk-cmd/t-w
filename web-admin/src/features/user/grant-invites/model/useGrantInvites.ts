import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  GROUP_INVITES_KEY,
  useForgetUserInvites,
  useSetInvitesLeftCache,
  type GroupInvite,
  type GroupInviteDraft,
} from '@/entities/invite';
import { listFriendCodes } from '@/entities/user';
import { useDb } from '@/shared/api';
import {
  createInviteCodes,
  grantInvites,
  grantInvitesAll,
  revokeInvitesAll,
  uniqueUserIds,
  type GrantScope,
} from './grantInvites';
import { createGroupInviteCode, setGroupInviteStopped } from './groupInvites';

export function useGrantInvites(uid: string) {
  const db = useDb();
  const setCache = useSetInvitesLeftCache();
  return useMutation({
    mutationFn: (count: number) => grantInvites(db, uid, count),
    onSuccess: (r) => r.ok && setCache(uid, r.after),
  });
}

type BatchRun<V, R> = (
  vars: V,
  opts: { onProgress: (done: number, total: number) => void; shouldStop: () => boolean },
) => Promise<R>;

/** 여러 명에게 도는 일 — 진행률 · 멈추기 · 끝나면 받아 둔 가입 칸 버리기를 지급과 회수가 같이 쓴다. */
function useInviteBatch<V extends { uids: string[] }, R>(run: BatchRun<V, R>) {
  const forget = useForgetUserInvites();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const mutation = useMutation({
    mutationFn: (vars: V) => {
      stopRef.current = false;
      setProgress({ done: 0, total: vars.uids.length });
      return run(vars, {
        onProgress: (done, total) => setProgress({ done, total }),
        shouldStop: () => stopRef.current,
      });
    },
    onSettled: () => forget(),
  });
  const stop = () => {
    stopRef.current = true;
  };
  const reset = () => {
    mutation.reset();
    setProgress(null);
  };
  return { ...mutation, reset, progress, stop };
}

export function useGrantInvitesAll(scope: GrantScope) {
  const db = useDb();
  return useInviteBatch(({ uids, count }: { uids: string[]; count: number }, opts) =>
    grantInvitesAll(db, uids, count, { ...opts, scope }),
  );
}

export function useRevokeInvites(scope: GrantScope) {
  const db = useDb();
  return useInviteBatch(({ uids }: { uids: string[] }, opts) =>
    revokeInvitesAll(db, uids, { ...opts, scope }),
  );
}

/** 만든 코드는 실패해도 남도록 codes 에 하나씩 쌓는다. */
export function useCreateInviteCodes() {
  const db = useDb();
  const [codes, setCodes] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: (n: number) => {
      setCodes([]);
      return createInviteCodes(db, n, (code) => setCodes((prev) => [...prev, code]));
    },
  });
  const reset = () => {
    setCodes([]);
    mutation.reset();
  };
  return { ...mutation, codes, reset };
}

/**
 * 전체 지급 · 회수 대상(사용자코드) — 단추를 눌렀을 때만 friendCodes 를 받는다(화면을 열기만 해서 통째로 받지 않게).
 * 이미 받아 둔 캐시가 있으면(예전 방식으로 사용자 목록을 읽었을 때) 그대로 쓴다.
 */
export function useLoadAllUserIds(): () => Promise<string[]> {
  const db = useDb();
  const client = useQueryClient();
  return async () =>
    uniqueUserIds(
      await client.fetchQuery({
        queryKey: ['friendCodes'],
        queryFn: () => listFriendCodes(db),
        staleTime: Infinity,
      }),
    );
}

/** 여러 명 코드 — 만들거나 중지하면 목록을 다시 받는다. */
export function useCreateGroupInvite() {
  const db = useDb();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: GroupInviteDraft) => createGroupInviteCode(db, draft),
    onSuccess: () => client.invalidateQueries({ queryKey: GROUP_INVITES_KEY }),
  });
}

export function useSetGroupInviteStopped() {
  const db = useDb();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ invite, stop }: { invite: GroupInvite; stop: boolean }) =>
      setGroupInviteStopped(db, invite, stop),
    onSettled: () => client.invalidateQueries({ queryKey: GROUP_INVITES_KEY }),
  });
}
