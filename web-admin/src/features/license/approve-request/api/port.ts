import type { LicenseRequest } from '@/entities/license-request';

export interface BulkResult {
  issued: number;
  failed: number;
  notDelivered: number;
}

/** 요청 승인 · 거절 — 키를 만들어 요청에 붙이고 받는 사람의 수령함으로 보낸다. */
export interface ApproveRequestPort {
  /** 승인한다. 친구코드 주인을 못 찾으면 수령함만 빼고 쓴다(`delivered: false`). */
  approve(req: LicenseRequest): Promise<{ key: string; delivered: boolean }>;
  /** 한 건씩 차례로 — 하나가 실패해도 나머지는 계속한다. */
  approveAll(reqs: LicenseRequest[]): Promise<BulkResult>;
  /** 거절한다 — 요청을 지운다. 상대는 다시 요청할 수 있다. */
  reject(req: LicenseRequest): Promise<void>;
}
