import type { Api } from '@/shared/api';
import { needApi } from '@/entities/seasonal/xmas-event';

/*
 * 신고 처리 셋 — 서버가 지우기 · 그 대상의 신고 · 감사 기록(xmas.removeOrnament · xmas.removeLetter · xmas.dismiss)을 한 트랜잭션에.
 * 작업 기록(adminLog)은 따로 쓰지 않는다 — 서버 감사 기록이 정본이다.
 */
const BASE = '/v2/admin/xmas';
const enc = encodeURIComponent;

/** 장식 지우기 — 관리자가 본 판(version)일 때만(그새 바꾼 장식은 409). 건 사람은 다시 걸 수 있다 · 그림 객체도 지운다. */
export async function removeOrnament(
  api: Api | null,
  tree: number,
  slot: number,
  version: number,
): Promise<void> {
  await needApi(api).send('DELETE', `${BASE}/trees/${tree}/ornaments/${slot}`, { query: { version } });
}

/** 받은 편지 지우기 — 받은 사람의 그 편지와 신고를 지운다. */
export async function removeGotLetter(api: Api | null, recipientCode: string, n: number): Promise<void> {
  await needApi(api).send('DELETE', `${BASE}/received/${enc(recipientCode)}/${n}`);
}

/** 문제없음 — 신고만 비운다. */
export async function dismissXmasReport(api: Api | null, key: string): Promise<void> {
  await needApi(api).send('DELETE', `${BASE}/reports/${enc(key)}`);
}
