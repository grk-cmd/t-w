// 앱의 요청 화면이 licenseRequests/{id} 의 status · issuedKey 를 지켜본다 — 모양을 바꾸지 않는다.
export interface LicenseRequest {
  id: string;
  /** 요청한 사람 이름 — 이름이 없으면 null(그릴 때 «나»). */
  name: string | null;
  /** Firebase 판 — 요청이 적어 온 친구코드. API 판 요청에는 없다(`userCode` 로 가린다). */
  friendCode?: string;
  /** API 판 — 요청한 사람의 사용자 코드. Firebase 판은 없다. */
  userCode?: string;
  requestedAt: number;
  /** 요청한 앱의 버전 — 0.11.0 부터. 옛 앱은 null. */
  ver?: string | null;
}

export interface RawRequest {
  name?: string;
  friendCode?: string;
  status?: string;
  requestedAt?: number;
  ver?: unknown;
}

export function pendingRequests(all: Record<string, RawRequest>): LicenseRequest[] {
  return Object.entries(all)
    .filter(([, r]) => r?.status === 'pending')
    .map(([id, r]) => ({
      id,
      name: r.name || null,
      friendCode: r.friendCode ?? '',
      requestedAt: r.requestedAt ?? 0,
      ver: typeof r.ver === 'string' && r.ver ? r.ver : null,
    }))
    .sort((a, b) => a.requestedAt - b.requestedAt);
}
