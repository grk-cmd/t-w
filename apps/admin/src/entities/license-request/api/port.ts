import type { KeysetPage } from '@/shared/lib';
import type { LicenseRequest } from '../model/request';

/**
 * 🙋 라이선스 요청 — 앱에서 «키 주세요» 한 대기 목록. 승인 · 거절은 features/license/approve-request 의 포트가 한다.
 * 판마다 받는 방식이 다르다 — Firebase 판은 지켜보고(`watch`), API 판은 연결이 없어 주기로 쪽을 묻는다(`page`).
 */
export type LicenseRequestPort =
  | {
      kind: 'watch';
      /** 대기 요청(오래된 순)을 지켜본다 — 바뀔 때마다 통째로 준다. 끊는 함수를 돌려준다. */
      watch(onChange: (pending: LicenseRequest[]) => void, onError: (error: Error) => void): () => void;
    }
  | {
      kind: 'poll';
      /** 대기 요청 한 쪽(먼저 온 순) — 첫 쪽은 `cursor` 없음 · 첫 쪽만 `total`(대기 요청 전체 수). */
      page(cursor: string | undefined, limit: number): Promise<KeysetPage<LicenseRequest>>;
      /** 화면이 열려 있는 동안 이 간격으로 다시 받는다(탭이 가려지면 멈춘다). */
      intervalMs: number;
    };
