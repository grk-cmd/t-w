/* ═══ 👥 sim-friend-profile-live.js — 친구 이름 · 레벨이 다시 실시간으로 (2026-10-19 신설) ═══
   [제보] 0.11.4 beta.1 — 친구가 이름을 바꿔도 내 친구 목록 · 그 친구 마이홈에 옛 이름. 탭을 옮겼다 오면 바뀐다(접속 상태는 실시간).
     친구 포트 개편(10-16~17)이 친구별 상시 구독 넷을 없애면서 이름(users/{fid}/profile) 구독까지 빠졌다.
   [고침] 목록이 열려 있는 동안(접속 상태와 같은 조건 · 같은 수명) 친구마다 프로필도 듣는다. 소개 · 사진은 열 때 한 번 그대로.
     목록이 닫혀 있을 때 마이홈 구경은 그 친구 프로필만 한 번 새로 읽는다.
   ・1절: firebase-init(가짜 onValue · get) → provider → 포트 → friends-sub 를 실제로 이어서 —
         평소 1개 · 열면 1 + 2n(접속 상태 n · 프로필 n) · 닫으면 1 · 소개 · 사진은 구독 0 · 이름 바뀌면 목록 값이 바뀜 ·
         닫았다 10분 안에 다시 열어도 옛 이름이 안 돌아옴(카드 기억에 얹힘) · 늦게 끝난 목록 받기가 들은 이름을 안 덮음
   ・2절: refreshProfile — 닫혀 있으면 그 친구 프로필 한 번(소개 · 사진 · 다른 친구 안 읽음) · 열려 있으면 읽기 0 · 친구 아니면 false
   ・3절: 마이홈 구경(myhome-visit.js openFriendHomeView) — 받아 둔 이름으로 먼저 그리고, 새 이름이 오면 다시 그림 · 친구 아니면 옛 길(getUserNameById)
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
  SS: pick(at('source-switch.js', 'shared')),
  FS: pick(at('friends-sub.js', 'myhome')),
  MV: pick(at('myhome-visit.js', 'myhome')),
  MS: pick(at('myhome-state.js', 'myhome')),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const load = (src, name, extra) => {
  const win = {};
  const names = ['window', 'module', 'console'].concat(Object.keys(extra || {}));
  new Function(...names, src)(win, undefined, { warn(){}, log(){}, error(){} }, ...Object.values(extra || {}));
  return win[name];
};
const flush = async () => { for(let i = 0; i < 3; i++) await new Promise(r => setImmediate(r)); };   // 걸려 있는 약속을 다 끝낸다

/* firebase-init 의 친구 함수(목록 한 번 · 목록 구독 ~ 접속 상태 한 번)를 떼어 가짜 SDK 위에서 돌린다 */
function fakeFirebase(S, N){
  const i0 = S.FI.indexOf('    watchMyFriendList(myId, onChange, onError){'), i1 = S.FI.indexOf('    async getFriendPresence(fid){', i0), i2 = i1 < 0 ? -1 : S.FI.indexOf('\n    },\n', i1);
  const g0 = S.FI.indexOf('    async getMyFriendList(myId){'), g1 = g0 < 0 ? -1 : S.FI.indexOf('\n    },\n', g0);
  if(!(i0 > 0 && i2 > i1 && g1 > g0)) return null;
  const db = { list: {}, profile: {}, presence: {} };
  for(let k = 0; k < N; k++){ db.list['f' + k] = { addedAt: k }; db.profile['f' + k] = { name: '옛이름' + k, level: 3, updatedAt: 1 }; }
  const live = [], gets = [];
  const valOf = (p) => {
    if(p === 'users/ME/friends') return db.list;
    let m = /^users\/(\w+)\/profile$/.exec(p); if(m) return db.profile[m[1]] || null;
    m = /^users\/(\w+)\/presence$/.exec(p); if(m) return db.presence[m[1]] || null;
    if(/\/home\/bio$/.test(p)) return '소개';
    if(/\/home\/avatar$/.test(p)) return 'data:image/jpeg;base64,AAAA';
    return null;
  };
  const ref = (_db, p) => ({ p });
  const onValue = (r, cb) => { const l = { p: r.p, cb, on: true }; live.push(l); cb({ val: () => valOf(r.p) }); return () => { l.on = false; }; };
  const get = async (r) => { gets.push(r.p); return { val: () => valOf(r.p) }; };
  let api = null;
  try{
    api = new Function('ref', 'onValue', 'get', 'db', 'console', 'let _myFriendsOff = null;\nconst api = {\n' + S.FI.slice(g0, g1 + 7) + '\n' + S.FI.slice(i0, i2 + 6) + '\n};\nreturn api;')(ref, onValue, get, {}, { warn(){}, log(){} });
  }catch(_){ return null; }
  /* 친구가 이름을 바꿈 — 그 경로를 듣는 구독에 새 값을 보낸다(Firebase 가 하는 일) */
  const write = (fid, prof) => { db.profile[fid] = prof; live.filter(l => l.on && l.p === 'users/' + fid + '/profile').forEach(l => l.cb({ val: () => prof })); };
  const on = (re) => live.filter(l => l.on && (!re || re.test(l.p))).length;
  const everOn = (re) => live.filter(l => re.test(l.p)).length;
  return { api, db, live, gets, write, on, everOn };
}

function wire(S, F, opts){
  const P = load(S.PORT, 'TwFriendsPort'), FB = load(S.FBP, 'TwFriendsFirebase'), SW = load(S.SS, 'TwSourceSwitch'), FSM = load(S.FS, 'TwFriendsSub');
  const T = { q: [], run(){ const q = T.q.splice(0); q.forEach(fn => fn && fn()); } };
  const clock = { t: 0 };
  const a = F.api;
  const fbp = FB.createFriendsFirebase({ getList: (...x) => a.getMyFriendList(...x), watchList: (...x) => a.watchMyFriendList(...x), getCard: (...x) => a.getFriendCard(...x),
    watchPresence: (...x) => a.watchFriendPresence(...x), getPresence: (...x) => a.getFriendPresence(...x),
    watchProfile: (...x) => a.watchFriendProfile(...x), getProfile: (...x) => a.getFriendProfile(...x),
    setTimer: (fn) => { T.q.push(fn); return T.q.length; }, clearTimer: (id) => { T.q[id - 1] = null; }, now: () => clock.t });
  const port = P.createFriendsPort({ firebase: fbp, api: null, source: () => 'firebase', serverFirst: SW.serverFirst, warn(){} });
  const box = { cur: {}, emits: 0 };
  const listFriends = (opts && opts.listFriends) ? opts.listFriends(port) : (...x) => port.listFriends(...x);
  const sub = FSM.createFriendsSub({ subscribe: (...x) => port.watchList(...x), fetchOnce: (id) => port.listFriends(id, { idsOnly: true }), listFriends,
    readFriend: (...x) => port.readFriend(...x), watchPresence: (...x) => port.watchPresence(...x), readPresence: (...x) => port.readPresence(...x),
    watchProfile: (...x) => port.watchProfile(...x), readProfile: (...x) => port.readProfile(...x),
    current: () => box.cur, setFriends: (v) => { box.cur = v; }, getMyUserId: () => 'ME', toast(){}, setTimer: () => 0, clearTimer(){}, onUnload(){} });
  sub.start('ME', (f) => { box.cur = f; box.emits++; }, () => {});
  return { sub, port, box, T, clock };
}

async function judge(S){
  const N = 5;
  say('── 1. 목록이 열려 있는 동안 프로필도 듣는다 (친구 ' + N + '명)');
  {
    const F = fakeFirebase(S, N);
    chk(!!F, 'firebase-init 친구 함수를 떼어 온다');
    if(!F) return;
    let W = null;
    try{ W = wire(S, F); }catch(e){ chk(false, '잇다 던짐 — ' + e.message); return; }
    const { sub, box, T, clock } = W;
    await flush(); T.run(); await flush();
    chk(F.on() === 1 && box.cur.f1 && box.cur.f1.name === '옛이름1', '★ 평소(목록 닫힘) 상시 구독 1개 · 이름은 한 번 읽어 얹음 (지금 ' + F.on() + ')');
    sub.open('myhome', () => {});
    await flush(); T.run(); await flush();
    chk(F.on() === 1 + 2 * N && F.on(/\/presence$/) === N && F.on(/\/profile$/) === N, '★ 목록을 열면 1 + 2×' + N + ' = ' + (1 + 2 * N) + '개 — 접속 상태 ' + N + ' · 프로필 ' + N + ' (지금 ' + F.on() + ')');
    chk(F.everOn(/\/home\//) === 0, '★ 소개 · 사진(home/bio · home/avatar)은 구독 0 — 열 때 한 번 읽기만 (구독 ' + F.everOn(/\/home\//) + ')');
    sub.open('invite', () => {});
    await flush();   // 초대 목록 첫 열기의 목록 받기까지 끝낸 뒤에 이름을 바꾼다 — 바뀐 이름은 듣기로만 와야 한다
    chk(F.on() === 1 + 2 * N, '  초대 목록까지 열어도 겹쳐 걸지 않음 (지금 ' + F.on() + ')');
    const before = box.emits;
    F.write('f2', { name: '새이름2', level: 7, cyc: 2, clv: 3, starC: '#112233', updatedAt: 2 });
    T.run(); await flush();
    const f2 = box.cur.f2 || {};
    chk(box.emits > before && f2.name === '새이름2' && f2.level === 7 && f2.cyc === 2 && f2.clv === 3 && f2.starC === '#112233', '★ 친구가 이름 · 레벨 · 회차를 바꾸면 목록 값이 바로 바뀐다 (이름 ' + f2.name + ')');
    chk(f2.bio === '소개' && f2.avatar === 'data:image/jpeg;base64,AAAA', '  ↳ 소개 · 사진은 그대로 남는다(프로필이 덮지 않음)');
    sub.close('myhome'); sub.close('invite');
    chk(F.on() === 1, '★ 닫으면 다시 1개 — 프로필 구독도 같이 끊김(남는 구독 0) (지금 ' + F.on() + ')');
    chk(box.cur.f2 && box.cur.f2.name === '새이름2', '  닫아도 마지막 이름은 남는다');
    clock.t += 60 * 1000;   // 10분(CARD_KEEP_MS) 안
    const nGets = F.gets.length;
    sub.open('myhome', () => {});
    await flush();
    const cardReads = F.gets.slice(nGets).filter(p => p !== 'users/ME/friends').length;   // 목록(누가 친구인가) 한 번 읽기는 원래 있다
    chk(box.cur.f2 && box.cur.f2.name === '새이름2', '★ 10분 안에 다시 열어도 옛 이름이 안 돌아온다(들은 이름이 카드 기억에 얹힘) (이름 ' + (box.cur.f2 || {}).name + ')');
    chk(cardReads === 0, '  ↳ 그때 카드(프로필 · 소개 · 사진)를 다시 읽지 않는다(바이트 그대로) (읽기 ' + cardReads + ')');
    sub.close('myhome');
    sub.stop();
    chk(F.on() === 0, '  멈추면 0개');
  }
  {
    /* 목록 받기가 늦게 끝나며 옛 이름을 들고 온다(서버 사본이 늦음) — 듣는 중 받은 이름이 이겨야 한다 */
    const F = fakeFirebase(S, 2);
    const gate = { hold: false, release: null };
    const W = wire(S, F, { listFriends: (port) => async (id) => { const v = await port.listFriends(id); if(gate.hold) await new Promise(r => { gate.release = r; }); return v; } });
    await flush(); W.T.run(); await flush();
    gate.hold = true;                  // 다음 목록 받기는 옛 이름을 든 채 붙잡아 둔다
    W.sub.open('myhome', () => {});    // 첫 열기 — 목록 받기 + 듣기 시작
    await flush();
    F.write('f0', { name: '바뀐이름0', updatedAt: 3 });
    W.T.run(); await flush();
    if(gate.release) gate.release();
    await flush(); await flush();
    chk(W.box.cur.f0 && W.box.cur.f0.name === '바뀐이름0', '★ 늦게 끝난 목록 받기가 듣는 중 받은 이름을 덮지 않는다 (이름 ' + (W.box.cur.f0 || {}).name + ')');
    W.sub.stop();
  }

  say('── 2. refreshProfile — 목록이 닫혀 있을 때 그 친구만 새로');
  {
    const F = fakeFirebase(S, 3);
    const W = wire(S, F);
    await flush(); W.T.run(); await flush();
    F.db.profile.f1 = { name: '닫힌새이름', level: 9, updatedAt: 5 };   // 듣지 않는 동안 바뀜
    const g0 = F.gets.length;
    const ok = await W.sub.refreshProfile('f1');
    await flush();
    const read1 = F.gets.slice(g0);
    chk(ok === true && W.box.cur.f1.name === '닫힌새이름' && W.box.cur.f1.level === 9, '★ 닫혀 있으면 그 친구 프로필을 한 번 새로 읽어 목록에 얹는다 (이름 ' + W.box.cur.f1.name + ')');
    chk(read1.join() === 'users/f1/profile' && F.on() === 1, '  ↳ 읽는 건 users/f1/profile 하나뿐(소개 · 사진 · 다른 친구 안 읽음 · 구독 안 남김) (' + read1.join(' · ') + ')');
    W.sub.open('myhome', () => {});
    await flush(); W.T.run(); await flush();
    const g1 = F.gets.length;
    chk((await W.sub.refreshProfile('f1')) === true && F.gets.length === g1, '  ↳ 목록이 열려 있으면(듣는 중) 읽지 않고 true');
    chk((await W.sub.refreshProfile('zz')) === false && (await W.sub.refreshProfile(null)) === false && F.gets.length === g1, '  ↳ 친구가 아니면 false(읽기 0 — 부르는 쪽이 옛 길)');
    W.sub.stop();
  }

  say('── 3. 마이홈 구경 — 받아 둔 이름 먼저 · 새 이름이 오면 다시 그림');
  {
    const any = (() => { const f = function(){ return P; }; const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? undefined : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true }); return P; })();
    const run = async (friends, refresh, opts) => {
      const L = { renders: 0, titles: [], nameReads: 0 };
      const st = load(S.MS, 'TwMyHomeState').createMyHomeState({ _myHomeFriends: () => friends.v });
      const label = { textContent: '' };
      const doc = { getElementById: (id) => id === 'mhTitleLabel' ? label : any, querySelectorAll: () => [] };
      const fapi = { getMyHome: async () => ({}), getUserNameById: async () => { L.nameReads++; return '서버이름'; }, subscribeDdays: () => () => {} };
      const w2 = {};
      new Function('window', 'document', 'firebaseAPI', 'TwMyHomeHooks', 'module', 'console', S.MV)(new Proxy(w2, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } }), doc, fapi, any, undefined, { warn(){}, log(){}, error(){} });
      const mod = w2.TwMyHomeVisit.createMyHomeVisit({
        _myHomeFriends: () => friends.v, _schedDdaysVisitUnsub: () => null, applyDesktopRunClass(){}, getMyUserId: () => 'ME', loadMyHomePage(){}, mhScheduler: any, myHomeOpen: () => true,
        renderMyHomePage: () => { L.renders++; L.titles.push(label.textContent); }, toast(){}, setSchedDdaysVisitUnsub(){}, setMyHomeOpen(){},
        _myHomeData: () => st._myHomeData(), _myHomeLoaded: () => true, _mhViewingUserId: () => st._mhViewingUserId(), _mhViewingName: () => st._mhViewingName(),
        _mhHomeFromServer: (...x) => st._mhHomeFromServer(...x), _mhViewingDisplayName: (...x) => st._mhViewingDisplayName(...x),
        setMyHomeData: (v) => st.setMyHomeData(v), setMhViewingUserId: (v) => st.setMhViewingUserId(v), setMhViewingName: (v) => st.setMhViewingName(v),
        refreshFriendProfile: refresh,
      });
      await mod.openFriendHomeView((opts && opts.fid) || 'f1', opts && opts.hint);
      await flush(); await flush();
      return L;
    };
    /* 친구 — 목록에 옛 이름. refreshProfile 이 새 이름을 목록에 얹는다(friends-sub 가 하는 일) */
    const friends = { v: { f1: { name: '옛이름' } } };
    let asked = [];
    const L1 = await run(friends, (fid) => { asked.push(fid); friends.v = Object.assign({}, friends.v, { f1: { name: '새이름' } }); return Promise.resolve(true); }, { hint: '옛이름' });
    chk(asked.join() === 'f1' && L1.titles[0] === '🏠 옛이름의 마이홈', '★ 열 때 받아 둔 이름으로 먼저 그리고 그 친구 프로필 새로 받기를 부른다 (처음 ' + L1.titles[0] + ')');
    chk(L1.renders === 2 && L1.titles[1] === '🏠 새이름의 마이홈' && L1.nameReads === 0, '★ 새 이름이 오면 다시 그린다 — 목록이 닫혀 있어도 옛 이름으로 굳지 않음 (나중 ' + L1.titles[1] + ')');
    const friends2 = { v: { f1: { name: '같은이름' } } };
    const L2 = await run(friends2, () => Promise.resolve(true), { hint: '같은이름' });
    chk(L2.renders === 1, '  ↳ 이름이 그대로면 다시 그리지 않는다(그리기 한 번)');
    const L3 = await run({ v: {} }, () => Promise.resolve(false), { fid: 'x9' });
    chk(L3.nameReads === 1 && L3.titles[L3.titles.length - 1] === '🏠 서버이름의 마이홈', '  ↳ 친구가 아니고 이름도 모르면 옛 길(getUserNameById)로 이름 한 줄');
    const L4 = await run({ v: {} }, () => Promise.reject(new Error('x')), { fid: 'x9', hint: '힌트' });
    chk(L4.renders === 1 && L4.nameReads === 0, '  ↳ 새로 받기가 실패해도 던지지 않고 받아 둔 이름 그대로');
  }
}

(async () => {
await judge(SRC0);

say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['FS', "  try{ offs.push(watchProfile(_myId, ids, p=>{", "  try{ (()=>{})(watchProfile, (p=>{", '목록을 열어도 프로필을 안 들음(회귀 그대로)'],
  ['FS', "  _presOff = ()=>{ for(const off of offs){ if(off){ try{ off(); }catch(_){} } } };", "  _presOff = ()=>{ try{ offs[0](); }catch(_){} };", '닫아도 프로필 구독이 남음'],
  ['FS', "Object.assign(_live, p); _applyProfile(p); _emit();", "Object.assign(_live, p); _emit();", '들은 이름을 목록에 안 얹음'],
  ['FS', "    .then(v=>{ if(run === _run){ _details = _keepKnown(v || {}); _applyProfile(_live); } },", "    .then(v=>{ if(run === _run){ _details = _keepKnown(v || {}); } },", '늦은 목록 받기가 들은 이름을 덮음'],
  ['FS', "  if(_presKey && _presKey.split(',').indexOf(fid) >= 0) return Promise.resolve(true);\n", "", '듣는 중에도 다시 읽음'],
  ['FS', "  if(!fid || !_myId || !(fid in _ids)) return Promise.resolve(false);", "  if(!fid || !_myId) return Promise.resolve(false);", '친구 아닌 사람도 읽음'],
  ['FBP', "    if(c) _cards[fid] = { at: c.at, card: Object.assign({}, c.card, prof) };", "", '들은 이름이 카드 기억에 안 얹힘(다시 열면 옛 이름)'],
  ['FBP', "  function watchProfile(myId, ids, onChange){ return _watchEach(ids, watchProfileOne, _keepProfile, onChange); }", "  function watchProfile(myId, ids, onChange){ return _watchEach(ids, (fid, cb)=>{ watchProfileOne(fid, cb); return ()=>{}; }, _keepProfile, onChange); }", '프로필 구독 해제 함수를 버림'],
  ['FBP', "  async function readProfile(fid){ return _keepProfile(fid, await getProfile(fid)); }", "  async function readProfile(fid){ return readFriend(fid); }", '새로 읽기가 10분 기억을 씀'],
  ['PORT', "  function watchProfile(myId, ids, onChange){ return firebase.watchProfile(myId, ids, onChange); }", "  function watchProfile(myId, ids, onChange){ firebase.watchProfile(myId, ids, onChange); }", '포트가 해제 함수를 안 돌려줌'],
  ['FI', "const off = onValue(ref(db, `users/${fid}/profile`), snap=>onChange(snap.val()));", "const off = onValue(ref(db, `users/${fid}/profile`), snap=>onChange(snap.val())); onValue(ref(db, `users/${fid}/home/avatar`), ()=>{});", '사진까지 구독'],
  ['MV', "    Promise.resolve(refreshFriendProfile ? refreshFriendProfile(friendId) : false)", "    Promise.resolve(false)", '마이홈 구경이 새 이름을 안 받음'],
  ['MV', "        if(_mhViewingDisplayName() !== shownName){ _mhApplyVisitUI(); renderMyHomePage(); }", "", '새 이름이 와도 다시 안 그림'],
];
const caught = [];
for(const [where, from, to, what] of BREAKS){
  if(SRC0[where].indexOf(from) < 0){ chk(false, '깨 볼 글을 못 찾음 — ' + what); continue; }
  const S = Object.assign({}, SRC0); S[where] = S[where].split(from).join(to);
  quiet = true; qfail = 0;
  let _hung = false;
  try{ await Promise.race([judge(S), new Promise((r) => setTimeout(() => { _hung = true; r(); }, 3000))]); }catch(_){ qfail++; }
  if(_hung) qfail++;
  quiet = false;
  caught.push([what, qfail]);
}
const missed = caught.filter(([, n]) => n === 0).map(([w]) => w);
chk(caught.length === BREAKS.length && !missed.length, '일부러 깨 본 ' + BREAKS.length + '가지를 다 잡는다' + (missed.length ? ' — 못 잡음: ' + missed.join(' · ') : ''));

console.log(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
