import type { LicenseRequest } from '@/entities/license-request';

export interface BulkResult {
  issued: number;
  failed: number;
  /** 수령함으로 못 보낸 건수. API 판은 서버가 보내 알 수 없다(null). */
  notDelivered: number | null;
}

/** 요청 승인 · 거절 — 키를 만들어 요청에 붙이고 받는 사람의 수령함으로 보낸다. */
export interface ApproveRequestPort {
  /**
   * 승인한다. Firebase 판은 친구코드 주인을 못 찾으면 수령함만 빼고 쓴다(`delivered: false`).
   * API 판은 서버가 우편을 보내 결과를 모른다(`delivered: null`).
   */
  approve(req: LicenseRequest): Promise<{ delivered: boolean | null }>;
  /** Firebase 판은 한 건씩 차례로 — 하나가 실패해도 나머지는 계속한다. API 판은 서버가 요청마다 따로 처리한 결과를 준다. */
  approveAll(reqs: LicenseRequest[]): Promise<BulkResult>;
  /** 거절한다 — 요청을 지운다. 상대는 다시 요청할 수 있다. */
  reject(req: LicenseRequest): Promise<void>;
}
