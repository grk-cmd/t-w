/*
 * 방 설정(제목 · 최대 인원 · 방장 닉네임 · 공개)과 방 만들기 창 검사 — 모듈을 그대로 불러 돌린다.
 * 1. banned-words.js 한 벌(앱 사본 = 서버 함수 글자까지 같음 · 두 길로 실림)  2. room-settings.js(순수)  3. 범위가 규칙 · 서버 함수와 같다
 * 4. room-create-ui.js(가짜 DOM)  5. room-entry doCreateRoomInChannel  6. firebase-init 쓰기(setRoomChannel · claimHostIfVacant · claimEmptyRoom)
 * 7. remote-config bannedWords  8. 깨 보기
 * 설계: docs/ROOM_LOBBY.md 1 · 2.1 · 5.2
 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const BW_APP = need('banned-words.js'), BW_FN = need('functions/banned-words.js');
const RS_SRC = need('room-settings.js'), UI_SRC = need('room-create-ui.js'), RE_SRC = need('room-entry.js'), FI = need('firebase-init.js');
const RL = require(path.resolve('functions/room-lobby.js'));
const RULES = JSON.parse(need('firebase-database-rules.json')).rules;
const RCM = require(path.resolve('remote-config.js'));

function takeFn(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0) return src.slice(i, j + 1); }
  }
  return null;
}
const classic = (src, name) => { const w = {}; new Function('window', src)(w); return w[name]; };
const BW = classic(BW_APP, 'TwBannedWords');
const RS = classic(RS_SRC, 'TwRoomSettings');

(async () => {
say('── 1. banned-words.js — 한 벌');
{
  chk(BW_APP === BW_FN, '★ 앱 사본(shared/banned-words.js)이 서버 함수(functions/banned-words.js)와 글자까지 같다 — 판정이 두 벌로 갈라지지 않게');
  const BWN = require(path.resolve('functions/banned-words.js'));
  chk(typeof BWN.hasBannedWord === 'function' && typeof BW.hasBannedWord === 'function', '  require(서버 함수) · classic script(앱 window.TwBannedWords) 두 길로 실린다');
  const L = BW.cleanBannedList(['나쁜말']);
  chk(BW.hasBannedWord('나.쁜 말1', L) === BWN.hasBannedWord('나.쁜 말1', BWN.cleanBannedList(['나쁜말'])), '  두 길의 판정이 같다');
}

say('── 2. room-settings.js — 순수 규칙');
{
  const L = BW.cleanBannedList(['나쁜말']);
  const ok = RS.checkTitle('  조용히 그림만  ', L, BW);
  chk(ok.ok && ok.title === '조용히 그림만', '제목: 앞뒤 공백 걷고 통과');
  chk(JSON.stringify(RS.checkTitle('   ', L, BW)) === '{"ok":true,"title":""}' && RS.checkTitle(undefined, L, BW).title === '', '★ 빈 제목은 통과(title:\'\') — 목록이 «○○ 님의 방» 으로 그린다');
  chk(RS.checkTitle('가'.repeat(20), L, BW).ok && RS.checkTitle('가'.repeat(21), L, BW).reason === 'long', '  20자 통과 · 21자 long');
  chk(RS.checkTitle('나 쁜.말 하는 방', L, BW).reason === 'banned', '★ 금칙어(기호 · 띄어쓰기 끼움)는 banned');
  chk(RS.checkTitle('나쁜말', [], BW).ok, '  목록이 비면 거르지 않는다');
  chk(!!RS.TITLE_ERROR_TEXT.long && !!RS.TITLE_ERROR_TEXT.banned, '  거절 이유마다 문구가 있다');
  chk(RS.clampMax(5, 10) === 5 && RS.clampMax(1, 10) === 2 && RS.clampMax(11, 10) === 10, '최대 인원: 2 ~ 정원 안으로');
  chk(RS.clampMax('x', 10) === 10 && RS.clampMax(undefined, 7) === 7, '  숫자가 아니면 정원');
  chk(RS.clampMax(60, 99) === 50 && RS.clampMax(5, 1) === 2, '  정원이 범위 밖이어도 2 ~ 50 안');
  chk(RS.clampMax(3.7, 10) === 3, '  소수는 내림');
  chk(RS.roomCap({ max: 4 }, 10) === 4 && RS.roomCap({ max: 20 }, 10) === 10, '★ 방 정원 = 방 최대 인원과 원격 정원 중 작은 쪽');
  chk(RS.roomCap(null, 10) === 10 && RS.roomCap({}, 10) === 10 && RS.roomCap({ max: 1 }, 10) === 10 && RS.roomCap({ max: 2.5 }, 10) === 10, '  max 가 없거나 범위 밖(옛 방 · 잘못 쓴 값)이면 정원');
  chk(RS.roomCap({ max: 2 }, 10) === 2 && RS.roomCap({ max: 50 }, 60) === 50, '  경계 2 · 50');
  chk(RS.hostNameOf('  새벽작업러 ') === '새벽작업러' && RS.hostNameOf('가'.repeat(25)).length === 20, '방장 닉네임: 공백 걷고 20자까지');
  chk(RS.hostNameOf('') === null && RS.hostNameOf('   ') === null && RS.hostNameOf(null) === null, '  비면 null(칸을 쓰지 않는다)');
}

say('── 3. 범위가 규칙 · 서버 함수와 같다');
{
  const M = RULES.rooms.$room._meta;
  chk(RS.TITLE_MAX === RL.TITLE_MAX && M.title['.validate'].includes('<= ' + RS.TITLE_MAX), '제목 길이 — 규칙 · 함수 · 앱이 같다');
  chk(RS.HOST_NAME_MAX === RL.HOST_NAME_MAX && M.hostName['.validate'].includes('<= ' + RS.HOST_NAME_MAX), '방장 닉네임 길이');
  chk(RS.ROOM_MAX_MIN === RL.ROOM_MAX_MIN && RS.ROOM_MAX_MAX === RL.ROOM_MAX_MAX && M.max['.validate'].includes('>= ' + RS.ROOM_MAX_MIN) && M.max['.validate'].includes('<= ' + RS.ROOM_MAX_MAX), '최대 인원 범위');
}

say('── 4. room-create-ui.js — 가짜 DOM');
{
  function mk(o){
    o = o || {};
    const els = {};
    const el = (id) => els[id] || (els[id] = { id, hidden: id === 'roomCreatePanel', disabled: false, checked: false, value: '', textContent: '', focus(){}, listeners: {},
      classList: { s: new Set(), toggle(c, on){ on ? this.s.add(c) : this.s.delete(c); }, contains(c){ return this.s.has(c); } },
      addEventListener(t, f){ this.listeners[t] = f; } });
    global.document = { getElementById: el };
    global.window = {};
    new Function('window', UI_SRC)(global.window);
    const made = [];
    let lic = !!o.licensed;
    const ui = global.window.TwRoomCreateUi.createRoomCreateUi({
      roomSettings: RS, bannedWords: BW, rcStore: () => ({ bannedWords: () => o.banned || [] }),
      maxPeople: () => o.cap || 10, isLicensed: () => lic, onCreate: (ch, s) => made.push([ch, s]), serverRoomLikely: () => (o.check ? o.check() : Promise.resolve(!!o.server)),
    });
    return { ui, el, made, setLic: (v) => { lic = v; } };
  }
  let t = mk({ cap: 8 });
  t.ui.open('workingroom');
  chk(!t.el('roomCreatePanel').hidden && t.el('lobbyMain').hidden && t.el('inviteJoinPanel').hidden, '로비 [방 만들기] → 창이 열리고 로비 · 코드 칸은 숨는다');
  chk(t.el('rcMax').textContent === '8명' && t.el('rcOpen').checked === true && t.el('rcMusic').checked === false && t.el('rcChWorking').classList.contains('on'), '  처음 값: 최대 인원 = 정원 · 공개 켬 · 같이 듣기 끔 · 워킹룸');
  chk(t.el('rcChTogether').disabled === true, '  라이선스가 없으면 투게더룸 버튼은 막혀 있다');
  t.el('rcMaxUp').onclick();
  chk(t.el('rcMax').textContent === '8명' && t.el('rcMaxUp').disabled, '  정원에서 + 는 더 안 오른다');
  for(let i = 0; i < 10; i++) t.el('rcMaxDown').onclick();
  chk(t.el('rcMax').textContent === '2명' && t.el('rcMaxDown').disabled, '  2명 아래로 안 내려간다');
  t.el('rcTitle').value = '  공부방  ';
  t.el('rcOpen').checked = false;
  t.el('rcCreate').onclick();
  chk(t.made.length === 1 && t.made[0][0] === 'workingroom' && JSON.stringify(t.made[0][1]) === '{"title":"공부방","max":2,"open":false,"music":false}', '★ [방 만들기] → onCreate(채널, { 제목 · 최대 인원 · 공개 · 같이 듣기 })');
  // 가짜 DOM 은 mk 마다 전역 document 를 바꾼다 — 한 창의 확인을 끝낸 뒤 다음 창을 만든다
  const flush = () => new Promise(r => setImmediate(r));
  t.ui.open('workingroom');
  chk(t.el('rcMusicRow').hidden === true, '  «내 서버» 확인이 끝날 때까지는 같이 듣기 칸을 숨겨 둔다(앱을 켠 뒤 처음이면 아직 모른다)');
  await flush();
  chk(t.el('rcMusic').checked === false && t.el('rcMusicRow').hidden === false, '  다시 열면 같이 듣기는 꺼진 채 · Firebase 방이면 확인 뒤 칸이 보인다');
  t.el('rcMusic').checked = true;
  t.el('rcCreate').onclick();
  chk(t.made.length === 2 && t.made[1][1].music === true, '★ 같이 듣기를 켜면 music:true 로 넘긴다');
  t.made.length = 1;
  const ts = mk({ server: true });
  ts.ui.open('workingroom');
  await flush();
  ts.el('rcMusic').checked = true;   // 숨긴 칸에 남은 체크가 있어도
  ts.el('rcCreate').onclick();
  chk(ts.el('rcMusicRow').hidden === true && ts.made[0][1].music === false, '★ 새 방이 방 서버로 가면 «🎧 같이 듣기 방» 칸을 숨기고 music:false — 방 서버는 아직 같이 듣기를 모른다');
  let done = null;
  const tl = mk({ check: () => new Promise(r => { done = r; }) });
  tl.ui.open('workingroom');
  tl.ui.close();
  done(false); await flush();
  chk(tl.el('rcMusicRow').hidden === true, '  확인이 끝나기 전에 창을 닫으면 아무것도 안 바뀐다');
  const tr = mk({ check: () => new Promise(r => { done = r; }) });
  tr.ui.open('workingroom');
  const first = done;
  tr.ui.close(); tr.ui.open('workingroom');   // 다시 열면 지난 확인 결과는 버린다
  first(false); await flush();
  chk(tr.el('rcMusicRow').hidden === true, '  다시 연 창에는 지난 확인 결과를 쓰지 않는다');
  chk(t.el('roomCreatePanel').hidden && !t.el('lobbyMain').hidden, '  만들고 나면 창을 닫고 로비로');

  t = mk({ banned: ['나쁜말'] });
  t.ui.open('workingroom');
  t.el('rcTitle').value = '나 쁜 말';
  t.el('rcCreate').onclick();
  chk(t.made.length === 0 && t.el('rcTitleErr').textContent === RS.TITLE_ERROR_TEXT.banned && !t.el('roomCreatePanel').hidden, '★ 금칙어 제목은 만들지 않고 칸 아래에 문구 — 창은 그대로');
  t.el('rcTitle').oninput();
  chk(t.el('rcTitleErr').textContent === '', '  다시 고치기 시작하면 문구를 지운다');

  t = mk();
  t.ui.open('togetherroom');
  chk(t.el('rcChWorking').classList.contains('on') && !t.el('rcChTogether').classList.contains('on'), '★ 라이선스 없이 투게더룸으로 열면 워킹룸으로 연다(투게더룸 버튼은 막힘)');
  t.ui.close();
  t.setLic(true);
  t.ui.open('togetherroom');
  chk(!t.el('roomCreatePanel').hidden && t.el('rcChTogether').classList.contains('on'), '  보유자는 투게더룸으로 열린다');
  t.el('rcCreate').onclick();
  chk(t.made[0][0] === 'togetherroom' && t.made[0][1].open === true && t.made[0][1].title === '', '  투게더룸도 공개를 고를 수 있다 · 빈 제목은 \'\'');
  t.ui.open('workingroom');
  t.el('inviteClose').listeners.click();
  chk(t.el('roomCreatePanel').hidden && !t.el('lobbyMain').hidden, '  모달을 닫으면 다음엔 로비부터');
  delete global.document; delete global.window;
}

say('── 5. room-entry — doCreateRoomInChannel 이 고른 값을 싣는다');
{
  const fn = takeFn(RE_SRC, 'async function doCreateRoomInChannel(');
  chk(!!fn && /let _pendingExtra = null;/.test(RE_SRC), '만들기 함수 · 고른 값 칸이 있다');
  const run = async (o) => {
    const win = { firebaseAPI: { getRoomCount: async () => 0 } };
    const log = { started: [], toasts: [] };
    const f = new Function('window', 'roomLimitOf', 'toast', '_channelFullMsg', 'genRoomCode', 'startRoom', 'roomSettings', 'maxPeople', 'getDisplayName',
      'let _pendingExtra = null;\n' + fn + '\nreturn { go: doCreateRoomInChannel, extra: () => _pendingExtra };')(
      win, () => 300, (m) => log.toasts.push(m), () => '꽉', (ch) => (ch === 'togetherroom' ? 'PLAY-' : 'WORK-') + 'AB12', (c) => log.started.push(c), RS, () => o.cap || 10, () => (o.name !== undefined ? o.name : '나'));
    await f.go(o.ch, o.settings);
    return { win, log, extra: f.extra() };
  };
  let r = await run({ ch: 'togetherroom', settings: { title: '수다', max: 4, open: true, music: true }, name: ' 말랑콩떡 ' });
  chk(r.win._pendingRoomChannel === 'togetherroom' && r.win._pendingRoomOpen === true && r.log.started[0] === 'PLAY-AB12', '★ 투게더룸도 공개(open)를 싣는다 — 예전엔 워킹룸만');
  chk(JSON.stringify(r.extra) === '{"max":4,"title":"수다","hostName":"말랑콩떡","music":true}', '★ 고른 값 { 최대 인원 · 제목 · 방장 닉네임 · 같이 듣기 }');
  r = await run({ ch: 'workingroom', settings: { title: '', max: 99, open: false }, cap: 6, name: '' });
  chk(JSON.stringify(r.extra) === '{"max":6,"title":null,"hostName":null,"music":false}' && r.win._pendingRoomOpen === false, '★ 빈 제목 · 빈 닉네임은 null(지움)로 — 같은 코드의 지난 방 제목이 update 병합으로 남지 않게 · 최대 인원은 정원 안으로');
  chk(/setRoomChannel\(code, _channel, getMyUserId\(\), !!window\._pendingRoomOpen, _pendingExtra\);\s*_pendingExtra = null;/.test(RE_SRC), '  만들기 갈래가 고른 값을 _meta 에 한 번 쓰고 비운다');
  chk(/const _cap2 {2}= _isSecret \? \(maxPeople\(\) - 1\) : roomSettings\.roomCap\(window\._roomMetaCache, maxPeople\(\)\);/.test(RE_SRC)
    && /'이 방은 이미 가득 찼어요\(최대 '\+_cap2\+'명\)'/.test(RE_SRC), '★ 재확인이 이미 읽은 _meta 로 방 최대 인원을 막는다 · 문구도 그 값(시크릿룸은 예전 그대로)');
  chk(/const _cap {2}= _isSecret \? \(maxPeople\(\) - 1\) : maxPeople\(\);/.test(RE_SRC) && !/_capMeta/.test(RE_SRC), '  사전 검사는 _meta 를 또 읽지 않는다(같은 노드를 이미 두 번 읽는다)');
  chk(!/chRandOpen/.test(RE_SRC), '  옛 «랜덤 참여 허용» 토글을 읽지 않는다(창의 «방 목록에 공개» 로)');
}

say('── 5-2. 방 서버 만들기 칸(serverCreateOf) · room-entry 가 싣는다');
{
  const c = RS.serverCreateOf('togetherroom', true, { title: ' 수다 ', max: 4, hostName: '말랑', music: true });
  chk(JSON.stringify(c) === '{"channel":"togetherroom","open":true,"title":"수다","max":4,"music":true}', '★ 제목(앞뒤 공백 걷음) · 최대 인원 · 같이 듣기 · 공개 — 방장 이름은 안 싣는다(서버가 정함) (' + JSON.stringify(c) + ')');
  chk(JSON.stringify(RS.serverCreateOf('workingroom', false, { title: null, max: 6, hostName: null, music: false })) === '{"channel":"workingroom","open":false,"max":6}', '  빈 제목 · 꺼진 같이 듣기는 칸째 뺀다(서버는 틀린 모양을 통째로 거절)');
  chk(!('max' in RS.serverCreateOf('workingroom', true, { max: 1 })) && !('max' in RS.serverCreateOf('workingroom', true, { max: 51 })) && RS.serverCreateOf('workingroom', true, { max: 2 }).max === 2
    && RS.serverCreateOf('workingroom', true, { max: 50 }).max === 50 && !('max' in RS.serverCreateOf('workingroom', true, { max: 4.5 })), '  최대 인원 경계 2 · 50 · 범위 밖 · 소수는 뺀다');
  chk(!('title' in RS.serverCreateOf('workingroom', true, { title: 'x'.repeat(21) })) && RS.serverCreateOf('workingroom', true, { title: 'x'.repeat(20) }).title.length === 20, '  제목 20자까지 · 21자는 뺀다');
  chk(JSON.stringify(RS.serverCreateOf('workingroom', 1, null)) === '{"channel":"workingroom","open":true}', '  고른 값이 없으면(옛 길) 채널 · 공개만');
  // 어느 create 를 실을지 — 만들기 갈래 · 시크릿룸 갈래 · 그 밖
  const ex = { title: '수다', max: 4, hostName: '말랑', music: true };
  chk(JSON.stringify(RS.serverJoinCreate(true, 'workingroom', true, ex, { music: false })) === JSON.stringify(RS.serverCreateOf('workingroom', true, ex)),
    '★ 만들기면 고른 값(serverCreateOf) — 시크릿룸 표시가 있어도 만들기가 이긴다');
  chk(JSON.stringify(RS.serverJoinCreate(false, null, false, null, { music: true })) === '{"channel":"togetherroom","music":true}'
    && JSON.stringify(RS.serverJoinCreate(false, null, false, null, { music: false })) === '{"channel":"togetherroom","music":false}', '★ 시크릿룸을 주인이 열면 { channel: togetherroom, music } — 같이 듣기를 끈 것도 싣는다(지난 값이 남지 않게)');
  chk(RS.serverJoinCreate(false, 'workingroom', true, ex, undefined) === null, '  그 밖(코드로 들어가기 · 손님 · 인원 모름)은 null — create 없이');
  const rc = takeFn(RE_SRC, 'async function _startRoomOnServer(');
  chk(/const create = roomSettings\.serverJoinCreate\(creating, window\._pendingRoomChannel, !!window\._pendingRoomOpen, _pendingExtra, srOpen\);/.test(rc), '  room-entry 방 서버 갈래가 이 한 함수로 고른다');
  // 들어간 뒤 비우기 — 함수를 떼어 실제로 굴린다
  const clr = (RE_SRC.match(/function _clearPendingCreate\(\)\{[^\n]*\}/) || [''])[0];
  const runClear = (src) => { const w = { _pendingRoomChannel: 'workingroom', _pendingRoomOpen: true }; const ex2 = new Function('window', 'let _pendingExtra = { title: 1 };\n' + src + '\n_clearPendingCreate(); return _pendingExtra;')(w); return { w, ex2 }; };
  const cr = runClear(clr);
  chk(clr && cr.w._pendingRoomChannel === null && cr.w._pendingRoomOpen === false && cr.ex2 === null, '★ 들어간 뒤 만들기 표시 셋(채널 · 공개 · 고른 값)을 비운다 — 다음 입장이 지난 제목 · 인원을 물려받지 않게');
  chk(/refreshInviteUI\(\); toast\('방에 연결됐어요: '\+code\);\n  _clearPendingCreate\(\);/.test(rc), '  방 서버 갈래가 들어간 뒤 그것을 부른다');
  chk(/if\(code === 'title'\) return roomSettings\.TITLE_ERROR_TEXT\.banned;/.test(RE_SRC), '  서버가 금칙어로 거절하면 «방 제목에 쓸 수 없는 말이 있어요»');
}

say('── 6. firebase-init — 쓰기');
{
  const method = (head) => takeFn(FI, head);
  const mkApi = (body) => new Function('ref', 'db', 'runTransaction', 'update', 'serverTimestamp', '_touchRoomIndex', '_svNow', 'return ({ ' + body + ' });');
  const tx = (cur) => async (r, fn) => { const v = fn(cur === undefined ? null : JSON.parse(JSON.stringify(cur))); return { committed: v !== undefined, snapshot: { val: () => v } }; };
  // setRoomChannel
  const writes = [];
  const set = mkApi(method('async setRoomChannel('))((p) => p, {}, null, async (p, v) => writes.push(v), () => 'TS', () => {}, () => 1);
  await set.setRoomChannel('WORK-AB12', 'workingroom', 'u1', true, { title: '방', max: 4, hostName: '나' });
  chk(JSON.stringify(writes[0]) === '{"channel":"workingroom","ts":"TS","host":"u1","open":true,"title":"방","max":4,"hostName":"나"}', '★ setRoomChannel 이 고른 값을 _meta 에 같이 쓴다');
  await set.setRoomChannel('WORK-AB12', 'workingroom', 'u1');
  chk(!('title' in writes[1]) && !('open' in writes[1]), '  안 넘기면 안 쓴다(다른 길 — 시크릿룸 · 하트비트)');
  await set.setRoomChannel('WORK-AB12', 'workingroom', 'u1', false, { max: 3, title: null, hostName: null });
  chk(writes[2].title === null && writes[2].hostName === null, '  비운 칸은 null 로 실어 update 가 지운다');
  // claimHostIfVacant
  const claim = (cur, hn) => mkApi(method('async claimHostIfVacant('))((p) => p, {}, tx(cur), null, null, null, () => 1).claimHostIfVacant('R', 'u2', ['u2'], null, hn);
  let c = await claim({ host: 'gone', hostName: '나간 사람' }, '새방장');
  chk(c.ok && c.meta.host === 'u2' && c.meta.hostName === '새방장', '★ 승계가 방장 닉네임도 새 방장으로');
  c = await claim({ host: 'gone', hostName: '나간 사람' }, null);
  chk(c.ok && !('hostName' in c.meta), '  새 방장 닉네임을 모르면 나간 사람 이름을 지운다');
  c = await claim({ host: 'u2', hostName: '그대로' }, '다른');
  chk(!c.ok, '  방장이 살아 있으면 손대지 않는다(예전 그대로)');
  // claimEmptyRoom
  const empty = (cur, hn) => mkApi(method('async claimEmptyRoom('))((p) => p, {}, tx(cur), null, null, () => {}, () => 1e12).claimEmptyRoom('R', 'u3', false, hn);
  let e = await empty(null, '빈방주인');
  chk(e && e.mine && /hostName/.test(method('async claimEmptyRoom(')) , '빈 방 선점도 방장 닉네임을 쓴다');
  chk(/if\(hostName\) out\.hostName = hostName; else delete out\.hostName;/.test(FI), '  모르면 지난 방의 닉네임을 지운다');
  chk(/const _cap = window\.TwRoomSettings\.roomCap\(_capturedMeta, /.test(FI), '★ 들어간 뒤 자기 퇴장도 같은 규칙(roomCap)으로');
  chk(/claimHostIfVacant\(room, myUserId, aliveUserIds, null, window\.TwRoomSettings\.hostNameOf\(friends\[myMemberId\]\.name\)\)/.test(FI), '  승계 판정이 내 닉네임을 넘긴다');
}

say('── 7. remote-config — 금칙어 원문');
{
  const st = RCM.createRemoteConfig();
  chk(JSON.stringify(st.bannedWords()) === '[]', '처음엔 빈 목록');
  st.set('bannedWords', ['나쁜말', '', 3, '가'.repeat(21), '욕']);
  chk(JSON.stringify(st.bannedWords()) === '["나쁜말","욕"]', '  글자 칸만 · 20자까지(규칙과 같다)');
  st.set('bannedWords', { 0: '가', 1: '나' });
  chk(JSON.stringify(st.bannedWords()) === '["가","나"]', '  Firebase 의 {0:…} 모양도 받는다');
  chk(RCM.FALLBACK_PATHS.bannedWords === 'config/bannedWords' && RCM.KEYS.includes('bannedWords'), '  API 를 못 받으면 Firebase config/bannedWords 한 칸');
  chk(RCM.BANNED_WORD_LEN_MAX === 20 && RULES.config.bannedWords.$i['.validate'].includes('<= 20'), '  길이 상한이 규칙과 같다');
  chk(RCM.BANNED_WORDS_MAX === BW.BANNED_MAX, '★ 줄 수 상한이 판정(BANNED_MAX)과 같다 — 넘는 낱말을 받아 놓고 판정에서 버리지 않게');
}

say('── 8. 깨 보기');
{
  const broken = classic(RS_SRC.replace('if(Number.isInteger(m) && m >= ROOM_MAX_MIN && m <= ROOM_MAX_MAX) return Math.min(m, cap);', ''), 'TwRoomSettings');
  chk(broken.roomCap({ max: 4 }, 10) === 10, '방 최대 인원을 안 보면 2절 «작은 쪽» 이 빨강이 된다');
  const noBan = classic(RS_SRC.replace("if(bw.hasBannedWord(title, banned)) return { ok: false, reason: 'banned' };", ''), 'TwRoomSettings');
  chk(noBan.checkTitle('나쁜말', ['나쁜말'], BW).ok === true, '금칙어 확인을 빼면 2절 «banned» 가 빨강이 된다');
  chk(BW_APP.replace('500', '400') !== BW_FN, '앱 사본만 바꾸면 1절 «글자까지 같다» 가 빨강이 된다');
  const noRange = classic(RS_SRC.replace('if(Number.isInteger(e.max) && e.max >= ROOM_MAX_MIN && e.max <= ROOM_MAX_MAX) out.max = e.max;', 'if(e.max != null) out.max = e.max;'), 'TwRoomSettings');
  chk('max' in noRange.serverCreateOf('workingroom', true, { max: 99 }), '최대 인원 범위 거르기를 빼면 5-2절 «범위 밖은 뺀다» 가 빨강이 된다');
  const noSecret = classic(RS_SRC.replace("return secretOpen ? { channel: 'togetherroom', music: !!secretOpen.music } : null;", 'return null;'), 'TwRoomSettings');
  chk(noSecret.serverJoinCreate(false, null, false, null, { music: true }) === null, '시크릿룸 갈래를 빼면 5-2절 «주인이 열면» 이 빨강이 된다');
  const noExtraClear = (RE_SRC.match(/function _clearPendingCreate\(\)\{[^\n]*\}/) || [''])[0].replace(' _pendingExtra = null;', '');
  const nb = new Function('window', 'let _pendingExtra = { title: 1 };\n' + noExtraClear + '\n_clearPendingCreate(); return _pendingExtra;')({});
  chk(nb !== null, '고른 값 비우기를 빼면 5-2절 «비운다» 가 빨강이 된다');
}

say('');
say('통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
