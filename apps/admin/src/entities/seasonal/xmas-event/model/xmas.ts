/*
 * 🎄 크리스마스 이벤트(2026 · 일회성 — 이벤트가 끝나면 걷는다 · 이슈 #963) 관리자 쪽 모양.
 * 경로 · 숫자는 서버 firebase/functions/xmas.js · 규칙 xmas* 와 같아야 한다 — tests/entities/xmas.test.ts 가 서버 모듈과 견준다.
 *   xmasLetters/{authUid}/l1~l5   { text, ts, song? }      맡긴 편지(관리자 읽기 · 반송은 함수 xmasAdminReturn)
 *   xmasReports/{key}/{authUid}   { ts, note? }            신고 — key: o-{트리}-{자리}(장식) · g-{받은 uid}-{번호}(받은 편지)
 *   xmasTrees/{t}/o/{s} · xmasImg/{t}/{s} · xmasOwners/{t}/{s}   신고된 장식 · 그림 · 건 사람
 *   xmasGotFrom/{받은 uid}/{번호} = '{보낸 uid}/{lid}'      받은 편지를 쓴 사람(받은 편지 본문은 받은 사람만 읽는다 → 보낸 사람 칸에서 읽는다)
 * 사람은 로그인 uid 로만 보인다 — authUsers 는 본인만 읽는다(이름을 보이려면 규칙을 따로 연다).
 */

export const LETTER_IDS = ['l1', 'l2', 'l3', 'l4', 'l5'] as const;
export const LETTER_DEADLINE_MS = 1798124400000; // 2026-12-25T00:00:00+09:00 — 편지 마감 · 짝 짓기
export const RETURN_CUTOFF_MS = 60000; // 마감 1분 전부터 함수가 반송을 거절한다
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
  uid: string;
  lid: string;
  text: string;
  /** 반송할 때 그대로 돌려보낸다 — 함수가 «관리자가 본 그 편지» 인지 견준다. */
  ts: number;
  song: XmasSong | null;
}

const SONG_ID = /^[A-Za-z0-9_-]{11}$/;
const UID = /^[A-Za-z0-9]{10,40}$/;

function songOf(v: unknown): XmasSong | null {
  const s = v as { id?: unknown; title?: unknown } | null;
  if (!s || typeof s.id !== 'string' || !SONG_ID.test(s.id)) return null;
  return { id: s.id, title: typeof s.title === 'string' ? s.title.slice(0, 40) : '' };
}

/** 한 사람의 편지함 → 칸 순서 · 모양이 틀린 칸은 뺀다(ts 가 없으면 반송할 수 없어 뺀다). */
export function lettersOf(uid: string, box: unknown): AdminLetter[] {
  const b = (box && typeof box === 'object' ? box : {}) as Record<
    string,
    { text?: unknown; ts?: unknown; song?: unknown }
  >;
  return LETTER_IDS.flatMap((lid) => {
    const l = b[lid];
    if (!l || typeof l.text !== 'string' || !l.text || typeof l.ts !== 'number') return [];
    return [{ uid, lid, text: l.text.slice(0, 500), ts: l.ts, song: songOf(l.song) }];
  });
}

export const youtubeUrl = (s: XmasSong) => `https://www.youtube.com/watch?v=${s.id}`;

/** 서버 시각으로 아직 반송할 수 있나 — 마감 1분 전까지(함수 RETURN_CUTOFF_MS 와 같다). */
export const canReturn = (serverNow: number) => serverNow < LETTER_DEADLINE_MS - RETURN_CUTOFF_MS;

/** 반송 사유 · 메모를 함수가 받는 모양으로 — 기타는 메모가 있어야 한다(없으면 null). */
export function returnArgs(
  letter: Pick<AdminLetter, 'uid' | 'lid' | 'ts'>,
  reason: ReturnReason,
  note: string,
): { uid: string; lid: string; ts: number; reason: ReturnReason; note?: string } | null {
  const n = note.replace(/\s+/g, ' ').trim().slice(0, RETURN_NOTE_MAX);
  if (reason === 'etc' && !n) return null;
  return {
    uid: letter.uid,
    lid: letter.lid,
    ts: letter.ts,
    reason,
    ...(reason === 'etc' ? { note: n } : {}),
  };
}

/* ── 신고 ── */
export interface ReportBy {
  uid: string;
  ts: number;
  note: string;
}
export type XmasReport =
  | { key: string; kind: 'orn'; tree: number; slot: number; by: ReportBy[] }
  | { key: string; kind: 'got'; got: string; n: number; by: ReportBy[] };

const ORN_KEY = /^o-([1-9][0-9]{0,3})-([0-9]{1,3})$/;
const GOT_KEY = /^g-([A-Za-z0-9]{10,40})-([1-9][0-9]?)$/;

/** xmasReports 통째 → 신고 많은 순(같으면 최근 순). 모르는 키는 뺀다. */
export function reportsOf(all: unknown): XmasReport[] {
  const tree = (all && typeof all === 'object' ? all : {}) as Record<string, Record<string, unknown>>;
  const out: XmasReport[] = [];
  for (const [key, byUid] of Object.entries(tree)) {
    const by = Object.entries(byUid ?? {})
      .map(([uid, v]) => {
        const r = v as { ts?: unknown; note?: unknown } | null;
        return {
          uid,
          ts: typeof r?.ts === 'number' ? r.ts : 0,
          note: typeof r?.note === 'string' ? r.note : '',
        };
      })
      .sort((a, b) => b.ts - a.ts);
    if (!by.length) continue;
    const o = ORN_KEY.exec(key);
    if (o) {
      out.push({ key, kind: 'orn', tree: Number(o[1]), slot: Number(o[2]), by });
      continue;
    }
    const g = GOT_KEY.exec(key);
    if (g) out.push({ key, kind: 'got', got: g[1], n: Number(g[2]), by });
  }
  return out.sort((a, b) => b.by.length - a.by.length || (b.by[0]?.ts ?? 0) - (a.by[0]?.ts ?? 0));
}

/** xmasGotFrom 값 '{보낸 uid}/{lid}' → 보낸 사람 · 칸 */
export function gotFromOf(v: unknown): { from: string; lid: string } | null {
  if (typeof v !== 'string') return null;
  const [from, lid] = v.split('/');
  return from && UID.test(from) && (LETTER_IDS as readonly string[]).includes(lid) ? { from, lid } : null;
}

/** 신고된 장식 — 서버 모양 { k, v, w? } · 그림 { v, d } */
export interface Ornament {
  kind: string;
  word: string;
  img: string | null;
  owner: string | null;
}
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
export function ornamentOf(o: unknown, img: unknown, owner: unknown): Ornament | null {
  const e = o as { k?: unknown; w?: unknown } | null;
  if (!e || typeof e.k !== 'string') return null;
  const d = (img as { d?: unknown } | null)?.d;
  return {
    kind: e.k,
    word: typeof e.w === 'string' ? e.w : '',
    // 남이 올린 그림 — PNG data URL 만 그린다(서버도 PNG 만 받는다)
    img: e.k === 'img' && typeof d === 'string' && PNG.test(d) ? d : null,
    owner: typeof owner === 'string' && UID.test(owner) ? owner : null,
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

/** 화면에 보일 사람 — 로그인 uid 앞 8자(이름은 규칙이 막는다) */
export const shortUid = (uid: string) => (uid.length > 10 ? `${uid.slice(0, 8)}…` : uid);
