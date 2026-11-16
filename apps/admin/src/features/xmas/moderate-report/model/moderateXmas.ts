import { auditAfter, withAudit, type Db, type Functions } from '@/shared/api';

// 서버 함수 functions/index.js xmasAdminRemove — 로직은 functions/xmas.js handleAdminRemove. 지우면서 그 신고도 같이 지운다.
export const REMOVE_FN = 'xmasAdminRemove';

/** 장식 지우기 — 목록 · 그림 · 건 사람 · 내 자리 · 신고를 함수가 한 번에(건 사람은 다시 걸 수 있다). */
export async function removeOrnament(fns: Functions, db: Db, tree: number, slot: number): Promise<void> {
  await fns.call(REMOVE_FN, { tree, slot });
  await auditAfter(db, 'xmas.removeOrnament', `트리 ${tree} · 자리 ${slot}`);
}

/** 받은 편지 지우기 — 받은 사람의 그 편지와 신고를 함수가 지운다(보낸 사람 칸은 남는다). */
export async function removeGotLetter(fns: Functions, db: Db, got: string, n: number): Promise<void> {
  await fns.call(REMOVE_FN, { got, n });
  await auditAfter(db, 'xmas.removeLetter', `${got} · ${n}번째`);
}

/** 문제없음 — 신고만 비운다(규칙: 관리자는 xmasReports/{key} 를 쓸 수 있다). */
export function dismissXmasReport(db: Db, key: string): Promise<void> {
  return db.commit(withAudit(db, { [`xmasReports/${key}`]: null }, 'xmas.dismiss', key));
}
