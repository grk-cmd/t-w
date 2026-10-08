/*
 * 규칙 잠금 A — «안 묶인 uid 는 누구나 쓴다» 갈래(!root.child('userAuth/'+$x).exists() ||)를 걷었는가 · 앱이 그 뒤에도 도는가
 * (RULES_LOCK_PLAN A · 가입 게이트 I 는 0.9.8 부터 · 앱 최소 버전은 별도 PR)
 * 1. 규칙 파일 어디에도 그 갈래가 남지 않았다 · 잠근 자리 37곳이 그대로 있다
 * 2. 규칙식을 굴린다 — 묶인 주인 ✓ · 다른 묶인 사람 ✗ · 로그인 안 함 ✗ · 안 묶인 uid 에 아무나 ✗ · 관리자는 관리자 갈래가 있는 곳만
 *    (secretRoom 은 관리자 갈래를 새로 넣었다 — 웹 관리자 · 앱의 시크릿룸 발급이 남의 칸에 쓴다)
 * 3. 폰(로그인 없음)의 mobileLink state 쓰기 — 키 갈래는 그대로
 * 4. 앱 — 묶은 뒤 한 번짜리 쓰기를 다시(I · K 닫을 때) · rearmPresence · 갈아타기(_switchPrepare)가 옛 uid 올리기 실패로 멈추지 않는다
 * 실제 서버(에뮬레이터)에서의 확인은 web-admin/e2e/rules-lock-unbound.spec.ts 가 한다.
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = (...names) => { for(const n of names){ const s = read(n); if(s != null) return s; } say('  ? 원본 못 찾음 — ' + names[0]); process.exit(2); };
const RULES_TXT = need('firebase-database-rules.json');
const RULES = JSON.parse(RULES_TXT).rules;
const APP = need('app.js', 'parts/app.js', 'app/parts/app.js');
const FI = need('firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const USER_KEYS = ['secretRoom', 'friendCode', 'transferHash', 'transferData', 'mallang', 'mallangGiftCount', 'bugSeen', 'bugPostCount',
  'mallangGiftSeen', 'profile', 'focus', 'gacha', 'slots', 'slotsPrev', 'chars', 'trash/$cid/$mtime', 'charsMeta', 'chalBonus', 'chal',
  'presence', 'home', 'invite', 'schedule', 'ddays', 'awayImg', 'awaySz', 'advBg', 'playlist', 'emojis', 'chalPaidTags'];
const LOCKED = USER_KEYS.map(k => ['users/$userId/' + k, '.write'])
  .concat([['inbox/$uid', '.write'], ['mobileKeys/$userId', '.write'], ['mobileLink/$userId', '.read'], ['mobileLink/$userId', '.write'],
    ['mobileLink/$userId/live', '.write'], ['mobileLink/$userId/state', '.write'], ['leaderboard/$userId', '.write']]);
const ADMIN_TOO = new Set(['users/$userId/secretRoom', 'users/$userId/invite', 'users/$userId/awayImg', 'inbox/$uid']);
const at = (p) => p.split('/').reduce((o, k) => (o && o[k] !== undefined) ? o[k] : undefined, RULES);

// 아주 작은 규칙식 계산기 — 이 검사가 보는 식에 나오는 것만(root/data/newData 의 child · val · exists, auth)
function snap(tree, path){
  const parts = String(path || '').split('/').filter(Boolean);
  let v = tree; for(const k of parts){ v = (v && typeof v === 'object' && k in v) ? v[k] : null; }
  return { val: () => v, exists: () => v !== null && v !== undefined, child: (p) => snap(tree, parts.concat(String(p).split('/')).join('/')) };
}
function allow(expr, { root, auth, vars, data, newData }){
  if(expr === true) return true;
  if(typeof expr !== 'string') return false;
  // 로그인 없음 = auth null · auth.uid null — 실제 엔진과 같다(그래서 null === null 이 참이 되는 함정도 그대로 잡힌다)
  const src = expr.replace(/auth != null/g, '(AUTH !== null)').replace(/auth\.uid/g, 'AUID').replace(/\$(\w+)/g, 'V_$1');
  const names = Object.keys(vars).map(k => 'V_' + k);
  try{
    return !!new Function('root', 'data', 'newData', 'AUTH', 'AUID', ...names, 'return (' + src + ');')(
      snap(root, ''), snap({ v: data }, 'v'), snap({ v: newData }, 'v'), auth, auth ? auth.uid : null, ...Object.values(vars));
  }catch(e){ return false; }
}

say('── 1. 걷었는가');
{
  chk(!/!root\.child\('userAuth\/'\+\$\w+\)\.exists\(\)/.test(RULES_TXT), '★ 규칙 파일에 «안 묶인 uid 는 누구나» 갈래가 하나도 없다');
  /* ★ auth != null 이 꼭 있어야 한다 — 로그인 안 한 요청에서 auth.uid 는 null 이고, 안 묶인 uid 의 userAuth 도 null 이라
       «val() === auth.uid» 만으로는 null === null 로 **통과한다**(에뮬레이터에서 확인 · 2026-10-09). 갈래만 걷으면 잠기지 않는다. */
  const missing = LOCKED.filter(([p, k]) => { const n = at(p); return !n || typeof n[k] !== 'string' || !/\(auth != null && root\.child\('userAuth\/'\+\$(userId|uid)\)\.val\(\) === auth\.uid\)/.test(n[k]); });
  chk(LOCKED.length === 37 && missing.length === 0, '★ 잠근 자리 37곳 모두 «로그인했고 묶인 주인» 식 (auth != null && …) 이 있다' + (missing.length ? ' — 빠짐: ' + missing.map(m => m.join(' ')).join(', ') : ''));
  const ua = (RULES.userAuth || {}).$userId || {};
  chk(/auth != null/.test(ua['.write'] || '') && /!data\.exists\(\)/.test(ua['.write'] || ''), '  userAuth 자체(묶기)는 그대로 — 로그인한 사람이 빈 자리를 자기 uid 로');
}

say('── 2. 규칙식을 굴린다');
{
  const root = { userAuth: { UBOUND: 'authA', UOTHER: 'authB' }, admins: { authAdmin: true } };
  const who = { owner: { uid: 'authA' }, other: { uid: 'authB' }, admin: { uid: 'authAdmin' }, anon: { uid: 'authAnon' }, none: null };
  const bad = [];
  for(const [p, k] of LOCKED){
    const expr = at(p)[k];
    const v = p.startsWith('inbox') ? 'uid' : 'userId';
    const isDel = /transferHash|transferData/.test(p);       // 지우기만 받는 칸
    const newData = isDel ? null : (p.endsWith('/state') ? { on: true } : 'x');
    const data = p.includes('trash') ? null : 'old';
    const run = (a, uid) => allow(expr, { root, auth: a, vars: { [v]: uid, cid: 'c1', mtime: '1' }, data, newData: k === '.read' ? undefined : newData });
    const want = (name, uid) => {
      if(uid === 'UBOUND' && name === 'owner') return !(p === 'mobileLink/$userId' && k === '.write');   // 노드 통째는 지우기만
      if(name === 'admin' && ADMIN_TOO.has(p)) return true;
      return false;
    };
    for(const uid of ['UBOUND', 'UNBOUND']){
      for(const name of Object.keys(who)){
        let w = want(name, uid);
        if(p === 'mobileLink/$userId' && k === '.write' && name === 'owner' && uid === 'UBOUND') w = false;   // 아래 따로
        if(run(who[name], uid) !== w) bad.push(`${p} ${k} · ${uid} · ${name} → ${!w ? '허용' : '거부'}`);
      }
    }
  }
  chk(bad.length === 0, '★ 37곳 × (묶인 uid · 안 묶인 uid) × (주인 · 다른 사람 · 관리자 · 익명 · 로그인 없음) — 주인만(관리자 갈래가 있는 곳은 관리자도)' + (bad.length ? '\n      ' + bad.slice(0, 8).join('\n      ') : ''));
  const ml = at('mobileLink/$userId')['.write'];
  chk(allow(ml, { root, auth: who.owner, vars: { userId: 'UBOUND' }, data: { live: 1 }, newData: null }) && !allow(ml, { root, auth: who.owner, vars: { userId: 'UBOUND' }, data: null, newData: { x: 1 } }),
    '  mobileLink 노드 통째로는 주인이 지우기만');
  const sr = at('users/$userId/secretRoom')['.write'];
  chk(allow(sr, { root, auth: who.admin, vars: { userId: 'UBOUND' }, newData: 'SCRT-AB12' }) && !allow(sr, { root, auth: who.other, vars: { userId: 'UBOUND' }, newData: 'SCRT-AB12' }),
    '★ secretRoom — 관리자 발급(웹 관리자 setUserSecretRoom · 앱 setMySecretRoom)은 묶인 사람 칸에도 된다 · 남은 안 된다');
  const th = at('users/$userId/transferData')['.write'];
  chk(allow(th, { root, auth: who.owner, vars: { userId: 'UBOUND' }, newData: null }) && !allow(th, { root, auth: who.owner, vars: { userId: 'UBOUND' }, newData: 'x' }),
    '  transferData · transferHash — 주인이 지우기만(그대로)');
}

say('── 3. 폰 연결 — 키 갈래는 그대로');
{
  const st = at('mobileLink/$userId/state')['.write'];
  const root = { userAuth: { UBOUND: 'authA' }, mobileKeys: { UBOUND: 'k'.repeat(20) }, mobileLink: { UBOUND: { live: { at: 1 } } } };
  chk(allow(st, { root, auth: null, vars: { userId: 'UBOUND' }, newData: { on: true, key: 'k'.repeat(20) } }), '★ 로그인 없는 폰 페이지(hosting/link.html) — 키가 맞고 PC 가 켜져 있으면 쓴다');
  chk(!allow(st, { root, auth: null, vars: { userId: 'UBOUND' }, newData: { on: true, key: 'wrong' } }), '  키가 틀리면 거부');
  const r2 = { userAuth: { UBOUND: 'authA' }, mobileKeys: { UBOUND: 'k'.repeat(20) }, mobileLink: {} };
  chk(!allow(st, { root: r2, auth: null, vars: { userId: 'UBOUND' }, newData: { on: true, key: 'k'.repeat(20) } }), '  PC 가 꺼졌으면(live 없음) 거부 — PC 의 live 쓰기는 묶인 주인만 된다');
}

say('── 4. 앱 — 잠근 규칙에서도 도는가');
{
  const A = strip(APP), F = strip(FI);
  const fn = (src, head) => { const i = src.indexOf(head); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0; for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };
  const after = fn(A, 'function _afterBindRewrite(');
  chk(/firebaseAPI\.rearmPresence\(\)/.test(after) && /claimDeviceSession\(myId, _onDeviceSessionLost\)/.test(after) && /setMyProfile\(myId,/.test(after),
    '★ _afterBindRewrite — presence(onDisconnect 포함) 다시 걸기 · 기기 세션 · 프로필');
  const ex = fn(A, 'function _showExistingSignup(');
  chk(/const close = \(\)=>\{[\s\S]{0,200}_afterBindRewrite\(\);[\s\S]{0,40}resolve\(true\);/.test(ex), '★ I(기존 사용자 가입)를 닫을 때(= 묶기 성공) 다시 쓴다 — 재시작이 없어서');
  const nl = fn(A, 'function _showNeedLogin(');
  chk(/const close = \(\)=>\{[^\n]*_afterBindRewrite\(\);[^\n]*resolve\(true\);/.test(nl), '  K(로그인 필요)를 닫을 때도');
  chk(/rearmPresence\(\)\{ if\(_presenceArm\) _whenAuthReady\(\)\.then\(_presenceArm\); \}/.test(F) && /_presenceArm = _armPresence;/.test(F), '  firebase-init rearmPresence — setMyPresenceOnline 의 _armPresence 를 그대로');
  const sp = fn(A, 'async function _switchPrepare(');
  chk(!!sp && !/if\(!b \|\| !b\.ok\) return prepFail;/.test(sp) && /const pushed = /.test(sp) && /mode:'import', n: plan\.cids\.length, pushed/.test(sp),
    '★ 갈아타기 — 옛 uid(안 묶임)로 못 올려도 멈추지 않고 서버에 있는 것만 옮긴다(잠근 규칙에서는 그 쓰기가 늘 거부된다)');
  chk(/if\(!ca \|\| !cb\) return prepFail;/.test(sp), '  읽지 못하면(오프라인)은 그대로 실패 — 아무것도 안 바꾼다');
}

say(`\n판정: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
