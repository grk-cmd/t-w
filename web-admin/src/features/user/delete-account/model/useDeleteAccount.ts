import { useMutation } from '@tanstack/react-query';
import { useFunctions } from '@/shared/api';
import { previewAccountDelete, runAccountDelete } from './deleteAccount';

export function useAccountDeletePreview() {
  const fns = useFunctions();
  return useMutation({ mutationFn: (code: string) => previewAccountDelete(fns, code) });
}

export function useAccountDelete() {
  const fns = useFunctions();
  return useMutation({ mutationFn: (userCode: string) => runAccountDelete(fns, userCode) });
}
