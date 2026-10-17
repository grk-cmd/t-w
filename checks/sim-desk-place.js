/* ═══ 📐 sim-desk-place.js — 📐 책상 자리 · 크기 모듈 구조 (2026-10-17 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 책상 자리 · 크기 본문 을 parts/character/desk-place.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 순수 계산(z 보정 · 배율) 경계 · 가짜 책상 그룹으로 크기 · 위치 · 핀 상쇄).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(DESK_PART_ANCHOR_NAME · deskPartAnchorOf · setCreatorDeskScale · setDeskPos · setDeskScale · syncDeskPartAnchor · syncSeatDeskZ)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 5줄 그대로 · 부르는 곳은 deskPlaceMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · desk-place.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["desk-place.js","parts/character/desk-place.js","app/parts/character/desk-place.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — desk-place.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = [];
const VAL_DEPS = ["CHAR_Z","DESK_SCALE_DEFAULT","DESK_SCALE_MAX","DESK_SCALE_MIN","crState"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["DESK_PART_ANCHOR_NAME","deskPartAnchorOf","setCreatorDeskScale","setDeskPos","setDeskScale","syncDeskPartAnchor","syncSeatDeskZ"];
const MOVED = ["setDeskScale","CREATOR_DESK_VISUAL_OFFSET","setCreatorDeskScale","DESK_PART_ANCHOR_NAME","syncDeskPartAnchor","deskPartAnchorOf","setDeskPos","seatDeskZCorr","seatDeskPosMul","syncSeatDeskZ"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAR_Z: CHAR_Z,","  DESK_SCALE_DEFAULT: DESK_SCALE_DEFAULT,","  DESK_SCALE_MAX: DESK_SCALE_MAX,","  DESK_SCALE_MIN: DESK_SCALE_MIN,","  crState: crState,"];

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
    src + '\nreturn window.TwDeskPlace;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createDeskPlace(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwDeskPlace = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwDeskPlace(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("DESK_PLACE_MOD_OFF") && app.includes("const deskPlaceMod = TwDeskPlace.createDeskPlace({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const deskPlaceMod = TwDeskPlace\\.createDeskPlace\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const deskPlaceMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 deskPlaceMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/desk-place.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/desk-place.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/desk-place.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const deskPlaceMod = TwDeskPlace.createDeskPlace({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const deskPlaceMod = TwDeskPlace.createDeskPlace({", "const deskPlaceMod = TwDeskPlace.createDeskPlace({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwDeskPlace = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const deskPlaceMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('deskPlaceMod.' + x)); if(n){ ls[i] = ls[i].replace('deskPlaceMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createDeskPlace(deps){', 'function createDeskPlace(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 책상 그룹 위에서 크기 · 위치 · z 보정 · 파츠 핀 상쇄(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 책상 자리 · 크기');
{
  const PREMOVE = !!process.env.TW_PREMOVE;
  const V = () => ({ x: 1, y: 1, z: 1, set(x, y, z){ this.x = x; this.y = y; this.z = z; } });
  const P0 = () => ({ x: 0, y: 0, z: 0, set(x, y, z){ this.x = x; this.y = y; this.z = z; } });
  class Group { constructor(){ this.name = ''; this.children = []; this.userData = {}; this.scale = V(); this.position = P0(); this.parent = null; }
    add(o){ o.parent = this; this.children.push(o); } getObjectByName(n){ for(const c of this.children){ if(c.name === n) return c; const r = c.getObjectByName && c.getObjectByName(n); if(r) return r; } return null; } }
  const THREE_ = { Group };
  const C = { CHAR_Z: 0.47, DESK_SCALE_MIN: 0.05, DESK_SCALE_MAX: 0.3, DESK_SCALE_DEFAULT: 0.175 };
  const mkDesk = (ud) => { const g = new Group(); const a = new Group(); a.name = 'deskAnchor'; g.add(a); g.userData = Object.assign({ deskAnchor: a }, ud || {}); return g; };
  const load = (o) => {
    o = o || {};
    const raw = Object.assign({}, C, { crState: { cDesk: o.cDesk || null, cDeskLenX: o.cDeskLenX } });
    let api;
    if(!PREMOVE){
      const w = {}; new Function('window', 'module', 'THREE', MOD)(w, undefined, THREE_);
      api = w.TwDeskPlace.createDeskPlace(Object.assign({}, raw));
    } else {
      /* 옮기기 전 글 — 가두기(seat-eq-clamp.js 로 먼저 옮김)를 만드는 줄 · seatSlot 줄은 건너뛴다 */
      const a1 = SRC.indexOf('// ★ 어플 3-1: 책상 길이(X축)'), b1 = SRC.indexOf('/* ═══ 📌 책상 위 파츠 앵커', a1);
      const a2 = SRC.indexOf("/* 🪑📌 '책상 위' **파츠**"), b2 = SRC.indexOf('/* 본문은 character/seat-eq-clamp.js', a2);
      const a3 = SRC.indexOf('function syncDeskPartAnchor(', b2), b3 = SRC.indexOf('/* ═══ 📦 복제 코드', a3);
      const names = Object.keys(raw);
      api = new Function(...names, 'THREE', SRC.slice(a1, b1) + '\n' + SRC.slice(a2, b2) + '\n' + SRC.slice(a3, b3) + '\nreturn { setDeskScale, setCreatorDeskScale, setDeskPos, syncSeatDeskZ, syncDeskPartAnchor, deskPartAnchorOf, DESK_PART_ANCHOR_NAME };')(...names.map(n => raw[n]), THREE_);
    }
    return { api, raw };
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  let { api } = load();
  let thr = null; try{ api.setDeskScale(null, 1); api.setDeskPos(null, {}); api.syncSeatDeskZ(null); api.syncDeskPartAnchor(null); }catch(e){ thr = e; }
  chk(!thr && api.deskPartAnchorOf(null) === null && api.deskPartAnchorOf({}) === null, '책상 그룹 · 좌석이 없으면 아무 일 없이 null');
  chk(api.DESK_PART_ANCHOR_NAME === '__deskPartAnchor', '파츠 핀 이름 __deskPartAnchor');

  /* 크기 */
  let g = mkDesk();
  api.setDeskScale(g, 0.2, 1.5);
  chk(near(g.scale.x, 0.3) && near(g.scale.y, 0.2) && g.userData.deskScaleBase === 0.2 && g.userData.deskLenX === 1.5 && near(g.userData.deskAnchor.scale.x, 1 / 1.5), '크기 — 그룹 배율(길이는 x 만) · 원본 크기 · 길이를 기억 · 앵커는 x 를 되돌려 아이템이 안 늘어난다');
  g.userData.animCorr = 0.4; g.userData.eqK = 0.5;
  api.setDeskScale(g);
  chk(near(g.scale.y, 0.2 * 0.4 * 0.5) && g.userData.deskScaleBase === 0.2 && near(g.scale.x, 0.2 * 0.4 * 0.5 * 1.5), '  크기 없이 부르면(평준화 다시 걸기) 기억해 둔 원본 · 길이로 · 원본은 안 덮는다 · 동물 · 평준화 배율을 곱한다');
  g = mkDesk(); api.setDeskScale(g);
  chk(g.scale.y === 1 && g.userData.deskScaleBase === undefined, '  경계 — 처음인데 크기도 없으면 1(원본 기억은 안 함)');
  g = mkDesk(); api.setDeskScale(g, 0);
  chk(g.scale.y === 1 && g.userData.deskScaleBase === 1, '  경계 — 크기 0 은 1 로');
  const cd = mkDesk();
  ({ api } = load({ cDesk: cd, cDeskLenX: 2 }));
  api.setCreatorDeskScale(0.15);
  chk(near(cd.scale.y, 0.15) && near(cd.scale.x, 0.3) && cd.userData.deskLenX === 2, 'setCreatorDeskScale — 생성기 책상(cDesk)에 생성기 길이로(보정 배율 1)');
  api.setCreatorDeskScale(); chk(cd.scale.y === 1, '  경계 — 크기 없으면 1');

  /* 위치 · z 보정 */
  ({ api } = load());
  g = mkDesk(); g.position.z = 9;
  api.syncSeatDeskZ(g);
  chk(g.position.z === 9, 'z 보정 — 원본 위치도 없고 보정도 0(사람 · 평준화 꺼짐)이면 z 를 안 건드린다(생성기 기즈모가 쓴 값 보호)');
  api.setDeskPos(g, { x: 1, y: 2, z: -0.2 });
  chk(g.position.x === 1 && g.position.y === 2 && near(g.position.z, -0.2) && g.userData.deskPosBase.z === -0.2, '위치 — 사람 좌석은 오프셋 그대로');
  g = mkDesk({ animCorr: 0.4, eqK: 0.5 });
  api.setDeskPos(g, { x: 1, y: '2', z: -0.2 });
  const k = 0.2, corr = C.CHAR_Z * (1 - k);
  chk(near(g.position.x, 1 * k) && near(g.position.y, 2 * k) && near(g.position.z, -0.2 * k + corr) && g.userData.deskPosBase.y === 2, '  동물 · 평준화 좌석 — 오프셋에 animCorr × eqK 를 곱하고 z 엔 CHAR_Z·(1 − a·k) 를 더한다(원본엔 안 굽는다)');
  g = mkDesk({ animCorr: 'x', eqK: -3 }); api.setDeskPos(g, { z: 1 });
  chk(g.position.z === 1, '  경계 — 숫자가 아니거나 0 이하인 배율은 1');
  g = mkDesk(); api.setDeskPos(g, null);
  chk(g.position.x === 0 && g.position.z === 0 && g.userData.deskPosBase.x === 0, '  경계 — 위치가 없으면 0');
  g = mkDesk({ animCorr: 0.4 }); g.position.z = 5; api.syncSeatDeskZ(g);
  chk(near(g.position.z, C.CHAR_Z * 0.6), '  원본 위치가 없어도 동물 좌석이면 보정만큼 옮긴다');

  /* 파츠 핀 */
  g = mkDesk();
  const seat = { deskAnchor: g.userData.deskAnchor };
  const pin = api.deskPartAnchorOf(seat);
  chk(pin && pin.name === '__deskPartAnchor' && pin.parent === g.userData.deskAnchor && api.deskPartAnchorOf(seat) === pin, '핀 — 처음 부르면 앵커 밑에 만들고 다음엔 같은 것');
  chk(pin.scale.x === 1 && pin.position.x === 0, '  책상을 안 옮기고 크기도 모르면 핀은 제자리 · 배율 1');
  api.setDeskScale(g, 0.0875);
  chk(near(pin.scale.x, 2), '  슬라이더를 기본(0.175)의 절반으로 → 핀 배율 2(파츠는 기본 크기 유지)');
  api.setDeskScale(g, 1);
  chk(pin.scale.x === 1, '  경계 — 슬라이더 범위 밖(1 = «모름») 이면 상쇄 안 함');
  api.setDeskScale(g, 0.3);
  chk(near(pin.scale.x, 0.175 / 0.3), '  경계 — 범위 끝(0.3)은 상쇄');
  g.userData.animCorr = 0.4;
  api.setDeskScale(g, 0.175, 2);
  api.setDeskPos(g, { x: 0.5, y: 0, z: -0.2 });
  const s = 0.175 * 0.4, kk = 0.4;
  chk(near(pin.position.x, -(0.5 * kk) / (s * 2 * 0.5)) && near(pin.position.z, -(-0.2 * kk) / s) && near(pin.scale.x, 1), '  위치 상쇄 = −(오프셋 × 배율) ÷ (그룹 배율 × 앵커 배율) — 파츠가 책상을 따라 움직이지 않는다');

}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
