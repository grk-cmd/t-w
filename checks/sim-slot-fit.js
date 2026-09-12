/* sim-slot-fit.js — 📐 슬롯 5칸이 설정 패널에 들어가는가 (재작성본)
   실행:  node sim-slot-fit.js   (app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ⚠ **이 파일은 유실본을 다시 만든 것이다.** 앞 핸드오프에 "CSS 폭을 본다"고만 적혀 있어서,
     실제 마크업·CSS·JS 가 지금 하는 일을 읽고 같은 목적으로 새로 썼다. 항목 구성은 원본과
     다를 수 있다. 원본이 나오면 빠진 항목만 옮겨 붙일 것.

   ★ 왜 이 검사가 있는가 — 슬롯이 3→5 칸이 되면서 설정 패널(300px)의 슬롯 줄이 창을 넘겼다
     (제보: "마지막 칸이 창 밖으로 나감"). 지금 코드는 칸을 줄이는 대신 **4칸만 보이는 창**으로
     자르고 ◀▶ 로 민다. 그 산수가 CSS 숫자 몇 개에 걸려 있는데, **그 숫자를 아무도 안 보고 있다.**
     패널 폭·여백·화살표 폭 중 하나만 손대도 마지막 칸이 조용히 다시 잘린다.

   ★ 무엇을 보는가 (세 층)
     §1 CSS 산수 — 패널 안쪽 폭에서 화살표·여백을 빼고 남은 창에 칸이 **몇 개** 들어가는가.
        숫자는 전부 CSS 에서 읽는다(여기에 52·300 을 박으면 이 검사도 같이 낡는다).
     §2 규약 — 칸 수·칸 폭이 JS 에 박혀 있지 않은가. 넘김이 브라우저 실측(clientWidth)에
        걸려 있는가. 칸 그리기가 slots 배열을 그대로 도는가.
     §3 런타임 — _fsRevealSlot · _fsSyncSlotNav 를 **app.js 에서 원본 그대로 떼어내**
        §1 이 계산한 치수의 가짜 DOM 위에서 돌린다. **마지막 칸을 쓰던 사람이 패널을 열면
        그 칸이 보이는가**가 이 검사의 핵심이다(안 보이면 캐릭터가 사라진 줄 안다).

   ⚠ 진짜 브라우저 레이아웃은 아니다. box-sizing:border-box 전역 규칙과 flex gap 만 가정한
     산수다 — 그래서 §1 에서 그 전제부터 확인한다. 전제가 깨지면 눈으로도 볼 것. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');
const say = console.log;
let fail = 0;
const chk = (c, m) => { say((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };

say('=== 📐 슬롯 5칸이 설정 패널에 들어가는가 ===');
say('');

/* ── §1. CSS 산수 ────────────────────────────────────────────────── */
say('· §1 CSS 산수 — 창에 칸이 몇 개 들어가는가');

const CSS = (HTML.match(/<style>([\s\S]*)<\/style>/) || ['', ''])[1];
/* ⚠️ 같은 선택자가 테마 오버라이드로 여러 번 나온다(html[data-theme="bubble"] #focusSettingsPanel 등).
   그래서 '처음 걸린 것'이 아니라 **찾는 속성이 들어 있는 규칙**을 고른다.
   (여기서 헛짚으면 치수가 NaN 이 되어 검사가 통째로 헛돈다.) */
const rule = (re, must) => {
  const all = CSS.match(new RegExp(re.source, 'g')) || [];
  return all.find(r => !must || new RegExp(must).test(r)) || all[0] || '';
};
const px = (block, prop) => {
  const m = new RegExp(prop + '\\s*:\\s*([\\d.]+)px').exec(block);
  return m ? +m[1] : NaN;
};

const MAX = +(/CHAR_SLOT_MAX\s*=\s*(\d+)/.exec(SRC) || [])[1];
chk(MAX >= 1, 'app.js 의 CHAR_SLOT_MAX 를 읽었다 (' + MAX + '칸)');

chk(/\*\s*\{[^}]*box-sizing\s*:\s*border-box/.test(CSS),
    '전역 box-sizing:border-box 가 있다 (이 산수의 전제 — 없으면 테두리만큼 다 어긋난다)');

const panel  = rule(/#focusSettingsPanel\{[^}]*\}/, 'width\\s*:');
const body   = rule(/#focusSettingsPanel \.fs-body\{[^}]*\}/, 'padding\\s*:');
const row    = rule(/#focusSettingsPanel \.fs-slotrow\{[^}]*\}/, 'gap\\s*:');
const vpRule = rule(/#focusSettingsPanel \.fs-slotvp\{[^}]*\}/, 'overflow\\s*:');
const arrow  = rule(/#focusSettingsPanel \.fs-slot-arrow\{[^}]*\}/, 'width\\s*:');
const strip  = rule(/#focusSettingsPanel \.fs-charslots\{[^}]*\}/, 'gap\\s*:');
const slot   = rule(/#focusSettingsPanel \.fs-charslot\{[^}]*\}/, 'width\\s*:');
chk(!!(panel && body && row && vpRule && arrow && strip && slot),
    '필요한 CSS 규칙 7개를 다 찾았다');

const panelW   = px(panel, 'width');
const panelBd  = px(panel, 'border');                                  // border:2px solid
// padding:0 12px 12px — 첫 값이 0(단위 없음)일 수 있다. 좌우 값은 두 번째 자리.
const bodyPad  = +((/padding\s*:\s*(?:[\d.]+(?:px)?)\s+([\d.]+)px/.exec(body) || [])[1]);
const rowGap   = px(row, 'gap');
const arrowW   = px(arrow, 'width');
const slotW    = px(slot, 'width');
const slotGap  = px(strip, 'gap');
chk([panelW, panelBd, bodyPad, rowGap, arrowW, slotW, slotGap].every(isFinite),
    '치수를 전부 CSS 에서 읽었다 (패널 ' + panelW + ' · 테두리 ' + panelBd + ' · 여백 ' + bodyPad
    + ' · 화살표 ' + arrowW + ' · 칸 ' + slotW + ' · 칸간격 ' + slotGap + ')');

const inner = panelW - panelBd * 2 - bodyPad * 2;
const vpW   = inner - arrowW * 2 - rowGap * 2;
const fits  = Math.floor((vpW + slotGap) / (slotW + slotGap));
const stripW = MAX * slotW + (MAX - 1) * slotGap;
say('    안쪽 ' + inner + 'px → 창 ' + vpW + 'px → 한 번에 ' + fits + '칸 (줄 전체 ' + stripW + 'px)');

chk(fits >= 1, '★ 창에 적어도 한 칸은 들어간다');
chk(fits >= 2, '★ 창에 두 칸 이상 들어간다 (한 칸씩 보이면 넘김이 고문이다)');
chk(vpW > 0 && inner > 0, '패널 여백을 빼고도 창이 남는다');
chk(slotW >= 48, '칸이 48px 이상이다 (그 아래로는 얼굴 썸네일이 뭉개진다 — CSS 주석의 결정)');

/* 넘치는 경우와 안 넘치는 경우 둘 다 말이 되어야 한다 */
if (stripW > vpW){
  chk(/overflow\s*:\s*hidden/.test(vpRule), '★ 줄이 창보다 길다 → 창이 넘침을 잘라 준다(overflow:hidden)');
  chk(/width\s*:\s*max-content/.test(strip),
      '★ 줄에 width:max-content 가 있다 (없으면 칸들이 창 폭에 찌그러져 들어가 버린다)');
  chk(/fs-slot-arrow/.test(HTML), '화살표가 마크업에 있다');
} else {
  chk(true, '줄이 창 안에 다 들어간다 — 넘김이 필요 없다 (' + stripW + ' ≤ ' + vpW + ')');
}

// 화살표를 안 쓰는 칸(빈 칸)도 같은 폭이어야 줄 계산이 맞는다
chk(/\.fs-charslot\.empty\{/.test(CSS.replace(/#focusSettingsPanel /g, '')),
    '빈 칸(.fs-charslot.empty)도 같은 규칙 위에 얹혀 있다');

// 마크업이 창·화살표 구조를 실제로 갖고 있는가 (CSS 만 있고 마크업이 없으면 산수는 무의미)
const rows = (HTML.match(/class="fs-slotrow"/g) || []).length;
chk(rows >= 2, '슬롯 줄이 둘이다 — 캐릭터 교체 · 자리 추가 (' + rows + '줄)');
chk((HTML.match(/class="fs-slotvp"/g) || []).length === rows, '줄마다 창이 하나씩 있다');
chk((HTML.match(/class="fs-slot-arrow"/g) || []).length === rows * 2, '줄마다 화살표가 둘씩 있다');

say('');

/* ── §2. 규약 ────────────────────────────────────────────────────── */
say('· §2 규약 — 칸 수·칸 폭이 JS 에 박혀 있지 않은가');

const render = (SRC.match(/function renderCharSlots\(\)[\s\S]*?\n\}/) || [''])[0];
chk(render.length > 0, 'renderCharSlots 를 찾았다');
chk(/slots\.forEach/.test(render), '★ 칸을 slots 배열 그대로 그린다 (칸 수를 세지 않는다)');
chk(!/\b[3-9]\b\s*[;)\],]/.test(render.replace(/'[^']*'/g, '')) || !/for\s*\(\s*let\s+i\s*=\s*0\s*;\s*i\s*<\s*\d/.test(render),
    '   칸 수를 숫자로 도는 반복문이 없다');
chk(/_fsRevealSlot\('fsCharSlots',\s*curSlot\)/.test(render),
    '★ 패널을 열 때 지금 쓰는 칸으로 창을 맞춘다 (마지막 칸을 쓰던 사람 배려)');
chk(/_fsRevealSlot\('fsAddSeatSlots',\s*curSlot\)/.test(render), '   자리 추가 줄도 같이 맞춘다');

const bind = (SRC.match(/function _fsBindSlotNav\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/vp\.clientWidth/.test(bind),
    '★ 한 번에 미는 양이 창 폭(clientWidth)이다 — 칸 수·칸 폭이 JS 에 안 적혀 있다');
chk(!/\b52\b|\b\d+\s*\*\s*\d+\s*\+/.test(bind), '   폭을 손으로 계산한 흔적이 없다');

const sync = (SRC.match(/function _fsSyncSlotNav\([\s\S]*?\n\}/) || [''])[0];
chk(/scrollWidth\s*-\s*vp\.clientWidth/.test(sync), '넘침 여부도 브라우저 실측으로 판단한다');
chk(/display\s*=\s*need\s*\?/.test(sync), '★ 다 들어가면 화살표를 아예 감춘다 (칸이 줄어도 알아서 사라진다)');

say('');

/* ── §3. 런타임 ──────────────────────────────────────────────────── */
say('· §3 런타임 — 마지막 칸을 쓰던 사람이 패널을 열면');

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

/* §1 이 읽은 치수 그대로 가짜 DOM 을 만든다 — 숫자를 여기 다시 적지 않는다 */
function makeStrip(n){
  const boxes = [];
  for (let i = 0; i < n; i++) boxes.push({ offsetLeft: i * (slotW + slotGap), offsetWidth: slotW });
  const arrows = [
    { dataset: { dir: '-1' }, style: {}, disabled: false },
    { dataset: { dir: '1'  }, style: {}, disabled: false },
  ];
  const row = { classList: { contains: c => c === 'fs-slotrow' },
                querySelectorAll: () => arrows };
  const vp = { scrollLeft: 0, clientWidth: vpW,
               scrollWidth: n ? (n * slotW + (n - 1) * slotGap) : 0,
               classList: { contains: c => c === 'fs-slotvp' },
               parentElement: row };
  const strip = { id: 'fsCharSlots', children: boxes, parentElement: vp };
  return { strip, vp, row, arrows };
}

const D = { current: null, getElementById(id){ return (D.current && id === 'fsCharSlots') ? D.current.strip : null; } };
const R = new Function('document', cut('_fsRevealSlot') + '\n' + cut('_fsSyncSlotNav')
  + '\n;return {_fsRevealSlot, _fsSyncSlotNav};')(D);

function open(n, cur){
  D.current = makeStrip(n);
  R._fsRevealSlot('fsCharSlots', cur);
  R._fsSyncSlotNav('fsCharSlots');
  return D.current;
}

// (ㄱ) 마지막 칸 — 이게 제보의 자리다
{
  const S = open(MAX, MAX - 1);
  const b = S.strip.children[MAX - 1];
  const visible = b.offsetLeft >= S.vp.scrollLeft - 0.5
               && b.offsetLeft + b.offsetWidth <= S.vp.scrollLeft + S.vp.clientWidth + 0.5;
  chk(visible, '★ ' + MAX + '번 칸을 쓰던 상태로 열면 그 칸이 창 안에 있다 (scrollLeft '
      + S.vp.scrollLeft + ')');
  chk(S.arrows[1].disabled, '   끝까지 밀린 상태라 ▶ 가 꺼진다');
  chk(!S.arrows[0].disabled, '   ◀ 는 살아 있다');
}

// (ㄴ) 첫 칸 — 굳이 움직이지 않는다
{
  const S = open(MAX, 0);
  chk(S.vp.scrollLeft === 0, '1번 칸이면 창을 안 움직인다');
  chk(S.arrows[0].disabled, '   ◀ 가 꺼진다');
  chk(!S.arrows[1].disabled || stripW <= vpW, '   ▶ 는 살아 있다(넘칠 때)');
}

// (ㄷ) 모든 칸이 다 닿는가 — 하나라도 못 보면 그 칸 캐릭터는 없는 것과 같다
{
  let unreachable = [];
  for (let i = 0; i < MAX; i++){
    const S = open(MAX, i), b = S.strip.children[i];
    const ok = b.offsetLeft >= S.vp.scrollLeft - 0.5
            && b.offsetLeft + b.offsetWidth <= S.vp.scrollLeft + S.vp.clientWidth + 0.5;
    if (!ok) unreachable.push(i + 1);
  }
  chk(unreachable.length === 0, '★ ' + MAX + '칸 전부가 창 안으로 들어온다'
      + (unreachable.length ? ' — 못 닿는 칸: ' + unreachable.join(',') : ''));
}

// (ㄹ) 칸이 창에 다 들어가면 화살표가 사라진다 (칸을 다시 줄여도 안 깨진다)
{
  const S = open(1, 0);
  chk(S.arrows[0].style.display === 'none' && S.arrows[1].style.display === 'none',
      '한 칸뿐이면 화살표가 아예 안 보인다');
}

// (ㅁ) 없는 칸을 가리켜도 안 죽는다 — curSlot 이 저장값보다 클 수 있다
{
  const S = open(MAX, MAX + 3);
  chk(S.vp.scrollLeft === 0, '없는 칸 번호가 들어와도 조용히 넘어간다');
}

say('');
if (fail){ say('문제 ' + fail + '건'); process.exit(1); }
say('전부 통과 ✅ — ' + MAX + '칸이 ' + panelW + 'px 패널 안에서 전부 닿는다');
process.exit(0);
