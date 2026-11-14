/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// 톱니 — 두 판 갈아 끼우기(D12)가 끝나는 날까지 «포트 밖 직접 호출» 과 «API 판이 없는 포트» 가 늘지 않게 센다.
// 줄이는 PR 은 기준선도 같이 낮춘다(늘리는 PR 은 빨강). 마지막 D12-*a 뒤 TOOTH_1 = 0 · 마지막 D12-*b 뒤 TOOTH_2 = 0.

/** 톱니 1 기준선 — D12-0 시점(아직 포트로 옮긴 묶음 없음). */
const TOOTH_1_BASELINE = 107;
/** 톱니 2 기준선 — `notPorted(` 를 적은 포트 수. */
const TOOTH_2_BASELINE = 0;

const SRC = join(process.cwd(), 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const rel = (path: string) => relative(SRC, path).split(sep).join('/');
const all = files(SRC).map((path) => ({ path: rel(path), text: readFileSync(path, 'utf8') }));

/** 판 가르는 일이 허용된 곳 — 이 밖에서 Db · Files · Functions 를 직접 쓰면 톱니 1 이 센다. */
const isPortSide = (path: string) =>
  path.startsWith('shared/api/') || /\/api\/(firebase|index)\.ts$/.test(path);

/** Firebase 판에만 있는 화면 — 포트 없이 지금 코드 그대로 두었다가 Firebase 판과 같이 걷는다. */
const FIREBASE_ONLY: string[] = [];

const DIRECT = /\b(useDb|useFiles|useFunctions|viaApiOr|withAudit)\b/;

describe('두 판 갈아 끼우기 톱니', () => {
  it('톱니 1 — 포트 밖에서 Db · Files · Functions · viaApiOr · withAudit 를 부르는 파일 수가 기준선을 넘지 않는다', () => {
    const offenders = all
      .filter(({ path }) => !isPortSide(path) && !FIREBASE_ONLY.some((p) => path.startsWith(p)))
      .filter(({ text }) => DIRECT.test(text))
      .map(({ path }) => path);
    expect(offenders.length, `기준선 ${TOOTH_1_BASELINE} — 지금 ${offenders.length}`).toBeLessThanOrEqual(
      TOOTH_1_BASELINE,
    );
  });

  it('톱니 2 — API 판이 없는 포트(notPorted)가 기준선을 넘지 않는다', () => {
    const ported = all.filter(
      ({ path, text }) => path !== 'shared/api/backend.ts' && /\bnotPorted\(/.test(text),
    );
    expect(ported.length).toBeLessThanOrEqual(TOOTH_2_BASELINE);
  });

  it('화면이 판을 모른다 — BACKEND 를 읽는 파일은 backend.ts 둘 · 메뉴 표뿐', () => {
    const allowed = ['shared/config/backend.ts', 'shared/config/index.ts', 'shared/api/backend.ts'];
    const readers = all
      .filter(({ path }) => !allowed.includes(path) && !path.startsWith('app/routes/'))
      .filter(({ text }) => /\bBACKEND\b|VITE_ADMIN_BACKEND/.test(text))
      .map(({ path }) => path);
    expect(readers).toEqual([]);
  });
});
