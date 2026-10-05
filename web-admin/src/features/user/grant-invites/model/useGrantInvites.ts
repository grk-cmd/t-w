import { useMutation } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSetInvitesLeftCache } from '@/entities/invite';
import { useDb } from '@/shared/api';
import { createInviteCodes, grantInvites, grantInvitesAll } from './grantInvites';

export function useGrantInvites(uid: string) {
  const db = useDb();
  const setCache = useSetInvitesLeftCache();
  return useMutation({
    mutationFn: (count: number) => grantInvites(db, uid, count),
    onSuccess: (r) => r.ok && setCache(uid, r.after),
  });
}

export function useGrantInvitesAll() {
  const db = useDb();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ uids, count }: { uids: string[]; count: number }) => {
      stopRef.current = false;
      setProgress({ done: 0, total: uids.length });
      return grantInvitesAll(db, uids, count, {
        onProgress: (done, total) => setProgress({ done, total }),
        shouldStop: () => stopRef.current,
      });
    },
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
