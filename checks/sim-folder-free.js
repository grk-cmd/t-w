/* ═══ 📂 sim-folder-free.js — 마이홈 바탕화면 «폴더 자유배치» (2026-10-09 신설 · 시안 확정) ═══════════════
   요청: 환경 설정에 [폴더 자유배치] — 북마크 · 말랑이 폴더를 자유롭게 놓기.
   ・1절: cleanPos · 비율 ↔ 픽셀 — 모르는 모양은 버림 · 0~1 로 자름 · 상자 밖으로 안 나감
   ・2절: createFolderFree 를 가짜 요소로 실제로 돌림 — 끌기 · 배치 중 클릭 막기 · [완료] 때만 저장 · 처음 자리로 ·
          못 하는 이유(남의 집 · 폴더 숨김) · Esc
   ・3절: myhome-desktop.js 배선 — 저장 · 서버 기록 · 다른 기기 맞춤 · 방문자는 집주인 배치 · 메뉴 · 늦게 생기는 폴더
   ・4절: html — 스크립트 순서
   ⚠️ 실제 화면은 2026-10-09 헤드리스 크로미움에서 확인했다(실제 앱 페이지 — 북마크 · 말랑이 폴더를 끌어 옮김 ·
     배치 중 클릭으로 안 열림 · [완료] 뒤 열림 · 창 크기를 바꿔도 비율 그대로 · 처음 자리로 · 페이지 오류 0).
   [실행] folder-free.js · myhome-desktop.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['folder-free.js', 'myhome-desktop.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }

/* 가짜 window — 모듈이 pointermove · pointerup · keydown 을 여기에 건다 */
function target(){
  const ls = {};
  return { ls,
    addEventListener(t, f, cap){ (ls[t] = ls[t] || []).push({ f, cap: !!cap }); },
    removeEventListener(t, f, cap){ ls[t] = (ls[t] || []).filter(x => !(x.f === f && x.cap === !!cap)); },
    fire(t, e){ (ls[t] || []).slice().forEach(x => x.f(e)); } };
}
const win = target();
new Function('window', 'module', SRC['folder-free.js'])(win, undefined);
const F = win.FolderFree;
const sec = (title, fn) => { say(title); try{ fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + e.message); } };

sec('── 1. 값 다듬기 · 비율', () => {
  const c = F.cleanPos({ bookmark: { x: 0.5, y: 1.7 }, mallang: { x: -1, y: '0.25' }, 'bad id!': { x: 0, y: 0 }, z: { x: 'a', y: 1 }, w: null });
  chk(JSON.stringify(c) === '{"bookmark":{"x":0.5,"y":1},"mallang":{"x":0,"y":0.25}}', '0~1 로 자르고 · 이상한 이름 · 숫자 아님 · 빈 값은 버린다');
  chk(JSON.stringify(F.cleanPos(null)) === '{}' && JSON.stringify(F.cleanPos('x')) === '{}', '모양이 아니면 빈 배치');
  const many = {}; for(let i = 0; i < 30; i++) many['f' + i] = { x: 0.1, y: 0.1 };
  chk(Object.keys(F.cleanPos(many)).length === 12, '폴더는 12개까지만(서버 기록이 커지지 않게)');
  chk(JSON.stringify(F.ratioToPx({ x: 0.5, y: 0.5 }, 400, 200, 66, 50)) === '{"left":200,"top":100}', '비율 → 픽셀');
  chk(JSON.stringify(F.ratioToPx({ x: 1, y: 1 }, 400, 200, 66, 50)) === '{"left":334,"top":150}', '오른쪽 · 아래 끝이어도 폴더가 상자 밖으로 안 나간다');
  const r = F.pxToRatio(100, 50, 400, 200);
  chk(r.x === 0.25 && r.y === 0.25 && F.pxToRatio(5, 5, 0, 0).x === 0, '픽셀 → 비율 · 크기 0 이면 0');
});

/* 가짜 요소 — style · classList · offset · contains */
function el(id, left, top){
  const cls = new Set(), e = { id, style: { left: left + 'px', top: top + 'px' }, offsetWidth: 66, offsetHeight: 50, children: [],
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, v) => (v ? cls.add(c) : cls.delete(c)) },
    contains(t){ return t === e || e.children.indexOf(t) >= 0; }, closest(){ return e; } };
  Object.defineProperty(e, 'offsetLeft', { get: () => parseFloat(e.style.left) || 0 });
  Object.defineProperty(e, 'offsetTop', { get: () => parseFloat(e.style.top) || 0 });
  return e;
}
sec('── 2. 끌기 · 저장', () => {
  const room = Object.assign(target(), { clientWidth: 420, clientHeight: 220 });
  const cls = new Set(); room.classList = { toggle: (c, v) => (v ? cls.add(c) : cls.delete(c)) };
  const bm = el('bm', 12, 14), ml = el('ml', 344, 136), inner = { closest(){ return inner; } };
  ml.children.push(inner);
  let resets = 0, saved = [], toasts = [], why = '', stored = {};
  const items = [{ id: 'bookmark', el: bm, reset(){ resets++; bm.style.left = '12px'; bm.style.top = '14px'; } },
                 { id: 'mallang', el: ml, reset(){ resets++; } }];
  const band = { style: { display: 'none' } };
  const ff = F.createFolderFree({ room: () => room, items: () => items, getPos: () => stored, band, bottomInset: 20,
    canArrange: () => why, toast: (t) => toasts.push(t), onSave: (p) => { saved.push(p); stored = p; } });
  const ev = (o) => Object.assign({ button: 0, preventDefault(){ this.dp = true; }, stopPropagation(){ this.sp = true; } }, o);

  const c0 = ev({ target: inner }); room.fire('click', c0);
  chk(!c0.sp, '배치 중이 아니면 클릭은 그대로 폴더로 간다(열린다)');
  why = '폴더 숨기기가 켜져 있어요 — 먼저 꺼 주세요';
  chk(ff.start() === false && !ff.isArranging() && toasts.pop() === why, '못 하는 때(폴더 숨김 · 남의 집)는 시작하지 않고 이유를 알린다');
  why = '';
  chk(ff.start() === true && ff.isArranging() && band.style.display === 'flex' && cls.has('mhd-ff-arrange'), '[폴더 자유배치] — 안내 띠 · 점선 표시');
  const c1 = ev({ target: inner }); room.fire('click', c1);
  const c2 = ev({ target: inner }); room.fire('contextmenu', c2);
  chk(c1.sp && c1.dp && c2.sp && c2.dp, '배치 중에는 폴더 클릭 · 우클릭을 먼저 막는다(옮기려다 열리지 않게)');
  const cOther = ev({ target: { closest(){ return null; } } }); room.fire('click', cOther);
  chk(!cOther.sp, '폴더가 아닌 곳의 클릭은 막지 않는다');

  room.fire('pointerdown', ev({ target: inner, clientX: 370, clientY: 150 }));
  chk(ml.classList.contains('mhd-ff-drag'), '말랑이 폴더를 집는다');
  win.fire('pointermove', { clientX: 100, clientY: 60 });
  chk(ml.style.left === '74px' && ml.style.top === '46px' && ml.style.right === 'auto', '끄는 만큼 따라온다(오른쪽 · 아래 기준은 풀린다)');
  win.fire('pointermove', { clientX: -900, clientY: 900 });
  chk(ml.style.left === '0px' && ml.style.top === '150px', '상자 밖으로는 안 나간다(아래는 작업표시줄 위까지)');
  win.fire('pointermove', { clientX: 230, clientY: 80 });
  win.fire('pointerup', {});
  chk(!ml.classList.contains('mhd-ff-drag') && saved.length === 0, '놓아도 아직 저장하지 않는다([완료] 때 한 번)');

  ff.finish();
  chk(saved.length === 1 && Math.abs(saved[0].mallang.x - 204 / 420) < 1e-3 && Math.abs(saved[0].mallang.y - 66 / 200) < 1e-3 && !saved[0].bookmark,
    '[완료] — 옮긴 폴더만 비율로 저장(쓰기 한 번)');
  chk(!ff.isArranging() && band.style.display === 'none' && !cls.has('mhd-ff-arrange'), '끝나면 띠 · 점선이 사라진다');
  const c3 = ev({ target: inner }); room.fire('click', c3);
  chk(!c3.sp, '끝난 뒤에는 다시 눌러서 연다');

  room.clientWidth = 300; room.clientHeight = 170; ff.apply();
  chk(ml.style.left === Math.round(saved[0].mallang.x * 300) + 'px' && ml.style.top === Math.round(saved[0].mallang.y * 150) + 'px', '창 크기가 바뀌면 비율대로 다시 놓는다');

  ff.start(); ff.finish();
  chk(saved.length === 1, '안 옮기고 끝내면 저장하지 않는다');
  ff.start(); ff.resetAll();
  chk(resets === 1 && saved.length === 1, '[처음 자리로] — 원래 자리 규칙으로 돌리고 [완료] 전에는 저장 안 함');
  win.fire('keydown', { key: 'Escape', preventDefault(){} });
  chk(!ff.isArranging() && saved.length === 2 && JSON.stringify(saved[1]) === '{}', 'Esc 로 끝내도 저장 — 빈 배치(처음 자리)');
  chk((win.ls.pointermove || []).length === 0 && (room.ls.click || []).length === 0, '끝나면 건 처리기를 모두 뗀다');
});

sec('── 3. myhome-desktop.js 배선', () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
  const M = strip(SRC['myhome-desktop.js']);
  chk(/folderPos:\(typeof FolderFree!=='undefined'\) \? FolderFree\.cleanPos\(d\.folderPos\) : \{\}/.test(M), '로컬 저장값을 다듬어 읽는다');
  chk(/if\(ADV\.folderPos && Object\.keys\(ADV\.folderPos\)\.length\) rec\.folderPos = ADV\.folderPos;/.test(M), '배경과 같은 서버 기록(advBg)에 싣는다 — 방문자 · 다른 기기');
  chk(/const nextPos = \(typeof FolderFree!=='undefined'\) \? FolderFree\.cleanPos\(srv\.folderPos\)/.test(M) && /ADV\.folderPos = nextPos;/.test(M), '다른 기기에서 더 최근에 옮겼으면 그 배치로 맞춘다');
  chk(/onSave:\(pos\)=>\{ ADV\.folderPos = pos; ADV\.bgTs = Date\.now\(\); advSave\(\); advSaveBgRemote\(\); \}/.test(M), '저장 = 고른 시각(bgTs) 찍고 로컬 + 서버');
  chk(/function mhdFfPos\(\)\{ return advVisiting \? \(\(advVisitBg && advVisitBg\.folderPos\) \|\| \{\}\) : \(ADV\.folderPos \|\| \{\}\); \}/.test(M), '남의 집이면 그 집 주인의 배치');
  chk(/canArrange:\(\)=> advVisiting \? '[^']+'\s*: \(ADV\.hideFolders \? '[^']+' : ''\)/.test(M), '남의 집 · 폴더 숨김이면 못 옮긴다');
  chk(/'<button id="advEnvFreeFolders" type="button">폴더 자유배치<\/button>'/.test(M) && /el\('advEnvFreeFolders'\)\.addEventListener\('click', \(\)=>\{[^}]*mhdFF\.toggle\(\);/.test(M), '환경 설정 메뉴 [폴더 자유배치]');
  chk(/document\.getElementById\('mlFolder'\)/.test(M) && /out\.push\(\{ id:a\.id, el:e,/.test(M), '옮길 수 있는 것 = 외부 앱 폴더 + 말랑이 폴더(붙박이 아이콘은 빼고)');
  chk(/new MutationObserver\(\(\)=>mhdFF\.apply\(\)\)\.observe\(room, \{ childList:true \}\)/.test(M) && /d\.appendChild\(ic\);\s*if\(mhdFF\) mhdFF\.apply\(\);/.test(M), '늦게 생기는 폴더(말랑이 · 나중에 붙는 앱)도 옮긴 자리로');
  chk(/new ResizeObserver\(\(\)=>mhdFF\.apply\(\)\)\.observe\(room\)/.test(M), '창 크기가 바뀌면 다시 놓는다');
  chk(/window\._advApplyVisitUI = function\(visiting, ownerId\)\{\s*if\(mhdFF && mhdFF\.isArranging\(\)\) mhdFF\.finish\(\);/.test(M), '옮기던 중에 집을 나가면 내 배치로 저장하고 끝낸다');
  chk(/advBindEvents\(\);\s*mhdFfInit\(\);\s*advApplyBg\(\);/.test(M) && /^let mhdFF = null;/m.test(M), '배경 적용보다 먼저 준비 · 변수는 파일 위에(이른 호출에도 안전)');
  chk(SRC['myhome-desktop.js'].indexOf('북마크') < 0, "myhome-desktop.js 에 '북마크' 글자 없음(sim-bookmark 약속 그대로)");
});

sec('── 4. html', () => {
  const H = SRC['desk-companion-prototype.html'];
  const iF = H.indexOf('<script src="parts/folder-free.js">'), iM = H.indexOf('<script src="parts/myhome-desktop.js">');
  chk(iF > 0 && iF < iM, 'folder-free.js 를 myhome-desktop.js 앞에 싣는다');
});

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
