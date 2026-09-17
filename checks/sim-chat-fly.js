/* sim-chat-fly.js — 🌊 채팅 「날리기」(흐르는 자막) 검사
   실행:  node sim-chat-fly.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 이 기능은 **이미 있는 세 가지 규약 위에 얹힌다.** 얹는 자리마다
     "나중에 한쪽만 고쳐지면 조용히 깨지는" 짝이 생겼다. 그 짝을 여기서 묶는다.

       ① 클릭 통과 — 글자가 마우스를 가로채면 그 순간 아래 앱 조작이 막힌다. 화면 위쪽 전체를
          덮는 층이라 사고가 나면 «캐릭터 주변이 아니라 화면 절반»이 먹통이 된다.
          게다가 이 층을 클릭 통과 화이트리스트에 넣으면 정반대 사고가 난다 — 전체화면
          사각형이 들어가 «화면 어느 점에서나 우리 UI» 가 되어 회수 로직이 통째로 죽는다
          (app.js _uiRegions 의 pointer-events:none 주석이 그 사고 기록이다).
       ② 비활성 FPS — 포커스가 없으면 오버레이 FPS 가 낮다(sim-unfocused-fps). rAF 로 옮기는
          순간 **남의 화면에서만** 뚝뚝 끊긴다. 내 화면에서는 멀쩡해서 알아채기 어렵다.
       ③ 채널 — 워킹룸은 「일에 집중」 규약이다. 조건이 한 줄(`_activeChannel === 2`)이라야
          투게더룸+시크릿룸과 정확히 겹친다. 늘리는 순간 _chatDelRefreshUI 쪽과 어긋난다.

     ④ 그리고 이 기능만의 것: **레벨 판정이 받는 쪽에 있는가.** 보내는 쪽에만 두면 값을
        조작해 Lv.200 색을 쓸 수 있다. 보내는 쪽 체크는 편의고, 인정은 받는 쪽이 한다.

   ★ 무엇을 보는가 — 마크업·CSS·소스 대조 (런타임 DOM 은 보지 않는다)
     §1 전송      — payload 에 fly/flyColor 가 실리는가 · 안 쓰면 안 싣는가 · 연타 억제
     §2 수신      — 채널을 보는가 · 레벨을 **받는 쪽에서** 다시 보는가 · 말풍선과 갈라지는가
     §3 층·클릭통과 — #flyLayer 가 pointer-events:none 인가 · 화이트리스트에 안 들어갔는가 ·
                      z 층 · 띠가 화면 한가운데 기준인가
     §4 움직임    — CSS 애니메이션인가 · rAF 로 옮기지 않았는가 ·
                    속도가 px/s 인가(초 고정이면 넓은 화면에서 빨라진다) · JS 와 CSS 의 거리가 같은가
     §5 레인·상한 — 8명이 동시에 날리면 8레인으로 흩어지는가 · 동시 상한이 도는가
     §6 글자 모양 — 검은 테두리 + 흰 글씨 두 겹 · 이름: 내용 형식 · 색은 표에 있는 것만

   ⚠ 실제 화면에서 «읽히는가»는 여기서 못 본다 — 그건 눈으로 볼 것. 여기는 규약만 지킨다. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 🌊 채팅 날리기 (흐르는 자막) ===');
say('');

/* ── §1. 전송 ─────────────────────────────────────────────────────── */
say('· §1 전송 — payload 와 연타 억제');

const sendChat = (SRC.match(/function sendChat\(text[\s\S]*?\n  \}/) || [''])[0];
chk(sendChat.length > 0, 'Presence.sendChat 를 찾았다');
chk(/sendChat\(text,\s*fly,\s*flyColor,\s*flySize\)/.test(SRC),
    '★ sendChat 이 fly·flyColor·flySize 를 받는다');
chk(/chat\.fly\s*=\s*true/.test(sendChat),
    '★ 체크한 줄에만 chat.fly 를 싣는다');
chk(/flySize !== 'l'/.test(sendChat),
    "★ 기본 크기(대)는 payload 에 안 싣는다 — 받는 쪽이 «없으면 대» 로 읽는다");
chk(/if\s*\(fly\)/.test(sendChat) || /if\(fly\)/.test(sendChat),
    '★ fly 가 거짓이면 칸 자체를 안 싣는다 (안 쓰는 사람의 모든 메시지가 커지지 않는다)');
chk(/chat:\s*\{[^}]*fly\s*:\s*(false|!!)/.test(SRC) === false,
    '★ fly:false 를 항상 실어 보내지 않는다');

// 연타 억제 — 한 노드가 마지막 하나만 들고 있어서 앞 줄이 덮인다
chk(/function _chatFlySendGate\(\)/.test(SRC), '연타 억제 함수가 있다');
const gate = (SRC.match(/function _chatFlySendGate\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/FLY_SEND_GAP/.test(gate), '★ 간격이 상수(FLY_SEND_GAP)로 한 곳에 있다');
const sendWin = (SRC.match(/function _sendChatWindowMsg\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/_chatFlyOn\s*&&\s*_chatFlySendGate\(\)/.test(sendWin),
    '★ 보내는 자리에서 체크 상태와 억제를 함께 본다');
chk(/sendMyChat\(bubbleText,\s*_fly/.test(sendWin),
    '★ 막힌 줄도 sendMyChat 으로는 나간다 (친 글을 잃지 않는다 — 말풍선으로 떨어진다)');
/* 🏢 [2026-09-17] 회사원 모드 — 보내는 쪽(체크 숨김·fly 안 실음)과 보는 쪽(상대 날리기도 말풍선/라벨로) 둘 다.
   플라잉체어·효과음과 같은 «보는 사람 기준» 규칙. 켜는 순간 흐르던 글자를 걷고 체크를 푼다. */
const OFF = /!\(typeof officeMode !== 'undefined' && officeMode\)/;
chk(OFF.test(sendWin) && sendWin.indexOf('officeMode') < sendWin.indexOf('_chatFlyOn && _chatFlySendGate'), '🏢 보낼 때 회사원 모드면 fly 를 안 싣는다');
const refreshUi = (SRC.match(/function _chatFlyRefreshUI\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/const on = \(window\._activeChannel === 2\) && !\(typeof officeMode/.test(refreshUi), '🏢 회사원 모드면 날리기 줄을 숨긴다');
chk(/chat\.fly && window\._activeChannel === 2 && !\(typeof officeMode !== 'undefined' && officeMode\) && typeof showFlyText/.test(SRC), '🏢 받을 때 회사원 모드면 상대 날리기도 말풍선/라벨로 떨어진다(보는 사람 기준)');
const offToggle = SRC.slice(SRC.indexOf("document.getElementById('progOfficeModeToggle').onclick"), SRC.indexOf("document.getElementById('progOfficeModeToggle').onclick") + 6000);
chk(/_fl\.innerHTML=''/.test(offToggle) && /_chatFlyOn = false;/.test(offToggle) && /_chatFlyRefreshUI\(\)/.test(offToggle), '🏢 켜는 순간 흐르던 글자를 걷고 체크를 풀고 줄을 갱신한다');

// chatLog 로 도망가지 않았는가 — 비용 때문에 안 가기로 한 길이다
chk(!/subscribeChatLog[\s\S]{0,200}fly/.test(SRC),
    '★ 연타 손실을 chatLog 구독으로 풀지 않았다 (비용 때문에 떼어 낸 구조다)');

say('');

/* ── §2. 수신 ─────────────────────────────────────────────────────── */
say('· §2 수신 — 채널과 레벨');

const recv = (SRC.match(/const chat=friends\[id\]\.chat;[\s\S]*?\n    \}/) || [''])[0];
chk(recv.length > 0, '수신 분기를 찾았다');
chk(/chat\.fly/.test(recv), '★ chat.fly 를 본다');
chk(/chat\.fly\s*&&\s*window\._activeChannel\s*===\s*2/.test(recv),
    '★ 채널을 본다 — 워킹룸에서는 fly 가 와도 흐르지 않는다');
// 조건을 늘리면 _chatDelRefreshUI 쪽과 어긋난다(시크릿룸은 언제나 투게더룸으로 열린다)
chk(!/_chatIsSecretRoom\(\)/.test(recv),
    '★ 시크릿룸 판정을 따로 덧대지 않았다 (_activeChannel===2 한 줄이 곧 투게더룸+시크릿룸)');
chk(/friends\[id\]\.level/.test(recv) && /FLY_COLOR_LEVEL/.test(recv),
    '★ 레벨을 **받는 쪽에서** 다시 본다 (보내는 쪽 체크만 믿으면 값을 조작해 색을 쓴다)');
chk(/chat\.flySize/.test(recv), '★ 크기도 같이 넘긴다');
chk(/FLY_COLOR_LEVEL \? chat\.flyColor : ''/.test(recv) && !/FLY_\w*LEVEL[^,]*flySize/.test(recv),
    '★ 레벨 문턱이 **색에만** 걸려 있다 — 크기는 읽기 편하자고 있는 것이지 치장이 아니다');
chk(/else\s+if\(\(window\._activeChannel === 2 \|\| _demojiOnly\)/.test(recv),
    '★ 날리지 않는 줄은 기존 말풍선 분기로 그대로 떨어진다');

say('');

/* ── §3. 층과 클릭 통과 ───────────────────────────────────────────── */
say('· §3 #flyLayer — 클릭 통과와 층');

chk(/<div id="flyLayer"/.test(HTML), '#flyLayer 요소가 마크업에 있다');
const layerCss = (HTML.match(/#flyLayer\{[^}]*\}/) || [''])[0];
chk(layerCss.length > 0, '#flyLayer 규칙을 찾았다');
chk(/pointer-events:none/.test(layerCss), '★ 층이 pointer-events:none 이다');
const flyCss = (HTML.match(/\n  \.fly\{[^}]*\}/) || [''])[0];
chk(/pointer-events:none/.test(flyCss), '★ 글자 자체도 pointer-events:none 이다');

// 화이트리스트에 들어가면 정반대 사고가 난다 — 전체화면 사각형이 회수 로직을 죽인다
chk(!/_WIN_Z_LAYERS[\s\S]{0,200}flyLayer/.test(SRC),
    '★ 창 z 목록(_WIN_Z_LAYERS)에 없다 — 자막은 창이 아니다');
chk(!/UI_HIT_SEL[\s\S]{0,400}flyLayer/.test(SRC) && !/closest\('#flyLayer'\)/.test(SRC),
    '★ 클릭 통과 화이트리스트에 넣지 않았다 (넣으면 화면 위쪽 전체가 «우리 UI» 가 된다)');

// #chatOverlay 안에 들어가면 조상으로 화이트리스트에 걸린다
const beforeChat = HTML.slice(0, HTML.indexOf('<div id="chatOverlay"'));
chk(/<div id="flyLayer"/.test(beforeChat),
    '★ #chatOverlay 바깥에 있다 (안에 넣으면 조상으로 화이트리스트에 걸린다)');

const zm = layerCss.match(/z-index:(\d+)/);
chk(!!zm && Number(zm[1]) > 60 && Number(zm[1]) < 70,
    '★ z 가 플레이리스트 패널(60)보다 위, 창들(70~92)보다 아래다 — 영상 위로 흐르되 창은 안 가린다'
    + (zm ? ' [지금 ' + zm[1] + ']' : ''));
/* 자리 — 화면 한가운데 기준 위아래 300px. 상단 고정으로 되돌아가지 않았는지 본다.
   ⚠️ 이 띠는 캐릭터·책상 위를 지난다. 그게 **의도**다 — 「안 가린다」로 되돌리는 것이
     이 검사가 막는 회귀다(상단 40% 는 2026-09-16 에 버린 자리다). */
chk(/calc\(50vh - 300px\)/.test(layerCss),
    '★ 띠가 화면 한가운데 기준이다 (상단 고정으로 되돌아가지 않았다)');
chk(/height:min\(600px, 100vh\)/.test(layerCss),
    '★ 높이 600px — 화면이 그보다 낮으면 화면 안으로 접힌다 (띠가 밖으로 새지 않는다)');
chk(!/height:40%/.test(layerCss), '옛 상단 40% 규칙이 남아 있지 않다');

say('');

/* ── §4. 움직임 ───────────────────────────────────────────────────── */
say('· §4 움직임 — CSS 애니메이션만');

chk(/@keyframes flyAcross\{/.test(HTML), '★ @keyframes flyAcross 가 있다');
chk(/animation:flyAcross/.test(flyCss), '★ .fly 가 그 애니메이션을 쓴다');
chk(/translateX/.test(HTML.match(/@keyframes flyAcross\{[^}]*\}[^}]*\}/) || ''),
    'transform:translateX 로 움직인다 (left/margin 은 매 프레임 레이아웃을 다시 잡는다)');

const showFly = (SRC.match(/function showFlyText\(seat, text, color, size\)[\s\S]*?\n\}/) || [''])[0];
chk(showFly.length > 0, 'showFlyText 를 찾았다');
chk(!/requestAnimationFrame/.test(showFly) && !/setInterval/.test(showFly),
    '★ rAF·setInterval 로 옮기지 않는다 (포커스 없을 때 남의 화면에서만 끊긴다 — sim-unfocused-fps)');
chk(/animationend/.test(showFly), '★ animationend 에 지운다 (타이머로 재지 않는다)');

/* 🐢 속도 — 「몇 초에 건너간다」가 아니라 「초당 몇 px」이어야 한다.
   시간을 고정하면 **화면이 넓을수록 빨라진다.** 같은 방의 두 사람이 모니터가 다르면
   같은 메시지를 다른 속도로 보게 되고, 서로 왜 그런지 알 길이 없다(2026-09-16 실측). */
chk(/const FLY_SPEED_PX_S\s*=\s*\d+/.test(SRC),
    '★ 속도가 px/s 로 정해져 있다 (초 고정이 아니다)');
chk(!/FLY_BASE_MS|FLY_LEN_MS/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')),
    '★ 옛 「고정 초」 상수(FLY_BASE_MS·FLY_LEN_MS)가 코드에 남아 있지 않다');
chk(/window\.innerWidth/.test(showFly) && /offsetWidth/.test(showFly),
    '★ 시간을 **화면 폭 + 글자 폭**에서 역산한다');
chk(/travelPx \/ FLY_SPEED_PX_S/.test(showFly), '★ 거리 ÷ 속도 로 시간을 낸다');

/* ★ 두 파일이 어긋나는 자리 — JS 가 재는 거리와 CSS 가 실제로 가는 거리가 같아야 한다.
     CSS: translateX(calc(-100vw - 100%))   JS: innerWidth + offsetWidth
     100vw=화면 폭 · 100%=자기 글자 폭. 한쪽만 고치면 속도가 조용히 어긋난다. */
{
  const kf = (HTML.match(/@keyframes flyAcross\{[\s\S]*?\}\s*\}/) || [''])[0];
  chk(/-100vw - 100%/.test(kf),
      '★ CSS 가 가는 거리(100vw + 100%)가 JS 가 잰 거리(innerWidth + offsetWidth)와 같다');
}
// 폭 재기는 한 줄에 한 번이면 된다 — 매 프레임 재면 그게 곧 rAF 이동과 같은 값이 된다
{
  // 주석에도 offsetWidth 가 나오므로 주석을 걷고 센다 — §4-⑧ 과 같은 함정이다
  const code = showFly.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  chk((code.match(/offsetWidth/g) || []).length === 1,
      '★ 폭은 메시지 한 줄당 한 번만 잰다 (레이아웃 강제가 한 번뿐이다)');
}
// 재는 동안 이미 흐르고 있으면 안 된다
chk(/animation = 'none'/.test(showFly) && /animation = ''/.test(showFly),
    "★ 붙일 때는 애니메이션을 꺼 두었다가 시간을 정한 뒤 켠다 (재는 동안 이미 흐르면 안 된다)");

say('');

/* ── §5. 레인과 동시 상한 ─────────────────────────────────────────── */
say('· §5 레인 배정과 동시 상한');

chk(/const FLY_LANES\s*=\s*(\d+)/.test(SRC), '레인 수가 상수다');
chk(/function _flyPickLane\(/.test(SRC), '레인 배정 함수가 있다');

// 실제로 돌려 본다 — 8명이 동시에 날리면 8레인으로 흩어져야 한다
{
  const lanesN = Number((SRC.match(/const FLY_LANES\s*=\s*(\d+)/) || [0, 0])[1]);
  const gapN   = Number((SRC.match(/const FLY_LANE_GAP\s*=\s*(\d+)/) || [0, 0])[1]);
  const pick   = (SRC.match(/function _flyPickLane\([\s\S]*?\n\}/) || [''])[0];
  /* 무작위가 들어갔으므로 **여러 번** 돌린다. 한 번만 보면 운으로 통과할 수 있다.
     지키는 것은 두 가지다: ① 같은 순간이면 레인이 안 겹친다(빈 칸 중에서만 고른다)
     ② 순서가 늘 같지 않다(무작위가 실제로 걸려 있다 — 계단처럼 내려가지 않는다). */
  let allDistinct = true, orders = new Set(), err = '';
  try{
    for(let r = 0; r < 40; r++){
      const sandbox = { FLY_LANES: lanesN, FLY_LANE_GAP: gapN, _flyLaneFreeAt: [] };
      const fn = new Function('S', 'with(S){ ' + pick
        + ' const got=[]; const t=1000;'
        + ' for(let i=0;i<FLY_LANES;i++) got.push(_flyPickLane(t));'
        + ' S.__got = got; }');
      fn(sandbox);
      if(new Set(sandbox.__got).size !== lanesN) allDistinct = false;
      orders.add(sandbox.__got.join(','));
    }
  }catch(e){ allDistinct = false; err = ' — ' + e.message; }
  chk(allDistinct, '★ 같은 순간에 ' + lanesN + '명이 날리면 ' + lanesN
        + '레인으로 흩어진다 (빈 칸 중에서만 고른다)' + err);
  chk(orders.size > 1, '★ 배정 순서가 매번 다르다 [40회에 ' + orders.size
        + '가지] — 순서대로 돌리면 글자가 계단처럼 내려가는 게 눈에 보인다');
}
chk(/FLY_LANE_GAP/.test(SRC), '★ 같은 레인은 간격을 두고 다음 글자를 받는다 (앞 글자와 안 겹친다)');
// 흔들림은 레인 높이보다 훨씬 작아야 한다 — 크면 옆 레인을 침범해 두 줄이 겹친다
{
  const jit  = Number((SRC.match(/const FLY_JITTER_PX\s*=\s*(\d+)/) || [0, 0])[1]);
  const lane = Number((SRC.match(/const FLY_LANE_PX\s*=\s*(\d+)/)   || [0, 0])[1]);
  chk(jit > 0 && lane > 0 && jit * 2 < lane / 2,
      '★ 레인 안 흔들림(±' + jit + 'px)이 레인 높이(' + lane
      + 'px)를 침범하지 않는다 — 크게 잡으면 두 줄이 겹쳐 둘 다 못 읽는다');
  const lanesN = Number((SRC.match(/const FLY_LANES\s*=\s*(\d+)/) || [0, 0])[1]);
  const band   = Number((SRC.match(/const FLY_BAND_PX\s*=\s*(\d+)/) || [0, 0])[1]);
  chk(lanesN * lane <= band,
      '★ 레인 ' + lanesN + '칸 × ' + lane + 'px 가 띠(' + band
      + 'px) 안에 들어간다 — 넘치면 아래쪽 레인이 잘려 안 보인다');

  /* ★ 두 파일이 어긋나는 자리다 — 글자 크기는 **HTML 의 CSS**, 레인 높이는 **app.js 의 상수**.
     한쪽만 키우면 그 순간 조용히 줄이 겹친다. 여기서 맞대어 본다.
     (sim-win-layers 가 창 층을 두 파일에서 맞대어 보는 것과 같은 이유다.) */
  /* 크기가 3단이 되면서 재야 할 것이 «가장 큰 단» 으로 바뀌었다 —
     한 화면에 대·중·소가 섞여 흐르므로, 칸은 제일 큰 것을 담아야 한다.
     그래서 .fly 계열의 font-size 를 **전부 모아 최대값**을 쓴다(대만 보지 않는다). */
  const fonts = [];
  const baseF = (flyCss.match(/font:\s*\d+\s+(\d+)px/) || [])[1];
  if(baseF) fonts.push(Number(baseF));
  let m, reSz = /\.fly\.sz-\w\{font-size:(\d+)px/g;
  while((m = reSz.exec(HTML))) fonts.push(Number(m[1]));
  const fpx = fonts.length ? Math.max.apply(null, fonts) : 0;

  const strokes = [];
  let m2, reSt = /--fly-stroke:(\d+)px/g;
  while((m2 = reSt.exec(HTML))) strokes.push(Number(m2[1]));
  const strokePx = strokes.length ? Math.max.apply(null, strokes) : 0;

  const need = Math.ceil(fpx * 1.2) + strokePx * 2 + jit * 2;
  chk(fpx > 0 && strokePx > 0 && lane >= need,
      '★ 레인 높이(' + lane + 'px)가 **가장 큰 단**(' + fpx + 'px × 1.2 + 테두리 '
      + strokePx + 'px×2 + 흔들림 ' + jit + 'px×2 = ' + need
      + 'px)을 담는다 — 큰 단만 키우고 레인을 그대로 두면 줄이 겹친다 [단: '
      + fonts.sort((a,b)=>b-a).join('/') + 'px]');

  /* 작은 단은 테두리도 같이 줄어야 한다 — 27px 에 맞춘 4px 을 16px 글자에 그대로 쓰면
     선이 글자를 먹어 한글 획이 붙는다. «글자가 작을수록 테두리도 얇다» 만 본다. */
  {
    const pairs = [];
    const bs = (flyCss.match(/--fly-stroke:(\d+)px/) || [])[1];
    if(baseF && bs) pairs.push([Number(baseF), Number(bs)]);
    let m3, rePair = /\.fly\.sz-\w\{font-size:(\d+)px;--fly-stroke:(\d+)px/g;
    while((m3 = rePair.exec(HTML))) pairs.push([Number(m3[1]), Number(m3[2])]);
    pairs.sort((a, b) => a[0] - b[0]);
    let mono = pairs.length >= 2;
    for(let i = 1; i < pairs.length; i++){ if(pairs[i][1] < pairs[i-1][1]) mono = false; }
    chk(mono, '★ 글자가 작을수록 테두리도 얇다 [' 
        + pairs.map(p=>p[0]+'px/'+p[1]+'px').join(' · ')
        + '] — 큰 글자용 굵기를 작은 글자에 그대로 쓰면 획이 붙는다');
  }
}
chk(/const FLY_MAX_LIVE\s*=\s*\d+/.test(SRC), '동시 상한 상수가 있다');
chk(/children\.length > FLY_MAX_LIVE/.test(showFly),
    '★ 상한을 넘으면 가장 오래된 것부터 지운다');

say('');

/* ── §6. 글자 모양 ────────────────────────────────────────────────── */
say('· §6 글자 모양 — 테두리·형식·색');

/* 테두리 굵기는 크기 3단이 되면서 --fly-stroke 로 갈라졌다(4·3·2px).
   여기서는 «검은색인가» 만 본다 — 굵기 자체는 §5 가 단별로 맞대어 본다. */
chk(/-webkit-text-stroke:var\(--fly-stroke,\s*4px\) #000/.test(HTML),
    '★ 검은 테두리가 있다 (굵기는 단마다 --fly-stroke 로 갈린다)');
chk(/\.fly \.fly-out\{/.test(HTML) && /\.fly \.fly-ink\{/.test(HTML),
    '★ 앞(본체)·뒤(테두리) 두 겹이다 — 한 겹에 stroke 만 걸면 한글 획이 파먹힌다');
chk(/fly-out[\s\S]{0,120}fly-ink/.test(showFly),
    '★ 두 겹에 **같은 HTML** 을 넣는다 (::before + attr 로는 이모티콘 그림을 못 따라간다)');
chk(/_seatLabelName/.test(showFly),
    '★ 이름을 이름표와 같은 출처에서 꺼낸다 (발밑 이름표와 다른 사람처럼 보이지 않게)');
chk(/nameHtml[\s\S]{0,80}': '/.test(showFly) || /\+ ': '/.test(showFly),
    "★ 「이름: 내용」 한 형식으로 통일돼 있다");
chk(/_chatEsc[\s\S]{0,200}_officeDemojiHtml/.test(showFly),
    '★ 이스케이프가 **먼저**, 마커 변환이 나중이다 (뒤집으면 <img> 가 글자로 나온다)');

// 색 — 남이 보낸 문자열을 그대로 style 에 꽂지 않는다
chk(/const FLY_COLORS\s*=\s*\[/.test(SRC), '고를 수 있는 색이 표로 있다');
const colorOk = (SRC.match(/function _flyColorOk\([\s\S]*?\n\}/) || [''])[0];
chk(/FLY_COLORS\.indexOf/.test(colorOk),
    '★ 표에 있는 색만 통과시킨다 (받은 문자열을 그대로 style 에 꽂지 않는다)');
chk(/FLY_COLOR_LEVEL/.test(colorOk), '★ 레벨 판정이 같은 함수 안에 있다');
chk(/const FLY_COLOR_LEVEL\s*=\s*200/.test(SRC), '해금 레벨이 200 이다');

// 🔠 크기 — 목록·검증·단추가 서로 맞는가
chk(/const FLY_SIZES\s*=\s*\['l', 'm', 's'\]/.test(SRC), '크기 목록이 대·중·소 셋이다');
const sizeOk = (SRC.match(/function _flySizeOk\([\s\S]*?\n\}/) || [''])[0];
chk(/FLY_SIZES\.indexOf/.test(sizeOk) && /: 'l'/.test(sizeOk),
    '★ 표에 없는 값은 조용히 기본(대)으로 떨어진다 (받은 문자열을 그대로 class 에 안 붙인다)');
{
  const btns = (HTML.match(/data-flysize="(\w)"/g) || []).map(x => x.slice(-2, -1));
  const css  = (HTML.match(/\.fly\.sz-(\w)\{/g)    || []).map(x => x.slice(-2, -1));
  // 대(l)는 기본값이라 .fly 자체가 담당한다 — sz-l 클래스는 없는 게 맞다
  chk(btns.join(',') === 'l,m,s', '★ 단추가 대·중·소 셋이다 [' + btns.join(',') + ']');
  chk(css.sort().join(',') === 'm,s',
      '★ 대는 기본값이라 클래스가 없다 (.fly 가 그대로 대다) [sz-' + css.join(' sz-') + ']');
}

// 해금해도 테두리는 남는다 — 색만 남으면 밝은 장면에서 글자가 사라진다
const glowCss = (HTML.match(/\.fly\.glow \.fly-ink\{[^}]*\}/) || [''])[0];
const rbCss   = (HTML.match(/\.fly\.rainbow \.fly-ink\{[^}]*\}/) || [''])[0];
chk(glowCss.length > 0 && rbCss.length > 0, '글로우·무지개 규칙이 있다');
chk(!/text-stroke\s*:\s*none/.test(glowCss + rbCss) && !/\.fly-out\{[^}]*display:none/.test(HTML),
    '★ 색을 켜도 검은 테두리를 지우지 않는다 (밝은 장면에서 글자가 통째로 사라진다)');

// UI — 채널이 아니면 줄째 사라진다 · Lv 미달이면 색 고르개가 자리째 빠진다
chk(/<div class="chat-flyrow off" id="chatFlyRow">/.test(HTML),
    '★ 체크 줄의 기본값이 숨김이다 (방에 들어가기 전 잠깐 보이지 않는다)');
/* 자리 — 입력칸 **바로 아래**, 즉 `.chat-input-col` 안이다.
   `.chat-inputrow` 의 직계로 되돌리면 프로필 칸(74px)이 입력칸보다 커서
   그 아래로 밀려나고, 입력칸과 체크 줄 사이에 빈 띠가 생긴다(2026-09-16 화면 확인). */
{
  const col = (HTML.match(/<div class="chat-input-col">[\s\S]*?\n      <\/div>/) || [''])[0];
  chk(/id="chatFlyRow"/.test(col),
      '★ 체크 줄이 .chat-input-col 안에 있다 — 입력칸 바로 아래에 붙는다');
  chk(col.indexOf('id="chatInput"') < col.indexOf('id="chatFlyRow"'),
      '★ 입력칸 **다음**에 온다 (위로 올라가면 툴바와 입력칸 사이를 가른다)');
  chk(!/chatFlyHint/.test(HTML) && !/fly-hint/.test(HTML),
      '★ 옛 안내 문구가 남아 있지 않다 — 체크박스와 색 고르개 사이를 벌려 놓기만 했다');
}
chk(/\.chat-flyrow\.off\{display:none;\}/.test(HTML), '.off 가 줄째 숨긴다');
const refresh = (SRC.match(/function _chatFlyRefreshUI\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/window\._activeChannel === 2/.test(refresh), '★ 표시 조건이 채널 한 줄이다');
chk(/_chatOffRefreshUI[\s\S]{0,600}_chatFlyRefreshUI\(\)/.test(SRC),
    '★ 갱신을 _chatOffRefreshUI 에 얹었다 (호출 자리를 따로 두면 한쪽이 빠진다)');
chk(/classList\.toggle\('on', okLv\)/.test(refresh),
    '★ Lv 미달이면 색 고르개가 자리째 빠진다 (자물쇠를 보여주지 않는다)');

// 체크 상태는 세션만 — 저장하면 «왜 자꾸 날아가지»가 된다
chk(!/localStorage[^\n]{0,60}_chatFlyOn/.test(SRC) && !/_chatFlyOn[^\n]{0,60}localStorage/.test(SRC),
    '★ 체크 상태를 저장하지 않는다 (세션 변수)');
const leave = (SRC.match(/async function doLeaveRoom\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/_chatFlyOn = false/.test(leave) && /flyLayer/.test(leave),
    '★ 방을 나가면 흐르던 글자를 걷고 체크도 푼다');

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — 클릭 통과·비활성 FPS·채널·레벨 네 규약을 지킨다');
process.exit(0);
