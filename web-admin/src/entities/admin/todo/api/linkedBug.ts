// API 판 — 할 일에 연결된 제보(번호 `B-MMDD-n`) 한 건의 지금 상태: `GET /v2/bugs/{number}`.
// 릴리스 반영 · 할 일 완료 때 «아직 미해결인가 · 어떤 version · 마지막 답변 시각» 을 읽는 두 곳이 같이 쓴다.
import {
  isPortError,
  portCall,
  wireError,
  wireNullableString,
  wireNumber,
  wireObject,
  wireString,
  wireTime,
  type Api,
} from '@/shared/api';

const BUGS = '/v2/bugs';
// 제보 게시판 엔티티의 `BugStatus` 와 같은 글자(엔티티끼리 import 하지 않는다).
const STATUSES = ['new', 'checking', 'review', 'fixed', 'norepro', 'unfixed'] as const;
type LinkedStatus = (typeof STATUSES)[number];

/** 연결된 제보에서 쓰는 칸. `id` 는 글 번호이고 화면 주소 · 제보 연결의 열쇠다. */
export interface LinkedBug {
  item: { id: string; no: string; vis: 'pub' | 'prv'; status: LinkedStatus; title: string; ts: number };
  /** 고칠 때 돌려줄 번호. */
  version: number;
  /** 읽을 때 본 «마지막 답변 시각» — 서버가 준 글자 그대로(없으면 null). */
  lastAnswerAt: string | null;
}

export function toLinkedBug(w: unknown): LinkedBug {
  const o = wireObject(w, '제보');
  const number = wireString(o.number, '제보의 number');
  const what = (field: string) => `제보 ${number} 의 ${field}`;
  const status = wireString(o.status, what('status')).toLowerCase();
  if (!(STATUSES as readonly string[]).includes(status))
    throw wireError(what('status'), STATUSES.join(' · '));
  const visibility = wireString(o.visibility, what('visibility'));
  if (visibility !== 'PUBLIC' && visibility !== 'PRIVATE')
    throw wireError(what('visibility'), 'PUBLIC · PRIVATE');
  const lastAnswerAt = wireNullableString(o.lastAnswerAt, what('lastAnswerAt'));
  if (lastAnswerAt !== null) wireTime(lastAnswerAt, what('lastAnswerAt'));
  return {
    item: {
      id: number,
      no: number,
      vis: visibility === 'PUBLIC' ? 'pub' : 'prv',
      status: status as LinkedStatus,
      title: wireString(o.title, what('title')),
      ts: wireTime(o.createdAt, what('createdAt')),
    },
    version: wireNumber(o.version, what('version')),
    lastAnswerAt,
  };
}

/** 지금 글 — 그새 지워졌으면 null(`BUG_NOT_FOUND`), 못 읽으면 던진다. */
export async function readLinkedBug(api: Api | null, number: string): Promise<LinkedBug | null> {
  try {
    return toLinkedBug(
      await portCall(
        api,
        (a) => a.get<unknown>(`${BUGS}/${encodeURIComponent(number)}`),
        '제보를 불러오지 못했어요',
      ),
    );
  } catch (error) {
    if (isPortError(error, 'notFound') && error.code === 'BUG_NOT_FOUND') return null;
    throw error;
  }
}
