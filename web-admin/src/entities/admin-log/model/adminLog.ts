import type { AuditAction, AuditRecord } from '@/shared/api';

// adminLog/{id} = { at, by, action, target, detail? } — 쓰는 쪽은 shared/api/audit.ts.
export interface AdminLogEntry {
  id: string;
  at: number;
  by: string;
  action: string;
  target: string;
  detail: string;
}

export const ACTION_LABEL: Record<AuditAction, string> = {
  'license.issue': '키 발급',
  'license.grantCode': '친구코드 발급',
  'license.revoke': '키 회수',
  'license.remove': '키 삭제',
  'license.approve': '요청 발급',
  'license.reject': '요청 거절',
  'license.bulk': '엑셀 일괄 발급',
  'license.secretRoom': '시크릿룸 발급',
  'invite.grant': '초대권 지급',
  'invite.grantSelected': '초대권 선택 지급',
  'invite.grantAll': '초대권 전체 지급',
  'invite.codes': '초대 코드 만들기',
  'report.takeDown': '그림 내리기',
  'report.dismiss': '신고 문제없음',
  'notice.announce': '확성기',
  'notice.announceClear': '확성기 끄기',
  'notice.update': '업데이트 공지',
  'notice.updateClear': '업데이트 공지 내림',
  'notice.bugReport': '버그 제보 안내',
  'notice.broadcast': '전체 공지 보내기',
  'notice.pin': '공지 고정',
  'notice.unpin': '공지 고정 해제',
  'notice.broadcastDelete': '공지 삭제',
  'settings.adBanner': '광고 배너',
  'settings.unlockLevel': '게임 설정',
  'settings.minRoomVer': '방 입장 최소 버전',
  'roomServer.switch': '방 서버 스위치',
  'roomServer.server': '방 서버 주소',
  'roomServer.serverDelete': '방 서버 빼기',
  'roomServer.allow': '방 서버 시범 이용자',
  'roomServer.allowDelete': '방 서버 시범 이용자 빼기',
  'settings.minAppVer': '앱 최소 버전',
  'room.close': '방 종료',
  'room.closeAll': '방 전체 종료',
  'room.cleanGhost': '유령 방 청소',
  'catalog.categoryName': '카테고리 이름',
  'catalog.delete': '카탈로그 삭제',
  'catalog.reorder': '카탈로그 순서',
  'catalog.editInfo': '카탈로그 정보 수정',
  'catalog.cleanGlb': '카탈로그 진단 정리',
  'bug.answer': '제보 답변',
  'bug.status': '제보 상태',
  'bug.delete': '제보 삭제',
  'account.delete': '계정 삭제',
};

/** 필터 칩 — action 의 앞부분(«종류»)으로 묶는다. */
export const LOG_GROUPS = [
  { id: 'all', label: '전체' },
  { id: 'license', label: '라이선스' },
  { id: 'invite', label: '초대' },
  { id: 'report', label: '신고' },
  { id: 'notice', label: '공지' },
  { id: 'settings', label: '설정' },
  { id: 'roomServer', label: '방 서버' },
  { id: 'room', label: '방' },
  { id: 'catalog', label: '카탈로그' },
  { id: 'bug', label: '제보' },
  { id: 'account', label: '계정' },
] as const;

export type LogGroup = (typeof LOG_GROUPS)[number]['id'];

export const actionLabel = (action: string): string =>
  (ACTION_LABEL as Record<string, string>)[action] ?? action;

export const inGroup = (entry: AdminLogEntry, group: LogGroup): boolean =>
  group === 'all' || entry.action.split('.')[0] === group;

/** 관리자 이메일은 남기지 않는다 — 나면 «나», 아니면 uid 앞부분. */
export const whoLabel = (by: string, me: string | null): string =>
  by === me ? '나' : by.length > 6 ? `${by.slice(0, 6)}…` : by;

/** 최근 것부터. 모양이 틀린 줄은 뺀다. */
export function toLogEntries(all: Record<string, Partial<AuditRecord>>): AdminLogEntry[] {
  return Object.entries(all)
    .filter(([, v]) => v && typeof v === 'object' && typeof v.at === 'number')
    .map(([id, v]) => ({
      id,
      at: v.at as number,
      by: String(v.by ?? ''),
      action: String(v.action ?? ''),
      target: String(v.target ?? ''),
      detail: String(v.detail ?? ''),
    }))
    .sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));
}
