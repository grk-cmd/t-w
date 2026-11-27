import { useMutation } from '@tanstack/react-query';
import {
  useRefreshSignupFlags,
  useSignupFlagPort,
  type SignupFlag,
  type SignupFlags,
} from '@/entities/signup-flag';
import { refreshOnConflict, type Versioned } from '@/shared/api';

export function useSetSignupFlag() {
  const port = useSignupFlagPort();
  const refresh = useRefreshSignupFlags();
  return useMutation({
    mutationFn: ({ flag, from, value }: { flag: SignupFlag; from: Versioned<SignupFlags>; value: boolean }) =>
      port.set(flag, from, value),
    onSuccess: refresh,
    onError: refreshOnConflict(refresh),
  });
}
