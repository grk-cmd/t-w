/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_NAME, realName, shownName } from '@/shared/lib';

describe('사람 이름 — realName · shownName', () => {
  it('이름이 있으면 앞뒤 공백을 지운 값', () => {
    expect(realName('  민트 ')).toBe('민트');
    expect(shownName('민트')).toBe('민트');
    expect(shownName('  민트 ')).toBe('민트');
  });

  it('null · undefined · 빈 문자열 · 공백뿐 · 옛 placeholder «(이름 없음)» 은 이름이 없는 것', () => {
    expect(NO_NAME).toBe('이름 없음');
    for (const empty of [null, undefined, '', '   ', '(이름 없음)', ' (이름 없음) ']) {
      expect(realName(empty)).toBeNull();
      expect(shownName(empty)).toBe('이름 없음');
    }
  });
});

// 이름 placeholder 는 personName.ts 에서만 정한다.
const SRC = join(process.cwd(), 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/**
 * 이름 placeholder 를 직접 쓴 줄(주석 줄 제외): «이름 없음» · «(이름 없음)» 문자열 리터럴 · JSX 텍스트,
 * `|| '나'` · `?? '나'` · `: '나'` 같은 fallback. `uid === me ? '나' : …`(현재 관리자 표시)는 이름 fallback 이 아니다.
 */
const NO_NAME_TEXT = /(['"`>]\s*\(?이름 없음\)?\s*['"`<])/;
const ME_FALLBACK = /(\|\||\?\?|:)\s*['"`]\s*나\s*['"`]/;
function fallbackLines(text: string): number[] {
  return text
    .split('\n')
    .map((line, i) => ({ line, at: i + 1 }))
    .filter(
      ({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line) && (NO_NAME_TEXT.test(line) || ME_FALLBACK.test(line)),
    )
    .map(({ at }) => at);
}

/** 예외 파일과 이유. */
const ALLOWED: Record<string, string> = {
  // NO_NAME · 옛 placeholder 를 정의하는 곳
  'shared/lib/personName.ts': 'source',
  // 카탈로그 항목(파츠 · 책상) 이름 — 사람 이름이 아니다
  'widgets/catalog-list/ui/CatalogList.tsx': 'catalog',
};

describe('이름 placeholder 는 personName.ts 에서만', () => {
  it('src 의 다른 파일에 이름 placeholder 리터럴 · fallback 이 없다', () => {
    const offenders = files(SRC)
      .map((path) => ({ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }))
      .filter(({ path }) => !Object.hasOwn(ALLOWED, path))
      .flatMap(({ path, text }) => fallbackLines(text).map((at) => `${path}:${at}`));
    expect(offenders).toEqual([]);
  });

  it('mutation test — placeholder 를 다시 쓰면 잡고, 주석 · shownName · 현재 관리자 «나» 는 잡지 않는다', () => {
    expect(fallbackLines("const who = `${request.name || '이름 없음'} 님`;")).toEqual([1]);
    expect(fallbackLines("<b>{req.name || '(이름 없음)'}</b>")).toEqual([1]);
    expect(fallbackLines("const label = p.name ?? '(이름 없음)';")).toEqual([1]);
    expect(fallbackLines('x\n<span className="soft">이름 없음</span>')).toEqual([2]);
    expect(fallbackLines("const who = name ?? '나';")).toEqual([1]);
    expect(fallbackLines("<td>{name || '나'}</td>")).toEqual([1]);
    expect(fallbackLines("const who = name ? name : '나';")).toEqual([1]);
    expect(fallbackLines('// 이름이 없으면 «이름 없음» — «나» 는 쓰지 않는다')).toEqual([]);
    expect(fallbackLines('<b>{shownName(req.name)}</b>')).toEqual([]);
    expect(fallbackLines("const who = uid === me ? '나' : adminNameOf(uid, names);")).toEqual([]);
  });
});
