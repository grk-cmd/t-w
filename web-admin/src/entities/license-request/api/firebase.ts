// Firebase 판 — 지금 코드 그대로: 대기 요청을 실시간으로 지켜본다 · 승인 / 거절 쓰기 내용.
import type { Db } from '@/shared/api';
import { pendingRequests, type RawRequest } from '../model/request';
import type { LicenseRequestPort } from './port';

/** 요청을 승인으로 바꾸는 쓰기 — 앱의 요청 화면이 status · issuedKey 를 지켜본다. */
export function approvedWrite(db: Db, id: string, key: string) {
  return {
    [`licenseRequests/${id}/status`]: 'approved',
    [`licenseRequests/${id}/issuedKey`]: key,
    [`licenseRequests/${id}/approvedAt`]: db.now(),
  };
}

/** 요청을 지우는 쓰기 — 지우면 앱의 요청 화면이 처음 상태로 돌아가 다시 요청할 수 있다(«거절»). */
export function removeRequestWrite(id: string): Record<string, null> {
  return { [`licenseRequests/${id}`]: null };
}

export function createFirebaseLicenseRequestPort(db: Db): LicenseRequestPort {
  return {
    watch: (onChange, onError) =>
      db.watch<Record<string, RawRequest>>(
        'licenseRequests',
        (all) => onChange(pendingRequests(all ?? {})),
        onError,
      ),
  };
}
