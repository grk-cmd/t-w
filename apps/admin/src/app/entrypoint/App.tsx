import { useAdminSession } from '@/features/auth';
import { LoginPage } from '@/pages/login';
import { useEnv, type Firebase } from '@/shared/api';
import { AdminLayout } from '@/widgets/admin-layout';
import { DEFAULT_ROUTE_ID, ROUTE_GROUPS, ROUTES } from '../routes/routes';
import { useHashRoute } from '../routes/useHashRoute';

export function App({ fb }: { fb: Firebase }) {
  const session = useAdminSession(fb);
  const [routeId, go] = useHashRoute(DEFAULT_ROUTE_ID);
  const route =
    ROUTES.find((r) => r.id === routeId) ?? ROUTES.find((r) => r.id === DEFAULT_ROUTE_ID) ?? ROUTES[0];
  const env = useEnv();

  if (session.state !== 'admin') {
    return (
      <AdminLayout env={env}>
        {session.state === 'checking' ? (
          <p className="center soft">확인하는 중…</p>
        ) : (
          <LoginPage onSignIn={fb.signIn} message={session.message} />
        )}
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      env={env}
      account={{ label: session.user.email ?? session.user.uid, onSignOut: () => fb.signOut() }}
      nav={{ groups: ROUTE_GROUPS, current: route.id, onSelect: go }}
      title={route.label}
    >
      <route.Page />
    </AdminLayout>
  );
}
