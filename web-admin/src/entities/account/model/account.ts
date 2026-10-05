// accountSnap/{사용자코드} — 계정에 연결된 사용자의 요약본. 앱이 다른 PC 로 옮길 값을 여기 올린다.
export interface AccountSnap {
  name?: string;
  friendCode?: string;
  license?: string;
  focusTotalSec?: number;
  ts?: number;
  /** 앱 버전 — 0.10.3 부터 앱이 부팅마다 올린다. 옛 앱 사용자는 없다. */
  ver?: string;
}
