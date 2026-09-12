/* sim-win-front.js — 🪟 누른 창이 맨 앞으로 오는가
   · 🔔 알림창 · 🏠 마이홈 · 📖 방명록이 목록에 있는가(제보: "눌러도 뒤에 있다").
   · CSS 고정값보다 큰 번호를 받는가 — 안 그러면 올려도 그대로다.
   · 천장에 닿으면 앞뒤 순서를 지킨 채 번호만 다시 매기는가.
   실행: node sim-win-front.js  (app.js · smoke.js · desk-companion-prototype.html 과 같은 폴더에서) */
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

/* 원본 stub 의 요소를 그대로 쓰되 **같은 id 는 같은 요소**를 돌려주게 한다.
   원본은 부를 때마다 새 요소를 만들어서, 올려 둔 zIndex 를 다음 호출에서 읽을 수 없다. */
const _getById = document.getElementById;
const nodes = {};
document.getElementById = id => {
  if(!nodes[id]) nodes[id] = _getById(id);
  return nodes[id];
};

const probe = `
;globalThis.__P = {
  LAYERS: _WIN_Z_LAYERS,
  MIN: WIN_Z_MIN, MAX: WIN_Z_MAX,
  front: id=>bringWinToFront(id),
  z: id=>document.getElementById(id).style.zIndex,
};`;

const say = console.log; console.log = ()=>{}; console.warn = ()=>{};
try { vm.runInThisContext(fs.readFileSync('app.js', 'utf8') + probe, { filename: 'app.js' }); }
catch (e) { console.log = say; say('✗ app.js 평가 실패: ' + (e && e.stack || e).toString().split('\n').slice(0,5).join('\n')); process.exit(1); }
console.log = say;

const P = globalThis.__P;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

/* HTML 에 적힌 CSS 기본 z-index 를 읽어 온다 — 목록에 넣어도 그 값보다 낮으면 소용이 없다 */
const html = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const _flat = html.replace(/\s+/g, '');
function cssZ(id){
  const m = new RegExp('#' + id + '\\{[^}]*?z-index:(\\d+)').exec(_flat);
  return m ? parseInt(m[1], 10) : null;
}

say('\n── 1. 제보된 창이 목록에 있다');
{
  chk(P.LAYERS.indexOf('bellWin') >= 0, '🔔 알림창(bellWin)');
  chk(P.LAYERS.indexOf('myHomeOverlay') >= 0, '🏠 마이홈(myHomeOverlay)');
  chk(P.LAYERS.indexOf('mhGbOverlay') >= 0, '📖 방명록(mhGbOverlay) — 마이홈만 올리면 이게 뒤로 숨는다');
  ['chatOverlay','focusSettingsPanel','myStatusChip','focusLogOverlay'].forEach(id=>{
    chk(P.LAYERS.indexOf(id) >= 0, '기존 창 그대로 — ' + id);
  });
}

say('\n── 2. 올린 번호가 CSS 기본값보다 크다');
{
  ['bellWin','myHomeOverlay','mhGbOverlay'].forEach(id=>{
    const base = cssZ(id);
    P.front(id);
    const now = parseInt(P.z(id), 10);
    chk(base !== null, id + ' 의 CSS 기본값을 찾았다 (' + base + ')');
    chk(now > base, id + ' → ' + now + ' (기본 ' + base + ' 보다 위)');
  });
}

say('\n── 3. 나중에 누른 창이 앞에 온다');
{
  P.front('chatOverlay');
  P.front('bellWin');
  chk(parseInt(P.z('bellWin'), 10) > parseInt(P.z('chatOverlay'), 10), '알림창이 대화창 위로');
  P.front('myHomeOverlay');
  chk(parseInt(P.z('myHomeOverlay'), 10) > parseInt(P.z('bellWin'), 10), '마이홈이 그 위로');
  P.front('mhGbOverlay');
  chk(parseInt(P.z('mhGbOverlay'), 10) > parseInt(P.z('myHomeOverlay'), 10), '방명록이 마이홈 위로 — 마이홈에서 열리는 창이니 가려지면 안 된다');
  const before = P.z('mhGbOverlay');
  P.front('mhGbOverlay');
  chk(P.z('mhGbOverlay') === before, '이미 맨 앞이면 번호를 낭비하지 않는다');
}

say('\n── 4. 천장에서 다시 매긴다');
{
  for(let i = 0; i < 40; i++) P.LAYERS.forEach(id => P.front(id));
  const zs = P.LAYERS.map(id => parseInt(P.z(id), 10));
  chk(zs.every(z => z >= P.MIN && z <= P.MAX),
      '전부 ' + P.MIN + '~' + P.MAX + ' 안에 있다 (' + zs.join(',') + ')');
  chk(new Set(zs).size === zs.length, '번호가 겹치지 않는다 — 겹치면 앞뒤가 다시 CSS 순서로 정해진다');
  chk(P.LAYERS.length <= P.MAX - P.MIN + 1,
      '창 수(' + P.LAYERS.length + ')가 칸 수(' + (P.MAX - P.MIN + 1) + ') 이내다');
  say('    (칸이 모자라면 다시 매길 때 번호가 겹친다 — 창을 더 태울 때 이 줄을 볼 것)');
}

say('\n── 5. 위층은 넘지 않는다');
{
  const top = Math.max(...P.LAYERS.map(id => parseInt(P.z(id), 10)));
  chk(top < 93, '꾸미기창(93)보다 아래 — 실제 ' + top);
  chk(top < 95, '마이홈 디자인 오버레이(95)보다 아래');
  chk(top < 120, '가챠(120)보다 아래');
}

say(fail ? '\n✗ 실패 ' + fail + '건' : '\n✓ 전부 통과');
