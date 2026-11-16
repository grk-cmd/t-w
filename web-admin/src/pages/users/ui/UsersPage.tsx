import { useUserRowsPort } from '@/features/user/user-rows';
import { KeysetUsers } from './KeysetUsers';
import { PagedUsers } from './PagedUsers';

export function UsersPage() {
  return useUserRowsPort().kind === 'keyset' ? <KeysetUsers /> : <PagedUsers />;
}
