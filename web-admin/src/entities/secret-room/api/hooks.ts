import { useQuery } from '@tanstack/react-query';
import { useSecretRoomPort } from './index';

export function useUserSecretRoom(uid: string) {
  const port = useSecretRoomPort();
  return useQuery({ queryKey: ['userSecretRoom', uid], queryFn: () => port.ofUser(uid) });
}
