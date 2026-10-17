/* ═══ 🪑 sim-seat-equalize.js — 🪑 좌석 크기 평준화 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w1) ═══════════════
   app.js 의 좌석 크기 평준화 본문 을 parts/character/seat-equalize.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(sim-seat-eq · sim-char-z 가 app.js 전체로 · 4절이 모듈만으로).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(charLiftWorld · seatEqK · seatEqualizeOn · setSeatEqualizeOn · seatScale · syncSeatEqualize)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 8줄 그대로 · 부르는 곳은 seatEqMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · seat-equalize.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["seat-equalize.js","parts/character/seat-equalize.js","app/parts/character/seat-equalize.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — seat-equalize.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["clampCharY","findMySeat","fitModel","setDeskPos","setDeskScale","syncSeatDeskZ"];
const VAL_DEPS = ["ANIMAL_RUN_SCALE","seats"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["charLiftWorld","seatEqK","seatEqualizeOn","setSeatEqualizeOn","seatScale","syncSeatEqualize"];
const MOVED = ["seatEqualizeOn","seatEqK","seatScale","charLiftWorld","_eqSyncing","syncSeatEqualize"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  ANIMAL_RUN_SCALE: ANIMAL_RUN_SCALE,","  clampCharY: (...a)=>clampCharY(...a),","  findMySeat: (...a)=>findMySeat(...a),","  fitModel: (...a)=>fitModel(...a),","  seats: seats,","  setDeskPos: (...a)=>setDeskPos(...a),","  setDeskScale: (...a)=>setDeskScale(...a),","  syncSeatDeskZ: (...a)=>syncSeatDeskZ(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwSeatEqualize;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createSeatEqualize(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwSeatEqualize = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwSeatEqualize(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("SEAT_EQ_MOD_OFF") && app.includes("const seatEqMod = TwSeatEqualize.createSeatEqualize({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const seatEqMod = TwSeatEqualize\\.createSeatEqualize\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const seatEqMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 seatEqMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/seat-equalize.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/seat-equalize.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/seat-equalize.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const seatEqMod = TwSeatEqualize.createSeatEqualize({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const seatEqMod = TwSeatEqualize.createSeatEqualize({", "const seatEqMod = TwSeatEqualize.createSeatEqualize({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwSeatEqualize = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const seatEqMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('seatEqMod.' + x)); if(n){ ls[i] = ls[i].replace('seatEqMod.' + n, n); return ls.join('\n'); } } return a + '\n' + EXPORTS[0] + '(true);'; }, null],   // app.js 에 부르는 자리가 없으면(다른 모듈만 부른다) 옛 이름 부름을 끼워 본다
  ['만들 때 던짐', m => m.replace('function createSeatEqualize(deps){', 'function createSeatEqualize(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
/* ── 4. 동작 — 가짜 좌석 · 책상으로 배율 k · 실효 크기 · 들림 · 다시 걸기를 본다(옮기기 전 app.js 글로도 같은 판정) */
say('── 4. 동작 — 배율 k · seatScale · charLiftWorld · syncSeatEqualize');
{
  const A = 0.4;
  function mk(store){
    const log = [];
    const seats = [];
    const V = {
      seats, ANIMAL_RUN_SCALE: A,
      findMySeat: () => seats.find(s => s.isMe) || null,
      clampCharY: (y) => Math.max(0, Math.min(0.5, +y || 0)),
      fitModel: (s) => log.push('fit:' + s.n),
      setDeskScale: (d, base, lenX) => { log.push('scale:' + d.n + ':' + base + ':' + lenX); if(V.reenter) api.syncSeatEqualize(); if(V.boom) throw new Error('boom'); },
      setDeskPos: (d, pb) => log.push('pos:' + d.n),
      syncSeatDeskZ: (d) => log.push('z:' + d.n),
    };
    const ls = { getItem: (k) => (k in store ? store[k] : null) };
    let api;
    if(typeof MOD === 'string' && MOD){
      const win = {};
      new Function('window', 'module', 'localStorage', MOD)(win, undefined, ls);
      const deps = {}; for(const k of ['seats', 'ANIMAL_RUN_SCALE', 'findMySeat', 'clampCharY', 'fitModel', 'setDeskScale', 'setDeskPos', 'syncSeatDeskZ']) deps[k] = V[k];
      const m = win.TwSeatEqualize.createSeatEqualize(deps);
      api = { seatEqK: m.seatEqK, seatScale: m.seatScale, charLiftWorld: m.charLiftWorld, syncSeatEqualize: m.syncSeatEqualize, on: (v) => m.setSeatEqualizeOn(v), isOn: () => m.seatEqualizeOn() };
    } else {
      const a = SRC.indexOf('let seatEqualizeOn = false;'), a2 = SRC.indexOf('\n', SRC.indexOf('try{ seatEqualizeOn =', a)) + 1;
      const b = SRC.indexOf('function seatEqK(seat){'), b2 = SRC.indexOf('\n}\n', SRC.indexOf('function syncSeatEqualize(){')) + 3;
      const names = Object.keys(V);
      api = new Function(...names, 'localStorage', SRC.slice(a, a2) + SRC.slice(b, b2) + '\nreturn { seatEqK, seatScale, charLiftWorld, syncSeatEqualize, on: (v) => { seatEqualizeOn = v; }, isOn: () => seatEqualizeOn };')(...names.map(n => V[n]), ls);
    }
    return { api, V, seats, log };
  }
  const desk = (n, o) => Object.assign({ n, userData: {} }, o || {});
  let T = mk({});
  chk(T.api.isOn() === false && mk({ 'tw.seatEq': '1' }).api.isOn() === true && mk({ 'tw.seatEq': '0' }).api.isOn() === false, '깃발 — 기본 꺼짐 · 저장값 tw.seatEq=1 이면 켜짐');
  const me = { n: 'me', isMe: true, userScale: 1.2 }, big = { n: 'big', userScale: 2.4 }, bad = { n: 'bad', userScale: 0 }, nan = { n: 'nan', userScale: NaN };
  T.seats.push(me, big, bad, nan);
  chk(T.api.seatEqK(big) === 1 && T.api.seatScale(big) === 2.4 && T.api.seatScale(bad) === 1 && T.api.seatScale(nan) === 1 && T.api.seatScale(null) === 1, '꺼짐 — k 1 · 실효 크기 = 저장값(0 · NaN · 없음은 1)');
  T.api.on(true);
  chk(T.api.seatEqK(me) === 1 && T.api.seatEqK(null) === 1, '켬 — 내 좌석 · 빈 값은 k 1');
  chk(Math.abs(T.api.seatEqK(big) - 0.5) < 1e-12 && Math.abs(T.api.seatScale(big) - 1.2) < 1e-12, '켬 — k = 내 크기 ÷ 그 좌석 크기(1.2 ÷ 2.4) · 실효 크기는 내 크기');
  chk(Math.abs(T.api.seatEqK(bad) - 1.2) < 1e-12 && Math.abs(T.api.seatScale(bad) - 1.2) < 1e-12, '  저장값이 0 이면 1 로 보고 맞춘다');
  me.userScale = -3; chk(Math.abs(T.api.seatEqK(big) - 1 / 2.4) < 1e-12, '  내 크기가 이상하면 1 로 본다'); me.userScale = 1.2;
  const extra = { n: 'ex', isExtra: true, userScale: 0.6 }; T.seats.push(extra);
  chk(Math.abs(T.api.seatEqK(extra) - 2) < 1e-12, '  자리추가(부캐) 좌석도 맞춘다');
  const T2 = mk({}); T2.api.on(true); const lone = { n: 'l', userScale: 2 }; T2.seats.push(lone);
  chk(T2.api.seatEqK(lone) === 1, '  내 좌석이 없으면 k 1');
  /* 들림 */
  chk(T.api.charLiftWorld(null) === 0, 'charLiftWorld — 빈 값 0');
  const h = { n: 'h', userScale: 2.4, userY: 0.3 }; T.seats.push(h);
  chk(Math.abs(T.api.charLiftWorld(h) - 0.3 * 0.5) < 1e-12, '  사람 — userY × 평준화 k');
  const an = { n: 'an', userScale: 2.4, userY: 0.9, charDef: { animal: true } }; T.seats.push(an);
  chk(Math.abs(T.api.charLiftWorld(an) - 0.5 * A * 0.5) < 1e-12, '  동물 — 높이 상한(clampCharY) × 동물 40% × k');
  T.api.on(false); chk(Math.abs(T.api.charLiftWorld(h) - 0.3) < 1e-12, '  꺼짐 — userY 그대로');
  /* 다시 걸기 */
  const T3 = mk({}); T3.api.on(true);
  const m3 = { n: 'me', isMe: true, userScale: 1 }, s1 = { n: 's1', userScale: 2, bodyWrap: {}, desk: desk('d1', { userData: { deskScaleBase: 0.7, deskLenX: 1.3, deskPosBase: { x: 1 } } }) },
    s2 = { n: 's2', userScale: 4, desk: desk('d2') };
  T3.seats.push(m3, s1, s2);
  T3.api.syncSeatEqualize();
  chk(J3(T3.log) === J3(['scale:d1:0.7:1.3', 'pos:d1', 'z:d1', 'fit:s1', 'z:d2']), 'sync — 배율이 바뀐 좌석만: 책상 배율(기준값 있을 때) · 위치(옮긴 책상만) · 앞뒤(늘) · 캐릭터');
  chk(s1._eqK === 0.5 && s1.desk.userData.eqK === 0.5 && s2.desk.userData.eqK === 0.25 && m3._eqK === 1, '  좌석 · 책상에 k 를 심어 둔다');
  T3.log.length = 0; T3.api.syncSeatEqualize();
  chk(T3.log.length === 0, '  k 가 그대로면 아무것도 안 한다');
  s1._eqK = undefined; T3.V.reenter = true; T3.log.length = 0; T3.api.syncSeatEqualize();
  chk(T3.log.filter(l => l.startsWith('scale:')).length === 1, '  도는 중 다시 불려도(재진입) 한 번만');
  T3.V.reenter = false; s1._eqK = undefined; T3.V.boom = true; let threw = null; try{ T3.api.syncSeatEqualize(); }catch(e){ threw = e; }
  T3.V.boom = false; s1._eqK = undefined; T3.log.length = 0; T3.api.syncSeatEqualize();
  chk(!threw && T3.log.includes('fit:s1'), '  중간에 던져도 삼키고 다음 번엔 다시 돈다(잠금이 풀린다)');
  function J3(x){ return JSON.stringify(x); }
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
