import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* 빌드 스크립트는 Windows PC 에서도 돈다(firebase deploy 의 predeploy) — CI 는 Linux 라 경로 문제가 안 보여서 글로 지킨다.
   import() 에 파일 경로를 넣을 땐 pathToFileURL(...).href 로: Windows 경로(C:\…)는 «Received protocol 'c:'» 로 멈춘다. */
const DIR = new URL('../scripts/', import.meta.url);

describe('빌드 스크립트 — Windows 경로', () => {
  const files = readdirSync(DIR).filter((f) => /\.(mjs|js|cjs)$/.test(f));

  it('스크립트가 있다', () => {
    expect(files).toContain('prerender.mjs');
  });

  it.each(files)('%s — import() 는 pathToFileURL 로 바꾼 주소만', (f) => {
    const src = readFileSync(new URL(f, DIR), 'utf8');
    // import( 바로 뒤가 pathToFileURL( 이거나 글자 그대로의 주소('…')여야 한다
    const starts = [...src.matchAll(/\bimport\(\s*([^\s,)]+)/g)].map((m) => m[1] ?? '');
    for (const a of starts) expect(a, f).toMatch(/^pathToFileURL\(|^['"]/);
  });
});
