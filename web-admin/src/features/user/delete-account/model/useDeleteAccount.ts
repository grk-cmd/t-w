import { useMutation } from '@tanstack/react-query';
import { useDeleteAccountPort } from '../api/index';
import type { DeleteAccountPort } from '../api/port';

const functionsOnly = (port: DeleteAccountPort) => {
  if (port.kind !== 'functions') throw new Error('이 판은 계정 삭제를 서버가 받아 뒤에서 지워요');
  return port;
};

const serverOnly = (port: DeleteAccountPort) => {
  if (port.kind !== 'server') throw new Error('이 판은 계정 삭제를 서버 함수가 끝까지 해요');
  return port;
};

/** Firebase 판 — 지울 것 미리 보기. */
export function useAccountDeletePreview() {
  const port = useDeleteAccountPort();
  return useMutation({ mutationFn: (code: string) => functionsOnly(port).preview(code) });
}

/** Firebase 판 — 지운다(끝난 결과). */
export function useAccountDelete() {
  const port = useDeleteAccountPort();
  return useMutation({ mutationFn: (userCode: string) => functionsOnly(port).run(userCode) });
}

/** API 판 — 지울 것 미리 보기. */
export function useServerDeletePreview() {
  const port = useDeleteAccountPort();
  return useMutation({ mutationFn: (code: string) => serverOnly(port).preview(code) });
}

/** API 판 — 삭제를 받게 한다(202). */
export function useServerDelete() {
  const port = useDeleteAccountPort();
  return useMutation({
    mutationFn: ({ userCode, memo }: { userCode: string; memo: string }) =>
      serverOnly(port).run(userCode, memo),
  });
}
