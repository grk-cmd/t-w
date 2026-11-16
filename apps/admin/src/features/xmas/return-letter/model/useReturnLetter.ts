import { useMutation } from '@tanstack/react-query';
import { useRefreshXmas } from '@/entities/seasonal/xmas-event';
import { useDb, useFunctions } from '@/shared/api';
import { returnLetter, type ReturnRequest } from './returnLetter';

// 반송한 사람의 편지함만 다시 받는다(목록 전체는 그대로).
export function useReturnLetter() {
  const fns = useFunctions();
  const db = useDb();
  const refresh = useRefreshXmas();
  return useMutation({
    mutationFn: (req: ReturnRequest) => returnLetter(fns, db, req),
    onSettled: (_r, _e, req) => refresh.letters(req.uid),
  });
}
