// reports/{신고당한 사용자}/{신고한 사용자} — 같은 사람이 또 신고하면 같은 칸을 덮어서 칸 수 = 서로 다른 신고자 수다.
export interface Report {
  kind: string;
  nick?: string;
  code4?: string;
  note?: string;
  ts?: number;
}

export type ReportTree = Record<string, Record<string, unknown>>;

export interface ReportTarget {
  target: string;
  reports: Report[];
}

/** 앱 REPORT_ADMIN_MIN 과 같다 — 한두 명의 장난 신고로 목록이 차지 않게. */
export const REPORT_ADMIN_MIN = 3;

const KIND_LABEL: Record<string, string> = {
  char: '캐릭터',
  away: '자리비움 그림',
  nick: '닉네임',
  etc: '기타',
};

function isReport(v: unknown): v is Report {
  return !!v && typeof v === 'object' && typeof (v as Report).kind === 'string';
}

/** 서로 다른 REPORT_ADMIN_MIN 명 이상에게 신고된 사람만, 신고 많은 순. 한 사람 안에서는 최근 신고가 위. */
export function reportTargets(all: ReportTree): ReportTarget[] {
  const out: ReportTarget[] = [];
  for (const [target, byReporter] of Object.entries(all)) {
    const reports = Object.values(byReporter ?? {}).filter(isReport);
    if (reports.length >= REPORT_ADMIN_MIN)
      out.push({ target, reports: reports.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)) });
  }
  return out.sort((a, b) => b.reports.length - a.reports.length);
}

export function reportReason(r: Report): string {
  const base = KIND_LABEL[r.kind] ?? '기타';
  return r.kind === 'etc' && r.note ? `${base} · ${r.note}` : base;
}
