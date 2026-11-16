// Firebase 판 — 지금 코드 그대로: 신고 노드를 통째로 받아 웹이 «3명 이상» 을 거른다.
import type { Db } from '@/shared/api';
import { reportTargets, type ReportTree } from '../model/report';
import type { ReportPort } from './port';

// 신고는 한 줄에 100바이트 남짓이고 쌓이면 관리자가 비우는 노드라 통째로 받는다.
export async function listReports(db: Db): Promise<ReportTree> {
  return (await db.get<ReportTree>('reports')) ?? {};
}

/** 한 사람이 받은 신고 수(= 서로 다른 신고자 수). 키 이름만 받는다 — 사유 · 닉네임은 내려받지 않는다. */
export async function countUserReports(db: Db, uid: string): Promise<number> {
  return (await db.shallowKeys(`reports/${uid}`)).length;
}

/** 한 사람에 대한 신고를 전부 비우는 쓰기 — 다른 쓰기와 한 묶음(db.commit)으로 보낼 수 있다. */
export function clearReportsWrite(target: string): Record<string, null> {
  return { [`reports/${target}`]: null };
}

export function createFirebaseReportPort(db: Db): ReportPort {
  return {
    targets: async () => reportTargets(await listReports(db)),
    countFor: (uid) => countUserReports(db, uid),
  };
}
