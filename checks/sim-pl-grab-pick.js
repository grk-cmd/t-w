/* sim-pl-grab-pick.js — 📥 담기: 담을 프리셋을 그 자리에서 고른다
   · 버튼을 누르면 프리셋 세 줄이 작은 드롭메뉴로 뜬다.
   · 못 담는 줄(꽉 참·이미 담김)은 흐리게, 클릭은 막는다.
   · 고르면 그 프리셋으로 들어가고 메뉴는 닫힌다. 보고 있던 프리셋(_plCur)은 안 바뀐다.
   실행: node sim-pl-grab-pick.js  (app.js · smoke.js 와 같은 폴더에서) */
'use strict';
const fs = require('fs'), vm = require('vm');

let smokeSrc = fs.readFileSync('smoke.js', 'utf8');
const cut = smokeSrc.indexOf('/* ── 실행');
smokeSrc = smokeSrc.slice(0, cut).split('\n')
  .filter(l => !/require\(|const FILE =|if \(!FILE\)|process\.exit/.test(l)).join('\n');
vm.runInThisContext(smokeSrc, { filename: 'smoke-stubs.js' });

globalThis.setTimeout = (fn)=>0;
globalThis.setInterval = () => 0;
globalThis.clearInterval = () => {};

const probe = `
;globalThis.__P = {
  MAX: PL_MAX, SETS: PL_SETS,
  sets: ()=>_plSets,
  label: k=>_plSetLabel(k),
  items: k=>_plSetItems(k),
  block: (k, it)=>_plGrabBlock(k, it),
  grabTo: k=>_plGrabTo(k),
  open: btn=>_plOpenGrabPick(btn),
  close: ()=>_plCloseGrabPick(),
  cur: ()=>_plCur,
  setCur: k=>{ _plCur = k; },
  setView: v=>{ _plView = v; },
  setSel: i=>{ _plSel = i; },
  song: ()=>_plGrabSong(),
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
let toasts = [];
globalThis.toast = m => toasts.push(String(m));

/* 진짜 자식을 기억하는 요소로 갈아끼운다 — 원본 stub 의 appendChild 는 아무것도 안 남긴다 */
const realCreate = document.createElement;
document.createElement = tag => {
  const n = realCreate(tag);
  n.kids = [];
  n.appendChild = c => { n.kids.push(c); return c; };
  n.style.cssText = '';
  n.className = '';
  return n;
};
let mounted = [];
document.body.appendChild = n => { mounted.push(n); return n; };
document.querySelectorAll = () => mounted.splice(0, mounted.length).map(n => ({ remove(){} })) && [];

/* 남의 목록(파도타기) 상황을 만든다 */
const songs = n => Array.from({length:n}, (_, i)=>({ id:'vid'+i, title:'곡 '+i }));
function stage(mine){
  const sets = P.sets();
  for(let k = 0; k < P.SETS; k++){ sets[k].name = ''; sets[k].items = (mine[k] || []).slice(); }
  P.setCur(0);
  P.setView({ items: songs(5), name:'민서님의 목록' });
  P.setSel(1);
  mounted = []; toasts = [];
}
const menuRows = ()=>{
  const menu = mounted.find(n => String(n.className||'').indexOf('pl-grab-ctx') >= 0);
  return menu ? menu.kids : null;
};
const rowText = r => r.kids.map(k => k.textContent).join(' ');
const btn = { getBoundingClientRect: ()=>({ top:100, bottom:120, left:50, right:200, width:150, height:20 }) };

say('\n── 1. 버튼을 누르면 프리셋 줄이 뜬다');
{
  stage([[], [], []]);
  P.open(btn);
  const rows = menuRows();
  chk(!!rows, '메뉴가 화면에 붙는다');
  chk(rows.length === P.SETS, '프리셋 수만큼 줄이 있다 (' + (rows||[]).length + '줄)');
  chk(rowText(rows[0]).indexOf('●') >= 0, '보고 있던 프리셋에는 ● 표식');
  chk(rowText(rows[1]).indexOf('2') >= 0, '나머지는 번호');
  chk(rowText(rows[0]).indexOf('0/' + P.MAX) >= 0, '곡 수가 n/' + P.MAX + ' 로 보인다');
  const menu = mounted.find(n => String(n.className||'').indexOf('pl-grab-ctx') >= 0);
  chk(String(menu.className).indexOf('cr-preset-ctx') >= 0,
      '★ 클래스가 cr-preset-ctx 다 — 클릭 통과 화이트리스트에 이미 있는 이름이어야 한다');
  chk(!!mounted.find(n => String(n.className||'').indexOf('seat-ctx-backdrop') >= 0),
      '★ 투명 뒷판도 같이 깔린다 — 없으면 바깥 클릭으로 안 닫힌다');
}

say('\n── 2. 고르면 그 프리셋에 담긴다');
{
  stage([[], [], []]);
  P.open(btn);
  const rows = menuRows();
  chk(typeof rows[1].onclick === 'function', '빈 프리셋 줄은 눌린다');
  rows[1].onclick({ stopPropagation(){} });
  chk(P.items(1).length === 1, '2번 프리셋에 한 곡 들어갔다');
  chk(P.items(1)[0].id === 'vid1', '고른 행의 곡이다');
  chk(P.items(0).length === 0 && P.items(2).length === 0, '다른 프리셋은 그대로');
  chk(P.items(1)[0].url.indexOf('vid1') >= 0, 'url 도 함께 만들어진다');
  chk(toasts.some(t => t.indexOf('담았어요') >= 0), '결과를 토스트로 알린다');
}

say('\n── 3. 담아도 보고 있던 프리셋은 안 바뀐다');
{
  stage([[], [], []]);
  P.setCur(0);
  P.grabTo(2);
  chk(P.cur() === 0, '★ _plCur 은 0 그대로 — 담기는 복사지 이동이 아니다');
  chk(P.items(2).length === 1, '담긴 곳은 3번 프리셋');
}

say('\n── 4. 하나 담으면 메뉴가 닫힌다');
{
  stage([[], [], []]);
  P.open(btn);
  chk(!!menuRows(), '열려 있다');
  const rows = menuRows();
  mounted = [];                     // remove() 가 불렸는지 보려고 화면을 비운다
  rows[0].onclick({ stopPropagation(){} });
  chk(!menuRows(), '고른 뒤에는 메뉴가 남아 있지 않다');
}

say('\n── 5. 이미 담긴 곳은 흐리게, 클릭 막기');
{
  stage([[{ id:'vid1', title:'곡 1' }], [], []]);
  P.open(btn);
  const rows = menuRows();
  chk(rowText(rows[0]).indexOf('이미') >= 0, '이유가 줄 안에 적힌다 (' + rowText(rows[0]).trim() + ')');
  chk(typeof rows[0].onclick !== 'function', '★ 클릭이 아예 안 걸린다');
  chk(String(rows[0].className).indexOf('off') >= 0, '.off 가 붙는다 — 흐리게·커서 기본은 CSS 가 맡는다');
  chk(String(rows[1].className).indexOf('off') < 0, '멀쩡한 줄에는 안 붙는다');
  chk(typeof rows[1].onclick === 'function', '멀쩡한 줄은 그대로 눌린다');
}

say('\n── 6. 꽉 찬 곳도 마찬가지');
{
  stage([[], songs(P.MAX), []]);
  P.open(btn);
  const rows = menuRows();
  chk(rowText(rows[1]).indexOf('꽉') >= 0, '꽉 찼다고 적힌다');
  chk(typeof rows[1].onclick !== 'function', '클릭이 안 걸린다');
  chk(P.block(1, { id:'새곡' }) !== null, '판정 함수도 같은 답을 낸다');
  chk(P.block(0, { id:'새곡' }) === null, '빈 프리셋은 통과');
}

say('\n── 7. 막힌 곳으로 직접 담아도 안 들어간다');
{
  stage([[{ id:'vid1', title:'곡 1' }], songs(P.MAX), []]);
  P.grabTo(0);
  chk(P.items(0).length === 1, '중복은 안 늘어난다');
  P.grabTo(1);
  chk(P.items(1).length === P.MAX, '꽉 찬 곳도 안 늘어난다');
  chk(toasts.filter(t => t.indexOf('담았어요') >= 0).length === 0, '담았다고 하지 않는다');
  say('    (메뉴가 막아도 판정은 담는 쪽에도 있어야 한다 — 문이 하나뿐인 구조가 아니다)');
}

say('\n── 8. 내 목록에서는 담기가 없다');
{
  stage([[], [], []]);
  P.setView(null);                  // 파도타기 종료 = 내 목록
  P.grabTo(1);
  chk(P.items(1).length === 0, '읽기전용이 아니면 아무 일도 안 한다 (버튼도 안 보인다)');
}

say('\n── 9. 고른 곡이 없으면 메뉴를 안 연다');
{
  stage([[], [], []]);
  P.setSel(-1);
  chk(P.song() === null, '고른 곡이 없다');
  P.open(btn);
  chk(!menuRows(), '메뉴가 뜨지 않는다');
  chk(toasts.some(t => t.indexOf('선택') >= 0), '먼저 고르라고 알려준다');
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
