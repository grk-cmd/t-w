import type { LicenseRequest } from '../model/request';

/**
 * 🙋 라이선스 요청 — 앱에서 «키 주세요» 한 대기 목록. 승인 · 거절은 features/license/approve-request 의 포트가 한다.
 * 판마다 받는 방식이 다르다 — Firebase 판은 지켜보고(`watch`), API 판은 연결이 없어 주기로 묻는다(`pending`).
 */
export type LicenseRequestPort =
  | {
      kind: 'watch';
      /** 대기 요청(오래된 순)을 지켜본다 — 바뀔 때마다 통째로 준다. 끊는 함수를 돌려준다. */
      watch(onChange: (pending: LicenseRequest[]) => void, onError: (error: Error) => void): () => void;
    }
  | {
      kind: 'poll';
      /** 대기 요청 전부를 지금 받는다(서버 키셋을 끝까지 이어 받음). */
      pending(): Promise<LicenseRequest[]>;
      /** 화면이 열려 있는 동안 이 간격으로 다시 받는다(탭이 가려지면 멈춘다). */
      intervalMs: number;
    };
