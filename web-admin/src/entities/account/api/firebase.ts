// Firebase 판 — 계정 요약(accountSnap) 통째 읽기. 사용자 표(features/user/user-rows)가 쓴다.
// API 판에는 이 읽기가 없다 — 사용자 줄(`GET /v2/admin/users`)이 로그인 방식 · 가입일을 이미 싣는다(D12-8a).
import type { Db } from '@/shared/api';
import type { AccountSnap } from '../model/account';

export async function listAccountSnaps(db: Db): Promise<Record<string, AccountSnap>> {
  return (await db.get<Record<string, AccountSnap>>('accountSnap')) ?? {};
}
