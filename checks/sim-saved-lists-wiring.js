/* sim-saved-lists-wiring.js — 🗂️ 저장한 책상 · 아이템 · 파츠 세 조각(app.js userLocal 칸)의 읽기 · 비우기 연결
   실행:  node sim-saved-lists-wiring.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 모듈 함수(commission.js · premium-assets.js)는 각자의 sim 이 돌리지만, «세 조각이 칸마다 따로 읽고 · 세션이 끝나면 계정 몫만 비우고 · 아이템은 세션에 등록한 것(customItems)도 지운다» 는
     app.js 쪽 연결은 아무 검사도 돌려 보지 않았다. app.js 의 조각 줄을 그대로 떼어 와 진짜 user-local.js 위에서 돌린다.
   ・1절: 조각 셋(savedDesks · savedItems · savedParts) — start 가 칸마다 따로 읽는다 · 아이템은 읽은 뒤 세션 등록 · 한 칸이 던져도 다른 칸은 읽힌다 · 비동기 등록 실패는 경고(던지지 않음)
   ・2절: 세션이 끝나면 — 계정 몫만 비운다(카탈로그 몫은 남음) · customItems 에서 계정 몫 id 만 지운다(비우기 전에 목록을 보고 지운다 — 순서) · 파츠도 계정 몫만
   ・3절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const APP = read('app.js'), UL = read('launcher/user-local.js');
if (!APP || !UL) { say('  ? 원본 못 찾음 — app.js · launcher/user-local.js'); process.exit(2); }

/* app.js 의 userLocal 조각 목록에서 저장 목록 세 줄만 떼어 온다 */
function pieceSource(app) {
  const parts = (app.match(/const userLocalMod = TwUserLocal\.createUserLocal\(\{ parts: \[([\s\S]*?)\n\] \}\);/) || [])[1];
  if (!parts) return null;
  const i = parts.indexOf("{ name: 'savedDesks'");
  return i < 0 ? null : parts.slice(i);
}

/* 가짜 모듈 — 진짜 commission.js 처럼 비우기가 «계정 몫만 남기고 카탈로그 몫만 둔다» 를 따라 한다(순서가 결과를 바꾸게) */
async function rig(app, o) {
  o = o || {};
  const src = pieceSource(app);
  if (!src) throw new Error('조각 줄을 못 뗌');
  const ev = [];
  const items = [{ id: 'cat', fromCatalog: true }, { id: 'mine' }];
  const customItems = { cat: 1, mine: 1, other: 1 };
  const commissionMod = {
    loadLocalDesks: () => { ev.push('loadDesks'); if (o.desksThrow) throw new Error('깨진 책상 칸'); },
    loadLocalItems: () => { ev.push('loadItems'); },
    resetLocalDesks: () => { ev.push('resetDesks'); },
    resetLocalItems: () => { ev.push('resetItems'); for (let k = items.length - 1; k >= 0; k--) if (!items[k].fromCatalog) items.splice(k, 1); },
    savedItems: () => items,
  };
  const premiumMod = { loadLocal: () => { ev.push('loadParts'); }, resetLocal: () => { ev.push('resetParts'); } };
  const loadSavedItemsIntoSession = () => { ev.push('register'); return o.registerReject ? Promise.reject(new Error('등록 깨짐')) : Promise.resolve(); };
  const pieces = new Function('commissionMod', 'premiumMod', 'customItems', 'loadSavedItemsIntoSession', 'return [' + src.replace(/\n\] \}\);[\s\S]*$/, '') + '];')(commissionMod, premiumMod, customItems, loadSavedItemsIntoSession);
  const w = {}; new Function('window', UL)(w);
  const resets = [];
  const session = { onReset: (f) => resets.push(f) };
  const warns = []; const w0 = console.warn; console.warn = (...a) => warns.push(a.join(' '));
  let mod;
  try { mod = w.TwUserLocal.createUserLocal({ parts: pieces }); mod.start(session); await new Promise((r) => setTimeout(r, 0)); } finally { console.warn = w0; }   // 비동기 등록 실패의 경고까지 잡고 푼다
  return { ev, items, customItems, resets, warns, names: pieces.map((p) => p.name), end: () => { const w1 = console.warn; console.warn = (...a) => warns.push(a.join(' ')); try { resets.forEach((f) => f()); } finally { console.warn = w1; } } };
}

async function judge(app) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let x = await rig(app);
  t(x.names.join() === 'savedDesks,savedItems,savedParts', '조각 셋 — savedDesks · savedItems · savedParts(칸마다 따로)');
  t(x.ev.join() === 'loadDesks,loadItems,register,loadParts', '★ start — 칸마다 따로 읽는다 · 아이템은 읽은 뒤 세션에 등록  [' + x.ev.join(' → ') + ']');
  x = await rig(app, { desksThrow: true });
  t(x.ev.join() === 'loadDesks,loadItems,register,loadParts' && x.warns.some((w) => /savedDesks load 실패/.test(w)), '★ 책상 칸이 깨져 던져도 아이템 · 파츠 칸은 읽힌다(조각이 따로라서) — 경고만 남는다');
  x = await rig(app, { registerReject: true });
  t(x.warns.some((w) => /savedItems load 실패/.test(w)), '아이템 세션 등록이 비동기로 깨져도 던지지 않고 경고한다(user-local 이 받는다)');
  x = await rig(app); x.ev.length = 0; x.end();
  t(x.ev.slice().sort().join() === 'resetDesks,resetItems,resetParts', '★ 세션이 끝나면 세 조각이 각자 비운다  [' + x.ev.join(' → ') + ']');
  t(!('mine' in x.customItems) && 'cat' in x.customItems && 'other' in x.customItems, '★ customItems 는 이 계정 몫 id 만 지운다(카탈로그 · 다른 등록은 남음)');
  t(x.items.length === 1 && x.items[0].id === 'cat', '  비우기 뒤 목록엔 카탈로그 몫만 남는다');
  t(x.ev.indexOf('resetItems') >= 0, '  아이템 비우기 호출됨 — 목록을 비우기 전에 보고 지웠다(순서가 거꾸로면 지울 id 를 못 본다)');
  return r;
}

(async () => {
  say('── 1~2. app.js 의 저장 목록 세 조각을 진짜 user-local 위에서 돌린다');
  (await judge(APP)).forEach(([ok, msg]) => chk(ok, msg));
  say('── 3. 일부러 깨 보기 — 빨강이 나야 한다');
  const breaks = [
    ['세 칸을 한 조각으로 묶음(책상 칸이 깨지면 나머지 안 읽힘)', (m) => m.replace("  { name: 'savedDesks', load: ()=>commissionMod.loadLocalDesks(), reset: ()=>{ commissionMod.resetLocalDesks(); } },\n", '').replace("load: ()=>{ commissionMod.loadLocalItems();", "load: ()=>{ commissionMod.loadLocalDesks(); commissionMod.loadLocalItems();")],
    ['아이템 비우기가 customItems 를 안 지움', (m) => m.replace("commissionMod.savedItems().filter(p=>!p.fromCatalog).forEach(p=>{ delete customItems[p.id]; }); ", '')],
    ['customItems 를 목록 비운 뒤에 지움(순서 거꾸로)', (m) => m.replace("reset: ()=>{ commissionMod.savedItems().filter(p=>!p.fromCatalog).forEach(p=>{ delete customItems[p.id]; }); commissionMod.resetLocalItems(); } },", "reset: ()=>{ commissionMod.resetLocalItems(); commissionMod.savedItems().filter(p=>!p.fromCatalog).forEach(p=>{ delete customItems[p.id]; }); } },")],
    ['customItems 를 통째로 비움(카탈로그 몫까지)', (m) => m.replace("commissionMod.savedItems().filter(p=>!p.fromCatalog).forEach(p=>{ delete customItems[p.id]; });", "Object.keys(customItems).forEach(k=>{ delete customItems[k]; });")],
    ['파츠 조각이 비우지 않음', (m) => m.replace("reset: ()=>premiumMod.resetLocal() },", "reset: ()=>{} },")],
    ['아이템을 읽고 세션에 등록하지 않음', (m) => m.replace('return loadSavedItemsIntoSession(); },', '},')],
  ];
  for (const [name, fm] of breaks) {
    const m2 = fm(APP);
    if (m2 === APP) { chk(false, name + ' — 바꿀 글을 못 찾음'); continue; }
    let red = false;
    try { red = (await judge(m2)).some(([ok]) => !ok); } catch (_) { red = true; }
    chk(red, name);
  }
  say('\n' + (fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
