/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NO_NAME, shownName } from '@/shared/lib';

describe('사람 이름 그리기 — shownName', () => {
  it('글이 있으면 앞뒤 공백을 걷은 그 글', () => {
    expect(shownName('민트')).toBe('민트');
    expect(shownName('  민트 ')).toBe('민트');
  });

  it('이름이 없으면(null · undefined · 빈 글 · 공백뿐) «나»', () => {
    expect(NO_NAME).toBe('나');
    for (const empty of [null, undefined, '', '   ']) expect(shownName(empty)).toBe('나');
  });
});

// 이름이 없는 사람을 그리는 글은 shownName 한 곳에만 — 화면마다 자리 표시 글을 다시 쓰면 빨강.
const SRC = join(process.cwd(), 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** 옛 자리 표시 글 «이름 없음» · «(이름 없음)» 을 따옴표 · JSX 글로 쓴 줄(주석 줄은 뺀다). */
const PLACEHOLDER = /(['"`>]\s*\(?이름 없음\)?\s*['"`<])/;
function placeholderLines(text: string): number[] {
  return text
    .split('\n')
    .map((line, i) => ({ line, at: i + 1 }))
    .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line) && PLACEHOLDER.test(line))
    .map(({ at }) => at);
}

/** 사람 이름이 아닌 칸 · 옛 데이터를 읽는 곳 — 까닭을 같이 적는다. */
const ALLOWED: Record<string, string> = {
  // 카탈로그 항목(파츠 · 책상) 이름 — 사람이 아니다
  'widgets/catalog-list/ui/CatalogList.tsx': 'catalog',
  // 옛 앱이 이 글자를 이름 칸에 저장했다 — 읽을 때 «이름 없음(null)» 으로 본다(그리는 글이 아님)
  'entities/user/model/userRow.ts': 'legacy-read',
};

describe('자리 표시 글은 shownName 한 곳에만', () => {
  it('src 에 «이름 없음» 자리 표시 글이 없다(사람 이름이 아닌 칸 · 옛 데이터 읽기만 예외)', () => {
    const offenders = files(SRC)
      .map((path) => ({ path: relative(SRC, path).split(sep).join('/'), text: readFileSync(path, 'utf8') }))
      .filter(({ path }) => !Object.hasOwn(ALLOWED, path))
      .flatMap(({ path, text }) => placeholderLines(text).map((at) => `${path}:${at}`));
    expect(offenders).toEqual([]);
  });

  it('깨 보기 — 자리 표시 글을 다시 쓰면 잡는다 · 주석은 잡지 않는다', () => {
    expect(placeholderLines("const who = `${request.name || '이름 없음'} 님`;")).toEqual([1]);
    expect(placeholderLines("<b>{req.name || '(이름 없음)'}</b>")).toEqual([1]);
    expect(placeholderLines('x\n<span className="soft">이름 없음</span>')).toEqual([2]);
    expect(placeholderLines('// 이름이 없으면 «이름 없음» 대신 «나»')).toEqual([]);
    expect(placeholderLines('<b>{shownName(req.name)}</b>')).toEqual([]);
  });
});
