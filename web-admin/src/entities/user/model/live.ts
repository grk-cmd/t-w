export interface Presence {
  /** 접속 중인가. null = 모름 — 접속 상태를 묻는 서버에 닿지 못했다(API 판). false(꺼짐)와 다르다. */
  online: boolean | null;
  /** 마지막으로 접속 · 종료한 시각(ms). 0.9.7 같은 옛 앱도 쓴다 — 계정이 없는 사용자의 활동은 여기서만 보인다. */
  lastSeen: number | null;
  /** 접속 중일 때 들어가 있는 방 코드. 시크릿룸은 앱이 코드를 올리지 않아 늘 null 이다. */
  room: string | null;
  /** 앱 버전 — 0.11.0 부터. 꺼진 뒤에도 남는다. 옛 앱은 null. */
  ver: string | null;
  /** 앱이 버전을 못 받은 채 쓴 presence(ver «unknown») — 0.11.0 이상이라 옛 앱이 아니다. 이때 ver 는 null. */
  verUnknown: boolean;
}

export interface UserInvite {
  /** 가입(처음 통과)한 시각(ms). */
  joinedAt: number | null;
  /** 초대 코드를 준 사람. null 이면 초대장 제도 전부터 쓰던 기존 사용자(처음 한 번 5장). */
  invitedBy: string | null;
  invitesLeft: number | null;
}

/**
 * 목록 줄이 싣고 온 접속 · 가입 칸(API 판 — 서버가 한 번에 준다).
 * 싣지 않는 판(Firebase)의 줄은 null — 그 칸은 사람마다 따로 읽는다.
 */
export interface UserLive {
  presence: Presence;
  invite: UserInvite;
}
