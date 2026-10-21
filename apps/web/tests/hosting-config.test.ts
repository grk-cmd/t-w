import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* 홈페이지 Hosting 칸(firebase/firebase.json `home`) — 빌드 결과를 올리고, 남의 주소 · 인라인 코드를 막는 머리가 있어야 한다. */
const FB = new URL('../../../firebase/', import.meta.url);
const json = (f: string) => JSON.parse(readFileSync(new URL(f, FB), 'utf8'));

interface Header {
  key: string;
  value: string;
}
interface HostingTarget {
  target: string;
  public: string;
  predeploy?: string[];
  headers?: { source: string; headers: Header[] }[];
}

const hosting = json('firebase.json').hosting as HostingTarget[];
const home = hosting.find((h) => h.target === 'home');
const header = (source: string, key: string) =>
  home?.headers?.find((h) => h.source === source)?.headers.find((x) => x.key === key)?.value;

describe('홈페이지 Hosting 칸', () => {
  it('home 칸이 웹 빌드 결과를 올리고, 올리기 전에 빌드한다', () => {
    expect(home?.public).toBe('../apps/web/dist');
    expect(home?.predeploy?.at(-1)).toBe('npm --prefix .. -w @tw/web run build');
  });

  it('사이트 이름은 .firebaserc 한 곳(tw-site)', () => {
    expect(json('.firebaserc').targets['together-working'].hosting.home).toEqual(['tw-site']);
  });

  it('CSP — 우리 주소만 · 인라인 코드 · eval 없음 · 틀에 안 넣힘', () => {
    const csp = header('**', 'Content-Security-Policy') ?? '';
    const dirs = Object.fromEntries(
      csp
        .split(';')
        .map((d) => d.trim().split(/\s+/))
        .filter((d) => d[0])
        .map((d) => [d[0], d.slice(1)]),
    );
    for (const d of ['default-src', 'script-src', 'style-src', 'connect-src', 'font-src'])
      expect(dirs[d], d).toEqual(["'self'"]);
    expect(dirs['img-src']).toEqual(["'self'", 'data:', 'blob:']);
    expect(dirs['frame-ancestors']).toEqual(["'none'"]);
    expect(dirs['object-src']).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
  });

  it('HTML 은 매번 새로 · 해시 붙은 /assets 만 오래 기억', () => {
    expect(header('**', 'Cache-Control')).toBe('no-cache');
    expect(header('/assets/**', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(header('**', 'X-Content-Type-Options')).toBe('nosniff');
  });
});
