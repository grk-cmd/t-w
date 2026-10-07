import type { ComponentType } from 'react';
import { AdminLogPage } from '@/pages/admin-log';
import { CatalogPage } from '@/pages/catalog';
import { LicensePage } from '@/pages/license';
import { MetricsPage } from '@/pages/metrics';
import { NoticesPage } from '@/pages/notices';
import { ReportsPage } from '@/pages/reports';
import { RoomsPage } from '@/pages/rooms';
import { SettingsPage } from '@/pages/settings';
import { UsersPage } from '@/pages/users';

export interface Route {
  id: string;
  label: string;
  Page: ComponentType;
}

// 좌측 메뉴 = 이 목록. 관리자 기능을 웹으로 옮길 때마다 여기에 한 줄씩 더한다.
export const ROUTES: Route[] = [
  { id: 'metrics', label: '📈 지표', Page: MetricsPage },
  { id: 'license', label: '🎟️ 라이선스', Page: LicensePage },
  { id: 'users', label: '👥 사용자', Page: UsersPage },
  { id: 'reports', label: '🚩 신고', Page: ReportsPage },
  { id: 'notices', label: '📣 공지', Page: NoticesPage },
  { id: 'settings', label: '⚙️ 설정', Page: SettingsPage },
  { id: 'rooms', label: '🛑 방', Page: RoomsPage },
  { id: 'catalog', label: '🗂️ 카탈로그', Page: CatalogPage },
  { id: 'log', label: '🧾 기록', Page: AdminLogPage },
];
