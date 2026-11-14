import { useMutation } from '@tanstack/react-query';
import { useRefreshSignupFlags, useSignupFlagPort, type SignupFlag } from '@/entities/signup-flag';

export function useSetSignupFlag() {
  const port = useSignupFlagPort();
  const refresh = useRefreshSignupFlags();
  return useMutation({
    mutationFn: ({ flag, value }: { flag: SignupFlag; value: boolean }) => port.set(flag, value),
    onSuccess: refresh,
  });
}
