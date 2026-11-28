/* ═══ 🪑 sim-interaction-desk.js — 🪑 상호작용 책상 카탈로그(INTERACTION_DESKS) 모듈 구조 (2026-10-14 신설 · 앱 FSD 43번) ═══════════════
   app.js 의 상호작용 책상 카탈로그 구역 본문 을 parts/room/interaction-desk.js 로 옮겼다(글자 그대로 · 바뀐 줄 10 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(상호작용 책상 카탈로그 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(DANCE_MOVES · IDESK_ENABLED · INTERACTION_DESKS · TRICK_IN_S · TRICK_SPIN_S · TRICK_TURBO_STYLE · _danceCmdCooldownAt · setDanceCmdCooldownAt · _deskDefById · _lowestDanceReq · _parseDanceCmdChain · _pickUnlockedDance · _rideDenyToastAt · setRideDenyToastAt · _trickArmBase · _trickArmSpread · _trickEaseIn · _trickLegPose · _trickTurns · findRideTarget · getActiveInteractionDeskId · isDanceUnlocked · isDeskUnlocked · unlockGate · setActiveInteractionDeskId · startMyDance)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 14줄 그대로 · 부르는 곳은 iDeskMod.이름 · html(app.js 앞)
   ・3절: mutation test — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · interaction-desk.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["interaction-desk.js","parts/room/interaction-desk.js","app/parts/room/interaction-desk.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — interaction-desk.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["toast"];
const VAL_DEPS = ["accountStore","CIRCUS_ARM_DROP","CIRCUS_LEG_LIFT","CIRCUS_LEG_STAND","RIDE_MAX_STACK","RIDE_SNAP_DIST","_rideTmp","_rideWP","rideBenchMod","seats","tricksMod"];
const GET_DEPS = ["Presence","focusLevelMod","isAdmin"];
const SET_DEPS = [];
const EXPORTS = ["DANCE_MOVES","IDESK_ENABLED","INTERACTION_DESKS","TRICK_IN_S","TRICK_SPIN_S","TRICK_TURBO_STYLE","_danceCmdCooldownAt","setDanceCmdCooldownAt","_deskDefById","_lowestDanceReq","_parseDanceCmdChain","_pickUnlockedDance","_rideDenyToastAt","setRideDenyToastAt","_trickArmBase","_trickArmSpread","_trickEaseIn","_trickLegPose","_trickTurns","findRideTarget","getActiveInteractionDeskId","isDanceUnlocked","isDeskUnlocked","unlockGate","applyUnlocks","levelText","lockedToast","setActiveInteractionDeskId","startMyDance"];
const MOVED = ["INTERACTION_DESKS","IDESK_ENABLED","DANCE_MOVES","TRICK_IN_S","TRICK_SPIN_S","TRICK_OUT_S","TRICK_TURNS","TRICK_TURBO_STYLE","TRICK_TURBO_MULT","_trickTurns","TRICK_LEG_SIDE","TRICK_ARM_LIFT","TRICK_ARM_SPREAD","_trickArmBase","_trickArmSpread","_trickEaseIn","_trickLegPose","_danceByCmd","_parseDanceCmdChain","_danceCmdCooldownAt","isDanceUnlocked","_pickUnlockedDance","_lowestDanceReq","startMyDance","_deskDefById","isDeskUnlocked","ACTIVE_IDESK_KEY","getActiveInteractionDeskId","setActiveInteractionDeskId","_rideDenyToastAt","findRideTarget"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  accountStore: accountStoreMod,","  CIRCUS_ARM_DROP: CIRCUS_ARM_DROP,","  CIRCUS_LEG_LIFT: CIRCUS_LEG_LIFT,","  CIRCUS_LEG_STAND: CIRCUS_LEG_STAND,","  Presence: ()=>Presence,","  RIDE_MAX_STACK: RIDE_MAX_STACK,","  RIDE_SNAP_DIST: RIDE_SNAP_DIST,","  _rideTmp: _rideTmp,","  _rideWP: _rideWP,","  focusLevelMod: ()=>focusLevelMod,","  isAdmin: ()=>isAdmin,","  rideBenchMod: rideBenchMod,","  seats: seats,","  toast: (...a)=>toast(...a),","  tricksMod: tricksMod,"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src, over){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwInteractionDesk;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createInteractionDesk(Object.assign(deps, over || {}));
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwInteractionDesk = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwInteractionDesk(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("I_DESK_MOD_OFF") && app.includes("const iDeskMod = TwInteractionDesk.createInteractionDesk({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const iDeskMod = TwInteractionDesk\\.createInteractionDesk\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const iDeskMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 iDeskMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/room/interaction-desk.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/room/interaction-desk.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. mutation test — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/room/interaction-desk.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const iDeskMod = TwInteractionDesk.createInteractionDesk({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const iDeskMod = TwInteractionDesk.createInteractionDesk({", "const iDeskMod = TwInteractionDesk.createInteractionDesk({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwInteractionDesk = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const iDeskMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('iDeskMod.' + x)); if(n){ ls[i] = ls[i].replace('iDeskMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createInteractionDesk(deps){', 'function createInteractionDesk(deps){ throw new Error("mutation");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('── 4. 해금 레벨 — 서버 해금 표(applyUnlocks)가 원본');
function unlockBehave(mod){
  const st = { lv: 100, admin: false };
  /* focus-level.js 의 약속 그대로 — 모르면 null · levelGate 는 'unknown'(sim-focus-level 이 본다) */
  const d = build(mod, { isAdmin: () => st.admin, focusLevelMod: () => ({ getFocusLevel: () => st.lv, levelGate: (min) => (st.lv == null ? 'unknown' : st.lv >= min ? 'ok' : 'low') }) });
  const dance = (cmd) => d.DANCE_MOVES.find((m) => m.cmd === cmd), desk = d.INTERACTION_DESKS[0];
  const txt = (v) => [d.lockedToast(v, '달성 시 사용할 수 있어요'), d.levelText(v)].join('|');
  const unknown = txt(null) === '🔒 해금 정보를 받는 중이에요 — 잠시 뒤 다시 해 주세요|Lv.?' && d._lowestDanceReq() === null && !/Infinity|null|undefined|NaN/.test(txt(d._lowestDanceReq()) + txt(desk.reqLevel));
  const before = unknown && d.isDanceUnlocked(dance('80')) === false && d.isDeskUnlocked(desk) === false && d._pickUnlockedDance(() => 0) === null;
  st.admin = true; const adm = d.isDanceUnlocked(dance('80')) === true; st.admin = false;
  d.applyUnlocks({ DANCE: { '80': { level: 90 }, '150': { level: 200 } }, INTERACTION_DESK: { bench2: { level: 60 } } });
  const after = dance('80').reqLevel === 90 && dance('150').reqLevel === 200 && desk.reqLevel === 60 && d.isDanceUnlocked(dance('80')) === true && d.isDanceUnlocked(dance('150')) === false && d.isDeskUnlocked(desk) === true && d._lowestDanceReq() === 90 && d.lockedToast(90, '달성 시 해금돼요') === '🔒 Lv.90 달성 시 해금돼요' && d.levelText(60) === 'Lv.60';
  d.applyUnlocks({ DANCE: { '80': { level: 120 } }, INTERACTION_DESK: {} });
  const again = dance('80').reqLevel === 120 && d.isDanceUnlocked(dance('80')) === false && dance('150').reqLevel === 200 && desk.reqLevel === 60;
  /* 내 레벨을 모름(B-1128-2) — 'unknown' 으로 가른다(«Lv.N 필요» 가 아니다) · 관리자는 그대로 열림 · 받으면 원래대로 */
  st.lv = null;
  const unk = d.unlockGate(dance('80')) === 'unknown' && d.unlockGate(desk) === 'unknown' && d.isDanceUnlocked(dance('80')) === false && d.isDeskUnlocked(desk) === false && d._pickUnlockedDance(() => 0) === null
    && d.unlockGate({ reqLevel: null }) === 'unknown';
  st.admin = true; const unkAdm = d.unlockGate(dance('80')) === 'ok'; st.admin = false;
  st.lv = 100; const back = d.unlockGate(dance('80')) === 'low' && d.unlockGate(desk) === 'ok' && d.unlockGate({ reqLevel: null }) === 'low';
  return { before, adm, after, again, unk: unk && unkAdm && back };
}
{
  const R = unlockBehave(MOD);
  chk(R.before && R.adm, '★ 서버 해금 표를 받기 전에는 춤 · 책상이 잠기고(관리자는 늘 열림) 안내 글에 Infinity · null 이 없다(«해금 정보를 받는 중») — 코드에 박힌 레벨이 없다');
  chk(R.after && R.again, '★ 서버 표의 레벨이 그대로 앉는다(웹 관리자가 고친 값) · 다시 받으면 다시 앉는다 · 표에 없는 줄은 앉히지 않는다');
  chk(!/reqLevel:\s*\d/.test(strip(MOD)), '  코드에 박힌 숫자 reqLevel 이 없다');
  chk(R.unk, '★ 내 레벨을 모르면(B-1128-2) unlockGate 는 unknown — 잠금 안내(«Lv.N 필요») 대신 «불러오지 못함» 길로 · 관리자는 열림 · 레벨을 받으면 ok · low 그대로');
  const badU = unlockBehave(MOD.replace("  return focusLevelMod().levelGate(def.reqLevel);", "  return focusLevelMod().levelGate(def.reqLevel) === 'ok' ? 'ok' : 'low';"));
  chk(!badU.unk, 'mutation test — 레벨 모름을 low(잠김)로 뭉개면 빨강');
  const bad = unlockBehave(MOD.replace("  if(def.reqLevel == null) return focusLevelMod().getFocusLevel() == null ? 'unknown' : 'low';   // 서버 해금 표를 아직 못 받았다 — 잠가 둔다\n", "").replace("levelGate(def.reqLevel);", "levelGate(def.reqLevel || 1);"));
  chk(!bad.before, 'mutation test — 받기 전에 열려 있으면 빨강');
  const bad2 = unlockBehave(MOD.replace("return (level == null) ? '🔒 해금 정보를 받는 중이에요 — 잠시 뒤 다시 해 주세요' : '🔒 Lv.' + level + ' ' + tail;", "return '🔒 Lv.' + level + ' ' + tail;"));
  chk(!bad2.before, 'mutation test — 모를 때 레벨 글자를 지어내면(Lv.null) 빨강');
  const bad3 = unlockBehave(MOD.replace("d.reqLevel == null ? m : (m == null ? d.reqLevel : Math.min(m, d.reqLevel)), null);", "d.reqLevel == null ? m : Math.min(m, d.reqLevel), Infinity);"));
  chk(!bad3.before, 'mutation test — 못 받았을 때 Infinity 를 돌려주면 빨강');
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
