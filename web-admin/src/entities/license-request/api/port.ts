import type { LicenseRequest } from '../model/request';

/** 🙋 라이선스 요청 — 앱에서 «키 주세요» 한 대기 목록. 승인 · 거절은 features/license/approve-request 의 포트가 한다. */
export interface LicenseRequestPort {
  /** 대기 요청(오래된 순)을 지켜본다 — 바뀔 때마다 통째로 준다. 끊는 함수를 돌려준다. */
  watch(onChange: (pending: LicenseRequest[]) => void, onError: (error: Error) => void): () => void;
}
