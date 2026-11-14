/** 지금 로그인한 사람 — 포트가 «관리자인가» 를 가릴 때 쓰는 만큼만. */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

/**
 * 로그인 뒤 «관리자인가» 의 답.
 * - `admin` — 관리자 화면을 연다.
 * - `denied` — 관리자 계정이 아니다.
 * - `unreachable` — 서버에 닿지 못해 모른다(관리자 화면을 열지 않는다).
 * - `notReady` — 서버가 아직 관리자 API 를 열지 않았다(API 판을 점검 전에 올림).
 */
export type AdminCheck =
  | { state: 'admin' }
  | { state: 'denied'; message: string }
  | { state: 'unreachable'; message: string }
  | { state: 'notReady'; message: string };

export interface AuthPort {
  checkAdmin(user: AuthUser): Promise<AdminCheck>;
  /** 거절(관리자 아님 · 확인 못함)이면 로그아웃시키고 로그인 화면에 문구를 보이나. 아니면 «다시 시도 · 로그아웃» 화면에 머문다. */
  readonly signOutOnRefusal: boolean;
}
