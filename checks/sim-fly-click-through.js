/* sim-fly-click-through.js — 🪑 날리기 중 클릭 통과 검사
   실행:  node sim-fly-click-through.js   (desk-companion-prototype.html · app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 «날리기 할 때 오버레이(클릭 통과)가 안 먹어서 뒤의 작업이 막힌다».
     날아가는 캐릭터(💣 · 🔫 룰렛 · 🎲 · 깜짝쇼)는 10초 동안 화면 전체를 튕겨 다닌다.
     다른 앱을 쓰던 커서 밑을 지나가면 _pointHitsInteractive 의 레이캐스트가 «캐릭터 위» 로 잡아
     클릭받기로 바꾸고, 그 순간의 클릭이 투명 창에 꽂혀 쓰던 앱의 포커스를 뺏었다.
     날아가는 캐릭터는 누를 일이 없다(잡기는 seat.fly 면 돌아간다) — 판정에서 뺀다.
   ★ 무엇을 보는가
     §1 흐르는 글자(채팅 날리기) — #flyLayer · .fly 는 pointer-events:none · 클릭 화이트리스트(UI_HIT_SEL)에
        없다 · #chatOverlay 밖에 있다 · showFlyText 가 화이트리스트 클래스를 달지 않는다
     §2 날아가는 몸 — _pointHitsInteractive 가 _skipFlyingRigs 를 거친다 · 떼어 와 돌려 본다
        (나는 rig 는 빠짐 · 같은 좌석 책상은 남음 · 안 나는 좌석은 그대로 · 아무도 안 날면 같은 배열)
     §3 잡기(pointerdown)는 여전히 seat.fly 면 돌아간다 — 판정에서 빼도 받을 클릭이 없다
     §4 이빨 — 옛 판정 줄(_skipHiddenDesk(_ix0))을 넣으면 §2 가 빨강 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0, pass = 0;
const chk = (ok, msg) => { ok ? pass++ : fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!HTML || !APP) { say('  ? 원본 못 찾음 — desk-companion-prototype.html · app.js'); process.exit(2); }

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const grabFn = (src, name) => {
  const i = src.indexOf('function ' + name + '('); if (i < 0) return '';
  let k = src.indexOf('{', i), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return '';
};
const css = strip(HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>')));
function rulesFor(sel){
  const out = [], re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) if (m[1].split(',').map(s => s.trim()).includes(sel)) out.push(m[2]);
  return out.join(';');
}
const pe = (body) => { const m = [...body.matchAll(/(?:^|;)\s*pointer-events\s*:\s*([^;]+)/g)]; return m.length ? m[m.length - 1][1].trim() : null; };
const uiSel = (src) => { const m = src.match(/const UI_HIT_SEL = '([^']+)'/); return m ? m[1].split(',').map(s => s.trim()) : []; };

say('§1 흐르는 글자 (채팅 날리기)');
{
  chk(pe(rulesFor('#flyLayer')) === 'none', '#flyLayer 는 pointer-events:none');
  chk(pe(rulesFor('.fly')) === 'none', '.fly 는 pointer-events:none');
  /* 자식(.fly-ink · .fly-out · 이모티콘 img)이 auto 로 되살아나면 그 글자 위에서 클릭을 받는다 */
  const re = /([^{}]+)\{([^{}]*)\}/g; let m, revived = [];
  while ((m = re.exec(css))) {
    if (!/#flyLayer|\.fly\b/.test(m[1])) continue;
    const v = pe(m[2]); if (v && v !== 'none') revived.push(m[1].trim());
  }
  chk(revived.length === 0, '날리기 글자 규칙 어디에도 pointer-events 를 되살리지 않는다' + (revived.length ? ' — ' + revived.join(' | ') : ''));
  const sel = uiSel(APP);
  chk(sel.length > 10, 'UI_HIT_SEL 을 읽었다(' + sel.length + '개)');
  chk(!sel.some(s => /flyLayer|(^|[\s.])fly(\b|-)/.test(s)), 'UI_HIT_SEL 에 날리기 층 · 글자 선택자가 없다');
  const iLayer = HTML.indexOf('<div id="flyLayer"'), iChat = HTML.indexOf('<div id="chatOverlay"');
  chk(iLayer > 0 && iChat > 0 && iLayer < iChat, '#flyLayer 는 #chatOverlay 밖(앞)에 있다 — 조상으로 화이트리스트에 걸리지 않는다');
  const SHOW = grabFn(APP, 'showFlyText');
  chk(/getElementById\('flyLayer'\)/.test(SHOW) && /layer\.appendChild\(el\)/.test(SHOW), 'showFlyText 는 #flyLayer 에만 붙인다');
  const cls = (SHOW.match(/el\.className\s*=([\s\S]*?);/) || [])[1] || '';
  const classTokens = (cls.match(/'[^']*'/g) || []).join(' ').replace(/'/g, ' ').split(/\s+/).filter(Boolean);
  const hitClasses = sel.filter(s => s.startsWith('.')).map(s => s.slice(1));
  chk(classTokens.includes('fly') && !classTokens.some(t => hitClasses.includes(t)), '흐르는 글자의 클래스가 화이트리스트 클래스와 겹치지 않는다(' + classTokens.join(' ') + ')');
}

/* 떼어 와 돌린다 — seats · _flyActive 를 주입한다 */
function load(src){
  const fns = grabFn(src, '_hitInFlyingRig') + '\n' + grabFn(src, '_skipFlyingRigs');
  if (!/_hitInFlyingRig/.test(fns) || !/_skipFlyingRigs/.test(fns)) return null;
  // eslint-disable-next-line no-new-func
  return new Function('seats', '_flyActiveRef', fns.replace(/_flyActive\b/g, '_flyActiveRef.n')
    + '\nreturn { _hitInFlyingRig, _skipFlyingRigs };');
}
function judge(src, quiet){
  let bad = 0;
  const c = quiet ? (ok) => { if (!ok) bad++; } : (ok, msg) => { if (!ok) bad++; chk(ok, msg); };
  /* 판정 함수 안에서 레이캐스트 결과가 _skipFlyingRigs 를 거친다 */
  const iHit = src.indexOf('let _pointHitsInteractive = function(cx, cy){');
  const body = iHit >= 0 ? strip(src.slice(iHit, src.indexOf('\n    };', iHit))) : '';
  c(iHit >= 0, '_pointHitsInteractive 를 찾았다');
  c(/const _ix0 = ray\.intersectObjects\(_hitObjs, true\);/.test(body), '레이캐스트 줄 그대로(_ix0)');
  c(/const _ix = [^;]*_skipFlyingRigs\(_ix0\)/.test(body), '클릭 통과 판정이 날아가는 몸을 뺀다(_skipFlyingRigs(_ix0))');
  c(/_skipHiddenDesk\(/.test(body), '숨긴 책상 거르기(#7)도 그대로 있다');

  const mk = load(src);
  c(!!mk, '_hitInFlyingRig · _skipFlyingRigs 를 떼어 왔다');
  if (!mk) return bad;
  const node = (name, parent) => ({ name, parent: parent || null });
  const mkSeat = (n) => { const group = node('group' + n); const rig = node('rig' + n, group); const desk = node('desk' + n, group);
    return { group, rig, desk, body: node('body' + n, rig), head: node('head' + n, node('neck' + n, rig)), deskTop: node('top' + n, desk), fly: null }; };
  const A = mkSeat('A'), B = mkSeat('B');
  const seats = [A, B], flyRef = { n: 0 };
  const f = mk(seats, flyRef);
  const hits = [{ object: A.body }, { object: A.deskTop }, { object: B.body }];
  c(f._skipFlyingRigs(hits) === hits, '아무도 안 날면 같은 배열(추가 비용 0)');
  A.fly = { phase: 'air' }; flyRef.n = 1;
  const r = f._skipFlyingRigs(hits).map(h => h.object.name);
  c(!r.includes('bodyA'), '날아가는 몸(rig 아래 메시)은 빠진다');
  c(r.includes('topA'), '같은 좌석의 책상은 남는다(제자리에 있다)');
  c(r.includes('bodyB'), '안 나는 좌석의 몸은 그대로');
  c(f._skipFlyingRigs([{ object: A.head }]).length === 0, '깊은 자식(머리 · 파츠)까지 빠진다');
  c(f._skipFlyingRigs([{ object: A.body }]).length === 0, '날아가는 몸만 맞았으면 빈 배열 = 클릭 통과');
  A.fly = null;
  c(f._skipFlyingRigs([{ object: A.body }]).length === 1, '착지하면(fly=null) 다시 잡힌다 — 카운터가 늦어도');
  return bad;
}

say('§2 날아가는 몸 — 클릭 통과 판정');
judge(APP, false);

say('§3 잡기는 원래 날아가는 캐릭터를 받지 않는다');
{
  const i = APP.indexOf("const hit=_preferVisibleHit(_skipHiddenDesk(_hitsSkipHidden(ray.intersectObjects(seats.map(s=>s.group),true))));");
  const seg = i >= 0 ? strip(APP.slice(i, i + 1200)) : '';
  chk(i >= 0 && /if\(seat\.fly\) return;/.test(seg), 'pointerdown 은 seat.fly 면 돌아간다');
  chk(/function startFlight\([\s\S]*?_flyActive\+\+/.test(grabFn(APP, 'startFlight')), 'startFlight 가 _flyActive 를 바로 올린다(첫 프레임 전에도 거른다)');
}

say('§4 이빨 — 옛 판정 줄이면 빨강');
{
  const OLD = APP.replace(/const _ix = _skipHiddenDesk\(_skipFlyingRigs\(_ix0\)\);/, 'const _ix = _skipHiddenDesk(_ix0);');
  chk(OLD !== APP, '옛 줄로 되돌린 사본을 만들었다');
  chk(judge(OLD, true) > 0, '옛 판정(_skipHiddenDesk(_ix0))이면 §2 가 빨강');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
