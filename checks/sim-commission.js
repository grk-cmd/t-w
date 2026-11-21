/* ═══ 📦 sim-commission.js — 📦 커미션 zip 풀기 · 암호화 · 💾 저장 책상 · 아이템(savedDesks · savedItems) 모듈 구조 (2026-10-14 신설 · 앱 FSD 45번) ═══════════════
   app.js 의 커미션 · 저장 에셋 구역 본문 을 parts/character/commission.js 로 옮겼다(글자 그대로 · 바뀐 줄 0 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(커미션 · 저장 에셋 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(MAX_COMMISSION_BYTES · MAX_CUSTOM_ASSETS · MAX_CUSTOM_ITEMS · MAX_GLB_BYTES · decryptCommission · encryptCommission · persistSavedAssets · savedDesks · setSavedDesks · savedItems · setSavedItems · unpackCommissionZip)
     만들 때 deps 함수를 되부르지 않는다 — 만드는 도중엔 app.js 의 commissionMod 가 아직 없어(TDZ) 되부른 함수가 던진다(부팅 저장 아이템 등록이 깨졌던 사고)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 4줄 그대로 · 부르는 곳은 commissionMod.이름 · html(app.js 앞)
   ・3절: mutation test — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · commission.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["commission.js","parts/character/commission.js","app/parts/character/commission.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — commission.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_b64","_deriveKey","_unb64","notifyError"];
const VAL_DEPS = ["accountStore"];
const GET_DEPS = [];
const SET_DEPS = [];
const EXPORTS = ["MAX_COMMISSION_BYTES","MAX_CUSTOM_ASSETS","MAX_CUSTOM_ITEMS","MAX_GLB_BYTES","catalogBacked","decryptCommission","encryptCommission","persistSavedAssets","loadLocalDesks","loadLocalItems","resetLocalDesks","resetLocalItems","savedDesks","setSavedDesks","savedItems","setSavedItems","unpackCommissionZip"];
const MOVED = ["MAX_COMMISSION_BYTES","COMMISSION_TEX_SIZE","resizeImgBlobTo","unpackCommissionZip","encryptCommission","decryptCommission","SAVED_DESK_KEY","SAVED_ITEM_KEY","MAX_CUSTOM_ASSETS","MAX_CUSTOM_ITEMS","MAX_GLB_BYTES","savedDesks","savedItems","loadSavedAssets","persistSavedAssets"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  _b64: (...a)=>_b64(...a),","  _deriveKey: (...a)=>_deriveKey(...a),","  _unb64: (...a)=>_unb64(...a),","  notifyError: (...a)=>TwErrorCodes.notify(...a),","  accountStore: accountStoreMod,"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src, over){
  build.called = [];
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => { build.called.push(n); return any; }; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module',
    src + '\nreturn window.TwCommission;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined);
  return api.createCommission(Object.assign(deps, over || {}));
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  const reentry = build.called.slice();
  t(!err && !reentry.length, '만들 때 deps 함수를 되부르지 않는다(만드는 도중엔 commissionMod 가 아직 없다)' + (reentry.length ? ' — ' + reentry.join(' · ') : ''));
  t(!/^\}\);\n(?:\/\*[\s\S]*?\*\/\n)?loadSavedItemsIntoSession\(\);$/m.test(app.slice(app.indexOf('const commissionMod = '))) && /name: 'savedItems',[^\n]*\n    load: \(\)=>\{ commissionMod\.loadLocalItems\(\); return loadSavedItemsIntoSession\(\)/.test(app), 'app.js — 저장 아이템 등록(loadSavedItemsIntoSession)은 만들 때가 아니라 확인 뒤 userLocal 칸(savedItems)에서 부른다');
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwCommission = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwCommission(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("COMMISSION_MOD_OFF") && app.includes("const commissionMod = TwCommission.createCommission({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const commissionMod = TwCommission\\.createCommission\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const commissionMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 commissionMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/commission.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/commission.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 5) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 2-2. 저장 목록 — 카탈로그 몫은 서버가 원본 · 코드로 추가한 몫만 계정 칸(loadLocal · resetLocal · persist)');
function behave(mod){
  const cells = {}; let open = true; const toasts = [];
  const accountStore = { get: (k) => (open && k in cells) ? cells[k] : null, set: (k, v) => { if(!open) return false; cells[k] = String(v); return true; } };
  const m = build(mod, { accountStore, notifyError: (x) => toasts.push(x) });
  const r = {};
  const cat = { id: 'D-cat', fromCatalog: true, glbUrl: 'u', name: '카탈로그 책상' };
  m.setSavedDesks([cat]);   // 구독이 확인보다 먼저 왔다
  cells['tw.savedDesks'] = JSON.stringify([{ id: 'D-cat', fromCatalog: true, name: '옛 사본(덮으면 안 된다)' }, { id: 'D-mine', name: '내 책상', glb: 'AAAA' }]);
  cells['tw.savedItems'] = JSON.stringify([{ id: 'I-mine', name: '내 아이템' }, { id: 'I-old', fromCatalog: true }]);
  (m.loadLocalDesks(), m.loadLocalItems());
  r.load = m.savedDesks().map(d => d.id + ':' + (d.name || '')).join() === 'D-cat:카탈로그 책상,D-mine:내 책상' && m.savedItems().map(d => d.id).join() === 'I-mine';
  m.persistSavedAssets();
  r.persist = JSON.parse(cells['tw.savedDesks']).map(d => d.id).join() === 'D-mine' && JSON.parse(cells['tw.savedItems']).map(d => d.id).join() === 'I-mine' && !toasts.length;   // 카탈로그 몫은 쓰지 않는다
  (m.resetLocalDesks(), m.resetLocalItems());
  r.reset = m.savedDesks().map(d => d.id).join() === 'D-cat' && m.savedItems().length === 0;   // 이 계정 몫만 비운다 · 카탈로그 몫은 그대로
  open = false; m.setSavedDesks([{ id: 'D-x' }]); m.persistSavedAssets();
  r.closedLoud = toasts.length === 1;   // 계정 칸이 닫혀 있으면 조용히 넘기지 않고 알린다
  open = false; cells['tw.savedDesks'] = '[{"id":"Z"}]'; m.setSavedDesks([]); (m.loadLocalDesks(), m.loadLocalItems());
  r.closedRead = m.savedDesks().length === 0;   // 닫힌 칸은 읽기 null — 아무것도 채우지 않는다
  open = true; cells['tw.savedDesks'] = '{깨짐'; m.setSavedDesks([]);
  cells['tw.savedItems'] = '[{"id":"I-ok","name":"x"}]'; m.setSavedItems([]);
  try{ m.loadLocalDesks(); r.corruptThrows = false; }catch(_){ r.corruptThrows = true; }
  m.loadLocalItems(); r.otherCellRead = m.savedItems().map(p => p.id).join() === 'I-ok';   // 책상 칸만 깨져도 아이템 칸은 읽힌다   // 깨진 칸은 던진다 — 빈 목록으로 숨기지 않는다
  return r;
}
{
  const R = behave(MOD);
  chk(R.load, '확인 뒤 읽기 — 카탈로그 몫(구독이 먼저 와 있음)은 덮지 않고 이 계정 몫만 더한다 · 옛 칸에 섞인 카탈로그 사본은 읽지 않는다');
  chk(R.persist, '쓰기 — 이 계정 몫(fromCatalog 아닌 것)만 계정 칸에 쓴다 · 카탈로그 몫은 쓰지 않는다');
  chk(R.reset, '세션이 끝나면 이 계정 몫만 비운다 · 카탈로그 몫은 그대로');
  chk(R.otherCellRead === true, '한 칸(책상)이 깨져도 다른 칸(아이템)은 따로 읽힌다 — 안 읽힌 칸이 빈 목록으로 남아 다음 쓰기가 멀쩡한 칸을 지우지 않는다');
  chk(R.corruptThrows === true, '계정 칸 값이 깨져 있으면 던진다(빈 목록으로 숨기지 않아 다음 쓰기가 계정 몫을 지우지 않는다)');
  chk(R.closedLoud && R.closedRead, '계정 칸이 닫혀 있으면 — 쓰기는 알리고 읽기는 비워 둔다(조용히 옛 값을 쓰지 않는다)');
  const br = (from, to) => MOD.includes(from) ? behave(MOD.replace(from, to)) : null;
  const b1 = br("const have = new Set(cur.map(p=>p.id));\n  return cur.concat(_readLocal(key).filter(p=>!have.has(p.id)));", "return _readLocal(key);");
  chk(b1 && !b1.load, 'mutation test — 로그인 때 읽은 값으로 카탈로그 몫을 덮으면 빨강');
  const b2 = br("JSON.parse(raw).filter(p=>!p.fromCatalog)", "JSON.parse(raw)");
  chk(b2 && !b2.load, 'mutation test — 옛 칸의 카탈로그 사본까지 읽으면 빨강');
  const b3 = br("JSON.stringify(savedDesks.filter(p=>!p.fromCatalog))", "JSON.stringify(savedDesks)");
  chk(b3 && !b3.persist, 'mutation test — 카탈로그 몫까지 계정 칸에 쓰면 빨강');
  const b4 = br("savedDesks = savedDesks.filter(p=>p.fromCatalog);", "savedDesks = [];");
  chk(b4 && !b4.reset, 'mutation test — 세션 끝에 카탈로그 몫까지 비우면 빨강');
}
say('── 3. mutation test — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/commission.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const commissionMod = TwCommission.createCommission({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const commissionMod = TwCommission.createCommission({", "const commissionMod = TwCommission.createCommission({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwCommission = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const commissionMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('commissionMod.' + x)); if(n){ ls[i] = ls[i].replace('commissionMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 deps 를 되부름', m => m.replace('function resetLocalDesks(){', 'notifyError("mutation"); function resetLocalDesks(){'), null, null],
  ['확인 뒤 등록 줄 빠짐', null, a => a.replace('return loadSavedItemsIntoSession(); },', '},'), null],
  ['만들 때 던짐', m => m.replace('function createCommission(deps){', 'function createCommission(deps){ throw new Error("mutation");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
