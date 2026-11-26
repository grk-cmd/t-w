import type { AuditAction, AuditRecord } from '@/shared/api';

// adminLog/{id} = { at, by, action, target, detail? } — 쓰는 쪽은 shared/api/audit.ts.
export interface AdminLogEntry {
  id: string;
  at: number;
  by: string;
  action: string;
  target: string;
  detail: string;
  /** 서버 판이 돌려주는 관리자 이름 — 없으면 uid 앞부분을 보인다. */
  byName?: string;
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
  'invite.revokeSelected': '초대권 선택 회수',
  'invite.revokeAll': '초대권 전체 회수',
  'invite.codes': '초대 코드 만들기',
  'invite.groupCreate': '외부인 초대장 만들기',
  'invite.groupStop': '외부인 초대장 중지',
  'invite.groupResume': '외부인 초대장 다시 열기',
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
  'roomServer.limits': '방 개수 상한',
  'roomServer.default': '방 서버 기본 · 비율',
  'settings.minAppVer': '앱 최소 버전',
  'settings.bugDailyMax': '버그 제보 하루 상한',
  'settings.chatKeepDays': '대화 보관 일수',
  'settings.roomLimits': '전체 방 상한',
  'settings.roomMaxPeople': '방 정원',
  'settings.inviteGate': '신규 가입 초대 코드',
  'settings.featureSource': '기능 스위치(받는 곳)',
  'settings.existingSignup': '기존 사용자 가입 강제',
  'roomServer.registerIndex': '방 서버 장부 등록',
  'settings.apiCors': 'API CORS 허용 출처',
  'settings.apiCache': '공개 캐시 초',
  'settings.logLevel': '서버 로그 수준',
  'roomServer.frame': '방 서버 프레임 상한',
  'roomServer.timing': '방 서버 타이밍',
  'room.close': '방 종료',
  'room.closeAll': '방 전체 종료',
  'room.cleanGhost': '유령 방 청소',
  'catalog.categoryName': '카테고리 이름',
  'catalog.delete': '카탈로그 삭제',
  'catalog.reorder': '카탈로그 순서',
  'catalog.editInfo': '카탈로그 정보 수정',
  'catalog.cleanGlb': '카탈로그 진단 정리',
  'bug.answer': '제보 답변',
  'bug.answerEdit': '답변 수정',
  'bug.answerDelete': '답변 삭제',
  'bug.status': '제보 상태',
  'bug.delete': '제보 삭제',
  'bug.autoClean': '제보 자동 정리',
  'bug.edit': '제보 수정',
  'improvements.add': '개선 기록 추가',
  'improvements.edit': '개선 기록 수정',
  'improvements.delete': '개선 기록 삭제',
  'todo.create': '할 일 추가',
  'todo.update': '할 일 수정',
  'todo.delete': '할 일 삭제',
  'todo.applyRelease': '릴리스 반영',
  'todo.releaseTpl': '릴리스 답변 템플릿',
  'todo.note': '할 일 공용 메모',
  'account.delete': '계정 삭제',
  'account.selfDelete': '회원 탈퇴(본인)',
  'account.resetPassword': '비밀번호 초기화',
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
  { id: 'todo', label: '할 일' },
  { id: 'improvements', label: '개선 기록' },
  { id: 'account', label: '계정' },
  // 서버 판의 동작 이름 앞부분
  { id: 'ops', label: '운영 설정' },
  { id: 'metrics', label: '개선 기록' },
  { id: 'user', label: '사용자' },
] as const;

/** 판마다 보이는 필터 칩 — Firebase 판은 지금 열두 가지, 서버 판은 서버 동작 이름의 앞부분을 따른다. */
export const FIREBASE_LOG_GROUPS: readonly LogGroupId[] = [
  'all',
  'license',
  'invite',
  'report',
  'notice',
  'settings',
  'roomServer',
  'room',
  'catalog',
  'bug',
  'todo',
  'improvements',
  'account',
];
export const SERVER_LOG_GROUPS: readonly LogGroupId[] = [
  'all',
  'license',
  'invite',
  'report',
  'notice',
  'ops',
  'room',
  'catalog',
  'bug',
  'metrics',
  'user',
];

export type LogGroup = (typeof LOG_GROUPS)[number]['id'];
type LogGroupId = LogGroup;

/**
 * 서버 판(API 판)이 남기는 동작 이름 — 서버가 같은 트랜잭션에 적는 것이라 이름이 Firebase 판과 다르다(설계 R10).
 * 같은 이름(`notice.announce` 등)은 위 `ACTION_LABEL` 을 따른다.
 */
export const SERVER_ACTION_LABEL: Record<string, string> = {
  'bug.answer': '제보 답변',
  'bug.answerDelete': '답변 삭제',
  'bug.answerEdit': '답변 수정',
  'bug.dailyMax': '제보 하루 상한',
  'bug.delete': '제보 삭제',
  'bug.edit': '제보 수정',
  'bug.releaseAnswerTemplate': '릴리스 답변 템플릿',
  'bug.releaseFix': '릴리스 반영',
  'bug.report': '버그 제보 안내',
  'bug.write': '제보 쓰기',
  'catalog.archive': '카탈로그 단종',
  'catalog.assetDelete': '파일 지우기',
  'catalog.assetUpload': '파일 올리기',
  'catalog.categoryCreate': '카테고리 만들기',
  'catalog.categoryDelete': '카테고리 지우기',
  'catalog.categoryReset': '카테고리 원래대로',
  'catalog.categoryUpdate': '카테고리 고치기',
  'catalog.deskCreate': '책상 만들기',
  'catalog.deskPropCreate': '책상 소품 만들기',
  'catalog.deskPropUpdate': '책상 소품 고치기',
  'catalog.deskUpdate': '책상 고치기',
  'catalog.partCreate': '파츠 만들기',
  'catalog.partUpdate': '파츠 고치기',
  'catalog.productCreate': '그림 상품 만들기',
  'catalog.productUpdate': '그림 상품 고치기',
  'catalog.shelfOrder': '진열 순서',
  'catalog.unlockSet': '레벨 해금',
  'invite.groupCreate': '외부인 초대장 만들기',
  'invite.groupEdit': '외부인 초대장 고치기',
  'invite.quotaGrant': '초대권 지급',
  'invite.quotaRevoke': '초대권 회수',
  'license.approve': '요청 발급',
  'license.bulk': '엑셀 일괄 발급',
  'license.delete': '키 삭제',
  'license.issue': '키 발급',
  'license.reject': '요청 거절',
  'license.removeDevice': '기기 빼기',
  'license.secretEnd': '시크릿룸 끝내기',
  'license.secretIssue': '시크릿룸 발급',
  'license.secretUpdate': '시크릿룸 고치기',
  'license.update': '키 고치기',
  'metrics.improvementAdd': '개선 기록 추가',
  'metrics.improvementDelete': '개선 기록 삭제',
  'metrics.improvementEdit': '개선 기록 수정',
  'notice.announce': '확성기',
  'notice.announceClear': '확성기 끄기',
  'notice.bannerSet': '런처 배너',
  'notice.broadcastBulk': '공지 한꺼번에',
  'notice.broadcastCreate': '전체 공지 보내기',
  'notice.broadcastDelete': '공지 내리기',
  'notice.broadcastPin': '공지 고정',
  'notice.broadcastUnpin': '공지 고정 해제',
  'notice.updateCreate': '업데이트 공지',
  'notice.updateWithdraw': '업데이트 공지 내림',
  'ops.adminRename': '관리자 이름',
  'ops.configReset': '설정 기본값으로',
  'ops.configSet': '설정 바꿈',
  'ops.todoCreate': '할 일 추가',
  'ops.todoDelete': '할 일 삭제',
  'ops.todoNoteSet': '할 일 공용 메모',
  'ops.todoUpdate': '할 일 수정',
  'report.dismiss': '신고 문제없음',
  'report.takeDown': '그림 내리기',
  'room.close': '방 종료',
  'user.delete': '계정 삭제',
  'user.passwordReset': '비밀번호 초기화',
  'user.storageBackfill': 'Storage 주인 채우기',
};

export const actionLabel = (action: string): string =>
  (ACTION_LABEL as Record<string, string>)[action] ?? SERVER_ACTION_LABEL[action] ?? action;

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
