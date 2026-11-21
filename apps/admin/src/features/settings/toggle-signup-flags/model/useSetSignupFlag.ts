import { useMutation } from '@tanstack/react-query';
import { setSignupFlag, useRefreshSignupFlags, type SignupFlag } from '@/entities/signup-flag';
import { useDb } from '@/shared/api';

export function useSetSignupFlag() {
  const db = useDb();
  const refresh = useRefreshSignupFlags();
  return useMutation({
    mutationFn: ({ flag, value }: { flag: SignupFlag; value: boolean }) => setSignupFlag(db, flag, value),
    onSuccess: refresh,
  });
}
