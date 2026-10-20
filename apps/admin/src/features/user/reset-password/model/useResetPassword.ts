import { useMutation } from '@tanstack/react-query';
import { useFunctions } from '@/shared/api';
import { runPasswordReset } from './resetPassword';

export function usePasswordReset() {
  const fns = useFunctions();
  return useMutation({
    mutationFn: ({ code, memo }: { code: string; memo: string }) => runPasswordReset(fns, code, memo),
  });
}
