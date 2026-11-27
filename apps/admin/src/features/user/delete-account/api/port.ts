import type { AccountDeleteResult } from '../model/deleteAccount';
import type { ServerDeleteAccepted, ServerDeletePreview } from '../model/serverDelete';

/**
 * 계정 삭제 — 미리 보기 · 지우기. 판마다 답이 다르다:
 * Firebase 판은 서버 함수가 끝낸 결과(`functions`),
 * API 판은 서버가 받은 양만 돌려주고 뒤에서 지운다(`server` — 메모 필수).
 */
export type DeleteAccountPort = DeleteAccountFunctionsPort | DeleteAccountServerPort;

export interface DeleteAccountFunctionsPort {
  kind: 'functions';
  /** 사용자 코드 또는 친구 코드로 지울 것을 미리 본다. */
  preview(code: string): Promise<AccountDeleteResult>;
  /** 미리 본 사용자 코드로 지운다. */
  run(userCode: string): Promise<AccountDeleteResult>;
}

export interface DeleteAccountServerPort {
  kind: 'server';
  /** 사용자 코드 또는 친구 코드로 지울 것을 미리 본다. */
  preview(code: string): Promise<ServerDeletePreview>;
  /** 지우기를 받게 한다 — 202 에 받은 양. 실제 지우기는 서버가 뒤에서 한다. */
  run(userCode: string, memo: string): Promise<ServerDeleteAccepted>;
}
