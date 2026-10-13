/*
 * 관리자 전체 초대권 회수 검사. invite-revoke.js 를 그대로 불러 가짜 DB 로 돌린다.
 * 1. 1장 이상만 0 · 0장 · 마이너스 · 칸 없음은 건너뜀 · 친구코드 여럿인 사람 한 번  2. 트랜잭션 — 빈 캐시 · 그 사이 다 씀 · 실패
 * 3. 연결(firebase-init) · 우클릭 두 번 게이트(admin/admin-users.js — 관리자 코드 admin 폴더 5번에서 app.js 에서 옮김) · 안내 문구(html)
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const IR = need('invite-revoke.js'), FI = need('firebase-init.js'), HTML = need('desk-companion-prototype.html');
/* 초대권 지급 창(전체 지급 · 우클릭 전체 회수)은 admin/admin-users.js 로 옮겼다 — 저장소 루트에서 돌 때도 찾게 자리를 몇 곳 본다 */
const APP = ['admin-users.js', 'parts/admin/admin-users.js', 'app/parts/admin/admin-users.js'].map(f => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } }).find(Boolean)
  || (say('  ? 원본 못 찾음 — admin-users.js'), process.exit(2));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const { createInviteRevokeAll } = new Function(IR.replace(/^export function /mg, 'function ') + '\nreturn { createInviteRevokeAll };')();

const left = (u) => `users/${u}/invite/invitesLeft`;
// data: 경로 → 값. o.cacheNull: 트랜잭션 첫 호출을 null 로(빈 로컬 캐시) · o.serverNow: 트랜잭션 때 서버 값(그 사이 바뀜) · o.failOn: 쓰기 실패 uid
const mk = (data, o = {}) => {
  const L = { gets: [], writes: [] };
  const run = createInviteRevokeAll({
    db: {}, ref: (_d, p) => p,
    get: async (p) => { L.gets.push(p); return { val: () => (data[p] === undefined ? null : data[p]) }; },
    runTransaction: async (p, fn) => {
      if(o.failOn && p.includes('/' + o.failOn + '/')) throw new Error('permission_denied');
      const server = o.serverNow && p in o.serverNow ? o.serverNow[p] : data[p];
      let v = fn(o.cacheNull ? null : server);
      if(o.cacheNull && v !== undefined && server !== undefined) v = fn(server);   // 서버가 거절하면 진짜 값으로 다시 부른다
      if(v === undefined) return { committed: false };
      L.writes.push([p, v]); data[p] = v;
      return { committed: true };
    },
  });
  return { run, L, data };
};

(async () => {
  say('── 1. 대상 · 판정');
  {
    const t = mk({
      friendCodes: { 'MATE-A': { userId: 'a' }, 'MATE-OLD': { userId: 'a' }, 'B': { userId: 'b' }, 'C': { userId: 'c' }, 'D': { userId: 'd' }, 'E': { userId: 'e' }, 'X': {} },
      [left('a')]: 3, [left('b')]: 0, [left('c')]: -2, [left('e')]: 999,
    });
    const r = await t.run();
    chk(JSON.stringify(r) === JSON.stringify({ ok: true, total: 5, revoked: 2, taken: 1002, skipped: 3, failed: 0 }), '1장 이상 둘만 회수 · 거둔 장수 합 · 0 · 마이너스 · 칸 없음 건너뜀 → ' + JSON.stringify(r));
    chk(JSON.stringify(t.L.writes) === JSON.stringify([[left('a'), 0], [left('e'), 0]]), '쓰는 값은 0 하나 · invitesLeft 한 칸만');
    chk(t.data[left('c')] === -2, '마이너스(빚)는 0 으로 올리지 않는다');
    chk(t.L.gets.filter(p => p === left('a')).length === 1, '친구코드가 여럿인 사람도 한 번만 읽고 쓴다');
    chk(t.L.gets.every(p => p === 'friendCodes' || /^users\/[^/]+\/invite\/invitesLeft$/.test(p)), 'users 를 통째로 읽지 않는다 — friendCodes 와 사람마다 한 칸만');
  }
  {
    const r = await mk({}).run();
    chk(r.ok && r.total === 0 && r.revoked === 0, 'friendCodes 가 비어도 멈추지 않는다');
  }

  say('── 2. 트랜잭션');
  {
    const t = mk({ friendCodes: { A: { userId: 'a' } }, [left('a')]: 4 }, { cacheNull: true });
    const r = await t.run();
    chk(r.revoked === 1 && r.taken === 4 && t.data[left('a')] === 0, '빈 캐시(첫 호출 null)여도 미리 읽은 값으로 회수한다');
  }
  {
    const t = mk({ friendCodes: { A: { userId: 'a' } }, [left('a')]: 1 }, { serverNow: { [left('a')]: 0 } });
    const r = await t.run();
    chk(r.revoked === 0 && r.skipped === 1 && t.L.writes.length === 0, '그 사이 본인이 다 써서 0 이면 쓰지 않고 건너뜀');
  }
  {
    const t = mk({ friendCodes: { A: { userId: 'a' } }, [left('a')]: 5 }, { serverNow: { [left('a')]: 3 } });
    const r = await t.run();
    chk(r.revoked === 1 && r.taken === 3, '그 사이 줄었으면 서버 값 기준으로 센다');
  }
  {
    const uids = Array.from({ length: 45 }, (_, i) => 'u' + i);
    const data = { friendCodes: Object.fromEntries(uids.map(u => ['C' + u, { userId: u }])) };
    uids.forEach(u => { data[left(u)] = 1; });
    const t = mk(data, { failOn: 'u7' });
    const r = await t.run();
    chk(r.total === 45 && r.revoked === 44 && r.failed === 1, '한 명이 실패해도 나머지는 계속 · 실패는 따로 센다(20명 묶음 셋)');
  }

  say('── 3. 연결 · 우클릭 게이트');
  const fi = strip(FI), app = strip(APP);
  chk(/import\s*\{\s*createInviteRevokeAll\s*\}\s*from\s*["']\.\/invite-revoke\.js["']/.test(fi), 'firebase-init 이 모듈을 불러온다');
  chk(/revokeInvitesAll:\s*createInviteRevokeAll\(\{\s*db,\s*ref,\s*get,\s*runTransaction\s*\}\)/.test(fi), 'firebaseAPI.revokeInvitesAll 로 연결');
  const i0 = app.indexOf("getElementById('inviteGrantAll')"), blk = i0 >= 0 ? app.slice(i0, i0 + 4000) : '';
  chk(!!blk, '전체 지급 버튼 묶음을 찾음');
  const cm = blk.slice(blk.indexOf("addEventListener('contextmenu'"), blk.indexOf("addEventListener('click'"));
  chk(cm.length > 0 && /e\.preventDefault\(\)/.test(cm), '우클릭은 기본 메뉴를 막는다');
  chk(/_armed\s*!==\s*'revoke'[^]*?arm\('revoke'[^]*?return;/.test(cm), '첫 우클릭은 걸기만 하고 돌아간다(회수 안 함)');
  chk(cm.indexOf("arm('revoke'") < cm.indexOf('firebaseAPI.revokeInvitesAll()'), '두 번째 우클릭에서만 회수를 부른다');
  const ck = blk.slice(blk.indexOf("addEventListener('click'"));
  chk(/_armed\s*!==\s*'grant'/.test(ck) && !/revokeInvitesAll/.test(ck.slice(0, 1200)), '좌클릭 지급은 우클릭 걸림을 이어받지 않는다(지급 쪽으로 새로 건다)');
  chk(/const arm = [^\n]*disarm\(\)/.test(blk) && /setTimeout\(disarm,\s*4000\)/.test(blk), '걸 때 이전 걸림을 풀고 4초 뒤 저절로 풀린다');
  chk(/우클릭 두 번은 전체 회수/.test(HTML), '창 안내에 우클릭 회수가 적혀 있다');

  say(`\n결과: ${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
