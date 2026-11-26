import { useMutation } from '@tanstack/react-query';
import { useRefreshXmas } from '@/entities/seasonal/xmas-event';
import { useApi } from '@/shared/api';
import { returnLetter, type ReturnRequest } from './returnLetter';

// 반송한 사람의 편지함만 다시 받는다(목록 전체는 그대로).
export function useReturnLetter() {
  const api = useApi();
  const refresh = useRefreshXmas();
  return useMutation({
    mutationFn: (req: ReturnRequest) => returnLetter(api, req),
    onSettled: (_r, _e, req) => refresh.letters(req.userCode),
  });
}
