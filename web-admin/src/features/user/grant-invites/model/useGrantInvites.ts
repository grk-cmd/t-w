import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  GROUP_INVITES_KEY,
  useForgetUserInvites,
  useSetInvitesLeftCache,
  type GroupInvite,
  type GroupInviteDraft,
} from '@/entities/invite';
import { refreshOnConflict } from '@/shared/api';
import { useGrantInvitesPort, type RunOpts } from '../api';
import type { InviteTarget } from './grantInvites';

export function useGrantInvites(uid: string) {
  const port = useGrantInvitesPort();
  const setCache = useSetInvitesLeftCache();
  return useMutation({
    mutationFn: (count: number) => port.grantOne(uid, count),
    onSuccess: (r) => r.ok && setCache(uid, r.after),
  });
}

type BatchRun<V, R> = (vars: V, opts: Required<RunOpts>) => Promise<R>;

/** 여러 명에게 도는 일 — 진행률 · 멈추기 · 끝나면 받아 둔 가입 칸 버리기를 지급과 회수가 같이 쓴다. */
function useInviteBatch<V, R>(run: BatchRun<V, R>) {
  const forget = useForgetUserInvites();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const mutation = useMutation({
    mutationFn: (vars: V) => {
      stopRef.current = false;
      setProgress(null);
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

export function useGrantInvitesAll() {
  const port = useGrantInvitesPort();
  return useInviteBatch(({ target, count }: { target: InviteTarget; count: number }, opts) =>
    port.grant(target, count, opts),
  );
}

export function useRevokeInvites() {
  const port = useGrantInvitesPort();
  return useInviteBatch(({ target }: { target: InviteTarget }, opts) => port.revoke(target, opts));
}

/** 만든 코드는 실패해도 남도록 codes 에 하나씩 쌓는다. */
export function useCreateInviteCodes() {
  const port = useGrantInvitesPort();
  const [codes, setCodes] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: (n: number) => {
      setCodes([]);
      return port.createCodes(n, (code) => setCodes((prev) => [...prev, code]));
    },
  });
  const reset = () => {
    setCodes([]);
    mutation.reset();
  };
  return { ...mutation, codes, reset };
}

/**
 * 전체 지급 · 회수의 대상 수 — 단추를 눌렀을 때만 부른다(화면을 열기만 해서 대상을 읽지 않게).
 * 서버가 처리할 때 세는 판은 null.
 */
export function useCountAllTargets(): () => Promise<number | null> {
  const port = useGrantInvitesPort();
  return () => port.countAll();
}

/** 여러 명 코드 — 만들거나 중지하면 목록을 다시 받는다. */
export function useCreateGroupInvite() {
  const port = useGrantInvitesPort();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: GroupInviteDraft) => port.createGroup(draft),
    onSuccess: () => client.invalidateQueries({ queryKey: GROUP_INVITES_KEY }),
  });
}

export function useSetGroupInviteStopped() {
  const port = useGrantInvitesPort();
  const client = useQueryClient();
  const reload = () => client.invalidateQueries({ queryKey: GROUP_INVITES_KEY });
  return useMutation<void, Error, { invite: GroupInvite; stop: boolean }>({
    mutationFn: ({ invite, stop }) => port.setGroupStopped(invite, stop),
    // 다른 곳이 먼저 고쳤으면(API 판 409) 줄이 옛 번호를 들고 있다 — 어느 쪽이든 목록을 다시 받는다.
    onError: refreshOnConflict(reload),
    onSettled: reload,
  });
}
