import type { SecretRoomPub } from '../model/secretRoom';

/** 🔒 시크릿룸 읽기 — 사용자 상세가 그 사람의 방을 보여 준다. 발급 · 연장은 features/license/grant-secret-room 의 포트가 한다. */
export interface SecretRoomPort {
  /** 그 사용자의 방 — 코드가 없으면 null. 읽기 실패는 «없음» 으로 삼키지 않고 던진다. */
  ofUser(uid: string): Promise<{ code: string; pub: SecretRoomPub | null } | null>;
}
