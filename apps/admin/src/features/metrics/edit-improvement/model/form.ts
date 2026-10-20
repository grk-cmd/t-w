import {
  ADOPT_DAYS_DEFAULT,
  ADOPT_DAYS_MAX,
  cleanDraft,
  draftProblem,
  fromKstInput,
  toKstInput,
  type Improvement,
  type ImprovementDraft,
} from '@/entities/metrics/usage';

/** 입력칸 그대로의 글자 — 바뀐 것은 한 줄에 하나. 릴리스 시각은 서울 기준 datetime-local. */
export interface ImprovementForm {
  version: string;
  releasedAt: string;
  title: string;
  items: string;
  adoptDays: string;
}

export function emptyForm(nowMs: number): ImprovementForm {
  return {
    version: '',
    releasedAt: toKstInput(nowMs),
    title: '',
    items: '',
    adoptDays: String(ADOPT_DAYS_DEFAULT),
  };
}

export function formOf(e: ImprovementDraft | Improvement): ImprovementForm {
  return {
    version: e.version,
    releasedAt: toKstInput(e.releasedAt),
    title: e.title,
    items: e.items.join('\n'),
    adoptDays: String(e.adoptDays),
  };
}

/** 입력 → 저장할 값, 아니면 까닭. */
export function draftOf(f: ImprovementForm): { draft: ImprovementDraft } | { error: string } {
  const releasedAt = fromKstInput(f.releasedAt.trim());
  if (releasedAt === null) return { error: '릴리스 시각 확인' };
  const adopt = f.adoptDays.trim();
  if (!/^\d{1,2}$/.test(adopt)) return { error: `적용 기간 0~${ADOPT_DAYS_MAX}일` };
  const draft = cleanDraft({
    version: f.version,
    releasedAt,
    title: f.title,
    items: f.items.split('\n'),
    adoptDays: Number(adopt),
  });
  const problem = draftProblem(draft);
  return problem ? { error: problem } : { draft };
}
