/* sim-chat-badge-layer.js — 💬 안 읽은 채팅 뱃지가 옆 ▾ 버튼에 가려지지 않는가 (desk-companion-prototype.html CSS)
   [무엇을 지키나] 뱃지(#myChatBadge)는 [💬 채팅] 버튼 오른쪽 위 모서리 밖으로 걸치고, 바로 오른쪽엔 ▾(#myStatusChipBtn)가 붙어 있다.
     둘 다 position 이 있고 ▾ 가 DOM 에서 뒤라, 쌓는 순서(z-index)가 없으면 ▾ 가 뱃지를 덮는다.
   실제 HTML 을 jsdom 에 통째로 싣고 계산된 스타일(getComputedStyle)로 본다 — 스크립트는 돌리지 않는다.
   ・1절: 뱃지가 ▾ 보다 위 · 칩이 쌓임 맥락이라 뱃지는 칩 안에서만 · 칩 팝업(▾ 메뉴 · 이모티콘)은 뱃지보다 위 · 뱃지는 클릭을 막지 않음 · 버블 테마도 같음
   ・2절: mutation test — 뱃지의 z-index 를 지우면 1절이 빨강
   [실행] 저장소 루트에서 node checks/run.js sim-chat-badge-layer */
'use strict';
const fs = require('fs');
const path = require('path');

function find(rel){
  for(const d of [process.cwd(), __dirname, path.join(__dirname, '..')]){
    for(const r of [rel, path.join('app', rel), path.join('apps', 'desktop', 'app', rel)]){
      const p = path.join(d, r);
      if(fs.existsSync(p)) return p;
    }
  }
  return null;
}
const HTML_PATH = find('desk-companion-prototype.html');
if(!HTML_PATH){ console.log('  ? 원본 못 찾음 — desk-companion-prototype.html'); process.exit(2); }
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (e) { console.log('  ✗ jsdom 을 못 불러옴 — npm install 필요: ' + e.message); process.exit(1); }
const HTML = fs.readFileSync(HTML_PATH, 'utf8');

let pass = 0, fail = 0;
const chk = (ok, msg) => { if(ok){ pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const zNum = (z) => (z === 'auto' || z === '' || z == null) ? 0 : Number(z);

/* html 글 그대로(또는 바꾼 사본)를 싣고 뱃지를 켠 채 계산된 값을 돌려준다 */
function layers(html, theme){
  const w = new JSDOM(html).window;   // runScripts 없음 — CSS 와 마크업만
  const doc = w.document;
  if(theme) doc.documentElement.setAttribute('data-theme', theme);
  const $ = (id) => doc.getElementById(id);
  const badge = $('myChatBadge'), btn = $('myChatBtn'), caret = $('myStatusChipBtn'), group = $('myChipGroup'), chip = $('myStatusChip');
  if(!badge || !btn || !caret || !group || !chip) return null;
  btn.style.display = '';
  badge.classList.add('on');
  badge.textContent = '12';
  const cs = (el) => w.getComputedStyle(el);
  const sib = [...group.children];
  return {
    badge: cs(badge), btn: cs(btn), caret: cs(caret), chip: cs(chip),
    more: $('myChipMore') && cs($('myChipMore')), demoji: $('myDemojiBox') && cs($('myDemojiBox')),
    badgeInBtn: badge.parentElement === btn,
    caretAfter: sib.indexOf(caret) > sib.indexOf(btn) && sib.indexOf(btn) >= 0,
    chipHasPopups: !!(chip.contains($('myChipMore')) && chip.contains($('myDemojiBox'))),
  };
}

function judge(L, label){
  const p = label ? ' (' + label + ')' : '';
  if(!L){ chk(false, '상태칩 마크업을 찾았다' + p); return; }
  chk(L.badgeInBtn && L.caretAfter, '전제 — 뱃지는 [💬 채팅] 안 · ▾ 는 같은 줄에서 그 뒤(그래서 순서가 없으면 ▾ 가 나중에 그려진다)' + p);
  chk(L.badge.position === 'absolute' && L.badge.display !== 'none', '뱃지는 버튼 모서리 밖으로 걸친 absolute' + p);
  chk(zNum(L.badge.zIndex) > zNum(L.caret.zIndex) && zNum(L.badge.zIndex) > zNum(L.btn.zIndex),
    '★ 뱃지 z-index(' + L.badge.zIndex + ')가 ▾(' + L.caret.zIndex + ') · 채팅 버튼(' + L.btn.zIndex + ')보다 위 — ▾ 에 가려지지 않는다' + p);
  chk(L.chip.position !== 'static' && L.chip.zIndex !== 'auto', '★ 상태칩이 쌓임 맥락(position · z-index ' + L.chip.zIndex + ') — 뱃지의 z-index 는 칩 안에서만 효력(다른 창 순서는 그대로)' + p);
  chk(L.chipHasPopups && L.more && L.demoji && zNum(L.more.zIndex) > zNum(L.badge.zIndex) && zNum(L.demoji.zIndex) > zNum(L.badge.zIndex),
    '  칩 팝업(▾ 메뉴 ' + (L.more && L.more.zIndex) + ' · 이모티콘 ' + (L.demoji && L.demoji.zIndex) + ')은 뱃지보다 위' + p);
  chk(L.badge.pointerEvents === 'none', '  뱃지는 클릭을 막지 않는다(pointer-events:none — 걸친 자리를 눌러도 ▾ 가 눌린다)' + p);
}

console.log('── 1. 쌓는 순서 (jsdom getComputedStyle)');
judge(layers(HTML), '');
judge(layers(HTML, 'bubble'), '버블 테마');

console.log('── 2. mutation test');
{
  const RULE = '#myChatBadge{display:none;position:absolute;z-index:1;';
  chk(HTML.includes(RULE), 'html 원문의 뱃지 규칙이 그대로 있다(아래 변이의 바탕)');
  const L = layers(HTML.replace(RULE, '#myChatBadge{display:none;position:absolute;'));
  chk(!!L && zNum(L.badge.zIndex) <= zNum(L.caret.zIndex), '뱃지의 z-index 를 지우면 — ▾ 와 같은 층(' + (L && L.badge.zIndex) + ')이라 DOM 순서대로 ▾ 가 덮는다 → 1절 ★ 이 빨강');
}

console.log('');
console.log((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
