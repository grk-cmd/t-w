// Firebase 판 — 지금 코드 그대로: 키를 licenses 에 쓰고 기록을 한 묶음으로 남긴다.
import { createLicense } from '@/entities/license';
import type { Db } from '@/shared/api';
import type { IssueKeyPort } from './port';

export function createFirebaseIssueKeyPort(db: Db): IssueKeyPort {
  return { issue: (note) => createLicense(db, note) };
}
