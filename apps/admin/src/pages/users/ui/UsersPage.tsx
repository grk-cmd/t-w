import { useUserRowsPort } from '@/features/user/user-rows';
import { ServerUsers } from './ServerUsers';
import { PagedUsers } from './PagedUsers';

export function UsersPage() {
  return useUserRowsPort().kind === 'server' ? <ServerUsers /> : <PagedUsers />;
}
