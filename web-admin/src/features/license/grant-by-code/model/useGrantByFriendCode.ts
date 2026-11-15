import { useMutation } from '@tanstack/react-query';
import { useRefreshLicenses } from '@/entities/license';
import { useGrantByCodePort } from '../api';

export function useGrantByFriendCode() {
  const port = useGrantByCodePort();
  const refresh = useRefreshLicenses();
  return useMutation({
    mutationFn: (input: string) => port.grant(input),
    onSuccess: (r) => r.ok && refresh(),
  });
}
