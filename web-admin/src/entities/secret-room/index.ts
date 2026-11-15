export { useUserSecretRoom } from './api/hooks';
export { useSecretRoomPort, type SecretRoomPort } from './api/index';
// 발급 · 만료 · 사용자 칸 기록 — features/license/grant-secret-room 의 Firebase 판이 쓴다. D12-Z 에서 걷는다.
export {
  expireSecretRoom,
  getSecretRoomPub,
  getUserSecretRoom,
  getUserSecretRoomInfo,
  issueSecretRoom,
  setUserSecretRoom,
} from './api/firebase';
export {
  addMonths,
  formatDay,
  genSecretCode,
  hasConfusingChars,
  isUserId,
  MONTHS_MAX,
  overwriteWarning,
  OWNER_NAME_MAX,
  parseMonths,
  parseWantCode,
  periodText,
  planExpiry,
  SECRET_PREFIX,
  secretRoomState,
  staleReason,
  STALE_DAYS,
  takenWarning,
  type ExpiryMode,
  type SecretRoomPub,
  type SecretRoomState,
  type TakenRoom,
} from './model/secretRoom';
