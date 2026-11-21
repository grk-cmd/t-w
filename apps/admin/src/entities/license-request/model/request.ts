// 앱의 요청 화면이 licenseRequests/{id} 의 status · issuedKey 를 지켜본다 — 모양을 바꾸지 않는다.
export interface LicenseRequest {
  id: string;
  name: string;
  friendCode: string;
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
      name: r.name ?? '',
      friendCode: r.friendCode ?? '',
      requestedAt: r.requestedAt ?? 0,
      ver: typeof r.ver === 'string' && r.ver ? r.ver : null,
    }))
    .sort((a, b) => a.requestedAt - b.requestedAt);
}
