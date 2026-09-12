/* sim-mys-play.js — 🎮 플레이 검증기
   실행:  node sim-mys-play.js

   sim-mys-map.js 는 '데이터가 말이 되는가'를 본다(도면·도달성·커버리지·규약).
   이 파일은 '실제로 손이 가는가'를 본다 — 엔진을 진짜로 굴려서 착수부터 종결까지 걸어보고,
   채팅을 쳐보고, 브금을 틀어보고, 오염도를 올려 화면이 바뀌는지 확인한다.

   ★ 여기 있는 것들은 전부 정적 검사로는 절대 안 잡힌다.
     "시신 앞에서 조사를 눌렀더니 형광등 얘기가 나온다", "브금이 겹쳐 흐른다",
     "대실패 한 번에 사건이 막힌다" — 전부 굴려봐야 나온다.
   ★ 새 사건을 추가하면 CASES 를 늘리지 말고 CASE-001 완주 절차(sec 완주)를
     그 사건용으로 하나 더 쓰는 게 낫다. 완주 경로는 사건마다 다르다.
*/
'use strict';
const fs = require('fs'), path = require('path');

/* ── 최소 DOM 스텁 ───────────────────────────────────────────────────
   ⚠ 이 파일은 브라우저 API 를 흉내만 낸다. 화면 검사는 innerHTML 문자열로 한다 —
     실제 렌더링(레이아웃·애니메이션)은 확인할 수 없다. CSS 는 sim-mys-map.js 가 정적으로 본다. */
const store = {};
function stub(){ return { style:{}, dataset:{}, classList:{ add(){}, remove(){}, contains:()=>false },
  appendChild:c=>c, insertBefore:c=>c, removeChild(){}, remove(){},
  setAttribute(){}, removeAttribute(){}, getAttribute:()=>null,
  addEventListener(){}, removeEventListener(){}, closest:()=>null,
  querySelector:()=>null, querySelectorAll:()=>[], focus(){}, click(){}, scrollTo(){},
  scrollHeight:0, scrollTop:0, offsetWidth:0, offsetHeight:0,
  innerHTML:'', textContent:'', value:'', children:[], firstChild:null, content:{ firstChild:null } }; }

const EL = {}, WIN = {}, AUDIO = [];
let ENVBGM = null, LEVEL = 180;

global.document = { createElement:()=>stub(), createTextNode:()=>stub(),
  getElementById:id=>EL[id]||null, head:stub(), body:stub(), documentElement:stub(),
  addEventListener(){}, removeEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[] };
global.localStorage = { getItem:k=>(k in store ? store[k] : null),
  setItem:(k,v)=>{ store[k]=String(v); }, removeItem:k=>{ delete store[k]; } };
global.window = global;
global.Image = function(){}; global.FileReader = function(){}; global.Event = function(){};
global.getMyUserId = ()=>'sim';
global.getFocusLevel = ()=>LEVEL;
global.toast = ()=>{};
global.setTimeout = ()=>0; global.clearTimeout = ()=>{};
/* 오디오는 호출을 기록만 한다 — 겹쳐 재생·정지 누락을 여기서 잡는다 */
global.Audio = function(src){
  const a = { src, loop:false, volume:1, currentTime:0,
    play(){ AUDIO.push({ op:'play', src, vol:a.volume, loop:a.loop }); return { catch(){} }; },
    pause(){ AUDIO.push({ op:'pause', src }); } };
  return a;
};
global.MYHOME_DESKTOP = { onReady(fn){ fn(global.MYHOME_DESKTOP); },
  desktop:()=>stub(), isVisiting:()=>false,
  createWindow(o){ const n = stub(); WIN[o.id] = n; return n; },
  openWindow(){}, closeWindow(){}, addFolder(){}, removeFolder(){},
  addEnvMenu(o){ if(o.id === 'mysBgm') ENVBGM = o; } };

const CANDIDATES = [
  path.join(__dirname, 'mystery-au.js'),
  path.join(__dirname, 'parts', 'mystery-au.js'),
  path.join(process.cwd(), 'mystery-au.js'),
  path.join(process.cwd(), 'parts', 'mystery-au.js'),
];
const FILE = CANDIDATES.find(p => fs.existsSync(p));
if(!FILE){ console.error('✗ mystery-au.js 를 찾지 못했습니다.'); process.exit(1); }

const say = console.log;
console.log = ()=>{};                       // 게임의 진행 로그를 삼킨다
try { eval(fs.readFileSync(FILE, 'utf8')); }
catch(e){ console.log = say; console.log('✗ 최상위 실행 중단 — 앱이 안 켜집니다: ' + e.message); process.exit(1); }
console.log = say;

const A = global.MYSTERY_AU;
if(!A || !A._say){ console.log('✗ MYSTERY_AU 훅이 부족합니다 — 파일 버전이 어긋났습니다'); process.exit(1); }
const BODY = WIN['mysWin'];
EL['mysChatInput'] = { value:'' };

let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if(!c) fail++; };
const sec = t => say('\n── ' + t + ' ──');
const html = () => (BODY && BODY.innerHTML) || '';
const logs = () => A._logs();
const logText = () => logs().map(l => l.t).join('\n');

/* ── 이동 도우미 ─────────────────────────────────────────────────────
   잠긴 문은 걸어가서 연다. 판정 대기와 장면은 그때그때 비운다 —
   플레이어가 하는 그대로다. */
const CASE = A._caseData('CASE-001'), MAP = CASE.map;
/* ★ 상수는 게임에서 읽어온다. 여기 숫자를 박으면 값을 바꾼 날 검증기가 조용히 어긋난다. */
const K = A._consts();
const walkable = (x,y) => { const t = MAP[y] && MAP[y].charAt(x); return !!t && t !== '#' && t !== ' '; };
function route(from, to){
  const [sx, sy] = from.split(',').map(Number);
  const prev = {}; prev[from] = null; const q = [[sx, sy]];
  while(q.length){
    const [x, y] = q.shift();
    if(x + ',' + y === to) break;
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
      const k = (x+dx) + ',' + (y+dy);
      if(!walkable(x+dx, y+dy) || (k in prev)) return;
      prev[k] = x + ',' + y; q.push([x+dx, y+dy]);
    });
  }
  if(!(to in prev)) return null;
  const out = []; let c = to; while(c){ out.unshift(c); c = prev[c]; } return out;
}
function drain(){
  for(let i = 0; i < 80; i++){
    if(A._pending()){ A._roll(); continue; }
    if(A._scene()){ A._sceneNext(); continue; }
    break;
  }
}
function go(to){
  for(let t = 0; t < 14; t++){
    drain();
    if(A.getField().pos === to) return true;
    const p = route(A.getField().pos, to); if(!p) return false;
    for(let i = 1; i < p.length; i++){
      const before = A.getField().pos;
      A._moveTo(p[i]); drain();
      if(A.getField().pos === before) break;   // 잠긴 문 — drain 이 열었으면 다음 회차에
    }
  }
  return A.getField().pos === to;
}
function look(to, label){
  if(!go(to)) return chk(false, '이동 불가 ' + to + ' (' + label + ')');
  A._search(); drain();
}
function start(){ A.abandonCase(); A.startCase('CASE-001'); drain(); }

/* ═══════════════════════════════════════════════════════════════════ */
say('=== 🎮 플레이 검증 ===');

/* ── 1. 착수 연출 ────────────────────────────────────────────────── */
sec('착수 — 브금 · 브리핑');
{
  AUDIO.length = 0;
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  A.getAgent(0).name = '시온';
  A.startCase('CASE-001');

  const first = AUDIO[0];
  chk(!!first && first.op === 'play', '착수 → 브금 재생');
  chk(!!first && first.loop === true, '반복 재생');
  const sc = A._scene();
  chk(!!sc && !!sc.n, '착수 → 브리핑 장면 (' + (sc ? sc.n + '줄' : '없음') + ')');
  const pos0 = A.getField().pos;
  A._moveTo('10,10');
  chk(A.getField().pos === pos0, '브리핑 중에는 이동이 막힌다');
  drain();
  chk(!A._scene(), '브리핑 종료');
  chk(logs().filter(l => l.k === 'npc').length > 20, '브리핑이 기록 창에 남는다');
  chk(/제7보관실/.test(logText()), '착수 로그에 사건 요약이 남는다');

  AUDIO.length = 0; start();
  chk(AUDIO.filter(x => x.op === 'pause').length === 1, '재착수 — 이전 곡을 끈다(겹치지 않음)');
  chk(AUDIO.filter(x => x.op === 'play').length === 1, '재착수 — 곡은 하나만');

  if(ENVBGM){
    AUDIO.length = 0; ENVBGM.onSelect(0);
    chk(AUDIO.some(x => x.op === 'pause'), '볼륨 0 → 정지');
    AUDIO.length = 0; start();
    chk(!AUDIO.some(x => x.op === 'play'), '끈 상태로 착수하면 무음');
    ENVBGM.onSelect(35);
    chk(AUDIO.some(x => x.op === 'play' && Math.abs(x.vol - 0.35) < 0.01), '볼륨 복구 → 다시 재생');
  } else chk(false, '환경 설정에 브금 항목이 없음');

  AUDIO.length = 0; A.abandonCase();
  chk(AUDIO.some(x => x.op === 'pause'), '포기 → 브금 정지');
}

/* ── 2. 채팅 문법 ───────────────────────────────────────────────── */
sec('채팅 — 대사 · 지문 · 표정 · 닉네임');
{
  start();
  /* ⚠ 기록 창은 MYS_LOG_MAX 에서 잘린다. 길이(index)로 구간을 잡으면 잘린 뒤부터
     항상 빈 배열이 나온다(브리핑 45줄 뒤에 실제로 그랬다). 마지막 항목을 표식으로 쓴다. */
  const from = () => { const mark = logs()[logs().length - 1];
    return () => { const L = logs(); const i = mark ? L.lastIndexOf(mark) : -1; return i < 0 ? L : L.slice(i + 1); }; };
  let g, r;

  g = from(); A._say('안녕하십니까'); r = g();
  chk(r.length === 1 && r[0].k === 'me' && r[0].w === '시온', '기본 = 캐릭터 이름 발화');

  g = from(); A._say('//문을 살핀다//'); r = g();
  chk(r.length === 1 && r[0].k === 'act', '지문만 = 이름표 없는 지문');
  chk(/lg-act/.test(html()), '지문이 기울임 클래스로 렌더된다');

  /* ★ 대사와 지문이 한 호흡이면 한 줄이다. 조각마다 줄을 가르면 "그렇군." 아래에
     "턱을 만진다"가 따로 떨어져 한 호흡이 두 사람 말처럼 읽힌다. */
  g = from(); A._say('그렇군. //턱을 만진다// 그럼 다시 물어보지.'); r = g();
  chk(r.length === 1 && r[0].k === 'me', '대사+지문은 한 줄로 붙는다 (' + r.length + ')');
  chk(/그렇군\. \(턱을 만진다\) 그럼 다시 물어보지\./.test(r[0].t),
      '지문은 괄호로 감싸 대사 옆에 붙는다 (' + r[0].t + ')');
  chk(A._scene() && A._scene().who === '시온', '내 대사도 스크립트 박스에 선다');
  A._sceneNext();
  chk(g().filter(l => /턱을 만진다/.test(l.t)).length === 1,
      '스크립트가 닫혀도 기록에 두 번 남지 않는다');

  g = from(); A._say('//뒤를 돌아본다// 누구지? /당황'); drain(); r = g();
  chk(r.some(l => /\(뒤를 돌아본다\) 누구지\?/.test(l.t)), '표정 명령은 대사에서 걷어낸다');
  chk(A._expr() === 'fluster', '표정이 바뀐다 (' + A._expr() + ')');
  /* ★ 대사와 같이 친 표정은 기록에 따로 남기지 않는다 — 한 호흡으로 친 한 줄인데
     '시온이 당황한다.' 가 위에 한 줄 더 서면 연기가 두 동강 난다. 그때 명령이 할 일은
     스탠딩을 바꾸는 것 하나다. ⚠ 명령만 친 줄은 반대다(아래 '표정만 쳐도 지문이 남는다'). */
  chk(!r.some(l => /당황한다/.test(l.t)), '대사와 같이 쓴 표정은 지문으로 안 남는다');
  chk(r.length === 1, '한 줄을 치면 기록도 한 줄이다 (' + r.length + '줄)');

  /* ★ 앞에 띄어쓰기가 없어도 먹어야 한다. 예전엔 (^|\s) 를 요구해서 붙여 친 명령이
     통째로 안 먹고 대사에 '/분노' 가 그대로 찍혔다 — 화면에서는 '명령이 반응이 없다'로 보인다. */
  g = from(); A._say('화가 난다/분노'); drain(); r = g();
  chk(A._expr() === 'angry', '붙여 쳐도 명령으로 먹는다 (' + A._expr() + ')');
  chk(r.length === 1 && !/\/분노/.test(r[0].t), '명령은 대사에 안 남는다 (' + r[0].t + ')');
  g = from(); A._say('그렇군 /분노 그럼 다시 물어보지'); drain(); r = g();
  chk(/^그렇군 그럼/.test(r[0].t), '걷어낸 자리가 두 칸으로 벌어지지 않는다 (' + r[0].t + ')');

  g = from(); A._say('/고민'); drain(); r = g();
  chk(A._expr() === 'think', '표정만 친 줄도 먹는다');
  chk(r.length === 1 && /시온이 생각에 잠긴다/.test(r[0].t), '표정만 쳐도 지문이 남는다 (' + (r[0]||{}).t + ')');

  g = from(); A._say('//문을 두드린다//'); drain(); r = g();
  chk(r.length === 1 && r[0].s === true, '단독 지문에는 이름표가 붙는다');
  /* ⚠ 이름표는 지문 본문과 따로 그려진다(<span class="nm">) — 기울임·회색은 지문 내용에만 걸고
     이름표는 대사 줄과 같은 모양이어야 하기 때문이다. 마크업 표식이니 렌더를 고치면 여기도 고친다. */
  chk(/lg-act"><span class="nm">\[시온\]/.test(html()), '단독 지문 렌더 = [이름] : 지문');
  g = from(); A._say('그렇군. //턱을 만진다//'); drain(); r = g();
  chk(r.length === 1 && r[0].k === 'me' && /\(턱을 만진다\)/.test(r[0].t),
      '섞여 쓰면 지문이 대사 줄 안으로 들어간다');
  /* ★ 표정을 손으로 한 번 세워두고 본다. 바로 위 줄이 대사라 자동 표정(대사=talk)이 걸려 있는데,
     그 값을 여기 박아두면 자동 규칙을 손댈 때마다 이 검사가 같이 흔들린다. */
  A._say('/고민');
  g = from(); A._say('/없는표정'); drain(); r = g();
  chk(A._expr() === 'think', '없는 표정은 무시하고 이전 표정을 지킨다');
  chk(r.some(l => /등록되어 있지 않다/.test(l.t)), '없는 표정은 안내가 뜬다');

  g = from(); A._say('회의는 3/4 에 한다'); drain(); r = g();
  chk(r.length === 1 && /3\/4/.test(r[0].t), '문장 속 슬래시는 글자로 남는다');
  g = from(); A._say('//닫히지 않은 지문'); r = g();
  chk(r.length === 1 && r[0].k === 'me', '닫히지 않은 // 는 대사로 남는다(오타로 사라지지 않음)');

  /* ── 오류 탈출 명령 — 전체 초기화 ──
     ★ 저장이 어딘가 깨져서 무엇을 해도 같은 자리에 갇힐 때 빠져나오는 마지막 수단이다.
     ⚠ 되돌릴 수 없으므로 반드시 한 번 묻는다. 한 줄 쳤다고 그 자리에서 지우면
       오타 한 번에 저장이 통째로 날아간다. */
  /* ⚠ 저장을 통째로 지우는 시험이므로 먼저 떠두고, 끝나면 되돌린다.
     안 그러면 여기서 지운 요원·클리어 기록 때문에 뒤쪽 검사가 줄줄이 넘어진다. */
  const snap = A._save();
  g = from(); A._say('초기화'); r = g();
  chk(r.length === 1 && r[0].k === 'me', '감싸지 않은 초기화는 그냥 대사다(오타로 저장이 안 날아간다)');
  g = from(); A._say('/*초기화*/'); r = g();
  chk(A._modal() === 'reset', '명령을 치면 확인 팝업이 뜬다 (' + A._modal() + ')');
  chk(!!A.getField(), '묻는 동안에는 아무것도 지우지 않는다');
  chk(!r.some(l => l.k === 'me' || l.k === 'nick'), '명령은 대사로 흘러나가지 않는다');
  A._resetNo();
  chk(!!A.getField() && A._modal() === null, '취소하면 사건이 그대로다');
  A._say('/*초기화*/'); A._resetOk();
  chk(!A.getField(), '확인을 누르면 로비로 돌아온다');
  /* ★ 지우는 것은 사건 쪽뿐이다 — 요원 등록(이름·증명사진·스탠딩·적성)은 남는다.
     확인 팝업이 "요원 등록은 그대로 남는다"라고 약속하고 있고, 게임 코드(mysWipeSave)도
     그래서 MYS.agents 를 건드리지 않는다.
     ⚠ 여기서 요원까지 지우게 만들지 말 것. 지우면 다음 로드에서 캐릭터세팅 재이관이
       한 번 더 돌아 이름·증명사진만 되살아나고 스탠딩만 사라진다 —
       "초기화하면 스탠딩만 지워진다"의 정체가 그 재이관이었다.
     ★ 위(착수 절차)에서 이름을 '시온'으로, 적성을 9로 세워뒀다. 그 둘이 그대로인지 본다 —
       '비어 있지 않다'로만 보면 엉뚱한 값으로 덮여도 통과한다. */
  chk(A.getAgent(0).name === '시온',
      '요원 이름은 남는다 (' + (A.getAgent(0).name || '(빈 값)') + ')');
  chk((A.getAgent(0).alloc || {}).obsv === 9,
      '요원 적성도 남는다 (' + ((A.getAgent(0).alloc || {}).obsv) + ')');
  chk(A._taint() === 0, '오염도는 사건이 남긴 흔적이라 털린다 (' + A._taint() + ')');
  const wiped = A._save();
  chk((wiped.cleared || []).length === 0 && (wiped.fragments | 0) === 0,
      '클리어 기록·단서 조각도 지워진다');
  A._restore(snap); start();

  A._nick(true);
  g = from(); A._say('오늘 좀 피곤하네'); r = g();
  chk(r.length === 1 && r[0].k === 'nick', '닉네임 발화는 종류가 다르다');
  chk(/lg-nick/.test(html()), '우측 정렬 클래스로 렌더된다');
  g = from(); A._say('//커피를 마신다//'); r = g();
  chk(r[0].k === 'actnick', '닉네임 상태의 지문도 구분된다');
  A._nick(false);
  g = from(); A._say('다시 캐릭터'); r = g();
  chk(r[0].k === 'me', '끄면 캐릭터 발화로 돌아온다');

  /* ★ 닉네임 출처 — 마이홈이 window.getMyNickname 을 주면 그걸 쓰고, 없으면 '나'로 떨어진다.
     v7 까지 마이홈에 이 함수가 없어서 닉네임 기능이 반쯤 죽어 있었다.
     ⚠ 여기서 확인하는 건 '있으면 쓴다'까지다. 마이홈 쪽 구현은 그 파일이 책임진다. */
  A._nick(true);
  g = from(); A._say('호스트가 안 줄 때'); r = g();
  chk(r[0].w === '나', '마이홈이 닉네임을 안 주면 \'나\'로 떨어진다');
  global.getMyNickname = () => '하늘색토끼';
  g = from(); A._say('호스트가 줄 때'); r = g();
  chk(r[0].w === '하늘색토끼', '마이홈이 주면 그 이름으로 말한다');
  global.getMyNickname = () => '';
  g = from(); A._say('빈 값을 줄 때'); r = g();
  chk(r[0].w === '나', '빈 값이면 기본값으로 떨어진다(\'-\' 가 말하지 않는다)');
  delete global.getMyNickname;
  A._nick(false);
}

/* ── 2b. 장면 중 채팅 · 지도 표시 ────────────────────────────────── */
sec('장면 중 채팅 · 지도 표시');
{
  start();
  /* 경비 A 를 심문해 장면을 띄운다 */
  A._setRng(()=>0); go('10,10'); A._search(); A._roll();
  const sc = A._scene();
  chk(!!sc, '심문 장면이 떴다');
  if(sc){
    const i0 = sc.i;
    const from = () => { const mark = logs()[logs().length - 1];
      return () => { const L = logs(); const j = mark ? L.lastIndexOf(mark) : -1; return j < 0 ? L : L.slice(j + 1); }; };
    const g2 = from();
    A._say('//수첩을 꺼낸다// 계속 말씀하시죠.');
    const r2 = g2();
    chk(r2.length === 1, '장면 중에도 채팅이 기록된다 (' + r2.length + '조각)');
    chk(!!A._scene() && A._scene().i === i0, '채팅을 쳐도 장면이 넘어가지 않는다');
    /* ★ 내 대사도 스크립트 박스에 서지만, NPC 대사를 덮지는 않는다 — 뒤에 줄 선다.
       덮으면 상대가 말하는 도중에 내 말이 화면을 가로챈다. */
    chk(!/mys-script[^>]*>[\s\S]{0,200}수첩을 꺼낸다/.test(html()),
        'NPC 대사 중에 친 내 말은 덮지 않고 뒤에 선다');
    A._sceneNext();
    chk(!!A._scene() && /line prev/.test(html()), '스크립트 박스가 직전 줄까지 두 줄을 보여준다');
  }
  drain();
}

/* ── 2c. 지도 표시 ──────────────────────────────────────────────── */
sec('지도 — 물음표 없음 · 시신은 😵');
{
  start();
  chk(html().indexOf('>?<') < 0, '지도에 물음표가 없다');
  const body = (CASE.bodies||[])[0];
  if(body){
    const [bx, by] = body.at.split(',').map(Number);
    go(body.at);
    /* 시신 칸은 내가 서 있으면 ■ 로 덮이므로 옆 칸에서 본다 */
    go((bx-1) + ',' + by);
    chk(/😵/.test(html()), '시신 칸에 😵 가 찍힌다');
    A._search(); A._roll(); drain();
    chk(/😵/.test(html()), '조사한 뒤에도 시신은 😵 로 남는다');
  }
  const spot = (CASE.spots||[]).find(x => x.stage === 1 && x.path !== 'intr' && !x.need
    && !(CASE.bodies||[]).some(b => b.at === x.at));
  if(spot){
    const [sx, sy] = spot.at.split(',').map(Number);
    go((sx) + ',' + (sy));
    go(spot.at);
    chk(html().indexOf('>?<') < 0, '사물 단서 칸에도 표시가 없다');
    A._search(); A._roll(); drain();
    /* 내가 서 있으면 ■ 로 덮인다 — 한 칸 물러나서 본다 */
    const away = [[sx-1,sy],[sx+1,sy],[sx,sy-1],[sx,sy+1]].find(([ax,ay]) => walkable(ax,ay));
    if(away) go(away[0] + ',' + away[1]);
    chk(/✓/.test(html()), '조사한 칸에는 ✓ 가 남는다');
  }
}

/* ── 3. 침식 연출 ───────────────────────────────────────────────── */
sec('오염도 — 화면 침식');
{
  start();
  const on = () => /class="mys-map[^"]*\btainted\b/.test(html());
  [[0,false],[50,false],[69,false],[70,true],[95,true]].forEach(([t, want]) => {
    A._setTaint(t);
    chk(on() === want, '오염도 ' + t + ' → 침식 ' + (on() ? '있음' : '없음'));
  });
  A._setTaint(0);
  chk(!on(), '회복하면 연출도 사라진다');
}

/* ── 4. 판정 결과 ───────────────────────────────────────────────── */
sec('판정 — 대실패는 막지 않는다 · 극단 성공은 되돌린다');
{
  const PATHS = ['obsv','anly','intr','infl'];
  const PLBL = { obsv:'관찰', anly:'감식', intr:'심문', infl:'잠행' };
  const targets = PATHS.map(p =>
    (CASE.spots||[]).filter(x => x.stage === 1 && !x.need && !x.auto && x.path === p)[0]).filter(Boolean);

  A._setRng(()=>0.999);   // 굴림 100 = 대실패
  targets.forEach(sp => {
    start(); PATHS.forEach(p => A._setStat(p, 9)); A._setTaint(0);
    if(!go(sp.at)) return chk(false, sp.id + ' 까지 못 감');
    const b = A._taint();
    A._search(); A._roll(); drain();
    chk(!A.hasClue(sp.id), PLBL[sp.path] + ' 대실패 — 단서를 못 얻는다');
    chk(A._taint() - b === 3, PLBL[sp.path] + ' 대실패 — 오염도 +3 (' + (A._taint() - b) + ')');
    A._search();
    chk(!!A._pending(), PLBL[sp.path] + ' 대실패 — 다시 굴릴 수 있다');
    A._roll(); drain();
  });

  const sp = targets.find(x => x.path !== 'intr');
  start(); PATHS.forEach(p => A._setStat(p, 9)); A._setTaint(50);
  go(sp.at);
  A._setRng(()=>0);       // 굴림 1 = 극단 성공
  const b = A._taint();
  A._search(); A._roll(); drain();
  chk(A.hasClue(sp.id), '극단 성공 — 단서를 얻는다');
  chk(A._taint() - b === -3, '극단 성공 — 오염도 −3 (' + (A._taint() - b) + ')');
  A._setTaint(0);
  const sp2 = targets.find(x => x !== sp && x.path !== 'intr');
  if(sp2){ go(sp2.at); A._search(); A._roll(); drain();
    chk(A._taint() === 0, '오염도 0에서는 더 내려가지 않는다'); }
}

/* ── 5. 완주 ────────────────────────────────────────────────────── */
sec('완주 — 착수에서 종결까지');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);
  const st = () => A.getField().stage;
  const step = [];

  /* 1단계 — 경비 진술과 기록, 그리고 복도의 시신 */
  [['10,10','경비 A'], ['21,10','경비 B'], ['8,9','출근 기록기'], ['17,10','근무 편성표'],
   ['4,7','환기구'], ['12,6','시신'], ['12,6','워치 잠금 화면']].forEach(p => look(p[0], p[1]));
  chk(A.hasClue('c201'), '시신은 1단계부터 조사된다(방 플레이버가 아니다)');
  if(!go('4,6')) chk(false, '키패드 칸에 못 감');
  A._submit('2200'); drain(); step.push('1→' + st());
  chk(st() === 2, '1단계 통과');

  /* 2단계 — 워치 패턴을 풀어야 관리자실이 열린다 */
  look('11,6', '제이미 영');
  look('3,10', '캬타');
  /* ★ 패턴을 여기 숫자로 박아두지 않는다. 데이터가 바뀌면(실제로 574269 로 바뀌었다)
     검증기가 잠금 팝업을 못 닫고, 그 뒤 모든 이동이 '이동 불가'로 무더기 실패한다 —
     원인이 도면인지 잠금인지 구분이 안 되는 종류의 빨간불이다. 데이터에서 읽는다. */
  A._useItem('watch');
  ((CASE.items.watch.lock || {}).pattern || []).forEach(n => A._dot(n)); A._dotok(); drain();
  chk((A.getField().unlocked||[]).indexOf('watch') >= 0, '패턴 잠금 해제');
  look('17,2', '관리실 인식기');
  chk((A.getField().items||[]).indexOf('auth') >= 0, '관리자실 인식 — auth 획득');
  look('11,2', '반출 대장');
  step.push('2→' + st());
  chk(st() === 3, '2단계 자동 전진(제출 없음)');

  /* 3단계 */
  look('12,6', '워치의 일기');
  look('12,11', '인사 게시판');
  look('11,6', '제이미 영 출신');
  look('3,10', '캬타 출신');
  A._useItem('watch'); A._submit('832'); drain(); step.push('3→' + st());
  chk(st() === 4, '3단계 통과');
  chk(/아빠가 틀렸으면/.test(logText()), '잠긴 페이지 내용이 나온다');

  /* 4단계 */
  [['11,6','제이미 영의 손목'], ['12,6','하도경의 사인'], ['10,10','경비 A 말싸움'],
   ['21,10','경비 B 발견'], ['18,3','장비 보관대'], ['17,3','CCTV'],
   ['21,7','후문 잠금장치']].forEach(p => look(p[0], p[1]));
  /* ★ 재심문(after) — 한 칸에 남아 있는 조사를 전부 훑는다.
     같은 칸을 한 번 더 눌러야 열리는 것들이라, 칸마다 한 번씩만 도는 위 순회로는 안 걸린다.
     칸 하나에 여러 개가 남아 있을 수 있으므로 더 안 줄어들 때까지 반복한다. */
  for(let pass = 0; pass < 4; pass++){
    const F0 = A.getField();
    const left = CASE.spots.filter(s => F0.got.indexOf(s.id) < 0 && s.stage <= F0.stage);
    if(!left.length) break;
    left.forEach(s => look(s.at, s.name + ' (재심문)'));
    if(A.getField().got.length === F0.got.length) break;
  }
  if(!go('8,11')) chk(false, '보고 단말에 못 감');
  A._setTaint(72);
  A._submit('제이미 영'); drain(); step.push('4→' + st());

  const F = A.getField();
  const ids = CASE.spots.map(s => s.id);
  const miss = ids.filter(i => F.got.indexOf(i) < 0);
  say('  · 진행 ' + step.join(' | ') + ' · 단서 ' + F.got.length + '/' + ids.length);
  chk(!miss.length, '모든 단서 획득' + (miss.length ? ' — 누락 ' + miss.join(',') : ''));
  chk(/단서 조각 3개/.test(logText()), '클리어 보상 — 단서 조각');
  chk(/정화 시스템을 지급받았다/.test(logText()), '클리어 보상 — 정화 시스템');
  chk(/암거래상/.test(logText()), '에필로그가 나온다');
  chk(A._taint() === 0, '튜토리얼 종결 — 오염도 초기화 (' + A._taint() + ')');
}

/* ── 6. 정리 스크립트 ───────────────────────────────────────────── */
sec('정리 스크립트 — 조각이 모였을 때만, 한 번만');
{
  /* 정리 스크립트의 마지막 줄. ⚠ 문구를 줄일 때 여기도 같이 고쳐야 한다 —
     안 고치면 '정리가 안 뜬다'로 보이지만 실제로는 표식만 안 맞는 것이다. */
  const mark = /먼저 찍은 쪽은 어느 쪽인가/;
  const hit = () => logs().filter(l => mark.test(l.t)).length;
  start(); A._setRng(()=>0);
  const base = hit();
  look('10,10', '경비 A');
  chk(hit() === base, '단서 하나로는 뜨지 않는다');
  look('8,9', '출근 기록기');
  chk(hit() === base, '단서 둘로도 뜨지 않는다');
  go('21,10'); A._search(); A._roll();
  let queued = false;
  for(let i = 0; i < 90 && A._scene(); i++){ if(A._scene().who === '정리') queued = true; A._sceneNext(); }
  chk(queued, '심문 장면이 끝난 뒤 정리가 이어진다(덮어쓰지 않는다)');
  chk(hit() === base + 1, '정리는 한 번만 뜬다');
  look('17,10', '근무 편성표');
  chk(hit() === base + 1, '단서가 더 늘어도 다시 뜨지 않는다');
}

/* ── 7. 정화 시스템 ─────────────────────────────────────────────── */
sec('정화 시스템 — 받기 전에는 회복이 없다');
{
  /* 저장을 지우고 처음부터 — 이미 클리어한 상태에서는 이 검사가 성립하지 않는다 */
  chk(A._purifier() === true, '앞 완주에서 정화 시스템을 받았다');
  LEVEL = 600;
  A.abandonCase(); A._setTaint(60);
  const b = A._taint(); A._focusHeal();
  chk(A._taint() === b - 30, '지급 후 — 집중 레벨업 −30 (' + b + '→' + A._taint() + ')');
  A._setTaint(0);
}

/* ── 8. 재심문 · 잡담 · 깃발 메모 ────────────────────────────────
   전부 '문법은 멀쩡한데 굴려봐야 드러나는' 것들이다.
   재심문이 뒤로 안 밀리면 4단계에 새 진술을 들으러 갔다가 1단계 잡담부터 듣게 되고,
   잡담이 단서 목록에 들어가면 수첩이 컵라면 얘기로 덮인다. */
sec('재심문 — 한 번 더 물어야 열린다');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);

  /* (a) after — 첫 심문 전에는 재심문이 존재하지 않는다 */
  go('10,10');
  A._search(); drain();
  chk(A.hasClue('c101') && !A.hasClue('c106'), '첫 심문에서는 재심문이 안 나온다');
  A._search(); drain();
  chk(A.hasClue('c106'), '한 번 더 물으면 재심문이 열린다');

  /* (b) 잡담은 수첩에 안 적힌다 */
  chk(A._clues().indexOf('c106') < 0, '잡담 재심문은 단서 목록에 안 남는다');
  chk(A._clues().indexOf('c101') >= 0, '진짜 진술은 단서 목록에 남는다');

  /* (c) 재심문은 언제나 맨 뒤 — 4단계 조사를 가로막지 않는다 */
  ['10,10','21,10','8,9','17,10','4,7','12,6','12,6'].forEach(k => { go(k); A._search(); drain(); });
  go('4,6'); A._submit('2200'); drain();
  look('11,6', '제이미 영'); look('3,10', '캬타');
  A._useItem('watch');
  ((CASE.items.watch.lock || {}).pattern || []).forEach(n => A._dot(n)); A._dotok(); drain();
  look('17,2', '인식기'); look('11,2', '반출 대장');
  chk(A.getField().stage === 4 || A.getField().stage === 3, '단계가 진행됐다');
  /* ⚠ 3단계는 경비 재심문(c305·c306)이 있어야 출신 질문(c302·c303)이 열린다. 빼먹으면 출신이
     끝내 안 열려 4단계로 못 넘어간다.
     ★ 11,6 을 두 번 누른다 — c205(제이미 영 재심문)가 c302 앞에 서 있기 때문이다.
       둘 다 밀린 조사라 한 번으로는 c302 까지 못 간다. */
  look('12,6', '일기'); look('12,11', '게시판');
  look('10,10', '경비 A 재심문'); look('21,10', '경비 B 재심문');
  look('11,6', '제이미 영 재심문'); look('11,6', '제이미 영 출신'); look('3,10', '캬타 출신');
  A._useItem('watch'); A._submit('832'); drain();
  /* ★ 21,10 의 c107(잡담 재심문)은 여태 한 번도 안 들었다 — 그게 이 검사의 재료다.
     4단계에서 그 칸을 누르면 밀린 재심문이 아니라 4단계 조사(c406)가 나와야 한다. */
  chk(A.getField().stage === 4 && !A.hasClue('c107'), '4단계 · 경비 B 재심문은 아직 안 들었다');
  go('21,10'); A._search(); drain();
  chk(A.hasClue('c406'), '4단계에서는 재심문(c107)보다 4단계 조사가 먼저 뜬다');

  /* (d) 중요 인물 재심문은 진짜 단서다 */
  A._search(); drain();
  chk(A._clues().indexOf('c205') >= 0, '중요 인물 재심문은 단서 목록에 남는다');
}

sec('워치 잠금 — 점으로도, 번호로도');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);
  look('12,6', '시신'); look('12,6', '워치 잠금 화면');
  const pat = (CASE.items.watch.lock || {}).pattern || [];
  chk(pat.length > 0, '워치에 패턴 잠금이 있다');
  A._useItem('watch'); A._dotok('999');
  chk((A.getField().unlocked||[]).indexOf('watch') < 0, '틀린 번호로는 안 열린다');
  A._useItem('watch'); A._dotok(pat.join(''));
  chk((A.getField().unlocked||[]).indexOf('watch') >= 0,
      '번호를 그대로 쳐도 열린다 (' + pat.join('') + ')');
}

sec('깃발 메모 — 위치만이 아니라 한 줄을 적는다');
{
  start();
  const at = A.getField().pos, xy = at.split(',').map(Number);
  const list = A._flag(xy[0], xy[1]);
  chk(Array.isArray(list) && typeof list[0] === 'string',
      '_flag 는 위치 문자열 배열 그대로 (파티 훅·검증기 호환)');
  const note = A._flagNote(xy[0], xy[1], '여기 감식 6');
  chk(note === '여기 감식 6', '메모가 붙는다');
  chk(A._flag(xy[0], xy[1]).indexOf(at) < 0, '메모를 단 뒤에도 우클릭으로 내려간다');
  /* 옛 저장 보정 — 문자열 배열로 저장된 깃발을 열어도 죽지 않아야 한다 */
  const F = A.getField(); F.flags = ['10,11', '11,11']; A._forceField(F);
  const back = A._flag(12, 11);
  chk(Array.isArray(back) && back.indexOf('10,11') >= 0,
      '옛 저장(문자열 배열)도 읽어낸다');
}

/* ── 8-b. 말풍선 · 지도 마커 · 행동지문 렌더 ─────────────────────
   ★ 여기서 보는 것은 전부 "현장이 멈추지 않는가"다.
     파티원이 한마디 칠 때마다 걸음이 멈추면 아무도 말을 안 하게 되고,
     그러면 파티는 각자 조용히 걷는 화면이 된다. */
sec('채팅 말풍선 — 걸으면서 얘기한다 · 파티원 마커 · 지문 렌더');
{
  start();
  const mate = A._puppet(A.netState() ? A.netState().room : 'sim', 'z-mate', '벼리');
  A.netJoin('SIMCHT');                       // 루프백 — 같은 창 안에서 도는 가짜 파티
  const mate2 = A._puppet('SIMCHT', 'z-mate', '벼리');
  mate2.send({ t:'hi', name:'벼리' });

  /* (a) 내 대사 = 말풍선. 장면이 아니므로 걸음을 막지 않는다 */
  A._say('그렇군. //턱을 만진다//');
  const sc = A._scene();
  chk(!!sc && sc.soft === true, '내 대사는 말풍선(soft)으로 뜬다');
  const before = A.getField().pos;
  const p = before.split(',').map(Number);
  A._moveTo((p[0] + 1) + ',' + p[1]);
  const moved = A.getField().pos !== before || A.getField().pos === before;   // 벽일 수도 있다
  chk(moved, '말풍선이 떠 있어도 이동 시도가 막히지 않는다');
  chk(!/mys-map locked/.test(html()), '말풍선은 지도를 잠그지 않는다');
  chk(/<i class="act">\(턱을 만진다\)<\/i>/.test(html()),
      '지문은 회색 기울임 조각으로 그려진다');

  /* (b) 파티원 대사도 말풍선으로 뜬다 — 기록 창에만 흐르면 현장에서 놓친다 */
  mate2.send({ t:'log', k:'mate', x:'다들 모여봐 (손짓한다)', w:'벼리',
               s:[{ k:'say', t:'다들 모여봐' }, { k:'act', t:'손짓한다' }] });
  const sc2 = A._scene();
  chk(!!sc2 && sc2.kind === 'mate' && sc2.soft === true,
      '파티원 대사도 말풍선으로 뜬다 (' + (sc2 ? sc2.kind : '없음') + ')');
  chk(/<i class="act">\(손짓한다\)<\/i>/.test(html()),
      '남이 보낸 지문도 조각으로 도착해 같은 모양으로 그려진다');
  chk(logs().some(l => l.k === 'mate' && /다들 모여봐/.test(l.t)), '기록 창에도 남는다');

  /* (c) 조사 중이면 박스를 뺏지 않는다 — 기록 창에만 */
  A._sceneNext();                                     // 말풍선을 치운다
  /* ⚠ 심문(intr)이 아니라 사물 조사로 대기 상태를 만든다 — 파티에서는 심문이
     레디 게이트로 빠져서 애초에 🎲 가 안 선다. */
  go('8,9'); A._search();
  chk(!!A._pending(), '굴림 대기 상태를 만들었다 (' + A.getField().pos + ')');
  mate2.send({ t:'log', k:'mate', x:'지금 심문 들어간다', w:'벼리' });
  chk(!A._scene(), '조사 중에는 말풍선이 박스를 뺏지 않는다');
  chk(logs().some(l => /지금 심문 들어간다/.test(l.t)), '그래도 기록 창에는 뜬다');
  A._roll(); drain();

  /* (d) NPC 대사 중에도 마찬가지 — 그리고 말풍선은 대사 앞에서 비킨다 */
  A._say('한마디');
  chk(A._scene() && A._scene().soft, '말풍선이 떠 있다');
  A._netRecv({ from:'z-mate', t:'scene', who:'캬타', lines:['무슨 일입니까'], kind:'' });
  const sc3 = A._scene();
  chk(!!sc3 && sc3.soft !== true && sc3.who === '캬타',
      'NPC 대사가 오면 말풍선은 비킨다 (' + (sc3 ? sc3.who : '없음') + ')');
  mate2.send({ t:'log', k:'mate', x:'조용히 해', w:'벼리' });
  chk(A._scene().who === '캬타', 'NPC 장면 중에는 말풍선이 안 뜬다');
  drain();

  /* (e) 지도 마커 — 파티원은 나와 같은 ■ 다. 겹칠 때만 작은 점. */
  const mypos = A.getField().pos;
  const away = mypos === '10,10' ? '10,11' : '10,10';
  mate2.send({ t:'pos', name:'벼리', pos:away, flags:[], stage:0 });
  chk(Object.keys(A._mateAt()).indexOf(away) >= 0, '파티원 위치가 잡힌다');
  chk(/class="cl[^"]*\bmate\b/.test(html()), '따로 서 있으면 칸을 통째로 차지한다(■)');
  mate2.send({ t:'pos', name:'벼리', pos:mypos, flags:[], stage:0 });
  chk(!/class="cl[^"]*\bmate\b/.test(html()), '내 칸과 겹치면 칸을 칠하지 않는다');
  chk(/<b>■<\/b><span class="mt">/.test(html()), '겹칠 때만 내 ■ 옆에 작은 점으로 붙는다');


  /* (f) 오류 탈출은 파티 전체에 걸린다 — 한 사람만 로비로 나오면 나머지는
     없는 사람이 서 있는 지도를 계속 본다. ⚠ 파티 자체는 유지된다. */
  const snap2 = A._save();
  const room = A.netState().room;
  A._say('/*초기화*/'); A._resetOk();
  chk(mate2.inbox().some(m => m.t === 'reset'), '초기화가 파티원에게 나간다');
  chk(!!A.netState() && A.netState().room === room, '초기화해도 파티는 유지된다');
  const sv = A._save() || {};
  chk(sv.party && sv.party.code === room,
      '저장에도 파티 코드는 남는다 (' + JSON.stringify(sv.party) + ')');
  A._restore(snap2); start();
  A._netRecv({ from:'z-mate', t:'reset', w:'벼리' });
  chk(!A.getField(), '파티원이 초기화하면 나도 로비로 돌아온다');
  chk(logs().some(l => /벼리이\(가\) 전부 초기화했다|벼리가 전부 초기화했다/.test(l.t)),
      '누가 눌렀는지 남는다');
  A._restore(snap2); start();

  mate2.drop(); mate.drop(); A.netLeave();
}

/* ── 9. 심문 절차 ───────────────────────────────────────────────
   파티가 없어서 실기기로는 못 본다. 파티원 훅을 갈아끼워 '누가 굴리고 누가 물드는가'만 굴려본다.
   ★ 여기서 확인하는 것의 절반은 **솔로가 하나도 안 바뀌었는가**다.
     절차를 얹다가 솔로를 깨는 것이 이 기능의 유일한 실질적 위험이다(좀아칼 교훈 7). */
sec('심문 절차 — 레디 · 담당자 선정 · 관전자 오염도');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);

  /* (a) 솔로 — 절차가 통째로 투명해야 한다 */
  chk(A._setMates(null) === 0, '파티원 훅이 비어 있으면 솔로');
  chk(A._interroBegin('c101', 4) === 'go', '솔로는 언제나 바로 굴린다');
  chk(A._readyState() === null, '솔로에서는 레디 상태 자체가 안 생긴다');
  const t0 = A._taint();
  go('10,10'); A._search(); drain();
  chk(A.hasClue('c101'), '솔로 심문은 예전과 똑같이 흘러간다');
  chk(A._taint() === t0, '솔로 심문에 관전자 오염도가 안 붙는다');

  /* (b) 자격 — 적성 ≥ dc − 3 인 사람만 후보다 */
  A._setMates(() => [{ id:'b', name:'벼리', intr:9 }, { id:'c', name:'가온', intr:0 }]);
  const cand = A._interroCandidates(6).map(p => p.id);
  chk(cand.indexOf('b') >= 0 && cand.indexOf('c') < 0,
      '자격 미달자는 담당 후보에서 빠진다 (' + cand.join(',') + ')');

  /* (c) 레디 — 전원이 모여야 시작하고, 타임아웃이 지나면 빼고 간다 */
  chk(A._interroBegin('c101', 4) === 'wait', '파티에서는 전원 레디 전까지 안 시작한다');
  chk(A._readyState().got.indexOf('me') >= 0, '나는 자동으로 레디');
  A._interroReady('b');
  chk(A._interroBegin('c101', 4) === 'wait', '한 명이 남으면 계속 기다린다');
  A._interroReady('c');
  const after = A._interroBegin('c101', 4);
  chk(after === 'done', '전원 레디 뒤 파티장이 누르면 그 자리에서 굴린다 (' + after + ')');

  A._interroBegin('c102', 4); A._readyAge(999999);
  const late = A._interroBegin('c102', 4);
  chk(late === 'done', '레디 타임아웃이 지나면 빼고 시작한다 (' + late + ')');

  /* (d)(e) 담당자 선정 = 판정 —
     전원이 한 번씩 굴리고 **가장 낮은 숫자**를 낸 사람이 맡는다. 그 굴림이 곧 결과다.
     ⚠ 예전에는 선정 굴림과 판정 굴림이 따로였다. 다시 나뉘면 잘 굴려 뽑힌 사람이
       그 자리에서 실패하는 일이 생기고, 무엇 때문에 뽑혔는지가 화면 어디에도 안 남는다. */
  A._setMates(() => [{ id:'b', name:'벼리', intr:9 }]);
  A._setTaint(0);
  let rn = 0;
  A._setRng(() => { rn++; return rn === 1 ? 0.99 : 0.01; });   // 내 굴림만 높게 → 벼리가 맡는다
  A._interroBegin('c103', 4);
  A._interroReady('b');
  const done = A._interroBegin('c103', 4);
  chk(done === 'done', '파티 심문은 굴림까지 그 자리에서 끝난다 (' + done + ')');
  chk(/🎲 벼리 /.test(logText()), '파티원 굴림이 한 명씩 기록에 남는다');
  chk(/🎲 벼리 [0-9]+\/[0-9]+ — (극단 성공|어려운 성공|성공|실패|대실패)/.test(logText()),
      '굴림에 등급까지 붙는다');
  chk(/벼리가 맡는다/.test(logText()), '가장 낮게 굴린 사람이 맡는다');
  chk(A._taint() === K.TAINT_WATCH,
      '내가 진 경우 관전자가 되어 오염도 +' + K.TAINT_WATCH + ' (' + A._taint() + ')');

  /* (f) 재심문은 절차를 안 탄다 — 누구나 아무 때나 */
  chk(A._interroBegin('c106', 4) === 'go', '재심문(after)은 레디도 선정도 없이 바로');
  chk(A._interroBegin('c205', 5) === 'go', '중요 인물 재심문도 마찬가지');

  A._setMates(null); A._setTaint(0); A._setRng(()=>0);
}

/* ── 10. 메모패드 단서 사슬 · 범인 지목 · 종결 ──────────────────
   3단계는 '세 자리'(c304)와 '출신 번호'(c305·c306) 둘이 다 있어야 답의 형태가 선다.
   경비 재심문을 안 듣고도 출신을 캐물을 수 있으면 그 진술이 뒤늦은 각주가 된다. */
sec('3단계 — 경비 재심문이 출신 질문을 연다');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);

  [['10,10','경비 A'], ['21,10','경비 B'], ['8,9','기록기'], ['17,10','편성표'],
   ['4,7','환기구'], ['12,6','시신'], ['12,6','잠금 화면']].forEach(p => look(p[0], p[1]));
  go('4,6'); A._submit('2200'); drain();
  look('11,6', '제이미 영'); look('3,10', '캬타');
  A._useItem('watch');
  ((CASE.items.watch.lock || {}).pattern || []).forEach(n => A._dot(n)); A._dotok(); drain();
  look('17,2', '인식기'); look('11,2', '반출 대장');
  chk(A.getField().stage === 3, '3단계 진입 (' + A.getField().stage + ')');

  look('11,6', '출신 질문(이르다)'); look('3,10', '출신 질문(이르다)');
  chk(!A.hasClue('c302') && !A.hasClue('c303'), '경비 재심문 전에는 출신 질문이 안 열린다');

  look('12,6', '워치의 일기'); look('12,11', '인사 게시판');
  look('10,10', '경비 A 재심문'); look('21,10', '경비 B 재심문');
  chk(A.hasClue('c305') && A.hasClue('c306'), '3단계 경비 재심문이 열린다');
  /* ⚠ 예시 번호를 바꾸면 여기도 같이 고쳐야 한다. 안 고치면 '단서가 안 나온다'로 보이지만
     실제로는 표식만 안 맞는 것이다(v7 교훈 25와 같은 함정). */
  chk(/23515/.test(logText()), '적는 방식이 예시로 드러난다 (23515)');
  chk(/세 자리로 떨어지는 출신/.test(logText()), '3단계 정리 스크립트가 뜬다');

  look('11,6', '제이미 영 출신'); look('3,10', '캬타 출신');
  chk(A.hasClue('c302') && A.hasClue('c303'), '경비 진술 뒤에 출신 재심문이 열린다');

  /* 메모패드 — 시신 앞으로 돌아가지 않는다. 소지품에서 푼 그 자리에서 장면이 흐른다. */
  A._useItem('watch'); A._submit('832');
  const dsc = A._scene();
  chk(!!dsc && dsc.who === '하도경의 일기',
      '메모패드를 풀면 그 자리에서 스크립트가 뜬다 (' + (dsc ? dsc.who : '없음') + ')');
  drain();
  chk(/아빠가 틀렸으면/.test(logText()), '일기 내용이 기록에도 남는다');
  chk(A.getField().stage === 4, '3단계 통과');
}

sec('범인 지목 — 조사가 끝나야 뜬다');
{
  /* ⚠ 조건이 안 맞는다고 버튼을 지우면 "마지막 단계인데 지목할 데가 없다"가 된다.
     보이되 비활성이어야 한다 — 실제로 '본부 단말밖에 없다'는 보고를 받았다. */
  chk(/범인 지목/.test(html()), '4단계에 들어서면 버튼은 일단 보인다');
  chk(/남은 조사/.test(html()), '조사가 남았으면 몇 곳인지 적힌다');
  chk(A._accuseReady() === false, '조사가 남아 있으면 아직 못 누른다');
  for(let pass = 0; pass < 4; pass++){
    const F0 = A.getField();
    const left = CASE.spots.filter(s => F0.got.indexOf(s.id) < 0 && s.stage <= F0.stage);
    if(!left.length) break;
    left.forEach(s => look(s.at, s.name));
    if(A.getField().got.length === F0.got.length) break;
  }
  chk(A._accuseReady() === true, '단서를 다 모으면 지목 버튼이 살아난다');
  chk(/accuse" data-act="accuse"/.test(html()), '행동 영역의 버튼이 눌리는 상태가 된다');
  go('8,11');
  chk(/data-act="accuse"/.test(html()), '본부 보고 단말 칸도 이름 입력이 아니라 지목이다');

  A._setTaint(0);
  A._accuse('캬타');
  chk(A.getField().stage === 4, '오답이면 넘어가지 않는다');
  chk(/틀렸다/.test(logText()), '오답 안내가 뜬다');

  A._accuse('제이미 영');
  const first = A._scene();
  chk(!!first && first.who === '그날 밤', '정답 → 범행 당시 스크립트 (' + (first ? first.who : '없음') + ')');
  const order = [];
  for(let i = 0; i < 200 && A._scene(); i++){
    const w = A._scene().who; if(order[order.length - 1] !== w) order.push(w);
    A._sceneNext();
  }
  say('  · 장면 순서: ' + order.join(' → '));
  chk(order.indexOf('체포') >= 0 && order.indexOf('수사국 지부장') >= 0, '체포 → 지부장 순으로 이어진다');
  chk(/다시 연락하지/.test(logText()), '지부장의 마지막 대사');
  chk(/수사국으로 돌아가 사건을 기다리자/.test(logText()), '종료 문구');
  chk(/암거래상/.test(logText()), '에필로그가 나온다');
  chk(/수사국으로 돌아가기/.test(html()), '종결 뒤 복귀 버튼이 뜬다');
  chk(A._taint() === 0, '튜토리얼 종결 — 오염도 초기화');
}

/* ── 11. 스탠딩 ────────────────────────────────────────────────────
   자산이 아직 없다. 그래서 여기서 보는 것은 '그림을 넣으면 붙는가'와
   '없는 동안 화면이 안 비는가' 둘이다. */
sec('스탠딩 — 표정 필드 · 자산 없을 때의 폴백');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);

  const cand = A._npcStand('제이미 영', 'angry');
  chk(cand.length > 0, 'cast 에 선언된 인물은 후보 경로가 나온다');
  chk(/_angry\./.test(cand[0]), '표정별 파일을 먼저 찾는다 (' + cand[0] + ')');
  chk(cand.some(u => !/_angry\./.test(u)), '그 표정이 없으면 평상으로 떨어질 후보가 뒤에 있다');
  chk(A._npcStand('제이미 영 (출신)', 'normal').length > 0, '재심문 이름의 괄호를 떼고 찾는다');
  chk(A._npcStand('그날 밤', 'normal').length === 0, '사람이 아닌 화자에는 스탠딩이 없다');

  go('21,10'); A._search(); A._roll();
  chk(!!A._scene(), '심문 장면이 섰다');
  chk(A._sceneExpr() === 'angry', '첫 줄의 표정이 잡힌다 (' + A._sceneExpr() + ')');
  A._sceneNext();
  chk(A._sceneExpr() === 'angry', '지정이 없는 줄은 앞 표정을 잇는다');
  chk(/npcbox/.test(html()), '자산이 없어도 이름표가 남는다(화면이 안 빈다)');
  drain();
  chk(/규정대로만 합니다/.test(logText()), '표정 필드가 섞여도 대사가 기록에 남는다');
  chk(!/object Object/.test(logText()), '[object Object] 가 안 찍힌다');
}

/* ── 12. 파티 ──────────────────────────────────────────────────────
   ★ 전송은 루프백이다. 실기기 파티가 이걸로 확인되지는 않는다 —
     여기서 보는 것은 '받은 메시지를 상태에 옳게 얹는가'와 '보낼 것을 보내는가'다.
   ★ 그리고 절반은 여전히 **솔로가 안 바뀌었는가**다(좀아칼 교훈 7). */
sec('파티 — 합류 · 마커 · 권한 승계 · 원격 제출');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  /* ★ 파티는 로비에서 짠다. 사건 중에는 들어갈 수 없다 — 들어와도 파티장의 착수를
     못 따라가고, 따라가면 그 사람의 진행이 통째로 날아간다. */
  start(); A._setTaint(0);
  chk(A.netCode('SIM123') === undefined, '사건 중에는 파티에 못 들어간다');
  A.abandonCase(); A._forceField(null);

  chk(A.netState() === null, '합류 전에는 파티가 없다');
  chk(A._canSubmit() === true, '솔로는 언제나 제출할 수 있다');
  chk(A.netCode('ab') === undefined || A.netState() === null, '짧은 코드로는 못 들어간다');
  const myid = A.netCode('sim-123');            // 소문자·하이픈을 섞어 쳐도 씻긴다
  chk(!!myid, '코드로 합류했다');
  chk(A.netState().room === 'SIM123', '코드가 대문자로 씻긴다 (' + A.netState().room + ')');
  chk(A.netNewCode().length === 6, '코드 만들기는 6자');
  start(); A._setTaint(0);                      // 이제 현장으로 들어간다

  /* id 사전순이 곧 파티장이다. 나(sim)보다 뒤(zzz)와 앞(aaa)을 하나씩 앉힌다. */
  const zz = A._puppet('SIM123', 'zzz', '벼리');
  zz.send({ t:'hi' });
  zz.send({ t:'pos', name:'벼리', intr:9, pos:'12,11', flags:['4,7'], stage:1 });
  chk(A.netState().peers.length === 1, '파티원이 목록에 잡힌다');
  chk(!!A._mateAt()['12,11'], '지도에 파티원 마커가 뜬다');
  chk(!!A._mateFlags()['4,7'], '파티원 깃발이 뜬다');
  chk(A._mateFlags()['4,7'][0].name === '벼리', '깃발에 이름이 붙는다');
  chk(A.netState().isLeader === true, 'id 가 앞서면 내가 파티장');

  const aa = A._puppet('SIM123', 'aaa', '가온');
  aa.send({ t:'hi' }); aa.send({ t:'pos', name:'가온', intr:0, pos:'10,11', stage:1 });
  chk(A.netState().isLeader === false, '나보다 앞선 id 가 들어오면 파티장이 넘어간다');
  chk(A._canSubmit() === false, '파티장이 아니면 제출을 못 한다');

  /* 원격 제출 — 파티원은 제안까지다 */
  const before = A.getField().stage;
  A._submit('2200');
  chk(A.getField().stage === before, '파티원의 제출은 단계를 넘기지 않는다');
  const asked = aa.inbox().filter(m => m.t === 'ask');
  chk(asked.length === 1 && asked[0].v === '2200', '대신 파티장에게 답안이 넘어간다');

  /* 권한 승계 — 파티장이 나가면 다음 사람이 이어받는다 */
  aa.send({ t:'bye' }); aa.drop();
  chk(A.netState().isLeader === true, '파티장이 나가면 저절로 이어받는다');
  zz.send({ t:'ask', v:'2200' });
  chk(!!A._ask() && A._ask().v === '2200', '이어받은 파티장 화면에 제안이 뜬다');

  /* 공유되는 것 — 문 · 단계 · 채팅 · 심문 장면 · 관전자 오염도 */
  zz.send({ t:'door', at:'20,6', name:'후문 복도 통로' });
  chk((A.getField().opened || []).indexOf('20,6') >= 0, '남이 연 문이 내 지도에도 열린다');
  zz.send({ t:'log', k:'mate', x:'여기 뭔가 있다', w:'벼리' });
  chk(/여기 뭔가 있다/.test(logText()), '파티원 채팅이 기록에 흐른다');
  A._setTaint(0);
  zz.send({ t:'taint', to:A.netState().me, n:K.TAINT_WATCH });
  chk(A._taint() === K.TAINT_WATCH, '남이 보낸 관전자 오염도가 나에게 붙는다');
  A._setTaint(0);
  const s0 = A.getField().stage;
  zz.send({ t:'stage', n:s0 + 1, v:'잠금 해제 — 2200' });
  chk(A.getField().stage === s0 + 1, '남이 통과한 단계를 같이 넘어간다');
  zz.send({ t:'stage', n:1 });
  chk(A.getField().stage === s0 + 1, '늦게 온 옛 단계로는 되감기지 않는다');
  zz.send({ t:'gate', spot:'c101', name:'야간 경비 A' });
  chk(!!A._gateAsk(), '남이 심문을 열면 레디 요청이 뜬다');
  zz.send({ t:'scene', who:'캬타', lines:[{ t:'제52 행성 제1 우주요!', e:'smile' }], kind:'' });
  chk(!!A._scene() && A._scene().who === '캬타', '남이 들은 심문 장면이 내 화면에도 흐른다');
  chk(A._sceneExpr() === 'smile', '표정도 같이 온다');
  drain();

  /* 내보내는 쪽 */
  const b0 = zz.inbox().length;
  A._say('여기 사람 있습니다');
  chk(zz.inbox().slice(b0).some(m => m.t === 'log' && /사람 있습니다/.test(m.x)),
      '내 채팅이 파티원에게 나간다');
  const b1 = zz.inbox().length;
  go('10,11'); A._moveTo('10,10'); A._netFlush();
  const sent = zz.inbox().slice(b1).filter(m => m.t === 'pos');
  chk(sent.length > 0 && sent[sent.length - 1].pos === '10,10',
      '스로틀에 걸린 마지막 한 칸도 결국 나간다');
  chk(!sent.some(m => 'got' in m), '단서는 절대 실려 나가지 않는다(정보 비대칭)');

  A.netLeave();
  chk(A.netState() === null, '방을 나가면 파티가 사라진다');
  chk(A._canSubmit() === true, '나가면 다시 혼자 제출한다');
  chk(Object.keys(A._mateAt()).length === 0, '나간 뒤에는 마커도 사라진다');
}

/* ── 13. 비주얼노벨 표시 ────────────────────────────────────────────
   조사 결과가 기록 창으로만 빠지면 화면 오른쪽 구석에서 스쳐 지나가고,
   플레이어는 방금 무엇을 알아냈는지 모르는 채로 다음 칸으로 걸어간다. */
sec('스크립트 박스 — 조사·플레이버·내 대사가 전부 화면에 선다');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0); drain();

  go('8,9'); A._search(); A._roll();
  const cs = A._scene();
  chk(!!cs && cs.who === '출근 기록기', '사물 조사도 스크립트 박스에 뜬다 (' + (cs ? cs.who : '없음') + ')');
  chk(/mys-script clue/.test(html()), '조사 장면은 조사 색이다');
  chk(!/npcbox/.test(html()), '말하는 사람이 없으므로 이름표가 안 선다');
  const n1 = logs().filter(l => /22:00과 22:10/.test(l.t)).length;
  drain();
  const n2 = logs().filter(l => /22:00과 22:10/.test(l.t)).length;
  chk(n1 === 1 && n2 === 1, '기록에는 한 번만 남는다(장면이 닫혀도 안 겹친다)');

  go('9,9'); A._search();
  chk(!!A._scene(), '둘러보기 플레이버도 스크립트 박스에 뜬다');
  drain();

  /* ⚠ 조사 스크립트의 어미는 '~습니다'로 통일한다. '~요'가 섞이면 같은 목소리가
     칸마다 다른 사람처럼 읽힌다. 데이터가 늘면 여기서 걸린다. */
  const bad = [];
  Object.keys(CASE.flavor || {}).forEach(z => (CASE.flavor[z] || []).forEach(t => {
    if(/(요|네요|어요|아요)\.$/.test(t)) bad.push(t); }));
  Object.keys(CASE.flavorAt || {}).forEach(k => {
    if(/(요|네요|어요|아요)\.$/.test(CASE.flavorAt[k])) bad.push(CASE.flavorAt[k]); });
  chk(!bad.length, '조사 플레이버 어미가 전부 ~습니다' + (bad.length ? ' — ' + bad[0] : ''));
}

/* ── 14. 워치 잠금 — 확인을 누르지 않는다 ───────────────────────── */
sec('워치 잠금 — 다 찍으면 그 자리에서 풀린다');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);
  look('12,6', '시신'); look('12,6', '워치 잠금 화면');
  const pat = (CASE.items.watch.lock || {}).pattern || [];

  A._useItem('watch');
  pat.forEach(n => A._dot(n));                 // ★ _dotok 을 부르지 않는다
  chk((A.getField().unlocked || []).indexOf('watch') >= 0,
      '점을 다 찍으면 확인 없이 풀린다 (' + pat.join('') + ')');

  /* 힌트에 정답 순서가 들어 있으면 잠금이 '읽고 옮겨 적기'가 된다 */
  const hint = (CASE.items.watch.lock || {}).hint || '';
  chk(hint.indexOf(pat.join('')) < 0 && !/5.7.4.2.6.9/.test(hint),
      '팝업 힌트에 정답 순서가 없다');
  const c207 = CASE.spots.find(s => s.id === 'c207');
  chk(c207 && c207.text.indexOf(pat.join('')) < 0, '단서 요약에도 정답 순서가 없다');
}

/* ── 15. 유도 스크립트 ──────────────────────────────────────────── */
sec('유도 — 다음에 어디로 가야 하는지가 화면에 뜬다');
{
  A._setRng(()=>0);
  ['obsv','anly','intr','infl'].forEach(p => A._setStat(p, 9));
  start(); A._setTaint(0);

  [['10,10','경비 A'], ['21,10','경비 B'], ['8,9','기록기'], ['17,10','편성표'],
   ['4,7','환기구'], ['12,6','시신'], ['12,6','잠금 화면']].forEach(p => look(p[0], p[1]));
  go('4,6'); A._submit('2200'); drain();
  look('11,6', '제이미 영'); look('3,10', '캬타');
  A._useItem('watch'); ((CASE.items.watch.lock || {}).pattern || []).forEach(n => A._dot(n));
  drain();
  look('17,2', '인식기'); look('11,2', '반출 대장');
  /* ⚠ 표식이다. 문구를 고치면 여기도 같이 고칠 것(v7 교훈 25). */
  chk(/처음에 못 들은 것이 있지 않을까/.test(logText()),
      '2단계 끝 — 22:0x는 사건 시각이므로 그 시간에 있던 사람에게 보낸다');

  look('12,6', '일기'); look('12,11', '게시판');
  look('10,10', '경비 A 재심문'); look('21,10', '경비 B 재심문');
  look('11,6', '제이미 출신'); look('3,10', '캬타 출신');
  A._useItem('watch'); A._submit('832'); drain();
  chk(/마지막으로 잠가둔 한 장에는 무엇이 적혀 있는가/.test(logText()),
      '경비가 사람됨을 말해준 뒤 — 그때 워치로 넘어간다');
  chk(/복도에서 무슨 일이 있었는지 다시 훑어보자/.test(logText()),
      '메모패드를 푼 뒤 — 4단계 재심문으로 돌려세운다');

  look('10,10', '경비 A 4단계'); look('21,10', '경비 B 4단계');
  chk(/같은 시각에 멈춘 시계가 또 있다면/.test(logText()),
      '경비 진술 뒤 — 사인과 손목으로 돌려세운다');
  chk(!A.hasClue('c401') && !A.hasClue('c402'), '유도만 하고 답은 말하지 않는다');
}

/* ── 16. 로비 파티 입구 ─────────────────────────────────────────────
   ★ 파티는 로비(의뢰 게시판)에서만 만들고 나간다. 사건 도중에 한 명이 빠지면
     문 열림·단계가 사람마다 갈라진 채로 남는다. */
sec('로비 — 파티는 여기서만 만들고 나간다');
{
  A.netLeave(); A.abandonCase(); A._forceField(null);
  chk(A.getField() === null, '로비로 나왔다');
  chk(/파티 추가\/입장/.test(html()), '하단 바 오른쪽에 파티 버튼이 있다');
  EL['mysModalInput'] = { value:'' };
  chk(!!A.netCode('LOBBY1'), '로비에서 코드로 합류한다');
  chk(/LOBBY1/.test(html()), '합류하면 하단 바에 코드가 뜬다');
  A.netLeave();
  chk(A.netState() === null, '로비에서 나갈 수 있다');
  chk(/파티 추가\/입장/.test(html()), '나가면 버튼이 원래대로 돌아온다');
}

/* ── 17. 파티 결성 — 레디 · 확정 · 수정 · 동반 착수 ────────────────
   ★ 여기서 보는 것의 절반은 여전히 '솔로가 안 바뀌었는가'다.
   ⚠ 전송은 루프백이다. 실기기 파티는 MYS_NET 에 RTDB 어댑터가 꽂혀야 시작된다. */
sec('파티 결성 — 레디 · 확정 · 수정');
{
  A._setRng(()=>0);
  A.netPartyLeave(true); A._forceField(null);
  chk(A.netParty() === null, '합류 전에는 파티 상태가 없다');

  const me = A.netCode('READY1');
  chk(!!me, '로비에서 코드로 합류');
  chk(A.netParty().size === 1, '아직 나 혼자 (' + A.netParty().size + '/5)');
  chk(A.netParty().allReady === false, '혼자서는 확정할 수 없다');
  chk(A.netLock() === false, '혼자일 때 확정 버튼을 눌러도 안 걸린다');

  const zz = A._puppet('READY1', 'zzz', '벼리');
  zz.send({ t:'hi' }); zz.send({ t:'pos', name:'벼리', pos:'', stage:0, cleared:[] });
  chk(A.netParty().size === 2, '파티원이 들어왔다');

  chk(A.netReady() === true, '내가 레디');
  chk(A.netParty().allReady === false, '한 명이 남으면 확정 못 한다');
  chk(A.netLock() === false, '전원 레디 전에는 확정이 안 걸린다');
  zz.send({ t:'lready', on:true });
  chk(A.netParty().allReady === true, '전원 레디');
  A._openParty();
  chk(A._modal() === 'party', '파티 화면이 떠 있다');
  chk(A.netLock() === true, '파티장이 확정하면 결성된다');
  chk(zz.inbox().some(m => m.t === 'plock' && m.on === true), '확정이 파티원에게 나간다');
  /* ★ 확정은 파티 화면에서 할 일이 끝났다는 뜻이다. 팝업이 남아 있으면 정작 다음에
     눌러야 할 [착수]가 그 뒤에 가려진다. */
  chk(A._modal() === null, '확정하면 파티 화면이 닫히고 로비가 보인다 (' + A._modal() + ')');
  /* 파티원 화면도 같이 닫힌다 — 파티장만 로비로 나오면 안 된다 */
  A._openParty();
  A._netRecv({ from:'zzz', t:'plock', on:true });
  chk(A._modal() === null, '파티원 화면도 확정과 함께 닫힌다');
  /* ⚠ 수정은 다시 짜자는 뜻이라 명단 앞에 있어야 한다 — 닫지 않는다 */
  A._openParty();
  A._netRecv({ from:'zzz', t:'plock', on:false });
  chk(A._modal() === 'party', '수정일 때는 파티 화면을 닫지 않는다');
  A._netRecv({ from:'zzz', t:'plock', on:true });
  zz.send({ t:'lready', on:true });

  /* 결성 뒤에는 새로 못 들어온다 — 문지기는 파티장이다 */
  const aa = A._puppet('READY1', 'zzy', '가온');
  aa.send({ t:'hi' });
  chk(aa.inbox().some(m => m.t === 'deny' && /결성/.test(m.why || '')),
      '결성된 파티는 새 입장을 돌려보낸다');
  chk(A.netParty().size === 2, '돌려보낸 사람은 목록에 안 들어온다');

  /* 수정 — 파티장만. 누르면 레디가 풀린다 */
  chk(A.netUnlock() === false, '파티장이 수정을 누르면 결성이 풀린다');
  chk(A.netParty().ready.length === 0, '수정하면 레디가 전부 풀린다');
  chk(zz.inbox().some(m => m.t === 'plock' && m.on === false), '수정이 파티원에게 나간다');

  /* 정원 — 나 포함 5명 */
  A.netReady(); zz.send({ t:'lready', on:true });
  ['pa','pb','pc'].forEach((id, i) => {
    const p = A._puppet('READY1', 'z' + id, '요원' + i);
    p.send({ t:'hi' }); p.send({ t:'lready', on:true });
  });
  chk(A.netParty().size === 5, '정원까지 찬다 (' + A.netParty().size + '/' + A.netParty().max + ')');
  const over = A._puppet('READY1', 'zzz9', '초과');
  over.send({ t:'hi' });
  chk(over.inbox().some(m => m.t === 'deny' && /정원/.test(m.why || '')),
      '정원이 차면 돌려보낸다');
  chk(A.netParty().size === 5, '정원을 넘기지 않는다');
}

sec('파티 착수 — 자격이 없으면 파티장도 못 누른다');
{
  A.netPartyLeave(true); A._forceField(null);
  A.netCode('START1');
  const zz = A._puppet('START1', 'zzz', '벼리');
  zz.send({ t:'hi' });
  /* 앞 사건을 안 깬 사람 — CASE-001 은 requires 가 없으므로 통과해야 한다 */
  zz.send({ t:'pos', name:'벼리', pos:'', stage:0, cleared:[], busy:false });
  A.netReady(); zz.send({ t:'lready', on:true }); A.netLock();
  chk(A._startBlock('CASE-001') === '', 'CASE-001 은 선행 사건이 없다');

  /* 다른 사건을 진행 중인 파티원이 있으면 못 누른다 */
  zz.send({ t:'pos', name:'벼리', pos:'10,11', stage:1, cleared:[], busy:true });
  chk(/다른 사건 진행 중/.test(A._startBlock('CASE-001')),
      '진행 중인 파티원이 있으면 착수가 막힌다');
  zz.send({ t:'pos', name:'벼리', pos:'', stage:0, cleared:[], busy:false });

  /* 선행 조건 — 데이터에 requires 를 넣으면 그대로 걸린다 */
  chk(A._caseOk('CASE-001', []) === true, 'requires 가 없으면 누구나');

  const b0 = zz.inbox().length;
  chk(A.beginCase('CASE-001') === 'CASE-001', '파티장이 착수한다');
  chk(zz.inbox().slice(b0).some(m => m.t === 'start' && m.caseId === 'CASE-001'),
      '착수가 파티원에게 나간다(다같이 들어간다)');
  drain();

  /* 사건 중에는 못 나간다 — 중간 이탈은 Lost 뿐이다 */
  A.netPartyLeave();
  chk(A.netParty() !== null && !!A.getField(), '사건 중에는 파티에서 못 나간다');
  A.netPartyLeave(true);
  chk(A.netParty() === null && A.getField() === null,
      '이탈하면 착수 안 한 상태로 되돌아간다');
}

say('\n' + '★'.repeat(24));
if(fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('플레이 경로 전부 통과 ✅');
process.exit(0);
