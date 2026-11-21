/* ═══ 🏢 sim-office-mode.js — 데스크탑 · 피규어 · 회사원 모드 깃발(launcher/office-mode.js · app.js 분리 M14) ═══════════════
   ・1절: 깃발 처음 값 — localStorage · desktopMode(companion · ?desktop=1) · 읽는 함수 · 쓰는 함수
   ・2절: 화면 숨김 — ■ 우클릭(회사원 모드가 꺼져 있으면 아무 일 없음) · body 클래스 · 버튼 표시 · 칩 팝업 닫기 · 모드를 끄면 숨김도 풀림
   ・3절: __officeDiag — 상태를 고치지 않고 읽기만
   ・4절: 연결 — html 순서 · 만드는 줄 · 옛 이름 · 읽는 자리 · focusGateSleep 이 만드는 줄 아래
   ・5절: mutation test */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('launcher/office-mode.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }
function mkEl(){ const cl = new Set(); return { title: '', _l: {}, classList: { add: (c) => cl.add(c), remove: (c) => cl.delete(c), contains: (c) => cl.has(c), toggle: (c, on) => { (on ? cl.add(c) : cl.delete(c)); } }, addEventListener(ev, fn){ this._l[ev] = fn; } }; }
function build(src, o){
  o = o || {};
  const store = Object.assign({}, o.store || {});
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const els = {}; ['myStatusChipBtn', 'myStatusMenu', 'progOfficeModeToggle'].forEach(i => { if(!(o.missing || []).includes(i)) els[i] = mkEl(); });
  const body = mkEl();
  const document = { getElementById: (i) => els[i] || null, body };
  const win = { companion: o.companion };
  const closed = [];
  new Function('window', 'document', 'localStorage', 'location', 'console', 'module', src)(win, document, ls, { search: o.search || '' }, { log(){}, warn(){}, error(){} }, undefined);
  const mod = win.TwOfficeMode.createOfficeMode({ chipPopupsMod: { _closeChipPopups: (a, f) => { closed.push([a, f]); if(o.popupThrows) throw new Error('x'); } } });
  return { mod, els, body, win, closed, store };
}
const rc = (b) => { let prevented = 0; b.els.myStatusChipBtn._l.contextmenu({ preventDefault(){ prevented++; }, stopPropagation(){} }); return prevented; };
say('§1 깃발');
{
  let b = build(SRC, {});
  chk(b.mod.figureMode() === false && b.mod.officeMode() === false && b.mod.desktopMode === false, '저장값이 없으면 피규어 · 회사원 모드 꺼짐 · 바깥 브라우저면 desktopMode false');
  b = build(SRC, { store: { 'tw.figureMode': '1', 'tw.officeMode': '1' }, companion: {} });
  chk(b.mod.figureMode() === true && b.mod.officeMode() === true && b.mod.desktopMode === true, '저장값 1 → 켜짐 · window.companion 이 있으면 desktopMode');
  b = build(SRC, { store: { 'tw.officeMode': '0' }, search: '?x=1&desktop=1' });
  chk(b.mod.officeMode() === false && b.mod.desktopMode === true, '?desktop=1 도 desktopMode · 0 은 꺼짐');
  chk(b.mod.FIGURE_MODE_KEY === 'tw.figureMode' && b.mod.OFFICE_MODE_KEY === 'tw.officeMode', '저장 키 이름');
  b.mod.setFigureMode(true); b.mod.setOfficeMode(true);
  chk(b.mod.figureMode() === true && b.mod.officeMode() === true, '쓰는 함수로 바꾼 값을 읽는 함수가 읽는다(값이 굳지 않는다)');
}
say('§2 화면 숨김');
{
  let b = build(SRC, {});
  chk(rc(b) === 1 && !b.body.classList.contains('office-hidden'), '회사원 모드가 꺼져 있으면 우클릭은 기본 메뉴만 막고 아무 일도 없다');
  b = build(SRC, { store: { 'tw.officeMode': '1' } });
  chk(b.els.myStatusChipBtn.title === '상태 (우클릭: 화면 숨기기)', '켜진 채 시작하면 툴팁이 «화면 숨기기» (만들 때 refresh 를 한 번 부른다)');
  rc(b);
  chk(b.body.classList.contains('office-hidden') && b.els.myStatusChipBtn.classList.contains('office-hiding') && b.els.myStatusChipBtn.title === '우클릭: 화면 다시 보이기', '우클릭 → 숨김 · 버튼 전용 클래스 · 툴팁');
  chk(b.closed.length === 1 && b.closed[0][0] === null && b.closed[0][1] === true && b.els.myStatusMenu.classList.contains('hidden'), '숨길 때 칩 팝업(플레이리스트 포함 force)과 상태 메뉴를 닫는다');
  chk(b.mod._officeHidden() === true, '_officeHidden 읽는 함수');
  rc(b);
  chk(!b.body.classList.contains('office-hidden') && b.mod._officeHidden() === false && b.closed.length === 1, '다시 우클릭 → 숨김 풀림(팝업은 또 닫지 않음)');
  rc(b); b.mod.setOfficeMode(false); b.mod.refreshOfficeChipUI();
  chk(b.mod._officeHidden() === false && !b.body.classList.contains('office-hidden') && b.els.myStatusChipBtn.title === '상태', '★ 모드를 끄고 refresh → 숨김도 반드시 풀린다');
  const b2 = build(SRC, { store: { 'tw.officeMode': '1' }, missing: ['myStatusChipBtn'] });
  chk(b2.mod.officeMode() === true, '■ 버튼이 없어도 만들 때 던지지 않는다');
}
say('§3 __officeDiag');
{
  const b = build(SRC, { store: { 'tw.officeMode': '1' } });
  rc(b);
  const d = b.win.__officeDiag();
  chk(d.저장값 === '1' && d.메모리값 === true && d.화면숨김중 === true && d.숨김클래스 === true && d.토글버튼 === true && d.새키쓰기 === true, '저장값 · 메모리값 · 숨김 · 새 키 쓰기 · 토글 버튼을 한 번에 돌려준다');
  chk(!('tw.__probe' in b.store) && b.mod.officeMode() === true, '진단은 상태를 고치지 않는다(탐침 키 지움)');
}
say('§4 연결');
{
  const iM = HTML.indexOf('<script src="parts/launcher/office-mode.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iM > 0 && iA > iM, 'html — office-mode.js 를 app.js 보다 먼저 싣는다');
  const code = stripC(APP);
  const pairs = depPairs(APP, 'officeModeMod', 'TwOfficeMode', 'createOfficeMode');
  chk(!!pairs && pairs.length === 1 && pairs[0].join() === 'chipPopupsMod,chipPopupsMod', 'app.js — 만든다 · deps 는 chipPopupsMod 값 하나');
  chk(['desktopMode', 'FIGURE_MODE_KEY', 'OFFICE_MODE_KEY', 'refreshOfficeChipUI'].every(n => new RegExp('^const ' + n + ' = officeModeMod\\.' + n + ';', 'm').test(code)), '  옛 이름 넷을 const 로 받는다');
  chk(!/^let (figureMode|officeMode|_officeHidden)\b/m.test(code) && !/function setOfficeHidden/.test(code), '  본문 · let 이 app.js 에 안 남음');
  chk((code.match(/officeModeMod\.officeMode\(\)/g) || []).length >= 5 && (code.match(/officeModeMod\.figureMode\(\)/g) || []).length >= 3, '  읽는 자리가 officeModeMod.officeMode() · figureMode() 를 부른다');
  chk(/setOfficeMode: \(v\)=>\{ officeModeMod\.setOfficeMode\(v\); \}/.test(code) && /setFigureMode: \(v\)=>\{ officeModeMod\.setFigureMode\(v\); \}/.test(code), '  쓰는 자리는 setOfficeMode · setFigureMode 로 쓴다');
  const iMk = code.indexOf('const officeModeMod = TwOfficeMode'), iGate = code.indexOf('let focusGateSleep');
  chk(iMk > 0 && iGate > iMk, '★ focusGateSleep(깃발을 최상위에서 읽는 줄)은 만드는 줄 아래에 있다(TDZ)');
}
say('§5 mutation test');
{
  const brk = (a, c) => { const m = SRC.replace(a, c); return m === SRC ? null : m; };
  const m2 = brk("_officeHidden = !!on && officeMode;", "_officeHidden = !!on;");
  chk(!!m2 && (() => { const b = build(m2, {}); b.els.myStatusChipBtn._l.contextmenu({ preventDefault(){}, stopPropagation(){} }); return b.mod._officeHidden() === false; })(), '모드가 꺼져도 숨김이 성립하면 빨강(우클릭 길)');
  const m4 = brk("e.preventDefault(); e.stopPropagation();", "");
  chk(!!m4 && (() => { const b = build(m4, {}); try{ return rc(b) === 0; }catch(_){ return true; } })(), '기본 메뉴를 막지 않으면 빨강');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
