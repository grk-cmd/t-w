/* sim-source-switch.js — 🎚️ 기능별 받는 곳(shared/source-switch.js) 검사 — 0.13 «한 길만 돌려주는» 얇은 자리
   ・1절: pickSource — 고정 표(옛 판의 «스위치 칸 없음» 기본값과 같음) · 모르는 기능은 파이어베이스 · 원격 설정을 읽지 않는다
   ・2절: serverFirst — 서버 먼저 · 던지면 알리고 파이어베이스 · SKIP 이면 조용히 파이어베이스 · 서버 길 없음 · 파이어베이스 오류는 그대로
   ・3절: 연결 — html 싣는 차례 · 친구 · 방 · 카탈로그 · 가챠가 이 모듈만 쓴다(옛 스위치를 직접 읽거나 넘어가기를 따로 쓰면 빨강)
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false, qfail = 0;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) qfail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find((v) => v != null);
const at = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f];
const SRC0 = {
  SS: pick(at('source-switch.js', 'shared')),
  PORT: pick(at('friends-port.js', 'friends')),
  ROOMRT: pick(at('room-rt.js', 'room')),
  CC: pick(at('catalog-cache.js', 'character')),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(SRC0)) if(!SRC0[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const load = (src, name, win) => { const w = win || {}; new Function('window', 'module', 'console', src)(w, undefined, { warn(){}, log(){} }); return w[name]; };

/* 받는 곳을 고르는 판단 · 넘어가기를 이 모듈 밖에서 다시 쓰는 글 — 기능 쪽 파일에 있으면 빨강 */
const OUTSIDE = [
  ['옛 친구 스위치를 직접 읽음', /\bfriendsApi\(\)/],
  ['옛 방 서버 스위치를 직접 판정', /\bcfg\.on\s*[!=]==\s*true|roomServer\(\)\.on\b/],
  ['스위치 칸을 직접 읽음', /\bsources\(\)|config\/sources/],
  ['옛 친구 고르기 함수', /\bpickListSource\b/],
];

async function judge(S){
  let SW = null;
  try{ SW = load(S.SS, 'TwSourceSwitch'); }catch(e){ chk(false, '싣다 던짐 — ' + e.message); return; }
  chk(!!(SW && SW.pickSource && SW.serverFirst && SW.SKIP && SW.store && SW.store.pick && SW.store.serverFirst), '전역 이름 TwSourceSwitch — pickSource · serverFirst · SKIP · store');
  if(!SW) return;

  say('── 1. pickSource — 고정 표');
  {
    const P = SW.pickSource;
    chk(P('friends') === 'server' && P('catalog') === 'server' && P('gacha') === 'firebase',
      '★ 친구 서버 먼저 · 카탈로그 서버 먼저 · 가챠 앱이 뽑기 — 옛 판의 «스위치 칸 없음» 기본값과 같다');
    chk(P('rooms') === 'firebase', '  ↳ 방은 표에 없다(방은 room-rt.js 방 포트 하나 — 고르지 않는다) — 물어도 파이어베이스');
    chk(P('presence') === 'firebase' && P(undefined) === 'firebase' && P('toString') === 'firebase' && P('__proto__') === 'firebase', '모르는 기능은 파이어베이스(물려받은 이름에도 속지 않음)');
    chk(JSON.stringify(Object.keys(SW.ONE_WAY)) === JSON.stringify(['friends', 'catalog', 'gacha']) && Object.isFrozen(SW.ONE_WAY), '표 — friends · catalog · gacha · 바꿀 수 없다');
    chk(SW.store.pick === SW.pickSource && SW.store.serverFirst === SW.serverFirst, 'store — 같은 두 함수(부르는 쪽 줄은 그대로)');
    chk(!/TwRemoteConfig|sources\(|friendsApi|roomServer/.test(strip(S.SS)), '원격 설정 · 옛 스위치를 읽지 않는다(0.13 설정에 칸이 없다)');
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
    r = await SW.serverFirst('server', async () => null, fb);
    chk(r.v === null && r.from === 'server', '서버가 null 을 돌려줘도 값(빈 값)으로 쓴다 — 넘어가는 건 던짐 · SKIP 뿐');
  }

  say('── 3. 연결 — 받는 곳 고르기는 이 모듈 하나');
  {
    const h = S.HTML;
    const iS = h.indexOf('<script src="parts/shared/source-switch.js"'), iA = h.indexOf('<script src="parts/app.js"');
    chk(iS > 0 && iA > iS && /<script type="module" src="parts\/firebase-init\.js">/.test(h), 'html — app.js 보다 먼저(firebase-init.js 는 module 이라 classic 이 다 돈 뒤에 돈다)');
    const a = strip(S.APP), fi = strip(S.FI);
    chk(/  source: \(\)=>TwSourceSwitch\.store\.pick\('friends'\),/.test(a) && /  serverFirst: TwSourceSwitch\.serverFirst,/.test(a), '친구 — app.js 가 포트에 pick(friends) · serverFirst 를 넘긴다');
    chk(/gachaSource: \(\)=>TwSourceSwitch\.store\.pick\('gacha'\),/.test(a), '가챠 — app.js 가 pick(gacha) 를 넘긴다');
    chk(!/pick\('rooms'\)/.test(fi) && !/pick\('rooms'\)/.test(a), '방 — 고르지 않는다(방 포트 하나)');
    chk(/source: \(\) => window\.TwSourceSwitch\.store\.pick\('catalog'\),/.test(fi) && /serverFirst: window\.TwSourceSwitch\.serverFirst, SKIP: window\.TwSourceSwitch\.SKIP,/.test(fi),
      '카탈로그 — firebase-init 이 본문 받기에 pick(catalog) · serverFirst · SKIP 을 넘긴다');
    chk(/await serverFirst\(source\(\),/.test(strip(S.PORT)) && /await serverFirst\(source\(\), fromApi,/.test(strip(S.CC)),
      '  ↳ 포트 · 카탈로그는 받은 답만 쓴다(serverFirst)');
    const files = { 'friends-port.js': S.PORT, 'room-rt.js': S.ROOMRT, 'catalog-cache.js': S.CC, 'app.js': S.APP, 'firebase-init.js': S.FI };
    const hits = [];
    for(const [f, src] of Object.entries(files)){ const c = strip(src); for(const [name, re] of OUTSIDE) if(re.test(c)) hits.push(f + ': ' + name); }
    chk(!hits.length, '★ 기능 쪽 · 연결 파일이 옛 스위치를 직접 읽거나 고르기를 다시 쓰지 않는다' + (hits.length ? ' — ' + hits.slice(0, 4).join(' / ') : ''));
    const tries = (src) => (strip(src).match(/catch\(e\)\{[^}]*Firebase 로/g) || []).length;
    chk(tries(S.PORT) === 0 && tries(S.CC) === 0, '  ↳ «서버 실패면 Firebase» try/catch 를 따로 두지 않는다(serverFirst 한 벌)');
  }
}

(async () => {
await judge(SRC0);

say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const BREAKS = [
  ['SS', "  gacha: SOURCE.FIREBASE,", "  gacha: SOURCE.SERVER,", '가챠를 서버 뽑기로(서버 응답 모양이 바뀜)'],
  ['SS', "  catalog: SOURCE.SERVER,", "  catalog: SOURCE.FIREBASE,", '카탈로그가 서버를 안 씀'],
  ['SS', "  return Object.prototype.hasOwnProperty.call(ONE_WAY, feature) ? ONE_WAY[feature] : SOURCE.FIREBASE;", "  return ONE_WAY[feature] || SOURCE.SERVER;", '모르는 기능을 서버로'],
  ['SS', "      if(v !== SKIP) return { v, from: SOURCE.SERVER };", "      return { v, from: SOURCE.SERVER };", 'SKIP 을 값으로 씀'],
  ['SS', "      if(onFail) onFail(e);", "", '서버 실패를 안 알림'],
  ['SS', "  if(src === SOURCE.SERVER && serverFn){", "  if(serverFn){", '파이어베이스로 골라도 서버를 물음'],
  ['APP', "  source: ()=>TwSourceSwitch.store.pick('friends'),", "  source: ()=>{ const s = acctStateMod._rcStore(); return s && s.friendsApi() === false ? 'firebase' : 'server'; },", '친구가 옛 스위치를 직접 읽음'],
  ['CC', "    const r = await serverFirst(source(), fromApi, () => firebaseGet(kind),", "    const r = await serverFirst('server', fromApi, () => firebaseGet(kind),", '카탈로그가 고르기를 건너뜀'],
  ['HTML', '<script src="parts/shared/source-switch.js"', '<script src="parts/shared/source-switch-x.js"', 'html 에 안 실음'],
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
