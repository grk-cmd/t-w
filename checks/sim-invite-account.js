/*
 * 초대 게이트 계정 읽기 검사. invite-account.js 를 그대로 불러 가짜 DB · fetch 로 돌린다.
 * 1. shallow 판정이 노드 전체로 한 판정과 같은가  2. 폴백  3. firebase-init 연결 · 런처 동작 그대로
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const IA = need('invite-account.js'), FI = need('firebase-init.js'), APP = need('app.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const { createInviteAccount } = new Function(IA.replace(/^export function /mg, 'function ') + '\nreturn { createInviteAccount };')();

// RTDB REST shallow 와 같은 모양: 객체 자식은 true, 원시값 자식은 값 그대로
const shallowOf = (v) => (v && typeof v === 'object')
  ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, (x && typeof x === 'object') ? true : x])) : v;

const mk = (node, o = {}) => {
  const L = { gets: [], fetches: 0 };
  const read = createInviteAccount({
    db: {}, ref: (_d, p) => p, databaseURL: o.noUrl ? null : 'https://x.firebasedatabase.app/',
    get: async (p) => { L.gets.push(p); const v = p.endsWith('/invite') ? (node && node.invite) : node; return { val: () => (v === undefined ? null : v) }; },
    fetch: async (url) => {
      L.fetches++; L.url = url;
      if(o.fetchThrows) throw new Error('offline');
      if(o.httpFail) return { ok: false, json: async () => null };
      return { ok: true, json: async () => (node == null ? null : shallowOf(node)) };
    },
  });
  return { read, L };
};

(async () => {
  say('── 1. shallow 판정 = 전체 판정');
  const cases = {
    '신규(자동 생성 노드만)': { presence: { on: 1 }, profile: { n: 'a' } },
    '기존(마이홈)':          { home: { x: 1 }, chars: { big: 'x'.repeat(5000) } },
    '초대 있음':             { invite: { left: 3, by: 'u2' }, friends: { u2: true } },
    '원시값 자식':           { clap: 3, schedule: 0, guestbook: '' },
    '빈 노드':               null,
  };
  for(const [name, node] of Object.entries(cases)){
    const full = await mk(node, { httpFail: true }).read('u1');      // 폴백 = 예전 전체 읽기
    const t = mk(node); const sh = await t.read('u1');
    chk(JSON.stringify(sh) === JSON.stringify(full), `${name}: ${JSON.stringify(sh)}`);
    if(node){
      chk(!t.L.gets.includes('users/u1'), '  ↳ 노드 전체를 get 하지 않는다');
      chk(t.L.gets.length === (node.invite ? 1 : 0), `  ↳ invite 가 있을 때만 그 하위 경로 하나를 읽는다 (${t.L.gets.join(',') || '없음'})`);
    }
  }
  {
    const t = mk({ home: 1 }); await t.read('a/b c');
    chk(t.L.url === 'https://x.firebasedatabase.app/users/a%2Fb%20c.json?shallow=true', 'uid 는 인코딩하고 주소 끝 / 를 정리한다');
  }

  say('── 2. 폴백 — shallow 가 안 되면 예전처럼 노드 전체');
  for(const [name, o] of Object.entries({ '네트워크 오류': { fetchThrows: true }, 'HTTP 오류': { httpFail: true }, '주소 없음': { noUrl: true } })){
    const t = mk({ invite: { left: 1 }, home: 1 }, o); const r = await t.read('u1');
    chk(t.L.gets[0] === 'users/u1' && t.L.gets.length === 1 && r.invite.left === 1, `${name}: 전체 get 한 번으로 같은 판정`);
  }

  say('── 3. 연결');
  const CODE = strip(FI), A = strip(APP);
  chk(/import \{ createInviteAccount \} from "\.\/invite-account\.js";/.test(CODE), 'firebase-init.js 가 invite-account.js 를 import 한다');
  chk(/getInviteAccount: createInviteAccount\(\{ db, ref, get, databaseURL:/.test(CODE), 'firebaseAPI.getInviteAccount 는 모듈로 넘긴다');
  chk(!/get\(ref\(db, `users\/\$\{userId\}`\)\)/.test(CODE), 'firebase-init.js 에 users/{uid} 통째 get 이 남아 있지 않다');
  const rb = A.match(/async function refreshInviteBtn\(\)\{[\s\S]*?\n\}/);
  chk(!!rb && /const acct = await firebaseAPI\.getInviteAccount\(getMyUserId\(\)\);/.test(rb[0]) && !/_inviteHealOkUid/.test(A),
      '런처는 예전처럼 열 때마다 확인한다 (세션 캐시 없음 — 중간에 invite 가 지워져도 바로 재지급)');

  say(`\n${pass} · ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { say('  ✗ 검사가 던졌다: ' + (e && e.stack || e)); process.exit(1); });
