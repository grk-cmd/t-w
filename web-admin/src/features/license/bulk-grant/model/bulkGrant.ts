import { inboxMessageWrite, licenseGrantMessage } from '@/entities/inbox';
import { newLicenseWrite } from '@/entities/license';
import { findUserByFriendCode, getUserName } from '@/entities/user';
import type { Db } from '@/shared/api';
import { CODE_RE, normalizeCode, rowNote, type BaseStatus, type PlanRow, type SheetRow } from './rows';

const LOOKUP_BATCH = 5;

type Lookup = { uid: string; code: string; name: string } | 'err' | null;

/**
 * 미리보기용 조회 — 친구코드 → 주인 · 이름만 읽고 아무것도 쓰지 않는다.
 * 같은 코드는 한 번만, 다섯 개씩 나란히 묻는다.
 */
export async function lookupRows(
  db: Db,
  data: SheetRow[],
  onProgress?: (done: number, total: number) => void,
): Promise<PlanRow[]> {
  const found = new Map<string, Lookup>();
  const unique = [...new Set(data.map((d) => normalizeCode(d.code)).filter(Boolean))];
  let done = 0;
  const one = async (code: string) => {
    let hit: Lookup;
    try {
      const user = await findUserByFriendCode(db, code);
      hit = user ? { ...user, name: (await getUserName(db, user.uid)) ?? '' } : null;
    } catch {
      hit = 'err';
    }
    found.set(code, hit);
    onProgress?.(++done, unique.length);
  };
  for (let i = 0; i < unique.length; i += LOOKUP_BATCH) {
    await Promise.all(unique.slice(i, i + LOOKUP_BATCH).map(one));
  }

  return data.map((d) => {
    const k = normalizeCode(d.code);
    const hit = k ? found.get(k) : null;
    let base: BaseStatus = 'key';
    if (k) base = hit === 'err' ? 'neterr' : hit ? 'send' : CODE_RE.test(k) ? 'nouser' : 'badcode';
    const user = hit && hit !== 'err' ? hit : null;
    return {
      line: d.line,
      cells: d.cells,
      raw: d.code,
      memo: d.memo,
      code: user?.code ?? '',
      uid: user?.uid ?? null,
      name: user?.name ?? '',
      // 결과 파일을 다시 올렸을 때 키가 이미 나간 행은 또 만들지 않는다. 코드는 풀어 두어 뒷 행의 중복 판정에 쓴다.
      base: d.hasKey ? 'haskey' : base,
      st: d.hasKey ? 'haskey' : base,
    };
  });
}

/**
 * 한 행 발급 — 단건 «친구코드로 발급» 과 같은 쓰기(키 + 수령함 메시지)를 한 묶음으로.
 * 친구코드가 빈 행은 키만 만든다. 실패하면 아무것도 쓰이지 않는다.
 */
export async function grantRow(db: Db, row: PlanRow, genKey?: () => string): Promise<string> {
  const { key, write } = newLicenseWrite(db, rowNote(row), genKey);
  const inbox = row.st === 'send' && row.uid ? inboxMessageWrite(row.uid, licenseGrantMessage(key)) : {};
  await db.commit({ ...write, ...inbox });
  return key;
}

/** 한 명씩 차례로 — 동시에 쏘지 않는다. 하나가 실패해도 나머지는 계속하고, 어디까지 됐는지 행마다 남긴다. */
export async function runBulkGrant(
  db: Db,
  rows: PlanRow[],
  onProgress?: (done: number, total: number) => void,
  genKey?: () => string,
): Promise<PlanRow[]> {
  const todo = rows.filter((r) => r.st === 'send' || r.st === 'key').length;
  let done = 0;
  const out: PlanRow[] = [];
  for (const row of rows) {
    if (row.st !== 'send' && row.st !== 'key') {
      out.push(row);
      continue;
    }
    onProgress?.(done, todo);
    try {
      const key = await grantRow(db, row, genKey);
      out.push({ ...row, key, res: row.st === 'send' ? 'ok' : 'okkey' });
    } catch {
      out.push({ ...row, res: 'fail', why: '발급 실패 — 아무것도 쓰이지 않았어요' });
    }
    onProgress?.(++done, todo);
  }
  return out;
}
