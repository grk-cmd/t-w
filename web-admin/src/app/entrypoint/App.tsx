import { useAdminSession } from '@/features/auth';
import { LoginPage, SessionBlocked } from '@/pages/login';
import { useEnv, type Firebase } from '@/shared/api';
import { AdminLayout } from '@/widgets/admin-layout';
import { DEFAULT_ROUTE_ID, ROUTE_GROUPS, ROUTES } from '../routes/routes';
import { useHashRoute } from '../routes/useHashRoute';

export function App({ fb }: { fb: Firebase }) {
  const { session, retry } = useAdminSession(fb);
  const [routeId, go] = useHashRoute(DEFAULT_ROUTE_ID);
  const route =
    ROUTES.find((r) => r.id === routeId) ?? ROUTES.find((r) => r.id === DEFAULT_ROUTE_ID) ?? ROUTES[0];
  const env = useEnv();

  if (session.state !== 'admin') {
    return (
      <AdminLayout env={env}>
        {session.state === 'loading' ? (
          <p className="center soft">확인하는 중…</p>
        ) : session.state === 'denied' ? (
          <SessionBlocked
            title="관리자 계정이 아니에요"
            detail={`${session.user.email ?? session.user.uid} 은(는) 관리자로 등록된 계정이 아니에요.\n등록할 uid: ${session.user.uid}`}
            onSignOut={() => fb.signOut()}
          />
        ) : session.state === 'unreachable' ? (
          <SessionBlocked
            title="서버에 연결하지 못했어요"
            detail={session.message}
            onRetry={retry}
            onSignOut={() => fb.signOut()}
          />
        ) : (
          <LoginPage onSignIn={fb.signIn} />
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
