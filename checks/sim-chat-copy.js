/* sim-chat-copy.js — 📋 대화창 드래그 · 복사 검사
   실행:  node sim-chat-copy.js   (chat-copy.js · app.js · desk-companion-prototype.html 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 조용히 깨지는 자리가 셋이다.
     ① _renderChatLog 는 업데이트마다 innerHTML 로 **통째로 다시 그린다.** 선택만 풀어 주면 고르는 도중
        메시지 하나에 선택이 날아간다 → 고르는 중엔 그리기를 미뤄야 한다(칩으로 알림).
     ② 이모티콘 생략을 DOM(img) 기준으로 하면 렌더링이 바뀔 때 깨진다 → 원문 마커 기준이어야 한다.
     ③ mac 은 frame:false 창이라 기본 편집 메뉴가 없어 Cmd+C 가 안 먹는다 → 키를 직접 받아야 한다.

   ★ 무엇을 보는가
     §1 chat-copy.js 를 실제로 돌린다 — 형식 · 이모티콘 생략 · 빈 줄 빼기 · 링크 원문
     §2 HTML — 스크립트 순서 · 선택 허용 범위 · 칩/메뉴/토스트가 #chatWindow 안
     §3 app.js — 보류 분기가 innerHTML 앞 · 원문 번호(data-i) · Ctrl/Cmd 둘 다 · 우클릭 메뉴 · 선택 풀리면 그림 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const CC = read('chat-copy.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if (!CC || !APP || !HTML) { say('  ? 원본 못 찾음 — chat-copy.js · app.js · desk-companion-prototype.html'); process.exit(2); }

/* ── §1 ── */
say('§1 복사 형식 (chat-copy.js 실행)');
const mod = { exports: {} };
new Function('module', 'window', CC)(mod, undefined);
const C = mod.exports;
chk(typeof C.textFor === 'function' && typeof C.lineFor === 'function', 'textFor · lineFor 가 있다');
const msgs = [
  { name: '철수', text: '안녕하세요', ts: 1 },
  { name: '영희', text: '[emoji:https://x/a.png][demoji:d01]', ts: 2 },
  { name: '영희', text: '좋아요 [emoji:https://x/b.png] 진짜로', ts: 3 },
  { name: '민수', text: '여기 https://example.com/a?b=1 봐', ts: 4 },
  { name: '민수', text: '[dice:5]', ts: 5 },
];
const out = C.textFor(msgs);
const lines = out.split('\n');
chk(lines[0] === '철수: 안녕하세요', '한 메시지 = 한 줄 「이름: 내용」 (' + lines[0] + ')');
chk(!/\d{1,2}:\d{2}/.test(lines[0]), '시각은 넣지 않는다');
chk(!lines.some(l => l.startsWith('영희: ') && l.trim() === '영희:') && lines.length === 4, '이모티콘만 있던 줄은 통째로 빠진다 (' + lines.length + '줄)');
chk(lines[1] === '영희: 좋아요 진짜로', '이모티콘 마커는 생략, 빈칸은 하나로 (' + lines[1] + ')');
chk(lines[2] === '민수: 여기 https://example.com/a?b=1 봐', '링크는 원문 URL 그대로');
chk(!/\[(?:emoji|demoji):/.test(out), '결과에 [emoji:…] · [demoji:…] 가 남지 않는다');
chk(C.lineFor({ name: 'a', text: '   ' }) === null && C.lineFor(null) === null, '빈 내용 · 없는 메시지는 null');
chk(String(C.EMOJI_RE) === String(/\[(?:emoji|demoji):[^\]]*\]/g), '마커 정규식이 사양과 같다');

/* ── §2 ── */
say('§2 HTML');
const iCC = HTML.indexOf('<script src="parts/chat-copy.js"></script>'), iApp = HTML.indexOf('<script src="parts/app.js"></script>');
chk(iCC > 0 && iCC < iApp, 'chat-copy.js 를 app.js 보다 먼저 싣는다');
chk(/body\{[^}]*user-select:none/.test(HTML.replace(/\s+/g, ' ')) || /user-select:none;-webkit-user-select:none;\}\s*\/\* 더블클릭/.test(HTML), 'body 의 user-select:none 은 그대로다');
chk(/\.chat-messages, \.chat-messages \*\{user-select:text/.test(HTML), '대화 칸(.chat-messages)과 그 자식만 user-select:text');
chk(!/\.chat-(?:menubar|toolbar|memberbar|titlebar)[^{]*\{[^}]*user-select:text/.test(HTML), '이름표 · 툴바 · 메뉴는 여전히 못 고른다');
const winBlock = HTML.slice(HTML.indexOf('<div id="chatWindow">'), HTML.indexOf('<div id="chatDelOv">'));
for (const id of ['chatNewChip', 'chatCopyToast', 'chatCtx'])
  chk(winBlock.includes('id="' + id + '"'), '#' + id + ' 가 #chatWindow 안에 있다 (body 로 빼면 run 모드에서 클릭이 뚫린다)');
chk(/data-act="copy"/.test(winBlock) && /data-act="copyMsg"/.test(winBlock) && /data-act="all"/.test(winBlock) && /cm-ctx-sep/.test(winBlock),
  '우클릭 메뉴 [복사] [이 메시지 복사] 구분선 [전체 선택]');
chk(/#chatWindow\.min \.cm-newchip/.test(HTML), '접으면 칩도 숨는다');

/* ── §3 ── */
say('§3 app.js');
const render = (APP.match(/function _renderChatLog\(list\)[\s\S]*?\n\}/) || [''])[0];
const iHold = render.indexOf('if(_chatSelInBox())'), iHtml = render.indexOf('box.innerHTML');
chk(iHold > 0 && iHold < iHtml, '★ 고르는 중이면 innerHTML 전에 돌아간다 (선택이 안 날아간다)');
chk(render.indexOf('_chatLogCache = list') < iHold, '  보류해도 최신 list 는 받아 둔다');
chk(/class="cm-row" data-i="' \+ i \+ '"/.test(render) && /_chatShownRows = rows/.test(render), '행마다 원문 번호(data-i) → _chatShownRows');
chk(/ChatCopy\.textFor\(rows\)/.test(APP) && /_chatShownRows\[\+r\.dataset\.i\]/.test(APP), '★ 복사는 원문 기준 (DOM 의 img 를 빼는 방식 아님)');
const bind = (APP.match(/function _bindChatCopy\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/e\.ctrlKey \|\| e\.metaKey/.test(bind) && /addEventListener\('keydown'/.test(bind), 'Ctrl+C · Cmd+C 를 둘 다 직접 받는다 (mac 기본 메뉴 없음)');
chk(/if\(!_chatSelInBox\(\)\) return;\s*e\.preventDefault\(\)/.test(bind), '  대화 칸 선택일 때만 가로챈다 (입력칸 복사는 그대로)');
chk(/addEventListener\('selectionchange'[^\n]*_chatFlushHeld\(\)/.test(bind), '선택이 풀리면 보관한 list 로 그린다');
chk(/chip\.addEventListener\('click'[\s\S]{0,120}_chatFlushHeld\(\)/.test(bind), '칩을 누르면 그린다');
const flush = (APP.match(/function _chatFlushHeld\(\)[\s\S]*?\n\}/) || [''])[0];
chk(/box\.scrollTop = box\.scrollHeight/.test(flush), '  그리고 맨 아래로');
chk(/box\.addEventListener\('contextmenu', e=>\{ e\.preventDefault\(\)/.test(bind), '대화 칸 우클릭은 OS 메뉴 대신 창 안 메뉴');
chk(/m\.addEventListener\('mousedown', e=>\{ e\.preventDefault\(\)/.test(bind), '메뉴를 누르는 순간 선택이 안 풀린다');
chk(/document\.addEventListener\('mousedown'[\s\S]{0,160}_chatCtxClose\(\)/.test(bind), '바깥 mousedown 이면 메뉴가 닫힌다');
chk(/'새 메시지 ' \+ _chatHeldN \+ ' ↓'/.test(APP), '칩 글자 「새 메시지 n ↓」');
chk(/function _chatCopyToast\(\)/.test(APP) && /getElementById\('chatCopyToast'\)/.test(APP), '복사 후 창 안 토스트');
chk(/getClientRects\(\)\.length\) return false/.test(APP), '창이 숨어 있으면 보류하지 않는다 (다른 방 대화가 남지 않게)');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 고르는 동안 선택이 유지되고, 복사는 원문 기준 「이름: 내용」 이다');
process.exit(fail ? 1 : 0);
