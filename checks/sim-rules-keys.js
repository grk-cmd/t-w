/* sim-rules-keys.js — 🔐 서버 규칙이 경로 키(사용자 id · 방 코드 · 글 id …)의 모양을 거르는가
   실행: node sim-rules-keys.js  (firebase-database-rules.json · app.js 와 같은 폴더에서)

   [왜] 10-17 친구 구독이 내 코드 없이 users/null/… 을 걸었다. 앱 안전망(firebase-init _noUidPath)이 막았지만
     서버 규칙에는 같은 막이 없어서, 안전망이 없는 옛 앱 · 폰 단축어(REST) · 다른 도구가 보내면 null · undefined ·
     공백 붙은 키가 그대로 저장됐다(운영 mobileLink 에 앞 공백 키가 실제로 있었다).
   [무엇을] 규칙의 경로 변수($이름)마다 «무슨 키인가» 를 아래 표에 적고, 그 변수의 .validate 에서 키만 보는 조건을
     꺼내 JS 로 실제로 돌린다 — 운영 키 모양은 통과, null · undefined · NaN · 앞뒤 공백 · 형식 틀림은 거절.
     표에 없는 새 경로 변수가 생기면 빨강 — 형식을 정해 규칙과 표에 같이 넣는다.
   ⚠️ 서버가 정말 그렇게 판정하는지는 에뮬레이터로만 안다 — 규칙을 바꾸면 node scripts/rules-emu-check.js 도 돌린다. */
'use strict';
const fs = require('fs');

let fail = 0;
const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* ── 키 종류마다 통과해야 하는 것 · 거절해야 하는 것 (통과 쪽은 운영 키 모양에서 골랐다) */
const SAMPLES = {
  user: {
    good: ['umu00pdxvk6d9x8mx', 'u0abcdefgh12', 'umgk3x9q2abc', 'U0ABCDEFGH'.replace(/^U/, 'u'), 'U0ABCDEFGH', 'u' + 'a'.repeat(40)],
    bad: ['null', 'undefined', 'NaN', '', ' umu00pdxvk6d9x8mx', 'umu00pdxvk6d9x8mx ', 'u1234567', 'u' + 'a'.repeat(41), 'xmu00pdxvk6d9x8mx', 'umu00-pdxvk6d9x8'],
  },
  room: {
    good: ['PLAY-AB12', 'WORK-ABCD', 'SCRT-1234', 'MATE-AB12', 'COZY-ZZ99'],
    bad: ['null', 'undefined', 'NaN', '', 'play-ab12', 'play-AB12', 'PLAY-AB1', 'PLAYAB12', ' PLAY-AB12', 'PLAY-AB12 '],
  },
  invite: {
    good: ['ABCD-EF12-GH34', 'INVT-AB12-CD34', '2345-6789-ABCD'],
    bad: ['null', 'undefined', '', 'INVT-123456789', 'abcd-ef12-gh34', 'ABCD-EF12-GH3', ' ABCD-EF12-GH34'],
  },
  member: {
    good: ['mabc12345', 'mmgk3x9q2ab3cd', 'm' + 'a'.repeat(40)],
    bad: ['null', 'undefined', 'NaN', '', 'mABC12345', 'm12', ' mabc12345'],
  },
  other: {   // 안쪽 키(push id · 날짜 · 번호 · 태그) — 모양이 여럿이라 사고로 생기는 것만 막는다
    good: ['-Nabc_12-xYz', '2026-10', '17', '0', 'x1', 'c123abc', '2026-W42-wd', 'a b'],
    bad: ['null', 'undefined', 'NaN', ' x1', 'x1 ', ' '],
  },
  userPadded: {   // 폰 연결(mobileLink) — 단축어 주소에 낀 공백은 받고 서버 함수가 정상 칸으로 옮긴다(state 는 연결 키가 맞을 때만 · 아래 4절)
    good: ['umu00pdxvk6d9x8mx', 'U0ABCDEFGH', ' umu00pdxvk6d9x8mx', 'umu00pdxvk6d9x8mx ', '  umu00pdxvk6d9x8mx'],
    bad: ['null', 'undefined', ' undefined', 'NaN', '', ' ', 'u1234567', ' xmu00pdxvk6d9x8mx', 'umu00-pdxvk6d9x8'],
  },
  own: {     // 원래 자기 형식이 있던 칸(슬롯 번호 · 탭 id …) — 사고 키만 거절하는지 본다
    good: [],
    bad: ['null', 'undefined', 'NaN', ' 0'],
  },
};

/* ── 경로 변수 표: 키 종류 또는 «검사 안 함» 과 그 이유 */
const KIND = {
  '/secretRooms/$code': 'room',
  '/rooms/$room': 'room',
  '/rooms/$room/_meta/tabs/$tabId': 'own',
  '/rooms/$room/chatLog/$msgId': 'other',
  '/rooms/$room/_chatTab/$tabId': 'own',
  '/rooms/$room/_chatTab/$tabId/$msgId': 'other',
  '/rooms/$room/_photo/slots/$i': 'own',
  '/rooms/$room/_photo/frames/$i': 'own',
  '/rooms/$room/_photo/p/$i': 'own',
  '/rooms/$room/_photo/ev/$i': 'own',
  '/rooms/$room/$memberId': 'member',
  '/roomIndex/$room': 'room',
  '/roomAlive/$room': 'room',
  '/roomAlive/$room/$memberId': 'member',
  '/licenseRequests/$reqId': 'other',
  '/accountSnap/$userId': 'user',
  '/userAuth/$userId': 'user',
  '/friendCodes/$code': 'room',
  '/users/$userId': 'user',
  '/users/$userId/mallangGifts/$giftId': 'other',
  '/users/$userId/mallangGiftCount/$date': 'other',
  '/users/$userId/bugSeen/$id': 'other',
  '/users/$userId/bugPostCount/$date': 'other',
  '/users/$userId/gacha/owned/$partId': 'other',
  '/users/$userId/slots/s/$i': 'own',
  '/users/$userId/slotsPrev/s/$i': 'own',
  '/users/$userId/chars/$cid': 'own',
  '/users/$userId/mallang/imgs/$i': 'own',
  '/users/$userId/trash/$cid': 'other',
  '/users/$userId/trash/$cid/$mtime': 'other',
  '/users/$userId/chal/days/$i': 'other',
  '/users/$userId/chal/arcWd/days/$i': 'other',
  '/users/$userId/chal/arcWe/days/$i': 'other',
  '/users/$userId/chal/due/$i': 'other',
  '/users/$userId/friends/$friendId': 'user',
  '/users/$userId/guestbook/$entryId': 'other',
  '/users/$userId/schedule/$ym': 'other',
  '/users/$userId/schedule/$ym/$dd': 'other',
  '/users/$userId/schedule/$ym/$dd/$id': 'other',
  '/users/$userId/ddays/$id': 'other',
  '/users/$userId/schedNotices/$id': 'other',
  '/users/$userId/playlist/items/$i': 'other',
  '/users/$userId/playlist/sets/$s': 'own',
  '/users/$userId/playlist/sets/$s/items/$i': 'other',
  '/users/$userId/emojis/$slot': 'other',
  '/users/$userId/chalPaidTags/$tag': 'other',
  '/playlistIndex/$uid': 'user',
  '/mobileKeys/$userId': 'user',
  '/mobileLink/$userId': 'userPadded',
  '/leaderboard/$userId': 'user',
  '/invites/$code': 'invite',
  '/groupInvites/$code': 'invite',
  '/groupInviteUses/$code': 'invite',
  '/groupInviteUses/$code/$n': 'own',            // 들어온 순서 1..9999
  '/groupInviteTokens/$code': 'invite',
  '/groupInviteTokens/$code/$token': 'own',      // 기기 토큰 t + 16자(license-gate _inviteTokenFor)
  '/friendRequests/$toId': 'user',
  '/friendRequests/$toId/$fromId': 'user',
  '/sentFriendRequests/$fromId': 'user',
  '/sentFriendRequests/$fromId/$toId': 'user',
  '/reports/$target': 'user',
  '/reports/$target/$reporter': 'user',
  '/bookmarks/$userId': 'user',
  '/bookmarks/$userId/items/$bid': 'other',
  '/bookmarksPub/$userId': 'user',
  '/bookmarksPub/$userId/items/$bid': 'other',
  '/bugBoard/list/$id': 'other',
  '/bugBoard/pub/$id': 'other',
  '/bugBoard/prv/$authUid/$id': 'other',
  '/bugBoard/rep/pub/$id': 'other',
  '/bugBoard/rep/pub/$id/$rid': 'other',
  '/bugBoard/rep/prv/$id': 'other',
  '/bugBoard/rep/prv/$id/$rid': 'other',
  '/bugBoard/likes/$id': 'other',
  '/inbox/$uid': 'user',
  '/inbox/$uid/$msgId': 'other',
  '/roomInvites/$toId': 'user',
  '/roomInvites/$toId/$fromId': 'user',
};
/* 검사 안 하는 변수 — 이유가 «관리자만» 이면 일반 사용자 · 로그인 안 한 쪽의 쓰기가 정말 막혔는지 아래에서 돌려 본다 */
const SKIP = {
  '/licenses/$key': 'key',          // 사용자 쓰기(redeemedAt)는 «이미 있는 키» 에만 — 없는 키는 못 만든다
  '/authUsers/$authUid': 'self',    // 내 auth uid 칸만(auth.uid === $authUid)
  '/bugBoard/prv/$authUid': 'self',
  '/bugBoard/likes/$id/$authUid': 'self',
  '/roomDir/$code': 'closed',       // .write false — 방 서버(관리자 SDK)만 쓴다
  '/admins/$uid': 'closed',
  '/apiBots/$uid': 'closed',
};
for (const p of ['/catalog/parts/$partId', '/catalog/gachaParts/$partId', '/catalog/desks/$deskId', '/catalog/items/$itemId',
  '/catalog/customCats/$catId', '/catalog/catOverrides/$catId', '/catalogMeta/$kind', '/config/chatKeepDays/$kind', '/config/sources/$feature', '/config/dataRoutes/$i',
  '/config/apiCors/$i', '/config/roomServer/servers/$name', '/config/roomServer/allow/$userId', '/bugBoard/seq/$day',
  '/bugBoard/ans/pub/$id', '/bugBoard/ans/pub/$id/$rid', '/bugBoard/ans/prv/$id', '/bugBoard/ans/prv/$id/$rid',
  '/inboxBroadcast/$msgId', '/adminLog/$logId', '/metrics/improvements/$id', '/metrics/improvements/$id/items/$i',
  '/adminTodos/$id', '/adminTodos/$id/reports/$rid', '/adminNames/$uid']) SKIP[p] = 'admin';

/* ── 규칙 읽기 · 변수 모으기 */
function collect(rules){
  const out = [];
  (function walk(n, p, chain){
    if (!n || typeof n !== 'object') return;
    for (const k of Object.keys(n)) {
      if (k[0] === '.') continue;
      const q = p + '/' + k, c = n[k];
      const ch = chain.concat([c]);
      if (k[0] === '$') out.push({ path: q, name: k, node: c, chain: ch });
      walk(c, q, ch);
    }
  })(rules, '', [rules]);
  return out;
}

/* 최상위 && 로 나눈 조각 중 «이 변수 하나만 보는 것»(newData · data · root · auth 없음)을 모은다 */
function splitAnd(expr){
  const parts = []; let d = 0, s = 0, q = null;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (q) { if (c === q && expr[i - 1] !== '\\') q = null; continue; }
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '/' && /[(,!&|=\s]/.test(expr[i - 1] || ' ') && /matches\($/.test(expr.slice(0, i))) {   // 정규식 글
      let j = i + 1; while (j < expr.length && !(expr[j] === '/' && expr[j - 1] !== '\\')) j++; i = j; continue;
    }
    if (c === '(') d++; else if (c === ')') d--;
    else if (d === 0 && expr.startsWith(' && ', i)) { parts.push(expr.slice(s, i)); s = i + 4; i += 3; }
  }
  parts.push(expr.slice(s));
  return parts.map(x => x.trim());
}
function keyCheckOf(node, name){
  const v = node && node['.validate'];
  if (v === false || v === 'false') return { closed: true };
  if (typeof v !== 'string') return null;
  const parts = splitAnd(v).filter(x => x.includes(name) && !/\b(newData|data|root|auth|now)\b/.test(x));
  return parts.length ? parts.join(' && ') : null;
}
/* 규칙식을 JS 로 돌린다 — matches · beginsWith · endsWith 를 잠깐 붙이고, replace 는 서버처럼 전부 바꾼다 */
function runKey(expr, name, key){
  if (typeof expr !== 'string') return true;      // 검사가 없으면 무엇이든 통과
  const js = expr.replace(/\.replace\(/g, '.replaceAll(');
  const P = String.prototype;
  P.matches = function (re) { return re.test(String(this)); };
  P.beginsWith = P.startsWith;
  try { return !!new Function(name, 'return (' + js + ');')(key); }
  finally { delete P.matches; delete P.beginsWith; }
}

/* 일반 사용자 · 로그인 안 한 쪽이 이 변수 아래(또는 위)에 쓸 수 있나 — .write 를 돌려 본다 */
function anyoneCanWrite(v){
  const snap = (val) => ({ exists: () => val != null, val: () => val, isNumber: () => typeof val === 'number', isString: () => typeof val === 'string',
    isBoolean: () => typeof val === 'boolean', hasChildren: () => false, hasChild: () => false, child: () => snap(null), parent: () => snap(null), getPriority: () => null });
  const root = snap(null);
  const writes = [];
  for (const n of v.chain.slice(1)) if (n && n['.write'] !== undefined) writes.push(n['.write']);
  (function down(n){ for (const k of Object.keys(n || {})) { if (k === '.write') { if (n !== v.node) writes.push(n[k]); } else if (k[0] !== '.' && typeof n[k] === 'object') down(n[k]); } })(v.node);
  return writes.some(w => {
    if (w === true) return true;
    if (typeof w !== 'string') return false;
    for (const auth of [null, { uid: 'someone' }]) {
      try {
        const P = String.prototype; P.matches = function (re) { return re.test(String(this)); }; P.beginsWith = P.startsWith;
        try { if (new Function('auth', 'root', 'newData', 'data', 'now', 'return (' + w + ');')(auth, root, snap({}), snap(null), 0)) return true; }
        finally { delete P.matches; delete P.beginsWith; }
      } catch (_) { /* auth.uid 를 null 에서 읽는 식 — 서버에서도 거짓 */ }
    }
    return false;
  });
}

function check(rules, quiet){
  const before = fail;
  const say = quiet ? (c) => { if (!c) fail++; } : chk;
  const vars = collect(rules);
  for (const v of vars) {
    if (v.name === '$other') continue;     // 나머지 칸 — 따로 .validate false 를 본다
    const kind = KIND[v.path], skip = SKIP[v.path];
    if (!kind && !skip) { say(false, `${v.path} — 표에 없는 경로 변수(형식을 정해 규칙과 이 표에 넣는다)`); continue; }
    if (skip) {
      if (skip === 'admin') say(!anyoneCanWrite(v), `${v.path} — 관리자만 쓴다(일반 · 로그인 안 함 쓰기 길 없음)`);
      else if (skip === 'self') say(/auth\.uid === \$authUid/.test(JSON.stringify(v.node)), `${v.path} — 내 auth uid 칸만`);
      else if (skip === 'closed') say(v.node['.write'] === false, `${v.path} — 쓰기 닫힘`);
      else if (skip === 'key') say(/root\.child\('licenses'\)\.child\(\$key\)\.exists\(\)/.test(JSON.stringify(v.node)), `${v.path} — 사용자 쓰기는 있는 키에만`);
      continue;
    }
    const kc = keyCheckOf(v.node, v.name);
    if (!kc || kc.closed) { say(false, `${v.path} — 키 형식 검사 없음`); continue; }
    const S = SAMPLES[kind];
    const goodOk = S.good.filter(k => !runKey(kc, v.name, k));
    const badOk = S.bad.filter(k => runKey(kc, v.name, k));
    say(!goodOk.length && !badOk.length, `${v.path} (${kind})` +
      (goodOk.length ? ` — 막히면 안 되는데 막힘: ${JSON.stringify(goodOk)}` : '') + (badOk.length ? ` — 통과하면 안 되는데 통과: ${JSON.stringify(badOk)}` : ''));
  }
  for (const p of Object.keys(KIND).concat(Object.keys(SKIP))) say(vars.some(v => v.path === p), `표의 ${p} 가 규칙에 있다(옛 줄이 남지 않게)`);
  return fail - before;
}

const RULES_TEXT = fs.readFileSync('firebase-database-rules.json', 'utf8');
const rules = JSON.parse(RULES_TEXT).rules;

console.log('\n── 1. 경로 변수마다 키 형식 — 운영 키 모양은 통과 · 사고 키는 거절');
check(rules, false);

console.log('\n── 2. 사용자 id 형식이 앱과 같다(앱이 만드는 id 는 서버도 받는다)');
{
  const app = fs.readFileSync('app.js', 'utf8');
  const m = /function _setMyUserId\(uid\)\{[\s\S]*?!(\/\^u[^\n]*?\/i?)\.test\(uid\)/.exec(app);
  chk(!!m, '앱 _setMyUserId 의 id 모양을 찾았다');
  if (m) {
    const appRe = new Function('return ' + m[1])();
    const kc = keyCheckOf(rules.users.$userId, '$userId');
    const all = SAMPLES.user.good.concat(SAMPLES.user.bad.filter(k => k !== 'undefined'));
    const diff = all.filter(k => appRe.test(k) !== runKey(kc, '$userId', k));
    chk(!diff.length, '앱이 받는 id 와 서버가 받는 id 가 같다' + (diff.length ? ' — 다름: ' + JSON.stringify(diff) : ''));
    chk(appRe.test('undefined') && !runKey(kc, '$userId', 'undefined'), '«undefined» 는 앱 모양에 맞지만 서버는 따로 거절한다(u + 영문 8자라 형식만으로는 못 막는다)');
  }
  const gen = /function _inventMyUserId\(\)\{\s*return ([^;]+);/.exec(app);
  chk(!!gen, '앱이 id 를 만드는 식을 찾았다');
  if (gen) {
    const make = new Function('return ' + gen[1]);
    const kc = keyCheckOf(rules.users.$userId, '$userId');
    let bad = 0; for (let i = 0; i < 2000; i++) if (!runKey(kc, '$userId', make())) bad++;
    chk(bad === 0, `앱이 새로 만드는 id 2000개가 전부 서버 형식에 맞다 (안 맞음 ${bad})`);
  }
}

console.log('\n── 3. 폰 연결 — 공백 낀 칸은 연결 키가 맞는 state 만 · live 는 정상 칸만');
{
  const ml = rules.mobileLink.$userId;
  const KEY = 'ABCDEFGHJKLMNPQRSTUVWXYZ', U = 'umu00pdxvk6d9x8mx';
  const snap = (val) => ({ exists: () => val != null, val: () => (val === undefined ? null : val), isString: () => typeof val === 'string',
    hasChildren: (ks) => ks.every(k => val && val[k] !== undefined), child: (k) => snap(val && typeof val === 'object' ? val[k] : null) });
  const root = { child: (p) => snap(p === 'mobileKeys/' + U ? KEY : null) };
  const run = (expr, id, nv) => {
    const P = String.prototype; P.matches = function (re) { return re.test(String(this)); };
    try { return !!new Function('$userId', 'newData', 'root', 'now', 'return (' + expr.replace(/\.replace\(/g, '.replaceAll(') + ');')(id, snap(nv), root, 1); }
    finally { delete P.matches; }
  };
  const st = ml.state['.validate'], lv = ml.live['.validate'];
  const S = (key) => ({ on: true, ts: 1, key });
  chk(typeof st === 'string' && run(st, U, { on: true, ts: 1 }), '정상 칸 state — 키 없이도 받음(예전 그대로 · 쓰기 권한은 .write 가 본다)');
  chk(run(st, ' ' + U, S(KEY)) && run(st, U + ' ', S(KEY)) && run(st, '  ' + U, S(KEY)), '공백 낀 칸 state — 공백 뺀 코드의 연결 키와 맞으면 받음(앞 · 뒤 · 두 칸)');
  chk(!run(st, ' ' + U, S('ZZZZZZZZZZZZZZZZZZZZZZZZ')) && !run(st, ' ' + U, { on: true, ts: 1 }) && !run(st, ' u0abcdefgh12', S(KEY)),
    '  ↳ 키가 틀리거나 · 없거나 · 연결 키가 없는 사람이면 거절');
  chk(typeof lv === 'string' && run(lv, U, { at: 1 }) && !run(lv, ' ' + U, { at: 1 }), 'live 는 정상 칸만(PC 는 공백 칸에 쓰지 않는다)');
}

console.log('\n── 4. 깨 보기 — 형식 검사를 빼거나 느슨하게 하면 빨강');
{
  const mutate = (fn) => { const r = JSON.parse(RULES_TEXT).rules; try { fn(r); } catch (_) { return 1; }   // 고칠 자리가 없는 규칙(옛 판)은 빨강으로 친다
   const f0 = fail; check(r, true); const n = fail - f0; fail = f0; return n; };
  const strip = (node, name) => { node['.validate'] = splitAnd(String(node['.validate'] || 'true')).filter(x => !x.includes(name) || /\b(newData|data|root)\b/.test(x)).join(' && ') || 'true'; };
  chk(mutate(r => strip(r.users.$userId, '$userId')) > 0, 'users/$userId 의 형식 검사를 빼면 빨강');
  chk(mutate(r => strip(r.friendRequests.$toId.$fromId, '$fromId')) > 0, '친구 신청 보낸 사람 형식을 빼면 빨강');
  chk(mutate(r => strip(r.rooms.$room.$memberId, '$memberId')) > 0, '방 멤버 id 형식을 빼면 빨강');
  chk(mutate(r => { r.users.$userId['.validate'] = r.users.$userId['.validate'].replace(" && $userId !== 'undefined'", ''); }) > 0, '«undefined» 거절을 빼면 빨강');
  chk(mutate(r => { r.users.$userId.schedule.$ym['.validate'] = "!$ym.matches(/^(null|undefined|NaN)$/)"; }) > 0, '안쪽 키에서 공백 거절을 빼면 빨강');
  chk(mutate(r => { r.rooms.$room['.validate'] = "$room.matches(/^[A-Za-z]{4}-[A-Z0-9]{4}$/)"; }) > 0, '방 코드에 소문자를 받게 느슨히 하면 빨강');
  chk(mutate(r => { r.users.$userId.newThing = { $x: { '.validate': 'true' } }; }) > 0, '표에 없는 새 경로 변수가 생기면 빨강');
  chk(mutate(r => { r.catalog.parts.$partId['.write'] = 'true'; }) > 0, '«관리자만» 으로 빼 둔 곳을 누구나 쓰게 바꾸면 빨강');
  chk(mutate(r => { r.mobileLink.$userId['.validate'] = "$userId.matches(/^[uU][0-9a-zA-Z]{8,40}$/)"; }) > 0, '폰 연결에서 공백 낀 칸을 막아 버리면 빨강(서버 함수가 옮길 길이 없어진다)');
}

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✓ 전부 통과');
process.exit(fail ? 1 : 0);
