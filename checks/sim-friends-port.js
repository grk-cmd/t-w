/* ═══ 👥 sim-friends-port.js — 친구 데이터 포트 · provider (2026-10-17 신설) ═══
   [왜] 친구 정보를 Firebase 구독에서 서버(API)로 옮긴다. 도메인(friends-sub.js) · 화면은 포트 하나만 부르고,
     어디서 받을지는 provider(firebase = 옛 길 · api · ws 자리)가 맡는다.
   ・1절: 포트 — 세 함수가 provider 로 그대로 간다(인자 · 반환 · 해제 함수)
   ・2절: firebase provider(옛 길) — 목록 한 번 읽기 · 목록 구독 · 접속 상태
   ・3절: 배선 — app.js 가 포트 → provider 를 잇는다 · html 순서 · friends/ 파일은 firebaseAPI 를 모른다 ·
         화면 파일이 친구 데이터 firebaseAPI 함수를 직접 안 부른다
   ・4절: 일부러 깨 보기 — 하나라도 못 잡으면 빨강
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
  PORT: pick(at('friends-port.js', 'friends')),
  FBP: pick(at('friends-firebase.js', 'friends')),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
/* 화면 · 도메인 파일(스테이징 평면의 .js) — firebase-init.js · app.js(연결) 밖에서는 친구 데이터 firebaseAPI 함수를 안 부른다 */
const FRIEND_FB_FNS = ['subscribeMyFriends', 'getMyFriendList'];
const ALL_JS = fs.readdirSync('.').filter(f => f.endsWith('.js') && !/^sim-|^smoke\.js$|^run\.js$/.test(f)).map(f => [f, read(f) || '']);

const load = (src, name) => { const win = {}; new Function('window', 'module', 'console', src)(win, undefined, { warn(){}, log(){} }); return win[name]; };
const flush = async () => { for(let i = 0; i < 8; i++) await Promise.resolve(); };

async function judge(S){
  say('── 1. 포트 — provider 로 그대로');
  let P = null, F = null;
  try{ P = load(S.PORT, 'TwFriendsPort'); F = load(S.FBP, 'TwFriendsFirebase'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(P && typeof P.createFriendsPort === 'function' && F && typeof F.createFriendsFirebase === 'function', '전역 이름 TwFriendsPort · TwFriendsFirebase');
  {
    const log = [];
    const un = () => log.push('un');
    const fake = {
      listFriends: async (id, o) => { log.push(['list', id, o]); return { f1: { addedAt: 1 } }; },
      watchList: (id, ok, err) => { log.push(['watch', id, typeof ok, typeof err]); return un; },
      watchPresence: (id, ids, ok) => { log.push(['pres', id, ids.join(), typeof ok]); return un; },
    };
    const port = P.createFriendsPort({ firebase: fake });
    const r = await port.listFriends('ME', { idsOnly: true });
    chk(r && r.f1 && JSON.stringify(log[0]) === JSON.stringify(['list', 'ME', { idsOnly: true }]), 'listFriends(myId, opts) — provider 로 · 값 그대로');
    await port.listFriends('ME');
    chk(log[1][2] && typeof log[1][2] === 'object', '  ↳ opts 를 안 주면 빈 객체');
    const u1 = port.watchList('ME', () => {}, () => {});
    chk(u1 === un && log[2].join() === 'watch,ME,function,function', 'watchList(myId, onChange, onError) — provider 로 · 해제 함수 그대로');
    const u2 = port.watchPresence('ME', ['a', 'b'], () => {});
    chk(u2 === un && log[3].join() === 'pres,ME,a,b,function', 'watchPresence(myId, ids, onChange) — provider 로 · 해제 함수 그대로');
  }

  say('── 2. firebase provider(옛 길)');
  {
    const reads = [], subs = [];
    const fb = F.createFriendsFirebase({
      getList: async (id) => { reads.push(id); return id === 'EMPTY' ? null : { f1: { addedAt: 5 } }; },
      watchAll: (id, ok, err) => { const s = { id, ok, err, on: true }; subs.push(s); return () => { s.on = false; }; },
    });
    const v = await fb.listFriends('ME', { idsOnly: true });
    chk(reads.join() === 'ME' && v.f1 && v.f1.addedAt === 5, 'listFriends — users/{나}/friends 한 번 읽기(getList) 그대로');
    chk(JSON.stringify(await fb.listFriends('EMPTY')) === '{}', '  ↳ 없으면 빈 목록({})');
    const got = [], errs = [];
    const off = fb.watchList('ME', (f) => got.push(f), (e) => errs.push(e));
    subs[0].ok({ f1: { name: 'A' } }); subs[0].err(new Error('x'));
    chk(subs.length === 1 && got.length === 1 && got[0].f1.name === 'A' && errs.length === 1, 'watchList — 옛 구독(watchAll)에 onChange · onError 그대로');
    off();
    chk(!subs[0].on, '  ↳ 해제 함수 그대로');
    const p = fb.watchPresence('ME', ['f1'], () => { throw new Error('부르면 안 됨'); });
    chk(typeof p === 'function' && subs.length === 1, 'watchPresence — 옛 길은 목록 구독이 접속 상태를 실어 와서 따로 걸지 않는다(빈 해제 함수)');
  }

  say('── 3. 배선');
  {
    const a = strip(S.APP);
    chk(/const friendsFirebaseMod = TwFriendsFirebase\.createFriendsFirebase\(\{\n  getList: \(\.\.\.a\)=>firebaseAPI\.getMyFriendList\(\.\.\.a\),\n  watchAll: \(\.\.\.a\)=>firebaseAPI\.subscribeMyFriends\(\.\.\.a\),\n\}\);/.test(a),
      'app.js — firebase provider 가 firebaseAPI 를 deps 로 받는다(목록 한 번 · 옛 구독)');
    chk(/const friendsPortMod = TwFriendsPort\.createFriendsPort\(\{\n  firebase: friendsFirebaseMod,\n/.test(a), '  ↳ 포트가 provider 를 받는다');
    chk(/  subscribe: \(\.\.\.a\)=>friendsPortMod\.watchList\(\.\.\.a\),\n  fetchOnce: \(id\)=>friendsPortMod\.listFriends\(id, \{ idsOnly:true \}\),/.test(a), '  ↳ friends-sub 의 subscribe · fetchOnce 는 포트로');
    const iF = a.indexOf('const friendsFirebaseMod'), iP = a.indexOf('const friendsPortMod'), iS = a.indexOf('const friendsSubMod');
    chk(iF > 0 && iP > iF && iS > iP, '  ↳ 만드는 순서 provider → 포트 → friends-sub');
    const h = S.HTML;
    const hF = h.indexOf('<script src="parts/friends/friends-firebase.js">'), hP = h.indexOf('<script src="parts/friends/friends-port.js">'), hA = h.indexOf('<script src="parts/app.js">');
    chk(hF > 0 && hP > 0 && hF < hA && hP < hA, 'html — friends-firebase.js · friends-port.js 를 app.js 보다 먼저 싣는다');
    chk(!/firebaseAPI|firebase-init|\bref\(db|onValue\(/.test(strip(S.PORT)) && !/firebaseAPI|\bref\(db|onValue\(/.test(strip(S.FBP)),
      'friends/ 파일은 firebaseAPI · SDK 를 직접 안 부른다(deps 로만)');
    const bad = ALL_JS.filter(([f, src]) => f !== 'firebase-init.js' && f !== 'app.js'
      && FRIEND_FB_FNS.some(n => new RegExp('firebaseAPI\\s*\\.\\s*' + n + '\\b').test(strip(src))));
    chk(!bad.length, '화면 · 도메인 파일이 친구 데이터 firebaseAPI 함수(' + FRIEND_FB_FNS.join(' · ') + ')를 직접 안 부른다' + (bad.length ? ' — ' + bad.map(b => b[0]).join(' · ') : ''));
    const appCalls = (a.match(/firebaseAPI\.(subscribeMyFriends|getMyFriendList)\(/g) || []).length;
    chk(appCalls === 2, '  ↳ app.js 도 provider deps 두 줄에서만 (' + appCalls + ')');
  }
}

(async () => {
await judge(SRC0);

say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['PORT', 'return firebase.listFriends(myId, opts || {});', 'return firebase.listFriends(myId, {});', 'opts 를 버림'],
  ['PORT', 'return firebase.watchList(myId, onChange, onError);', 'return firebase.watchList(myId, onChange);', '에러 콜백을 안 넘김'],
  ['PORT', 'return firebase.watchPresence(myId, ids, onChange);', 'firebase.watchPresence(myId, ids, onChange);', '해제 함수를 안 돌려줌'],
  ['FBP', 'return (await getList(myId)) || {};', 'return await getList(myId);', '없을 때 null'],
  ['FBP', 'function watchPresence(){ return NOOP; }', 'function watchPresence(){ return null; }', '접속 상태 해제 함수 없음'],
  ['APP', '  subscribe: (...a)=>friendsPortMod.watchList(...a),', '  subscribe: (...a)=>firebaseAPI.subscribeMyFriends(...a),', 'friends-sub 가 포트를 건너뜀'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  try{ await judge(S); }catch(_){ qfail++; }
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
