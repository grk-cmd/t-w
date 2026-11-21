import { fromKstInput, type Improvement, type ImprovementDraft } from '@/entities/metrics/usage';

/** 처음 한 번 넣는 0.10.2 기록 — 기록 기능보다 먼저 나간 릴리스라 단추로 넣는다. */
export const SEED_0_10_2: ImprovementDraft = {
  version: '0.10.2',
  releasedAt: fromKstInput('2026-10-05T17:44') as number,
  title: '0.10.2 — DB 다운로드 줄이기',
  items: [
    '방 개수 표시를 서버 요약(roomStats)으로 — 방 목록 30초 반복 받기 제거',
    '초대 계정 확인에서 사용자 정보 통째 받기 제거(shallow)',
    '유령 사용자 재등록 방지',
    '규칙 잠금',
  ],
  adoptDays: 3,
};

/** 같은 버전 기록이 이미 있으면 단추를 숨긴다. */
export const hasVersion = (list: readonly Improvement[], version: string) =>
  list.some((e) => e.version === version);
