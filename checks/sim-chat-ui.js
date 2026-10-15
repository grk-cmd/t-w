/* ═══ 💬 sim-chat-ui.js — 💬 채팅 모듈 구조 (2026-10-14 신설 · 앱 FSD 24번) ═══════════════
   app.js 의 💬 채팅 다섯 구역 본문 을 parts/chat/chat-ui.js 로 옮겼다(글자 그대로 · 바뀐 줄 37 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(채팅 검사들).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(DEMOJI_BY_CMD · DEMOJI_BY_ID · DEMOJI_DIR · DEMOJI_LIST · EMOJI_SLOTS · FLY_COLOR_LEVEL · _bindChatCopy · _bindChatTabs · _chatClearNow · _chatClearUndo · _chatFlyColor · setChatFlyColor · _chatFlyOn · setChatFlyOn · _chatFlyRefreshUI · _chatFlySize · setChatFlySize · _chatIsMinimized · _chatMyTabId · _chatTabName · _chatTabOut · _chatTabResolve · _chatTabsOnMeta · _chatTabsRender · _chatWindowIsOpen · _deleteEmoji · _emojiCache · _flyLaneFreeAt · setFlyLaneFreeAt · _flySizeOk · _onEmojiFilePicked · _onEmojiSlotClick · _renderChatLog · _saveChatLog · _saveChatWinPos · _sendChatWindowMsg · _setChatMinimized · _syncChatBadgeSub · _toggleEmojiPanel · closeChatWindow · openChatWindow · sendMyChat · showFlyText)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 35줄 그대로 · 부르는 곳은 chatUiMod.이름 · html(app.js 앞)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · chat-ui.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["chat-ui.js","parts/chat/chat-ui.js","app/parts/chat/chat-ui.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — chat-ui.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_chatDelClose","_chatEsc","_chatIsHost","_chatLinkify","_chatOffOn","_chatOffRefreshUI","_chatRoomCode","_diceSvg","_officeDemojiHtml","_parseDanceCmdChain","_refreshChatMembers","_seatLabelName","asyncPrompt","bringWinToFront","escHtml","findMySeat","getDisplayName","getMyUserId","isDanceUnlocked","showChatBubble","startMyDance","toast"];
const VAL_DEPS = ["seats","twNav"];
const GET_DEPS = ["CHAT_WIN_POS_KEY","Presence","_chatLogCache","_chatLogUnsub","_danceCmdCooldownAt","_myHomeData","focusLevelMod","isAdmin","officeMode"];
const SET_DEPS = ["_chatLogCache","_chatLogUnsub","setDanceCmdCooldownAt"];
const EXPORTS = ["DEMOJI_BY_CMD","DEMOJI_BY_ID","DEMOJI_DIR","DEMOJI_LIST","EMOJI_SLOTS","FLY_COLOR_LEVEL","_bindChatCopy","_bindChatTabs","_chatClearNow","_chatClearUndo","_chatFlyColor","setChatFlyColor","_chatFlyOn","setChatFlyOn","_chatFlyRefreshUI","_chatFlySize","setChatFlySize","_chatIsMinimized","_chatMyTabId","_chatTabName","_chatTabOut","_chatTabResolve","_chatTabsOnMeta","_chatTabsRender","_chatWindowIsOpen","_deleteEmoji","_emojiCache","_flyLaneFreeAt","setFlyLaneFreeAt","_flySizeOk","_onEmojiFilePicked","_onEmojiSlotClick","_renderChatLog","_saveChatLog","_saveChatWinPos","_sendChatWindowMsg","_setChatMinimized","_syncChatBadgeSub","_toggleEmojiPanel","closeChatWindow","openChatWindow","sendMyChat","showFlyText"];
const MOVED = ["FLY_BAND_PX","FLY_LANE_PX","FLY_LANES","FLY_JITTER_PX","FLY_MAX_LIVE","FLY_SPEED_PX_S","FLY_DUR_MIN_MS","FLY_DUR_MAX_MS","FLY_LANE_GAP","FLY_SEND_GAP","FLY_COLOR_LEVEL","FLY_COLORS","FLY_SIZES","_chatFlyOn","_chatFlyColor","_chatFlySize","_flyLaneFreeAt","_flySentAt","_chatFlySendGate","_flyColorOk","_flySizeOk","_flyPickLane","showFlyText","_chatFlyRefreshUI","sendMyChat","CHAT_READ_KEY_PREFIX","_chatReadMarker","_chatReadRoom","_chatJumpToUnread","_chatMsgKey","_chatClearedTo","CHAT_JOIN_KEY_PREFIX","_chatJoinKeyOf","_chatJoinCut","_noteChatJoin","_chatSinceJoin","_chatClearRoom","_chatVisibleRows","_chatClearNow","_chatClearUndo","_chatReadKeyOf","_loadChatReadMarker","_saveChatReadMarker","_markChatRead","CHAT_BADGE_LIMIT","_chatBadgeUnsub","_chatBadgeRoom","_chatWindowIsOpen","_chatPreMinH","_chatMinSinceKey","_chatIsMinimized","_setChatMinimized","_syncChatMinBadge","_setChatBadge","_stopChatBadgeSub","_startChatBadgeSub","_syncChatBadgeSub","openChatWindow","closeChatWindow","_restoreChatWinPos","_saveChatWinPos","_refreshChatProfile","_chatMyTab","_chatTabRoom","CHAT_TAB_LS_PREFIX","_chatTabLoad","_chatTabSave","_chatTabSyncRoom","_chatTabUnread","_chatTabUnreadUnsubs","CHAT_TAB_UNREAD_LIMIT","_chatTabServer","_chatTabAdd","_chatTabRename","_chatTabDelete","_chatTabMeta","_chatTabResolve","_chatMyTabId","_chatTabOut","_chatTabName","_chatMarkKey","_chatSubscribeTab","_chatTabUnreadStop","_chatTabUnreadStart","_chatSwitchTab","_chatTabSig","_chatTabsOnMeta","_chatTabEdit","_chatTabsRender","_chatTabEditHtml","_chatTabEditSubmit","_chatAsk","_chatTabMenu","_bindChatTabs","_renderChatLog","_chatShownRows","_chatHeldOn","_chatHeldN","_chatSelInBox","_chatChipRefresh","_chatFlushHeld","_chatSelRows","_chatSelText","_chatCopyToast","_chatWriteClip","_chatCtxClose","_chatCtxOpen","_chatCtxRun","_bindChatCopy","_renderEmojiMarkers","_renderDiceMarkers","_renderChatText","CHAT_EMOJI_RUN_MAX","CHAT_SAME_RUN_MAX","CHAT_SAME_COOL_MS","CHAT_BURST_N","CHAT_BURST_MS","CHAT_OUT_MAX","_chatSameText","_chatSameCount","_chatSameAt","_chatSendTimes","_emojiRunTooLong","_chatBlockReason","_chatNoteSent","_sendChatWindowMsg","_saveChatLog","_emojiCache","_emojiPendingSlot","EMOJI_SLOTS","DEMOJI_DIR","DEMOJI_LIST","DEMOJI_BY_ID","DEMOJI_BY_CMD","_loadMyEmojis","_renderEmojiPanel","_toggleEmojiPanel","_onEmojiSlotClick","_onEmojiFilePicked","_deleteEmoji","_applyEmojiCommands","_applyDefaultEmojiOnly"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  CHAT_WIN_POS_KEY: ()=>CHAT_WIN_POS_KEY,","  Presence: ()=>Presence,","  _chatDelClose: (...a)=>chatPrefsMod._chatDelClose(...a),","  _chatEsc: (...a)=>_chatEsc(...a),","  _chatIsHost: (...a)=>chatLockMod._chatIsHost(...a),","  _chatLinkify: (...a)=>_chatLinkify(...a),","  _chatLogCache: ()=>_chatLogCache,","  _chatLogUnsub: ()=>_chatLogUnsub,","  _chatOffOn: (...a)=>chatLockMod._chatOffOn(...a),","  _chatOffRefreshUI: (...a)=>chatLockMod._chatOffRefreshUI(...a),","  _chatRoomCode: (...a)=>chatLockMod._chatRoomCode(...a),","  _danceCmdCooldownAt: ()=>iDeskMod._danceCmdCooldownAt(),","  _diceSvg: (...a)=>diceMod._diceSvg(...a),","  _myHomeData: ()=>mhStateMod._myHomeData(),","  _officeDemojiHtml: (...a)=>overheadMod._officeDemojiHtml(...a),","  _parseDanceCmdChain: (...a)=>iDeskMod._parseDanceCmdChain(...a),","  _refreshChatMembers: (...a)=>chatPrefsMod._refreshChatMembers(...a),","  _seatLabelName: (...a)=>overheadMod._seatLabelName(...a),","  asyncPrompt: (...a)=>asyncPromptMod.asyncPrompt(...a),","  bringWinToFront: (...a)=>winStackMod.bringWinToFront(...a),","  escHtml: (...a)=>escHtml(...a),","  findMySeat: (...a)=>findMySeat(...a),","  focusLevelMod: ()=>focusLevelMod,","  getDisplayName: (...a)=>getDisplayName(...a),","  getMyUserId: (...a)=>getMyUserId(...a),","  isAdmin: ()=>isAdmin,","  isDanceUnlocked: (...a)=>iDeskMod.isDanceUnlocked(...a),","  officeMode: ()=>officeMode,","  seats: seats,","  showChatBubble: (...a)=>showChatBubble(...a),","  startMyDance: (...a)=>iDeskMod.startMyDance(...a),","  toast: (...a)=>toast(...a),","  setChatLogCache: (v)=>{ _chatLogCache = v; },","  setChatLogUnsub: (v)=>{ _chatLogUnsub = v; },","  setDanceCmdCooldownAt: (v)=>{ iDeskMod.setDanceCmdCooldownAt(v); },","  twNav: twNav,"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'module',
    src + '\nreturn window.TwChatUi;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, undefined);
  return api.createChatUi(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwChatUi = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwChatUi(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(app.includes("const CHAT_UI_MOD_OFF = {};   // 모듈이 없으면(검사가 app.js 만 굴릴 때) 빈 껍데기") && app.includes("const chatUiMod = (typeof TwChatUi === 'undefined') ? CHAT_UI_MOD_OFF : TwChatUi.createChatUi({"), '모듈이 없으면 빈 껍데기 · 만드는 줄');
  const mk = (app.match(new RegExp('const chatUiMod = \\(typeof TwChatUi === \'undefined\'\\) \\? CHAT_UI_MOD_OFF : TwChatUi\\.createChatUi\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = mk.split('\n').map(kindOf);
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:])').test(A.replace(/const chatUiMod = [\s\S]*?\n\}\);/, '')));
  t(!bare.length, '부르는 곳은 chatUiMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/chat/chat-ui.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/chat/chat-ui.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/chat/chat-ui.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  ['deps 하나 빠짐', null, a => { const i = a.indexOf("const chatUiMod = (typeof TwChatUi === 'undefined') ? CHAT_UI_MOD_OFF : TwChatUi.createChatUi({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }, null],
  ['전역 이름 안 걺', m => m.replace('window.TwChatUi = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const chatUiMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('chatUiMod.' + x)); if(n){ ls[i] = ls[i].replace('chatUiMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createChatUi(deps){', 'function createChatUi(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
