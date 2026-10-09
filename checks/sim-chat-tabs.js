/* sim-chat-tabs.js — 💬 채팅 탭(채널) 분리 검사
   실행:  node sim-chat-tabs.js   (chat-tabs.js · app.js · firebase-init.js · desk-companion-prototype.html · firebase-database-rules.json 과 같은 폴더에서)

   ★ 왜 이 검사가 있는가 — 탭은 구버전과 같은 방을 쓴다. 조용히 새는 자리가 둘이다.
     ① 영화 탭의 말풍선 · 날리기를 예전 `chat` 칸으로 보내면 **구버전은 탭을 모르니 방 전원에게 띄운다.**
     ② 탭 기록 노드 이름이 `_` 로 시작하지 않으면 구버전 · 정리 코드가 그 키를 **사람으로 세서** 방이 안 사라진다.

   ★ 무엇을 보는가 (핸드오프 ④ 확인 ①~⑤ + 순수 함수)
     §1 chat-tabs.js 실행 — 목록 · [+] 조건(방장 · 3개) · 이름 · 지워진 탭 → #일반 · 탭별 인원 · 경로
     §2 송수신 — ① 일반 외 탭은 chat 칸을 안 쓴다(실행) ② 수신부가 chatTab.tab 을 내 탭과 비교
     §3 화면 — ③ [+] 표시가 canAdd(방장 · 상한) ⑤ 탭 줄에 가로 스크롤 없음 · 줄임표 · #chatWindow 안 확인창
     §4 규칙 · 정리 — ④ tabs 개수 상한 · _chatTab 검증이 chatLog 와 같은 식 · presence tab/chatTab · 빈 방 정리 */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const CT = read('chat-tabs.js'), APP = read('app.js'), FB = read('firebase-init.js'), HTML = read('desk-companion-prototype.html'), RULES = read('firebase-database-rules.json');
if (!CT || !APP || !FB || !HTML || !RULES) { say('  ? 원본 못 찾음 — chat-tabs.js · app.js · firebase-init.js · HTML · 규칙'); process.exit(2); }

say('§1 chat-tabs.js (실행)');
const mod = { exports: {} };
new Function('module', 'window', CT)(mod, undefined);
const T = mod.exports;
const meta = { s2: { name: '영화감상', ts: 2 }, s1: { name: '게임', ts: 1 } };
const L = T.list(meta);
chk(L.map(t => t.id).join() === 'general,s1,s2' && L[0].name === '일반', '#일반이 맨 앞, 나머지는 만든 순');
chk(T.list({ s1: { name: 'x', ts: 1 }, zz: { name: 'y', ts: 2 }, s2: { name: 'z', ts: 3 } }).map(t => t.id).join() === 'general,s1,s2', '자리(s1 · s2)가 아닌 키는 그리지 않는다');
chk(T.canAdd(true, {}) && T.canAdd(true, { s1: meta.s1 }) && !T.canAdd(true, meta), '③ [+] — 방장 · #일반 포함 3개 미만일 때만');
chk(!T.canAdd(false, {}), '③ 참여자에게는 [+] 가 없다');
chk(T.cleanName('  #영화 ', {}).name === '영화' && T.cleanName('', {}).err && T.cleanName('가'.repeat(11), {}).err && T.cleanName('일반', {}).err && T.cleanName('게임', meta).err,
  '이름 — # · 공백 떼기 · 빈 이름 · 11자 · 「일반」 · 같은 이름 거부');
chk(T.cleanName('게임', meta, 's1').name === '게임', '  이름 바꾸기는 자기 이름과 겹쳐도 된다');
chk(T.resolve('s2', meta) === 's2' && T.resolve('zz', meta) === 'general', '지워진 탭에 있으면 #일반');
const c = T.counts([{ tab: 's2' }, {}, { tab: 'zz' }, { tab: 'general' }, { tab: 's2' }], meta);
chk(c.general === 3 && c.s2 === 2 && c.s1 === 0, '탭별 인원 — 탭 칸이 없으면(구버전) · 없어진 탭이면 #일반');
chk(T.logPath('R', 'general') === 'rooms/R/chatLog' && T.logPath('R') === 'rooms/R/chatLog' && T.logPath('R', 's2') === 'rooms/R/_chatTab/s2', '#일반 기록은 예전 chatLog 그대로 · 그 외는 _chatTab');
chk(T.LOG_NODE.charAt(0) === '_', '★ 탭 기록 노드는 `_` 로 시작한다 — 아니면 구버전이 그 키를 멤버로 센다(유령 방)');
chk(T.markKey('R', 'general') === 'R' && T.markKey('R', 's2') === 'R#s2', '읽음 · 입장 컷 키 — #일반은 예전 방 코드 그대로');
chk(T.freeSlot({}) === 's1' && T.freeSlot({ s1: {} }) === 's2' && T.freeSlot({ s2: {} }) === 's1' && T.freeSlot({ s1: {}, s2: {} }) === null, '빈 자리는 s1 · s2 뿐 — 다 차면 null');

say('§2 송수신');
const sendChatSrc = (APP.match(/function sendChat\(text, fly, flyColor, flySize, tab\)\{[\s\S]*?\n  \}/) || [''])[0];
chk(!!sendChatSrc, 'Presence.sendChat(…, tab) 을 찾았다');
{
  const sent = [];
  const run = new Function('provider', '_basePayload', sendChatSrc + '\nreturn sendChat;')({ update: (p) => sent.push(p) }, () => ({ state: 'idle' }));
  run('안녕', false, '', '', 's2');
  run('같이 봐요', true, '#fff', 'm', 's2');
  run('일반이에요', false, '', '', 'general');
  run('옛 호출');
  chk(!('chat' in sent[0]) && sent[0].chatTab && sent[0].chatTab.tab === 's2' && sent[0].chatTab.text === '안녕', '① 영화 탭 말풍선은 chat 이 아니라 chatTab 칸으로 (구버전은 안 띄운다)');
  chk(!('chat' in sent[1]) && sent[1].chatTab.fly === true && sent[1].chatTab.flySize === 'm', '① 영화 탭 날리기도 chatTab 칸으로');
  chk(sent[2].chat && !('chatTab' in sent[2]) && !('tab' in sent[2].chat), '#일반은 예전 chat 칸 그대로');
  chk(sent[3].chat && !('chatTab' in sent[3]), '탭을 안 넘기는 옛 호출(상태칩 이모티콘 등)도 #일반');
}
const recv = (APP.match(/const ctab = friends\[id\]\.chatTab;[\s\S]*?\n    \}/) || [''])[0];
chk(/ctab\.tab === _chatMyTabId\(\)/.test(recv) && /window\._activeChannel === 2/.test(recv), '② 수신부가 chatTab.tab 을 내 탭과 비교한다 (투게더룸 · 시크릿룸만)');
chk(/s\._lastChatTabTs = \(friends\[id\]\.chatTab && friends\[id\]\.chatTab\.ts\) \|\| null;/.test(APP), '  들어오기 전 탭 말풍선은 다시 안 띄운다');
chk(/const _onGeneral = _chatMyTabId\(\) === 'general';\s*if\(!_onGeneral && !_demojiOnly\)/.test(APP), '#일반 말풍선은 #일반에 있는 사람에게만 (기본 이모티콘 단독은 그대로)');
chk(/danceStyle:_myDanceStyle\(\), tab:_chatTabOut\(\), flyCool:/.test(APP) && /function _chatTabOut\(\)\{ const t = _chatMyTabId\(\); return t === 'general' \? null : t; \}/.test(APP), '내 탭을 presence 에 싣는다 (#일반이면 칸을 지움)');
chk(/sendMyChat\(bubbleText, _fly, _fly \? _chatFlyColor : '', _chatFlySize, _chatMyTabId\(\)\)/.test(APP), '대화창에서 친 글은 지금 탭으로');
chk(/sendChatLog\(room, \{ uid:getMyUserId\(\), name:getDisplayName\(\), text:outText \}, _chatMyTabId\(\)\)/.test(APP), '  기록도 지금 탭으로');
chk(/function _chatMyTabId\(\)\{\s*if\(window\._activeChannel !== 2\) return 'general';/.test(APP), '워킹룸에는 탭이 없다 (언제나 #일반)');

say('§3 화면');
const render = (APP.match(/function _chatTabsRender\(\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/ChatTabs\.canAdd\(host, _chatTabMeta\(\)\)/.test(render) && /const host = _chatIsHost\(\);/.test(render), '③ [+] 표시는 canAdd(방장, 상한) 로만');
chk(/function _chatTabMenu\(id\)\{\s*if\(!_chatIsHost\(\)\) return;/.test(APP), '  탭 우클릭 메뉴는 방장만');
chk(/#일반은 이름을 바꾸거나 지울 수 없어요\./.test(APP) && /대화 기록도 같이 지워지고, 있던 사람은 #일반으로 옮겨져요\./.test(APP), '  확인창 문구(사양 그대로)');
const ask = (APP.match(/function _chatAsk\(text, btns\)\{[\s\S]*?\n\}/) || [''])[0];
chk(/getElementById\('chatWindow'\)/.test(ask) && /win\.appendChild\(ov\)/.test(ask) && !/document\.body\.appendChild/.test(ask), '  확인창은 #chatWindow 의 자식');
const cssRules = (HTML.match(/\.chat-tabs\{[^}]*\}|\.ct-[a-z]+\{[^}]*\}/g) || []).join('\n');
chk(cssRules.length > 0 && !/overflow-x\s*:\s*(auto|scroll)/.test(cssRules) && !/overflow\s*:\s*(auto|scroll)/.test(cssRules), '⑤ 탭 줄 CSS 에 가로 스크롤이 없다');
chk(/\.chat-tabs\{[^}]*overflow:hidden/.test(HTML) && /\.ct-name\{[^}]*text-overflow:ellipsis/.test(HTML) && /\.ct-n\{[^}]*flex-shrink:0/.test(HTML) && /\.ct-unread\{[^}]*flex-shrink:0/.test(HTML),
  '  좁아지면 이름만 줄임표, 인원 · 안 읽음 숫자는 줄지 않는다');
chk(/title="#' \+ escHtml\(t\.name\) \+ '"/.test(render), '  title 에 전체 이름');
chk(/id="chatTabs"/.test(HTML.slice(HTML.indexOf('<div id="chatWindow">'), HTML.indexOf('<div class="chat-memberbar">'))), '탭 줄은 메뉴바와 멤버 줄 사이');
chk(/#chatWindow\.min \.chat-tabs/.test(HTML), '접으면 탭 줄도 숨는다');
chk(/'#' \+ _chatTabName\(_chatMyTabId\(\)\) \+ '에 메시지 입력 후 Enter'/.test(APP), '입력칸 안내 「#이름에 메시지 입력 후 Enter」');
chk(/clearChatLog\(room, _chatMyTabId\(\)\)/.test(APP), '🗑 기록 삭제는 지금 보는 탭만');
chk(/if\(_chatTabRoom !== room\)\{ _chatTabRoom = room; _chatMyTab = 'general'; \}/.test(APP), '방에 들어오면 #일반 · 같은 방이면 보던 탭 유지');

say('§4 규칙 · 정리');
const rules = JSON.parse(RULES).rules.rooms.$room;
chk(!/numChildren/.test(RULES), '★ 규칙에 numChildren 이 없다 — RTDB 규칙에 없는 함수라 규칙 전체가 거부된다');
chk(rules._meta.tabs && /\$tabId\.matches\(\/\^s\[12\]\$\/\)/.test(rules._meta.tabs.$tabId['.validate']), '④ _meta.tabs 는 s1 · s2 두 자리만 — #일반 제외 2개까지가 구조로 막힌다');
const tv = rules._meta.tabs && rules._meta.tabs.$tabId && rules._meta.tabs.$tabId['.validate'];
chk(!!tv && /length <= 10/.test(tv), '  탭 이름 10자');
const ctv = rules._chatTab && rules._chatTab.$tabId && rules._chatTab.$tabId.$msgId && rules._chatTab.$tabId.$msgId['.validate'];
chk(!!ctv && ctv === rules.chatLog.$msgId['.validate'], '④ _chatTab 기록 검증이 chatLog 와 같은 식 (text ≤ 1200)');
chk(!rules.chatTab, '  규칙에 `chatTab`(밑줄 없는) 자리는 없다');
const mv = rules.$memberId['.validate'];
chk(/newData\.child\('tab'\)\.val\(\)\.length <= 16/.test(mv) && /newData\.child\('chatTab'\)\.child\('text'\)\.val\(\)\.length <= 140/.test(mv), 'presence tab · chatTab 검증 (text ≤ 140)');
{
  const fc = (FB.match(/const _finalCleanup = async \(keys\)=>\{[\s\S]*?\n {10}\};/) || [''])[0];
  const FN = read('functions/room-stats.js') || '';
  chk(fc.length > 0 && !/\/_chatTab`/.test(fc) && /if \(keys && keys\._chatTab\) await db\.ref\('rooms\/' \+ code \+ '\/_chatTab'\)\.remove\(\);/.test(FN),
      '빈 방 정리 — 탭 기록은 서버 함수가 _meta 와 함께 걷는다(앱 퇴장은 안 지운다 · sim-room-meta-cleanup.js)');
}
chk(/async deleteChatTab\(room, tabId\)\{[\s\S]{0,300}_meta\/tabs\/\$\{tabId\}`\] = null;[\s\S]{0,80}_chatTab\/\$\{tabId\}`\] = null;/.test(FB), '탭 삭제는 정의 · 기록을 한 묶음으로');
chk(/runTransaction\(ref\(db, `rooms\/\$\{room\}\/_meta\/tabs`\)/.test(FB), '탭 추가는 트랜잭션 — 동시에 눌러도 셋째가 안 생긴다');
chk(/방장 제한은 \*\*화면 수준\*\*/.test(FB) && /방장 제한은 \*\*화면 수준\*\*/.test(APP), '방장 제한이 화면 수준이라는 한계를 주석으로 남겼다');

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅ — 탭 말풍선은 같은 탭에만, 구버전은 #일반만 본다');
process.exit(fail ? 1 : 0);
