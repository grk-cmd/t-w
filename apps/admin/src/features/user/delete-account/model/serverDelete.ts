/** 서버 `kept` 한 줄 — 지워도 남기는 것과 까닭. */
export interface KeptItem {
  label: string;
  why: string;
}

/** API 판 미리 보기 — 서버가 센 양과 계정 소개. */
export interface ServerDeletePreview {
  userCode: string;
  name: string | null;
  friendCode: string;
  /** DB 에서 지울 곳 수. */
  items: number;
  /** 지울 파일 수. null = 서버가 못 셌다. */
  files: number | null;
  byContext: { context: string; count: number }[];
  hasLogin: boolean;
  /** 접속 중인가. null = 모름(서버가 접속 상태를 묻지 못했다). */
  online: boolean | null;
  /** 로그인 방법 — google · password. */
  loginProviders: string[];
  kept: KeptItem[];
}

/** 202 에 받은 양 — 지우기 전에 센 값(미리 보기와 같은 셈). */
export interface ServerDeleteAccepted {
  items: number;
  /** null = 못 센 것. */
  files: number | null;
}

const CONTEXT_LABEL: Record<string, string> = {
  avatar: '캐릭터',
  bug: '제보',
  chat: '채팅',
  collection: '컬렉션',
  focus: '집중',
  gift: '선물',
  guestbook: '방명록',
  myhome: '마이홈',
  notification: '알림',
  playlist: '플레이리스트',
  schedule: '일정',
  social: '친구',
};

/** 서버 컨텍스트 이름 → 화면 이름. 표에 없으면 서버가 준 이름 그대로. */
export const contextLabel = (context: string): string => CONTEXT_LABEL[context] ?? context;

const PROVIDER_LABEL: Record<string, string> = {
  google: '구글',
  password: '친구 코드 + 비밀번호',
};

/** 로그인 방법 → 한 줄. 비어 있으면 «없음». */
export function providersLabel(providers: readonly string[]): string {
  return providers.length ? providers.map((p) => PROVIDER_LABEL[p] ?? p).join(' · ') : '없음';
}

/** 서버가 받은 뒤 한 줄 — 토스트 · 결과 칸에 같이 쓴다. `files` null 은 못 센 것이라 수를 적지 않는다. */
export function acceptedText(r: ServerDeleteAccepted): string {
  return r.files === null
    ? `삭제를 시작했어요 — DB ${r.items}곳을 지워요 · 파일 수는 못 셌어요`
    : `삭제를 시작했어요 — DB ${r.items}곳 · 파일 ${r.files}개를 지워요`;
}

/** 미리 보기의 파일 수 칸 — null 은 못 센 것. */
export const filesText = (files: number | null): string => (files === null ? '못 셌어요' : String(files));
