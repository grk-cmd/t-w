/* sim-pl-next.js — ⏭ 플레이리스트 '다음 곡' 규약 검사
   실행:  node sim-pl-next.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 다음 곡으로 가는 길이 **둘**이 되었다.
     ① 자동 진행(_plNext) — 곡이 끝나면 main 이 신호를 보낸다
     ② 사람이 누른 ⏭ (_plSkipNext)
     둘은 딱 한 곳만 달라야 한다: **'한 곡 반복'을 ②는 무시한다.**
     자동이면 같은 곡을 다시 여는 게 맞지만, 손으로 ⏭ 를 눌렀는데 같은 곡이 처음부터
     다시 시작하면 "버튼이 고장났다"로 읽힌다.
     그 하나 말고 다른 곳이 갈라지면(예: 반복 끔인데 ② 만 처음으로 돌아간다) 반복 스위치의 뜻이
     버튼마다 달라진다 — 이 검사가 막는 것이 그것이다.

   ★ 두 번째로 지키는 것: **실패 연속 카운터를 어느 쪽이 지우는가.**
     자동 진행은 못 트는 곡을 셋고(_plErrStreak) 바로 다음 곡을 부른다. 그 셈을
     _plSkipNext 안에서 0 으로 지우면 못 트는 곡만 있는 목록에서 **무한 루프**가 된다.
     그래서 지우는 것은 사람이 누른 경로(버튼 핸들러)뿐이다.

   ⚠ 실제 재생은 여기서 못 본다(유튜브 자식창은 main.js 쪽이다). 여기서 지키는 것은 분기 규약뿐이다. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

function cut(name){
  const i = SRC.indexOf('function ' + name + '(');
  if (i < 0) throw new Error(name + ' 를 못 찾음');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++){
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}'){ d--; if (d === 0) return SRC.slice(i, k + 1); }
  }
  throw new Error(name + ' 의 끝을 못 찾음');
}

say('=== ⏭ 플레이리스트 다음 곡 규약 검사 ===');
say('');

/* ── §1. 소스 대조 ───────────────────────────────────────────────── */
say('· §1 소스 대조 — 버튼이 붙었고, 두 길이 한 곳만 다른가');

chk(/id="myPlNext"/.test(HTML), '⏭ 버튼이 HTML 에 있다');
{
  const bar = HTML.slice(HTML.indexOf('<div id="myPlBar">'), HTML.indexOf('</div>', HTML.indexOf('<div id="myPlBar">')) + 6);
  const iStop = bar.indexOf('myPlStop'), iNext = bar.indexOf('myPlNext'), iLoop = bar.indexOf('myPlLoop');
  chk(iStop > -1 && iNext > iStop && iLoop > iNext,
      '★ 자리가 ■ 정지 **다음**, 🔁 반복 **앞**이다 (제보의 그 자리)');
  chk(/id="myPlNext"[^>]*class="plBtn"|class="plBtn"[^>]*id="myPlNext"/.test(bar),
      '공용 버튼 클래스(plBtn)를 쓴다 — 혼자 다르게 보이지 않는다');
  chk(/id="myPlNext"[^>]*aria-label/.test(bar), 'aria-label 이 있다 (아이콘만 있는 버튼)');
}

const auto = cut('_plNext'), manual = cut('_plSkipNext');
chk(/PL_KIND_ONE/.test(auto),  '★ 자동 진행은 한 곡 반복을 **본다**');
chk(!/PL_KIND_ONE/.test(manual),
    '★ 사람이 누른 길은 한 곡 반복을 **안 본다** — 같은 곡이 다시 시작하지 않는다');
chk(/_plSkipNext\s*\(/.test(auto),
    '★ 자동 진행이 그 다음은 사람 쪽과 **같은 함수**를 지난다 — 규칙이 두 벌이 되지 않는다');

// 갈라지면 안 되는 것들 — 둘이 같은 판단을 해야 한다
chk(/PL_KIND_SHUF/.test(manual), '셔플은 양쪽 다 같은 가방(_plShufPick)에서 뽑는다');
chk(/if\(!_plOn\)\{[\s\S]{0,80}_plStop\(\)/.test(manual),
    "★ 반복이 꺼져 있으면 마지막 곡에서 멈춘다 — 손으로 눌러도 '처음으로' 예외를 만들지 않았다");

// 실패 카운터를 지우는 자리 — 사람이 누른 쪽 하나뿐이어야 한다
chk(!/_plErrStreak\s*=/.test(manual),
    '★ _plSkipNext 안에서는 실패 카운터를 지우지 않는다 — 지우면 무한 루프가 된다');
chk(/bind\('myPlNext'[\s\S]{0,120}_plErrStreak\s*=\s*0[\s\S]{0,60}_plSkipNext\(\)/.test(SRC),
    '★ 대신 버튼 핸들러가 지운다 — 손으로 넘긴 뒤 남은 정상 곡에서 멈추지 않는다');

// 활성 조건 — ■ 와 같아야 한다(넘길 '지금 곡'이 있어야 뜻이 있다)
chk(/\['myPlNext',\s*_plNow >= 0\]/.test(SRC),
    "★ 재생 중일 때만 눌린다 — ■ 정지와 같은 조건");

say('');

/* ── §2. 런타임 ──────────────────────────────────────────────────── */
say('· §2 런타임 — 떼어낸 두 함수를 나란히 돌린다');

/* 두 함수와 셔플 뽑기를 그대로 떼어내고, 바깥 상태만 흉내 낸다.
   _plPlayFrom·_plStop 은 '무엇을 시켰는가'만 기록한다 — 실제 재생은 main 쪽이다. */
function run(state){
  const log = [];
  const env = {
    _plNow: state.now, _plOn: state.on, _plKind: state.kind,
    _plShufBag: [], PL_KIND_ONE: 1, PL_KIND_SHUF: 2,
    /* ⚠️ 이름이 셋 바뀌었다. app.js 에 프리셋(세트) 기능이 들어오면서:
         _plItems    → _plNowItems  (보고 있는 프리셋의 목록을 돌려준다)
         _plPlayFrom → _plPlayNow   (★ 아래 §1 참고 — 이 교체가 곧 규약이다)
         (신규)      → _plAdoptCurSet (프리셋 갈아타기. true 면 거기서 끝난다)
       이 목록이 낡아 있던 동안 이 검사는 ReferenceError 로 죽어 있었다.
       app.js 쪽에서 이름이 바뀌면 여기도 같이 바꿔야 한다. */
    _plNowItems: () => state.items,
    _plPlayNow: n => log.push('play:' + n),
    _plAdoptCurSet: () => !!state.adopt,
    _plStop: () => log.push('stop'),
    toast: () => {},
  };
  const fn = new Function(
    '_plNowItems', '_plPlayNow', '_plAdoptCurSet', '_plStop', 'toast', 'PL_KIND_ONE', 'PL_KIND_SHUF',
    '_plNow', '_plOn', '_plKind', '_plShufBag',
    cut('_plShufPick') + '\n' + auto + '\n' + manual + '\n;return {_plNext, _plSkipNext};'
  )(env._plNowItems, env._plPlayNow, env._plAdoptCurSet, env._plStop, env.toast, 1, 2,
    env._plNow, env._plOn, env._plKind, env._plShufBag);
  fn[state.via]();
  return log.join(',');
}
const items3 = ['a', 'b', 'c'];

// (ㄱ) 반복 끔 — 가운데 곡
chk(run({items:items3, now:0, on:false, kind:0, via:'_plNext'})     === 'play:1', '반복 끔 · 자동: 다음 칸');
chk(run({items:items3, now:0, on:false, kind:0, via:'_plSkipNext'}) === 'play:1', '반복 끔 · ⏭ : 같다');

// (ㄴ) 반복 끔 — 마지막 곡. **양쪽 다 멈춘다**(여기가 갈리면 스위치의 뜻이 달라진다)
chk(run({items:items3, now:2, on:false, kind:0, via:'_plNext'})     === 'stop', '반복 끔 · 자동: 마지막에서 정지');
chk(run({items:items3, now:2, on:false, kind:0, via:'_plSkipNext'}) === 'stop',
    '★ 반복 끔 · ⏭ : **똑같이 정지** — 손으로 눌러도 처음으로 돌아가지 않는다');

// (ㄷ) 목록 반복 — 마지막 곡에서 처음으로
chk(run({items:items3, now:2, on:true, kind:0, via:'_plNext'})     === 'play:0', '목록 반복 · 자동: 처음으로');
chk(run({items:items3, now:2, on:true, kind:0, via:'_plSkipNext'}) === 'play:0', '목록 반복 · ⏭ : 같다');

// (ㄹ) 한 곡 반복 — **여기가 유일하게 갈리는 자리**
chk(run({items:items3, now:1, on:true, kind:1, via:'_plNext'})     === 'play:1',
    '한 곡 반복 · 자동: 같은 곡을 다시 연다 (예전 그대로)');
chk(run({items:items3, now:1, on:true, kind:1, via:'_plSkipNext'}) === 'play:2',
    '★ 한 곡 반복 · ⏭ : **다음 곡으로 간다** — 이 한 줄이 이 작업의 요지');

/* (ㄹ-2) 🆕 _plPlayNow 여야 한다 — 이름만 바뀐 게 아니라 **규약이다.**
   ★ 다른 프리셋을 열어 둔 채 한 곡 반복이 돌면, _plPlayFrom 은 '그 목록의 같은 번호',
     즉 엉뚱한 곡을 연다. 보고 있는 목록 기준으로 여는 _plPlayNow 여야 한다.
     이 sim 이 죽어 있는 동안 app.js 에서 바뀐 것이라, 되돌아가도 아무도 모를 자리다. */
chk(/_plPlayNow\s*\(/.test(auto) && !/_plPlayFrom\s*\(/.test(auto),
    '★ 자동 진행의 한 곡 반복이 _plPlayNow 를 쓴다 (_plPlayFrom 이면 다른 프리셋의 같은 번호가 열린다)');
chk(/_plPlayNow\s*\(/.test(manual) && !/_plPlayFrom\s*\(/.test(manual),
    '★ ⏭ 쪽도 _plPlayNow 를 쓴다');

/* (ㄹ-3) 🆕 프리셋 갈아타기는 **_plSkipNext 첫 줄**에서만 일어난다.
   ★ 지금 곡은 이미 끝났고 여기서부터가 '다음 곡'이라, 새 프리셋이 효력을 갖는 유일한 자리다.
     true 를 돌려주면 그 자리에서 끝나야 한다 — 이어서 다음 칸까지 열면 프리셋을 갈아탄 뒤
     첫 곡이 아니라 두 번째 곡이 나온다. */
chk(run({items:items3, now:0, on:false, kind:0, via:'_plSkipNext', adopt:true}) === '',
    '★ 프리셋을 갈아탔으면 거기서 끝난다 — 다음 칸을 추가로 열지 않는다');
chk(run({items:items3, now:0, on:true, kind:1, via:'_plNext', adopt:true}) === 'play:0',
    '★ 한 곡 반복은 갈아타지 않는다 — 프리셋을 바꿔 뒀어도 이 곡을 되풀이한다');

// (ㅁ) 셔플 — 지금 곡은 다시 안 뽑는다
{
  const r = run({items:items3, now:1, on:true, kind:2, via:'_plSkipNext'});
  chk(r === 'play:0' || r === 'play:2', '셔플 · ⏭ : 지금 곡(1)이 아닌 칸을 뽑는다 (' + r + ')');
}

// (ㅂ) 멈춘 상태·빈 목록 — 아무것도 안 한다(버튼은 비활성이지만 단축키·경로가 늘 수 있다)
chk(run({items:items3, now:-1, on:true, kind:0, via:'_plSkipNext'}) === '', '멈춘 상태면 아무것도 안 한다');
chk(run({items:[],      now:0,  on:true, kind:0, via:'_plSkipNext'}) === '', '빈 목록이면 아무것도 안 한다');

// (ㅅ) 곡이 하나뿐 — 목록 반복이면 그 곡을 다시, 끔이면 정지
chk(run({items:['a'], now:0, on:true,  kind:0, via:'_plSkipNext'}) === 'play:0', '곡이 하나 · 목록 반복: 다시 연다');
chk(run({items:['a'], now:0, on:false, kind:0, via:'_plSkipNext'}) === 'stop',   '곡이 하나 · 반복 끔: 정지');

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 자동과 ⏭ 는 한 곡 반복 하나에서만 갈린다');
process.exit(0);
