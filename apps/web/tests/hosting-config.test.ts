import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  it('home 칸 — 올리기 전에 빌드하고 firebase/ 안(web-dist)으로 옮겨 그것을 올린다', () => {
    expect(home?.public).toBe('web-dist');
    expect(home?.predeploy).toEqual([
      'npm --prefix .. ci --ignore-scripts',
      'npm --prefix .. run web:build',
      'node scripts/copy-web-dist.js',
    ]);
  });

  it('predeploy 에 «@이름/패키지» 를 쓰지 않는다 — Windows 에서 firebase-tools 가 명령 전체를 경로처럼 normalize 해 «@tw\\web» 이 된다', () => {
    for (const h of hosting)
      for (const c of h.predeploy ?? []) {
        expect(c, h.target).not.toMatch(/@[\w-]+\//);
        // 경로 몫은 «\» 로 바뀌어도 같은 명령이어야 한다
        expect(path.win32.normalize(c).replaceAll('\\', '/'), h.target).toBe(c);
      }
  });

  it('올리는 폴더는 firebase/ 안 — firebase-tools 가 밖(..)이면 배포를 멈춘다(config.path 규칙 그대로)', () => {
    const projectDir = fileURLToPath(FB);
    for (const h of hosting) {
      const out = path.normalize(path.join(projectDir, h.public));
      expect(path.relative(projectDir, out), h.target).not.toContain('..');
    }
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
    // default-src 로 돌아가지 않는 지시어 · 막아 둔 것 — 빠지면 그만큼 풀린다
    for (const d of ['frame-ancestors', 'object-src', 'base-uri', 'form-action', 'worker-src'])
      expect(dirs[d], d).toEqual(["'none'"]);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
  });

  it('CSP 는 «**» 규칙 한 곳에만 — 다른 규칙이 덮어쓰지 않는다', () => {
    const withCsp = (home?.headers ?? []).filter((r) =>
      r.headers.some((x) => x.key === 'Content-Security-Policy'),
    );
    expect(withCsp.map((r) => r.source)).toEqual(['**']);
  });

  it('HTML 은 매번 새로 · 해시 붙은 /assets 만 오래 기억(뒤 규칙이 이겨서 /assets 가 «**» 뒤에)', () => {
    const order = (home?.headers ?? []).map((r) => r.source);
    expect(order.indexOf('/assets/**')).toBeGreaterThan(order.indexOf('**'));
    expect(header('**', 'Cache-Control')).toBe('no-cache');
    expect(header('/assets/**', 'Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(header('**', 'X-Content-Type-Options')).toBe('nosniff');
  });
});
