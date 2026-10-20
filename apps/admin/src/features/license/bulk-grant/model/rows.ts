import { NOTE_MAX } from '@/entities/license';
import type { Grid } from '../lib/sheet';

export const MAX_ROWS = 500; // 한 파일 상한 — 넘으면 앞 500행만(앱과 같다)
export const CODE_RE = /^(?:(MATE|COZY)-)?([A-Z0-9]{4})$/;

export interface SheetRow {
  line: number;
  cells: string[];
  code: string;
  memo: string;
  /** 결과 파일을 고쳐 다시 올린 경우 — «발급 키» 칸이 찬 행은 이미 키가 나갔다. */
  hasKey: boolean;
}

export interface SheetMap {
  header: string[] | null;
  codeCol: number;
  memoCol: number;
  data: SheetRow[];
}

/** 조회 결과로 정해지는 상태. */
export type BaseStatus = 'send' | 'key' | 'nouser' | 'badcode' | 'neterr' | 'haskey';
/** 옵션(중복 · 재발급)까지 반영한 상태. send · key 만 발급한다. */
export type RowStatus = BaseStatus | 'dup' | 'issued';
export type RowResult = 'ok' | 'okkey' | 'fail';

export interface PlanRow {
  line: number;
  cells: string[];
  raw: string;
  memo: string;
  /** 조회로 찾은 정식 친구코드(MATE-XXXX). */
  code: string;
  uid: string | null;
  name: string;
  base: BaseStatus;
  st: RowStatus;
  dupOf?: number;
  key?: string;
  res?: RowResult;
  why?: string;
}

export interface JudgeOptions {
  /** 같은 친구코드가 여러 번 나오면 첫 행만. */
  dupFirst: boolean;
  /** 전에 발급한 적 있는 친구코드도 다시. */
  reissue: boolean;
}

export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/\s+/g, '');
export const isActionable = (r: PlanRow) => r.st === 'send' || r.st === 'key';

/** 첫 줄 A칸이 친구코드처럼 생겼으면 제목 줄 없이 바로 자료로 본다. 빈 줄은 건너뛴다. */
export function mapRows(rows: Grid): SheetMap {
  const norm = (v: unknown) => String(v ?? '').trim();
  const first = (rows[0] ?? []).map(norm);
  const hasHeader = rows.length > 0 && !CODE_RE.test(normalizeCode(first[0] ?? ''));
  let codeCol = 0;
  let memoCol = 1;
  let keyCol = -1;
  if (hasHeader) {
    const h = first.map((x) => x.toLowerCase().replace(/\s+/g, ''));
    const ci = h.findIndex((x) => /친구코드|^코드$|code/.test(x));
    const mi = h.findIndex((x) => /메모|비고|note|memo/.test(x));
    if (ci >= 0) codeCol = ci;
    if (mi >= 0 && mi !== codeCol) memoCol = mi;
    else if (ci >= 0) memoCol = ci === 0 ? 1 : 0;
    keyCol = h.indexOf('발급키');
  }
  const data: SheetRow[] = [];
  for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
    const cells = (rows[i] ?? []).map(norm);
    if (!cells.some(Boolean)) continue;
    data.push({
      line: i + 1,
      cells,
      code: cells[codeCol] ?? '',
      memo: cells[memoCol] ?? '',
      hasKey: keyCol >= 0 && !!cells[keyCol],
    });
  }
  return { header: hasHeader ? first : null, codeCol, memoCol, data };
}

export interface IssuedIndex {
  full: Set<string>;
  tail: Set<string>;
}

/**
 * 발급된 키 목록의 메모 → 이미 받은 친구코드 표. 관리자는 그 사람이 지금 프리미엄인지 알 수 없어 메모로 판정한다.
 * full: «MATE-9K2M» 꼴 · tail: 옛 단건 발급이 입력 그대로 남긴 «친구코드 발급: 9K2M» 의 4자리.
 */
export function issuedIndex(all: Record<string, { note?: string }>): IssuedIndex {
  const full = new Set<string>();
  const tail = new Set<string>();
  for (const license of Object.values(all)) {
    const note = String(license?.note ?? '').toUpperCase();
    for (const code of note.match(/\b(?:MATE|COZY)-[A-Z0-9]{4}\b/g) ?? []) full.add(code);
    const m = /친구코드(?: 발급:)? ([A-Z0-9]{4})(?![A-Z0-9-])/.exec(note);
    if (m) tail.add(m[1]);
  }
  return { full, tail };
}

export function wasIssued(index: IssuedIndex | null, code: string): boolean {
  if (!index || !code) return false;
  return index.full.has(code) || index.tail.has(code.replace(/^(MATE|COZY)-/, ''));
}

/** 옵션에 따라 상태를 다시 매긴다 — 조회는 다시 하지 않는다. */
export function judge(rows: PlanRow[], options: JudgeOptions, issued: IssuedIndex | null): PlanRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const r: PlanRow = { ...row, st: row.base, dupOf: undefined };
    if (r.base === 'haskey' && r.code && !seen.has(r.code)) seen.set(r.code, r.line);
    if (r.base !== 'send') return r;
    const first = seen.get(r.code);
    if (options.dupFirst && first !== undefined) return { ...r, st: 'dup', dupOf: first };
    if (first === undefined) seen.set(r.code, r.line);
    if (!options.reissue && wasIssued(issued, r.code)) r.st = 'issued';
    return r;
  });
}

/** 발급 목록 메모 — 단건 «친구코드로 발급» 과 같은 모양에 파일의 메모를 붙인다. 규칙 상한에 맞춰 자른다. */
export function rowNote(r: PlanRow): string {
  const tail = r.memo ? ` · ${r.memo}` : '';
  const note =
    r.st === 'send' ? `${r.name ? `${r.name} · ` : ''}친구코드 ${r.code}${tail}` : `엑셀 일괄${tail}`;
  return note.slice(0, NOTE_MAX);
}

const RESULT_LABEL: Record<RowStatus | RowResult, string> = {
  send: '발급 안 함',
  key: '발급 안 함',
  haskey: '건너뜀',
  nouser: '건너뜀',
  dup: '건너뜀',
  issued: '건너뜀',
  badcode: '건너뜀',
  neterr: '건너뜀',
  ok: '수령함 발송',
  okkey: '키만 발급',
  fail: '실패',
};

const SKIP_REASON: Partial<Record<RowStatus, string>> = {
  haskey: '이미 발급 키가 있는 행',
  nouser: '친구코드를 가진 유저가 없음',
  badcode: '친구코드 형식이 아님',
  neterr: '조회 실패(네트워크)',
  issued: '전에 발급한 적 있음',
};

/**
 * 결과 파일 — 원본 열 뒤에 «발급 키 · 결과 · 사유». 결과 파일을 다시 올린 것이면 그 세 열을 채운다(두 벌이 되지 않게).
 * 이미 키가 있던 행은 그때의 결과 · 사유를 덮지 않는다.
 */
export function resultSheet(rows: PlanRow[], map: SheetMap, grid: Grid): Grid {
  const width = Math.max(1, ...grid.map((r) => r.length));
  const head = map.header
    ? map.header.slice()
    : Array.from({ length: width }, (_, i) =>
        i === map.codeCol ? '친구코드' : i === map.memoCol ? '메모' : '',
      );
  while (head.length < width) head.push('');
  const hn = head.map((x) => x.replace(/\s+/g, ''));
  let ki = hn.indexOf('발급키');
  let ri = hn.indexOf('결과');
  let wi = hn.indexOf('사유');
  if (ki < 0 || ri < 0 || wi < 0) {
    ki = head.length;
    ri = ki + 1;
    wi = ki + 2;
    head.push('발급 키', '결과', '사유');
  }
  const out: Grid = [head];
  for (const r of rows) {
    const cells = r.cells.slice();
    while (cells.length < head.length) cells.push('');
    const st = r.res ?? r.st;
    const why =
      r.why ||
      (r.st === 'dup' ? `${r.dupOf}행과 같은 친구코드` : (SKIP_REASON[r.st] ?? '')) ||
      (r.name ? `받는 사람: ${r.name}` : '');
    if (r.key) cells[ki] = r.key;
    if (!(st === 'haskey' && (cells[ri] || cells[wi]))) {
      cells[ri] = RESULT_LABEL[st];
      cells[wi] = why;
    }
    out.push(cells);
  }
  return out;
}

export const TEMPLATE: Grid = [['친구코드', '메모']];
