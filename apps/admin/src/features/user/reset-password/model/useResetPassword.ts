import { useMutation } from '@tanstack/react-query';
import { useResetPasswordPort } from '../api/index';

export function usePasswordReset() {
  const port = useResetPasswordPort();
  return useMutation({
    mutationFn: ({ code, memo }: { code: string; memo: string }) => port.run(code, memo),
  });
}
