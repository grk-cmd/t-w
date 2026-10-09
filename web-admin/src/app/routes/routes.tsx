import type { ComponentType } from 'react';
import { AdminLogPage } from '@/pages/admin-log';
import { BugBoardPage } from '@/pages/bug-board';
import { CatalogPage } from '@/pages/catalog';
import { ImprovementsPage } from '@/pages/improvements';
import { LicensePage } from '@/pages/license';
import { MetricsPage } from '@/pages/metrics';
import { NoticesPage } from '@/pages/notices';
import { ReportsPage } from '@/pages/reports';
import { RoomServerPage } from '@/pages/room-server';
import { RoomsPage } from '@/pages/rooms';
import { SettingsPage } from '@/pages/settings';
import { UsagePage } from '@/pages/usage';
import { UsersPage } from '@/pages/users';

export interface Route {
  id: string;
  label: string;
  Page: ComponentType;
}

export interface RouteGroup {
  label: string;
  items: Route[];
}

// 좌측 메뉴 = 이 묶음 순서 그대로(위 → 아래). 관리자 기능을 웹으로 옮길 때마다 알맞은 묶음에 한 줄씩 더한다.
// id 는 주소(#/<id>)라서 바꾸면 저장해 둔 링크가 깨진다.
export const ROUTE_GROUPS: RouteGroup[] = [
  {
    label: '👥 사용자 · 운영',
    items: [
      { id: 'users', label: '👥 사용자', Page: UsersPage },
      { id: 'license', label: '🎟️ 라이선스', Page: LicensePage },
      { id: 'reports', label: '🚩 신고', Page: ReportsPage },
      { id: 'bugs', label: '🐞 제보', Page: BugBoardPage },
      { id: 'notices', label: '📣 공지', Page: NoticesPage },
    ],
  },
  {
    label: '🏠 방 · 서버',
    items: [
      { id: 'rooms', label: '🛑 방', Page: RoomsPage },
      { id: 'roomServer', label: '🛰 방 서버', Page: RoomServerPage },
    ],
  },
  {
    label: '🗂️ 콘텐츠',
    items: [{ id: 'catalog', label: '🗂️ 카탈로그', Page: CatalogPage }],
  },
  {
    label: '📊 성능 · 비용',
    items: [
      { id: 'metrics', label: '📈 지표', Page: MetricsPage },
      { id: 'usage', label: '💰 사용량', Page: UsagePage },
      { id: 'improvements', label: '📉 개선 기록', Page: ImprovementsPage },
    ],
  },
  {
    label: '⚙️ 시스템',
    items: [
      { id: 'settings', label: '⚙️ 설정', Page: SettingsPage },
      { id: 'log', label: '🧾 기록', Page: AdminLogPage },
    ],
  },
];

export const ROUTES: Route[] = ROUTE_GROUPS.flatMap((g) => g.items);

// 주소에 #/<id> 가 없을 때 여는 화면. 메뉴 맨 위가 아니어도 예전처럼 라이선스로 연다.
export const DEFAULT_ROUTE_ID = 'license';
