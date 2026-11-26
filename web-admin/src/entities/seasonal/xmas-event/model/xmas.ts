/*
 * 🎄 크리스마스 이벤트(2026 · 일회성 — 이벤트가 끝나면 지운다 · 이슈 #1097) 관리자 쪽 모양.
 * 원본은 자체 서버(api xmas 컨텍스트 · 설계 tw-docs docs/design/11-xmas.md 6-5) — 서버 응답을 화면 모양으로 맞추는 곳은 여기뿐.
 *   GET /v2/admin/xmas                    요약(서버 시각 now · 반송 마감 returnCutoff …)
 *   GET /v2/admin/xmas/letter-authors     편지를 맡긴 사람(키셋 쪽 넘기기)
 *   GET /v2/admin/xmas/letters/{userCode} 한 사람의 편지(칸 → { text, song, version, updatedAt })
 *   GET /v2/admin/xmas/reports(/{key})    신고 목록(대상마다 한 줄) · 한 대상의 신고 · 장식(그림 id) · 받은 편지
 * 그림은 Storage xmas/{imageId}.png — 32자 id 로 주소를 만든다(토큰 없는 ?alt=media).
 */

export const LETTER_IDS = ['l1', 'l2', 'l3', 'l4', 'l5'] as const;
export const RETURN_NOTE_MAX = 40;
export const RETURN_REASONS = {
  abuse: '욕설 · 비방',
  privacy: '개인정보',
  spam: '광고 · 도배',
  etc: '기타',
} as const;
export type ReturnReason = keyof typeof RETURN_REASONS;

export interface XmasSong {
  id: string;
  title: string;
}
export interface AdminLetter {
  userCode: string;
  lid: string;
  text: string;
  /** 반송할 때 그대로 돌려보낸다 — 서버가 «관리자가 본 그 편지» 인지 견준다(다르면 409 CONCURRENT_UPDATE). */
  version: number;
  /** 마지막으로 고친 때(ms) */
  at: number;
  song: XmasSong | null;
}

const SONG_ID = /^[A-Za-z0-9_-]{11}$/;
const IMAGE_ID = /^[0-9a-f]{32}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const msOf = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? Date.parse(v) : 0);
const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null);

function songOf(v: unknown): XmasSong | null {
  const s = v as { id?: unknown; title?: unknown } | null;
  if (!s || typeof s.id !== 'string' || !SONG_ID.test(s.id)) return null;
  return { id: s.id, title: typeof s.title === 'string' ? s.title.slice(0, 40) : '' };
}

/** 한 사람의 편지(서버 letters 맵) → 칸 순서 · 모양이 틀린 칸은 뺀다(판이 없으면 반송할 수 없어 뺀다). */
export function lettersOf(userCode: string, box: unknown): AdminLetter[] {
  const b = isObj(box) ? box : {};
  return LETTER_IDS.flatMap((lid) => {
    const l = b[lid];
    if (!isObj(l) || typeof l.text !== 'string' || !l.text || typeof l.version !== 'number') return [];
    return [
      {
        userCode,
        lid,
        text: l.text.slice(0, 500),
        version: l.version,
        at: msOf(l.updatedAt),
        song: songOf(l.song),
      },
    ];
  });
}

export const youtubeUrl = (s: XmasSong) => `https://www.youtube.com/watch?v=${s.id}`;

/** 서버 시각으로 아직 반송할 수 있나 — 서버가 준 반송 마감(마감 1분 전) 전까지. */
export const canReturn = (serverNow: number, returnCutoff: number) => serverNow < returnCutoff;

/** 요약(GET /v2/admin/xmas) 중 화면이 쓰는 값 — 서버 시각 · 반송 마감(ms). 모양이 틀리면 null. */
export interface XmasClock {
  now: number;
  returnCutoff: number;
}
export function clockOf(d: unknown): XmasClock | null {
  if (!isObj(d)) return null;
  const now = msOf(d.now);
  const returnCutoff = msOf(d.returnCutoff);
  return now && returnCutoff ? { now, returnCutoff } : null;
}

/** 반송 사유 · 메모를 서버가 받는 모양으로 — 기타는 메모가 있어야 한다(없으면 null). */
export function returnArgs(
  letter: Pick<AdminLetter, 'userCode' | 'lid' | 'version'>,
  reason: ReturnReason,
  note: string,
): { userCode: string; lid: string; version: number; reason: ReturnReason; note?: string } | null {
  const n = note.replace(/\s+/g, ' ').trim().slice(0, RETURN_NOTE_MAX);
  if (reason === 'etc' && !n) return null;
  return {
    userCode: letter.userCode,
    lid: letter.lid,
    version: letter.version,
    reason,
    ...(reason === 'etc' ? { note: n } : {}),
  };
}

/** 편지를 맡긴 사람(키셋 쪽 하나) → 사람 코드 · 이름 · 편지 수 */
export interface LetterAuthor {
  userCode: string;
  name: string;
  letters: number;
}
export function authorsPageOf(d: unknown): { items: LetterAuthor[]; next: string | null } {
  const p = isObj(d) ? d : {};
  const items = (Array.isArray(p.items) ? p.items : []).flatMap((a) =>
    isObj(a) && typeof a.userCode === 'string' && a.userCode
      ? [
          {
            userCode: a.userCode,
            name: typeof a.name === 'string' ? a.name : '',
            letters: typeof a.letters === 'number' ? a.letters : 0,
          },
        ]
      : [],
  );
  return { items, next: strOrNull(p.next) };
}

/* ── 신고 ── */
export type XmasReport =
  | { key: string; kind: 'orn'; tree: number; slot: number; count: number; lastAt: number }
  | { key: string; kind: 'got'; got: string; n: number; count: number; lastAt: number };

/** 신고 목록(서버가 신고 수 많은 순으로 준다) → 화면 줄. 모르는 종류는 뺀다. */
export function reportsOf(items: unknown): XmasReport[] {
  return (Array.isArray(items) ? items : []).flatMap((r): XmasReport[] => {
    if (!isObj(r) || typeof r.key !== 'string') return [];
    const count = typeof r.count === 'number' ? r.count : 0;
    const lastAt = msOf(r.lastAt);
    if (r.type === 'ornament' && typeof r.tree === 'number' && typeof r.slot === 'number')
      return [{ key: r.key, kind: 'orn', tree: r.tree, slot: r.slot, count, lastAt }];
    if (r.type === 'received' && typeof r.recipientCode === 'string' && typeof r.n === 'number')
      return [{ key: r.key, kind: 'got', got: r.recipientCode, n: r.n, count, lastAt }];
    return [];
  });
}

/** 신고한 사람 한 줄 */
export interface ReportBy {
  who: string;
  at: number;
  note: string;
}
/** 신고된 장식 — 그림은 Storage 주소(img) · 건 사람 코드 · 판(지울 때 그대로 돌려보낸다) */
export interface Ornament {
  kind: string;
  word: string;
  img: string | null;
  version: number;
  owner: string | null;
}
/** 신고된 받은 편지 — 쓴 사람(보낸 사람 코드) */
export interface ReportedLetter {
  text: string;
  song: XmasSong | null;
  sender: string | null;
}
export interface ReportDetail {
  ornament: Ornament | null;
  received: ReportedLetter | null;
  by: ReportBy[];
}

/** Storage 그림 주소 — 32자 id 일 때만(남이 올린 그림이라 다른 경로를 만들지 않는다). */
export function imageUrl(bucket: string, id: unknown): string | null {
  if (typeof id !== 'string' || !IMAGE_ID.test(id) || !/^[a-z0-9][a-z0-9.-]*$/.test(bucket)) return null;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/xmas%2F${id}.png?alt=media`;
}

/** GET /v2/admin/xmas/reports/{key} → 화면 모양. 대상이 이미 없으면 ornament · received 가 null. */
export function reportDetailOf(d: unknown, bucket: string): ReportDetail {
  const r = isObj(d) ? d : {};
  const o = isObj(r.ornament) ? r.ornament : null;
  const g = isObj(r.received) ? r.received : null;
  const owner = o && isObj(o.owner) ? strOrNull(o.owner.userCode) : null;
  const sender = g && isObj(g.sender) ? strOrNull(g.sender.userCode) : null;
  return {
    ornament:
      o && typeof o.kind === 'string' && typeof o.version === 'number'
        ? {
            kind: o.kind,
            word: typeof o.word === 'string' ? o.word : '',
            img: o.kind === 'img' ? imageUrl(bucket, o.imageId) : null,
            version: o.version,
            owner,
          }
        : null,
    received: g && typeof g.text === 'string' ? { text: g.text, song: songOf(g.song), sender } : null,
    by: (Array.isArray(r.reports) ? r.reports : [])
      .flatMap((b) =>
        isObj(b)
          ? [
              {
                who: typeof b.reporterCode === 'string' ? b.reporterCode : '?',
                at: msOf(b.at),
                note: typeof b.note === 'string' ? b.note : '',
              },
            ]
          : [],
      )
      .sort((a, b) => b.at - a.at),
  };
}

export const KIND_LABEL: Record<string, string> = {
  bulb: '전구',
  star: '별',
  sock: '양말',
  cane: '지팡이 사탕',
  gift: '선물',
  img: '내 그림',
};
