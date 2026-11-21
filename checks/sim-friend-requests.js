/* ═══ 👋 sim-friend-requests.js — 친구 요청 포트 · 서버 provider (0.13 앱 묶음 D3 친구 요청) ═══
   [왜] 받은 요청 · 보낸 요청 · 수락 · 거절 · 취소 · 보내기 · 친구코드 찾기를 서버 경로(social-api.js)로 부른다. 서버 한 길이고(옛 Firebase 경로 provider · 받는 곳 고르기는 걷었다 — D13 E-2),
     못 하면 던진다. 알림(friendRequests)을 받으면 다시 받는다.
   ・1절: 포트 — 여덟 가지 모두 서버 provider · 못 하면 던진다
   ・2절: 서버 provider — 받은 요청 { 보낸이: { name, ts } } · 이름 못 받아도 요청은 그림 · 알림 · 한 번에 하나 · 해제 · 보낸 요청 · 수락 · 거절 · 취소/보내기 결과(already · self)
   ・3절: (옛 경로 provider 는 걷었다 — 없는지만 본다)
   ・4절: 친구코드 찾기(social-api) — 0/1명 · 모양 틀림 던짐
   ・5절: mutation test
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  PORT: pick(at('friend-requests-port.js', 'friends')),
  API: pick(at('friend-requests-api.js', 'friends')),
  SOC: pick(at('social-api.js', 'friends')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const load = (src, name) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[name]; };
const flush = async () => { for(let i = 0; i < 12; i++) await Promise.resolve(); };
const T = (d) => '2026-11-' + d + 'T00:00:00Z';

async function judge(S){
  let P, A, SOC;
  try{ P = load(S.PORT, 'TwFriendRequestsPort'); A = load(S.API, 'TwFriendRequestsApi'); SOC = load(S.SOC, 'TwSocialApi'); }
  catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }

  say('── 1. 포트 — 서버 provider 한 길');
  {
    const names = ['watchReceived', 'listSent', 'accept', 'reject', 'cancel', 'send', 'lookupName', 'lookupFriendCode'];
    const mk = (tag, log, fail) => Object.fromEntries(names.map((n) => [n, async (...a) => { log.push(tag + ':' + n); if(fail) throw new Error('x'); return tag; }]));
    const run = async (o) => {
      const log = [];
      const port = P.createFriendRequestsPort({ api: mk('api', log, o.apiFail) });
      const res = [];
      for(const n of names){ try{ res.push(await port[n]('ME', 'x', 'y', 'z', 'w')); }catch(e){ res.push('throw'); } }
      return { log, res };
    };
    let r = await run({});
    chk(r.log.every((x) => x.startsWith('api:')) && r.log.length === 8, '★ 서버면 여덟 가지 모두 서버 provider');
    r = await run({ apiFail: true });
    chk(r.log.every((x) => x.startsWith('api:')) && r.res.every((x) => x === 'throw'), '★ 서버가 못 하면 던진다 — 옛 경로(Firebase)로 물러나지 않는다');
  }

  say('── 2. 서버 provider');
  const mkSocial = (o) => {
    o = o || {};
    const L = { reqs: 0, cards: [], sent: [], on: {}, offs: 0 };
    const social = {
      fetchRequests: async () => { L.reqs++; if(o.reqFail) throw new Error('못 받음'); await (o.gate || Promise.resolve());
        return { received: [{ userCode: 'a', requestedAt: 100 }, { userCode: 'b', requestedAt: 200 }], sent: [{ userCode: 'c', requestedAt: 300 }] }; },
      fetchCards: async (codes) => { L.cards.push(codes.join()); if(o.cardsFail) throw new Error('x'); const out = {}; for(const c of codes) if(c !== 'b') out[c] = { name: 'N-' + c }; return out; },
      acceptRequest: async (c) => { L.sent.push('accept ' + c); if(o.writeErr) throw o.writeErr; },
      rejectRequest: async (c) => { L.sent.push('reject ' + c); },
      cancelRequest: async (c) => { L.sent.push('cancel ' + c); if(o.writeErr) throw o.writeErr; },
      sendRequest: async (c) => { L.sent.push('send ' + c); if(o.writeErr) throw o.writeErr; },
      findByFriendCode: async (c) => (c === 'MATE-AAAA' ? 'uAAA' : null),
    };
    const rt = { on: (k, fn) => { (L.on[k] = L.on[k] || []).push(fn); return () => { L.offs++; L.on[k] = L.on[k].filter((f) => f !== fn); }; } };
    const warns = [];
    return { api: A.createFriendRequestsApi({ social, rt, warn: (...a) => warns.push(a.join(' ')) }), L, warns, fire: (k, n) => (L.on[k] || []).slice().forEach((f) => f(Object.assign({ kind: k, resync: false }, n))) };
  };
  {
    let k = mkSocial(); const got = [], errs = [];
    const off = k.api.watchReceived('ME', (v) => got.push(v), (e) => errs.push(e));
    await flush();
    chk(got.length === 1 && got[0].a.name === 'N-a' && got[0].a.ts === 100 && got[0].b.name === '' && got[0].b.ts === 200 && k.L.cards.join() === 'a,b', '★ watchReceived — { 보낸이: { name, ts } } · 명함이 없는 사람은 이름 \'\'(화면이 «(이름 없음)»)');
    k.fire('friendRequests'); await flush();
    chk(got.length === 2 && k.L.reqs === 2, '  ↳ friendRequests 알림이 오면 다시 받는다');
    k.fire('friendRequests', { resync: true }); await flush();
    chk(got.length === 3, '  ↳ 오래 끊겼다 붙으면(resync)도 받는다');
    off(); k.fire('friendRequests'); await flush();
    chk(got.length === 3 && k.L.offs === 1, '  ↳ 해제하면 알림도 풀고 값을 안 넘긴다');
    let open; const gate = new Promise((r) => { open = r; });
    k = mkSocial({ gate }); const g2 = [];
    k.api.watchReceived('ME', (v) => g2.push(v), () => {});
    k.fire('friendRequests'); k.fire('friendRequests'); k.fire('friendRequests'); await flush();
    chk(k.L.reqs === 1, '★ 받는 중 알림이 여럿 와도 요청은 하나');
    open(); await flush(); await flush();
    chk(k.L.reqs === 2 && g2.length === 2, '  ↳ 끝난 뒤 한 번만 더');
    k = mkSocial({ reqFail: true }); const e2 = [];
    k.api.watchReceived('ME', () => e2.push('값'), () => e2.push('오류')); await flush();
    chk(e2.join() === '오류' && k.L.reqs === 1, '★ 못 받으면 onError 한 번 · 혼자 다시 받지 않는다');
    k = mkSocial({ cardsFail: true }); const g3 = [];
    k.api.watchReceived('ME', (v) => g3.push(v), () => {}); await flush();
    chk(g3.length === 1 && g3[0].a.name === '' && g3[0].a.ts === 100 && k.warns.length === 1, '★ 이름을 못 받아도 요청은 그린다(이름 없이) · 진단 한 줄');
    k = mkSocial();
    const sent = await k.api.listSent('ME');
    chk(Object.keys(sent).join() === 'c' && sent.c.ts === 300 && sent.c.toName === 'N-c', '보낸 요청 — { 받는이: { ts, toName } }');
    await k.api.accept('ME', 'a'); await k.api.reject('ME', 'a');
    chk(k.L.sent.join() === 'accept a,reject a', '수락 · 거절 — 상대 코드만 서버로(내 코드는 토큰)');
    chk((await k.api.cancel('ME', 'c')).ok === true && (await k.api.send('ME', 'z')).ok === true, '취소 · 보내기 성공 → { ok:true }');
    k = mkSocial({ writeErr: Object.assign(new Error('e'), { code: 'SOCIAL_ALREADY_FRIEND' }) });
    let r = await k.api.send('ME', 'z');
    chk(!r.ok && r.reason === 'already', '★ 보내기 — 이미 친구 → reason already');
    k = mkSocial({ writeErr: Object.assign(new Error('e'), { code: 'SOCIAL_SELF' }) });
    r = await k.api.send('ME', 'z');
    chk(!r.ok && r.reason === 'self', '  ↳ 나에게 → reason self');
    k = mkSocial({ writeErr: Object.assign(new Error('e'), { code: 'NETWORK' }) });
    r = await k.api.cancel('ME', 'z');
    chk(!r.ok && r.reason === 'NETWORK', '  ↳ 그 밖의 실패는 서버 코드를 reason 으로');
    k = mkSocial({ writeErr: Object.assign(new Error('e'), { code: 'SOCIAL_FRIEND_FULL' }) });
    let ee = null; try{ await k.api.accept('ME', 'a'); }catch(e){ ee = e; }
    chk(ee && ee.code === 'SOCIAL_FRIEND_FULL', '  ↳ 수락 실패는 던진다(화면이 오류 번호)');
    k = mkSocial();
    chk((await k.api.lookupName('a')) === 'N-a' && (await k.api.lookupName('b')) === null, '이름 조회 — 명함 이름 · 없으면 null');
    chk((await k.api.lookupFriendCode('MATE-AAAA')) === 'uAAA' && (await k.api.lookupFriendCode('MATE-ZZZZ')) === null, '친구코드 찾기 — 서버 경로로');
  }

  say('── 3. 옛 경로 provider 는 없다');
  chk(!/firebase|source/i.test(strip(S.PORT)), '포트가 Firebase · 받는 곳 고르기를 모른다');

  say('── 4. 친구코드 찾기(social-api)');
  {
    const calls = [];
    const mk = (d) => SOC.createSocialApi({ authed: { get: async (p, o) => { calls.push([p, o]); return d; }, post: async () => {}, del: async () => {} }, warn(){} });
    chk((await mk([{ userCode: 'uA', displayName: 'a' }]).findByFriendCode('MATE-AB2C')) === 'uA' && calls[0][0] === '/v2/users?friendCode=MATE-AB2C' && calls[0][1].auth === true, '0/1명 — 있으면 userCode · 로그인 요청');
    chk((await mk([]).findByFriendCode('MATE-AB2C')) === null, '  ↳ 없으면 null');
    let e = null; try{ await mk({}).findByFriendCode('MATE-AB2C'); }catch(x){ e = x; }
    chk(e && e.code === 'SHAPE', '  ↳ 모양이 틀리면 던진다');
    e = null; try{ await mk([]).findByFriendCode(''); }catch(x){ e = x; }
    chk(e && e.code === 'NO_USER', '  ↳ 코드가 비면 요청 0');
  }

  say('── 5. 배선');
  {
    const h = S.HTML;
    const i = (n) => h.indexOf('<script src="parts/friends/' + n + '">'), a = h.indexOf('<script src="parts/app.js">');
    chk(i('friend-requests-firebase.js') < 0 && i('friend-requests-api.js') > 0 && i('friend-requests-port.js') > 0 && i('friend-requests-port.js') < a && i('social-api.js') < i('friend-requests-api.js'), 'html — 요청 provider · 포트를 app.js 보다 먼저(social-api.js 다음)');
  }
}

(async () => {
await judge(SRC0);
say('── 6. mutation test — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['PORT', "const pick = () => deps.api;", "const pick = () => ({ watchReceived(){}, listSent(){}, accept(){}, reject(){}, cancel(){}, send(){}, lookupName(){}, lookupFriendCode(){} });", '서버 provider 를 안 씀'],
  ['PORT', "const pick = () => deps.api;", "const pick = () => deps.api || deps.firebase;", '옛 경로로 물러남'],
  ['API', "    const off = rt.on('friendRequests', () => { run(); });", "    const off = () => {};", '알림을 안 건다'],
  ['API', "      if(flying){ again = true; return; }", "      if(flying){ return; }", '받는 중 알림을 버림'],
  ['API', "    return () => { dead = true; off(); };", "    return () => { };", '풀어도 알림이 남음'],
  ['API', "catch(e){ warn('[친구 요청] 이름을 못 받음", "catch(e){ throw e; warn('[친구 요청] 이름을 못 받음", '이름 실패로 요청까지 못 그림'],
  ['API', "const REASON = { SOCIAL_ALREADY_FRIEND: 'already', SOCIAL_SELF: 'self' };", "const REASON = {};", '이미 친구 · 나 구분 없음'],
  ['API', "ts: x.requestedAt };\n        onChange", "ts: 0 };\n        onChange", '받은 시각을 버림'],
  ['SOC', "    if(!Array.isArray(d)) throw shapeError();\n    const u", "    const u", '친구코드 모양 틀림을 안 던짐'],
  ['SOC', "{ auth: true });\n    if(!Array.isArray(d))", "{});\n    if(!Array.isArray(d))", '친구코드 찾기가 토큰 없이'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  let hung = false;
  try{ await Promise.race([judge(S), new Promise((r) => setTimeout(() => { hung = true; r(); }, 3000))]); }catch(_){ qfail++; }
  if(hung) qfail++;
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, 'mutation test ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));
console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
