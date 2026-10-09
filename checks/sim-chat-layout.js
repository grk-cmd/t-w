/* sim-chat-layout.js — 💬 대화창 세로 배치 검사 (탭 줄이 대화에 눌려 사라지던 것)
   실행:  node sim-chat-layout.js   (desk-companion-prototype.html · app.js 와 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 제보 «채팅을 하면 할수록 하단이 늘어나서 탭 부분이 가려짐».
     #chatWindow 는 높이가 정해진 세로 flex 다. 대화 칸(.chat-messages)이 flex:1 1 auto 였는데,
     auto 는 «기준 크기 = 내용 높이» 라 대화가 쌓일수록 기준이 커지고, 넘친 만큼을 형제들이
     기준 크기 비율로 나눠 줄인다. 형제 대부분은 내용보다 작아지지 않지만(min-height:auto),
     탭 줄(.chat-tabs)은 overflow:hidden 이라 최소 높이가 0 으로 풀려 **20px → 1px** 로 눌렸다.
     (Electron 하네스 실측: 100줄에서 탭 줄 높이 1px, 고친 뒤 20px 그대로 · 대화 칸만 스크롤)
   ★ 무엇을 보는가
     §1 대화 칸 — 기준 크기 0(남은 자리만) · 세로 스크롤 · 최소 높이
     §2 창 — 높이가 정해진 세로 flex · 창의 직계 줄 중 overflow 가 hidden 인 것은 flex-shrink:0
     §3 입력칸 — 한 줄 input(여러 줄로 자라지 않음) · textarea 로 바꾸면 max-height 가 있어야
     §4 맨 아래면 새 메시지에 따라 내려간다(_renderChatLog)
     §5 옛 CSS 를 넣으면 §1 · §2 가 빨강이 된다(검사가 실제로 잡는지) */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const HTML = read('desk-companion-prototype.html'), APP = read('app.js');
if (!HTML || !APP) { say('  ? 원본 못 찾음 — desk-companion-prototype.html · app.js'); process.exit(2); }

/* 첫 <style> 블록만 — 창 안의 CSS 가 모두 여기 있다. 주석을 지워 주석 속 예시에 속지 않는다. */
const cssOf = (html) => html.slice(html.indexOf('<style>'), html.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
/* 선택자가 정확히 sel 인 규칙들의 본문을 이어 붙인다(테마 · .min 같은 변형은 빼고 기본 규칙만). */
function rulesFor(css, sel){
  const out = [], re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) if (m[1].split(',').map(s => s.trim()).includes(sel)) out.push(m[2]);
  return out.join(';');
}
const prop = (body, name) => { const m = [...body.matchAll(new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)', 'g'))]; return m.length ? m[m.length - 1][1].trim() : null; };
/* flex 줄임형에서 기준 크기 · 줄어듦 값을 뽑는다 */
function flexParts(body){
  const f = prop(body, 'flex'), out = { grow: null, shrink: null, basis: null };
  if (f){ const p = f.split(/\s+/); out.grow = p[0]; out.shrink = p[1] || '1'; out.basis = p[2] || (p.length === 1 && /^\d/.test(p[0]) ? '0' : null); }
  if (prop(body, 'flex-shrink') != null) out.shrink = prop(body, 'flex-shrink');
  if (prop(body, 'flex-basis') != null) out.basis = prop(body, 'flex-basis');
  return out;
}
/* #chatWindow 의 직계 자식(첫 단계 div)의 class/id — 마크업에서 깊이로 */
function windowChildren(html){
  const s = html.indexOf('<div id="chatWindow"'); if (s < 0) return [];
  const re = /<div\b([^>]*)>|<\/div>/g; re.lastIndex = s; let m, d = 0; const kids = [];
  while ((m = re.exec(html))){
    if (m[0] === '</div>'){ d--; if (d === 0) break; continue; }
    d++;
    if (d === 2){ const a = m[1]; kids.push({ id: (a.match(/id="([^"]+)"/) || [])[1] || null, cls: ((a.match(/class="([^"]+)"/) || [])[1] || '').split(/\s+/).filter(Boolean) }); }
  }
  return kids;
}

function judge(html, quiet){
  let bad = 0;
  const c = quiet ? (ok) => { if (!ok) bad++; } : (ok, msg) => { if (!ok) bad++; chk(ok, msg); };
  const css = cssOf(html);
  const msgs = rulesFor(css, '.chat-messages');
  const mf = flexParts(msgs);
  if (!quiet) say('§1 대화 칸 (.chat-messages)');
  c(mf.grow === '1', '남은 자리를 받는다(flex-grow 1) — 지금: ' + mf.grow);
  c(mf.basis != null && /^0(px|%)?$/.test(mf.basis), '★ 기준 크기 0 — auto 면 대화가 쌓일수록 위 줄(탭)을 눌러 없앤다 — 지금: ' + mf.basis);
  c(/^(auto|scroll)$/.test(prop(msgs, 'overflow-y') || prop(msgs, 'overflow') || ''), '넘치는 대화는 이 칸 안에서 세로 스크롤');
  c(/^\d+px$/.test(prop(msgs, 'min-height') || ''), '최소 높이가 있다(창을 줄여도 대화 칸이 0 이 되지 않게)');

  if (!quiet) say('§2 창 (#chatWindow) · 창 안 줄');
  const win = rulesFor(css, '#chatWindow');
  c(prop(win, 'display') === 'flex' && prop(win, 'flex-direction') === 'column', '세로 flex');
  c(/^\d+px$/.test(prop(win, 'height') || ''), '높이가 정해져 있다(내용 따라 자라지 않는다 — 저장된 크기는 JS 가 인라인으로 덮는다)');
  const kids = windowChildren(html);
  c(kids.some(k => k.cls.includes('chat-tabs')) && kids.some(k => k.cls.includes('chat-messages')), '탭 줄 · 대화 칸이 창의 직계 자식이다(마크업 읽기)');
  kids.forEach(k => {
    if (k.cls.includes('chat-messages')) return;
    const body = k.cls.map(x => rulesFor(css, '.' + x)).concat(k.id ? [rulesFor(css, '#' + k.id)] : []).join(';');
    const pos = prop(body, 'position'), ov = prop(body, 'overflow') || prop(body, 'overflow-y');
    if (pos === 'absolute' || pos === 'fixed') return;   // 흐름 밖 — 눌리지 않는다
    if (ov && ov !== 'visible'){
      const f = flexParts(body);
      c(f.shrink === '0', '★ overflow:' + ov + ' 인 줄 ' + (k.cls[0] ? '.' + k.cls[0] : '#' + k.id) + ' 은 flex-shrink:0 — 아니면 최소 높이 0 으로 눌린다');
    }
  });
  return bad;
}

judge(HTML, false);

say('§3 입력칸');
const inpTag = (HTML.match(/<(input|textarea)\b[^>]*id="chatInput"[^>]*>/) || [])[0] || '';
if (/^<input/.test(inpTag)) chk(/type="text"/.test(inpTag), '#chatInput 은 한 줄 input — 여러 줄로 자라 창을 밀지 않는다');
else chk(/max-height/.test(rulesFor(cssOf(HTML), '.chat-input')), '#chatInput 이 textarea 면 .chat-input 에 max-height(자라다 멈추고 스크롤)');

say('§4 맨 아래 따라가기 (_renderChatLog)');
const rl = APP.slice(APP.indexOf('function _renderChatLog('), APP.indexOf('function _renderChatLog(') + 6000);
chk(/const atBottom = \(box\.scrollHeight - box\.scrollTop - box\.clientHeight\) < \d+/.test(rl), '그리기 전에 맨 아래였는지 잰다');
chk(/else if\(atBottom \|\| jump\)\{\s*box\.scrollTop = box\.scrollHeight;/.test(rl), '맨 아래였으면 새 메시지 뒤 맨 아래로');

say('§5 옛 CSS 로 되돌리면 잡는가');
const OLD = HTML
  .replace(/\.chat-messages\{margin:0 6px;flex:1 1 0;/, '.chat-messages{margin:0 6px;flex:1 1 auto;')
  .replace(/\.chat-tabs\{display:none;flex-shrink:0;/, '.chat-tabs{display:none;');
chk(OLD !== HTML, '되돌릴 자리를 찾았다');
const oldBad = judge(OLD, true);
chk(oldBad >= 2, '옛 CSS(flex:1 1 auto · 탭 줄 shrink 기본값)는 빨강 ' + oldBad + '건');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 대화가 쌓여도 탭 줄 · 인원 줄은 그대로, 대화 칸만 스크롤');
process.exit(fail ? 1 : 0);
