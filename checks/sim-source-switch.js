/* sim-source-switch.js — 🎚️ 기능별 받는 곳 고르기(shared/source-switch.js) 검사
   ・1절: pickSource — 기능마다 옛 스위치 읽기(지금 동작과 같음) · 새 자리(sources.{기능})가 이긴다 · 모르는 기능은 파이어베이스
   ・2절: serverFirst — 서버 먼저 · 던지면 알리고 파이어베이스 · SKIP 이면 조용히 파이어베이스 · 서버 길 없음 · 파이어베이스 오류는 그대로
   ・3절: createSourceSwitch — 원격 설정을 못 읽으면 기본값(지금 동작)
   ・4절: 원격 설정 sources 칸 · 규칙 config/sources/$feature
   ・5절: 연결 — html 싣는 차례 · smoke · 친구 · 방 · 카탈로그가 이 모듈만 쓴다(옛 스위치를 직접 읽거나 넘어가기를 따로 쓰면 빨강)
   ・6절: 일부러 깨 보기 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');   // 옛 앱 읽기 막기 조건을 걷고 본다(개정 375)
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  SS: pick(at('source-switch.js', 'shared')),
  RC: pick(at('remote-config.js', 'shared')),
  PORT: pick(at('friends-port.js', 'friends')),
  GATE: pick(at('room-server-gate.js', 'room')),
  CC: pick(at('catalog-cache.js', 'character')),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
  RULES: stripReadGate(pick(['firebase-database-rules.json'])),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const load = (src, name, win) => { const w = win || {}; new Function('window', 'module', 'console', src)(w, undefined, { warn(){}, log(){} }); return w[name]; };

/* 받는 곳을 고르는 판단 · 넘어가기를 이 모듈 밖에서 다시 쓰는 글 — 기능 쪽 파일에 있으면 빨강 */
const OUTSIDE = [
  ['옛 친구 스위치를 직접 읽음', /\bfriendsApi\(\)/],
  ['옛 방 서버 스위치를 직접 판정', /\bcfg\.on\s*[!=]==\s*true|roomServer\(\)\.on\b/],
  ['새 자리 칸을 직접 읽음', /\bsources\(\)|config\/sources/],
  ['옛 친구 고르기 함수', /\bpickListSource\b/],
];

async function judge(S){
  let SW = null, RC = null;
  try{ SW = load(S.SS, 'TwSourceSwitch'); RC = load(S.RC, 'TwRemoteConfig'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(!!(SW && SW.pickSource && SW.serverFirst && SW.createSourceSwitch && SW.SKIP), '전역 이름 TwSourceSwitch — pickSource · serverFirst · createSourceSwitch · SKIP');

  say('── 1. pickSource — 기능별 옛 스위치 · 새 자리');
  {
    const P = SW.pickSource;
    chk(P('friends', null, undefined) === 'server' && P('friends', null, true) === 'server' && P('friends', null, false) === 'firebase',
      '친구 — 옛 flags.friendsApi 가 없거나 켜졌으면 서버 · 끄면 파이어베이스(지금과 같음)');
    chk(P('rooms', null, true) === 'server' && P('rooms', null, false) === 'firebase' && P('rooms', null, undefined) === 'firebase' && P('rooms', null, 'true') === 'firebase',
      '방 — 옛 roomServer.on 이 true 일 때만 서버(지금과 같음)');
    chk(P('catalog', null, undefined) === 'server' && P('catalog', null, false) === 'server', '카탈로그 — 옛 스위치 없이 늘 서버 먼저(지금과 같음)');
    chk(['friends', 'rooms', 'catalog'].every((f) => P(f, 'firebase', true) === 'firebase' && P(f, 'server', false) === 'server'),
      '★ 새 자리(sources.{기능})가 있으면 옛 스위치를 이긴다 — 세 기능 모두');
    chk(P('friends', 'SERVER', false) === 'firebase' && P('rooms', 'on', true) === 'server' && P('friends', 1, undefined) === 'server', '  ↳ 모르는 값은 칸 없음으로(옛 스위치)');
    chk(P('presence', 'server', true) === 'firebase' && P(undefined) === 'firebase', '모르는 기능은 파이어베이스(옛 길 — 안전한 쪽)');
    chk(SW.cleanSource('server') === 'server' && SW.cleanSource('firebase') === 'firebase' && SW.cleanSource('') === null && SW.cleanSource(null) === null, 'cleanSource 경계');
    chk(JSON.stringify(Object.keys(SW.FEATURES)) === JSON.stringify(['friends', 'rooms', 'catalog']) && JSON.stringify(RC.SOURCE_FEATURES) === JSON.stringify(Object.keys(SW.FEATURES)),
      '기능 표 — friends · rooms · catalog · 원격 설정 칸 이름과 같다');
  }

  say('── 2. serverFirst — 넘어가기 한 벌');
  {
    const L = [];
    const fb = async () => { L.push('fb'); return 'F'; };
    let r = await SW.serverFirst('server', async () => { L.push('sv'); return 'S'; }, fb, () => L.push('fail'));
    chk(r.v === 'S' && r.from === 'server' && L.join() === 'sv', '서버에서 받으면 파이어베이스는 안 부른다');
    L.length = 0;
    r = await SW.serverFirst('server', async () => { L.push('sv'); throw new Error('x'); }, fb, (e) => L.push('fail:' + e.message));
    chk(r.v === 'F' && r.from === 'firebase' && L.join() === 'sv,fail:x,fb', '★ 서버가 던지면 — 알리고 파이어베이스');
    L.length = 0;
    r = await SW.serverFirst('server', async () => { L.push('sv'); return SW.SKIP; }, fb, () => L.push('fail'));
    chk(r.v === 'F' && L.join() === 'sv,fb', 'SKIP 이면 알림 없이 파이어베이스(예: 사본 버전이 다름)');
    L.length = 0;
    r = await SW.serverFirst('firebase', async () => { L.push('sv'); return 'S'; }, fb, () => L.push('fail'));
    chk(r.v === 'F' && L.join() === 'fb', '받는 곳이 파이어베이스면 서버를 묻지도 않는다');
    L.length = 0;
    r = await SW.serverFirst('server', null, fb, () => L.push('fail'));
    chk(r.v === 'F' && L.join() === 'fb', '서버 길이 없으면(null) 실패 아님 — 바로 파이어베이스');
    let threw = null;
    try{ await SW.serverFirst('firebase', null, async () => { throw new Error('fb'); }); }catch(e){ threw = e.message; }
    chk(threw === 'fb', '파이어베이스 쪽 오류는 숨기지 않고 그대로 던진다');
    L.length = 0;
    r = await SW.serverFirst('server', async () => null, fb);
    chk(r.v === null && r.from === 'server', '서버가 null 을 돌려줘도 값(빈 값)으로 쓴다 — 넘어가는 건 던짐 · SKIP 뿐');
  }

  say('── 3. createSourceSwitch — 원격 설정에서 읽기');
  {
    const sw = SW.createSourceSwitch({ valueOf: (f) => ({ friends: 'firebase' })[f], legacyOf: (f) => ({ rooms: true })[f] });
    chk(sw.pick('friends') === 'firebase' && sw.pick('rooms') === 'server' && sw.pick('catalog') === 'server', 'pick — 새 칸 · 옛 칸을 deps 로 읽어 고른다');
    const boom = SW.createSourceSwitch({ valueOf: () => { throw new Error('아직'); }, legacyOf: () => { throw new Error('아직'); } });
    chk(boom.pick('friends') === 'server' && boom.pick('rooms') === 'firebase' && boom.pick('catalog') === 'server', '원격 설정을 못 읽으면 기본값(지금 동작)');
    const store = RC.createRemoteConfig();
    const win = { TwRemoteConfig: { store } };
    const W = load(S.SS, 'TwSourceSwitch', win);
    chk(W.store && W.store.pick('friends') === 'server' && W.store.pick('rooms') === 'firebase', '브라우저 한 벌(store) — 원격 설정 기본값이면 친구 서버 · 방 파이어베이스');
    store.apply({ sources: { friends: 'firebase', rooms: 'server' }, roomServer: { on: false } });
    chk(W.store.pick('friends') === 'firebase' && W.store.pick('rooms') === 'server' && W.store.pick('catalog') === 'server', '  ↳ 원격 설정이 바뀌면 다음 pick 부터 그 값(부를 때마다 읽는다)');
    store.apply({ sources: {}, flags: { friendsApi: false }, roomServer: { on: true } });
    chk(W.store.pick('friends') === 'firebase' && W.store.pick('rooms') === 'server', '  ↳ 새 칸이 없으면 옛 칸(flags.friendsApi · roomServer.on)');
  }

  say('── 4. 원격 설정 · 규칙');
  {
    chk(RC.KEYS.includes('sources') && JSON.stringify(RC.DEFAULTS.sources) === JSON.stringify({ friends: null, rooms: null, catalog: null }), '원격 설정 sources 칸 · 기본값 null(옛 스위치)');
    chk(JSON.stringify(RC.cleanSources({ friends: 'server', rooms: 'x', catalog: 'firebase', presence: 'server' })) === JSON.stringify({ friends: 'server', rooms: null, catalog: 'firebase' })
      && JSON.stringify(RC.cleanSources(null)) === JSON.stringify({ friends: null, rooms: null, catalog: null }), '  ↳ 모르는 값 · 모르는 기능은 버린다');
    chk(RC.FALLBACK_PATHS.srcFriends === 'config/sources/friends' && RC.FALLBACK_PATHS.srcRooms === 'config/sources/rooms' && RC.FALLBACK_PATHS.srcCatalog === 'config/sources/catalog',
      '  ↳ API 를 못 받으면 Firebase config/sources/{기능} 한 칸씩');
    chk(JSON.stringify(RC.fieldsOf({ sources: { rooms: 'server' } }).sources) === JSON.stringify({ rooms: 'server' }), '  ↳ GET /v1/config 의 data.sources 를 받는다');
    let R = null; try{ R = JSON.parse(S.RULES).rules.config.sources; }catch(_){}
    const v = R && R.$feature && R.$feature['.validate'] || '';
    const run = (feature, val) => new Function('$feature', 'newData', 'return ' + v.replace(/\$feature\.matches\((\/[^/]+\/)\)/, '$1.test($feature)').replace(/===/g, '==='))(feature, { isString: () => typeof val === 'string', val: () => val });
    chk(!!R && /admins/.test(R['.write'] || '') && R.$feature['.read'] === true, '규칙 config/sources — 관리자 쓰기 · 기능 칸 누구나 읽기');
    chk(run('friends', 'server') && run('rooms', 'firebase') && !run('rooms', 'on') && !run('rooms', true) && !run('Rooms', 'server') && !run('a/b', 'server'),
      '  ↳ 값은 server · firebase 만 · 기능 이름은 소문자');
  }

  say('── 5. 연결 — 받는 곳 고르기는 이 모듈 하나');
  {
    const h = S.HTML;
    const iR = h.indexOf('<script src="parts/shared/remote-config.js"'), iS = h.indexOf('<script src="parts/shared/source-switch.js"'), iA = h.indexOf('<script src="parts/app.js"');
    chk(iR > 0 && iS > iR && iA > iS && /<script type="module" src="parts\/firebase-init\.js">/.test(h), 'html — remote-config.js 다음 · app.js 보다 먼저(firebase-init.js 는 module 이라 classic 이 다 돈 뒤에 돈다)');
    chk(/PRELOAD\.push\('source-switch\.js'\)/.test(S.SMOKE), 'smoke PRELOAD 에 source-switch.js');
    const a = strip(S.APP), fi = strip(S.FI);
    chk(/  source: \(\)=>TwSourceSwitch\.store\.pick\('friends'\),/.test(a) && /  serverFirst: TwSourceSwitch\.serverFirst,/.test(a), '친구 — app.js 가 포트에 pick(friends) · serverFirst 를 넘긴다');
    chk(/pickSource: \(\) => window\.TwSourceSwitch\.store\.pick\('rooms'\),/.test(fi), '방 — firebase-init 이 문지기에 pick(rooms) 를 넘긴다');
    chk(/source: \(\) => window\.TwSourceSwitch\.store\.pick\('catalog'\),/.test(fi) && /serverFirst: window\.TwSourceSwitch\.serverFirst, SKIP: window\.TwSourceSwitch\.SKIP,/.test(fi),
      '카탈로그 — firebase-init 이 본문 받기에 pick(catalog) · serverFirst · SKIP 을 넘긴다');
    chk(/await serverFirst\(source\(\),/.test(strip(S.PORT)) && /await serverFirst\(source\(\), fromApi,/.test(strip(S.CC)) && /if\(!cfg \|\| pickSource\(\) !== 'server'\)/.test(strip(S.GATE)),
      '  ↳ 세 기능 쪽은 받은 답만 쓴다(포트 · 카탈로그는 serverFirst · 문지기는 pickSource)');
    const files = { 'friends-port.js': S.PORT, 'room-server-gate.js': S.GATE, 'catalog-cache.js': S.CC, 'app.js': S.APP, 'firebase-init.js': S.FI };
    const hits = [];
    for(const [f, src] of Object.entries(files)){ const c = strip(src); for(const [name, re] of OUTSIDE) if(re.test(c)) hits.push(f + ': ' + name); }
    chk(!hits.length, '★ 기능 쪽 · 연결 파일이 옛 스위치를 직접 읽거나 고르기를 다시 쓰지 않는다' + (hits.length ? ' — ' + hits.slice(0, 4).join(' / ') : ''));
    const tries = (src) => (strip(src).match(/catch\(e\)\{[^}]*Firebase 로/g) || []).length;
    chk(tries(S.PORT) === 0 && tries(S.CC) === 0, '  ↳ «서버 실패면 Firebase» try/catch 를 따로 두지 않는다(serverFirst 한 벌)');
  }
}

(async () => {
await judge(SRC0);

say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['SS', "  return cleanSource(value) || f.legacy(legacy);", "  return f.legacy(legacy);", '새 자리를 안 봄'],
  ['SS', "  rooms: Object.freeze({ legacy: (v) => (v === true ? SOURCE.SERVER : SOURCE.FIREBASE),", "  rooms: Object.freeze({ legacy: (v) => (v !== false ? SOURCE.SERVER : SOURCE.FIREBASE),", '방 서버가 값이 없어도 켜짐'],
  ['SS', "  catalog: Object.freeze({ legacy: () => SOURCE.SERVER,", "  catalog: Object.freeze({ legacy: () => SOURCE.FIREBASE,", '카탈로그가 서버를 안 씀'],
  ['SS', "  if(!f) return SOURCE.FIREBASE;", "  if(!f) return SOURCE.SERVER;", '모르는 기능을 서버로'],
  ['SS', "      if(v !== SKIP) return { v, from: SOURCE.SERVER };", "      return { v, from: SOURCE.SERVER };", 'SKIP 을 값으로 씀'],
  ['SS', "      if(onFail) onFail(e);", "", '서버 실패를 안 알림'],
  ['SS', "  if(src === SOURCE.SERVER && serverFn){", "  if(serverFn){", '파이어베이스로 골라도 서버를 물음'],
  ['SS', "  const read = (fn, feature) => { try{ return fn(feature); }catch(_){ return undefined; } };", "  const read = (fn, feature) => fn(feature);", '설정을 못 읽으면 던짐'],
  ['RC', "  for(const f of SOURCE_FEATURES) out[f] = (r[f] === 'server' || r[f] === 'firebase') ? r[f] : null;", "  for(const f of SOURCE_FEATURES) out[f] = r[f] || null;", '모르는 값을 그대로 받음'],
  ['RC', " srcRooms: 'config/sources/rooms',", " srcRooms: 'config/sources/room',", 'Firebase 칸 이름이 틀림'],
  ['GATE', "    if(!cfg || pickSource() !== 'server'){", "    if(!cfg || cfg.on !== true){", '문지기가 옛 스위치를 직접 판정'],
  ['APP', "  source: ()=>TwSourceSwitch.store.pick('friends'),", "  source: ()=>{ const s = acctStateMod._rcStore(); return s && s.friendsApi() === false ? 'firebase' : 'server'; },", '친구가 옛 스위치를 직접 읽음'],
  ['CC', "    const r = await serverFirst(source(), fromApi, () => firebaseGet(kind),", "    const r = await serverFirst('server', fromApi, () => firebaseGet(kind),", '카탈로그가 고르기를 건너뜀'],
  ['HTML', '<script src="parts/shared/source-switch.js"></script>', '', 'html 에 안 실음'],
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
