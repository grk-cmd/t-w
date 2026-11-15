/* sim-recent-rooms.js — 🕘 최근 들어간 방(room/recent-rooms.js · recent-rooms-ui.js)
   [무엇을 지키나] 방에 연결되면 이 PC 에 최근 방 3개를 남기고, 로비 코드 칸을 비운 채 누르면 펼쳐서 바로 들어간다.
     계정마다 따로 저장해 한 PC 를 둘이 써도 앞 사람의 방 코드(시크릿룸 포함)가 안 보인다.
   ・1절: 순수 함수 — 방 코드 모양은 room-entry 의 진짜 isRoomCode · add(맨 앞 · 같은 방 올림 · 3개 · 틀린 코드) · parse(망가진 글 · 틀린 줄 · 중복 · 상한) · agoText 경계값
   ・2절: 저장 — 계정마다 다른 키 · 로그인 전엔 기록 · 목록 없음 · 저장소가 막혀도 안 던짐
   ・3절: 화면 — 진짜 UI 를 가짜 DOM 에서 돌린다(빈 칸이면 펼침 · 글자 치면 접힘 · 줄 누르면 입장 · 목록 없으면 숨김 · ESC · 제목은 글로만)
   ・3-2절: 기록하는 제목 — app.js 연결 줄을 진짜 room-settings · banned-words 로 돌림(금칙어면 «○○ 님의 방»)
   ・4절: 연결 — room-entry 가 «연결됨» 두 곳에서 알림 · app.js 가 기록 · UI 를 건다 · html 순서 · 칸 위치
   ・5절: 일부러 깨 보기
   [실행] node checks/run.js sim-recent-rooms */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = { mod: read('room/recent-rooms.js'), ui: read('room/recent-rooms-ui.js'), entry: read('room/room-entry.js'), app: read('app.js'), html: read('desk-companion-prototype.html'),
  settings: read('room/room-settings.js'), banned: read('shared/banned-words.js') };
for (const k of Object.keys(SRC)) if (SRC[k] == null) { say('  ? 원본 못 찾음 — ' + k); process.exit(2); }

const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const loadUi = (src) => { const w = {}; new Function('window', src)(w); return w.TwRecentRoomsUi; };
/* 방 코드 모양 판정 — room-entry 의 진짜 isRoomCode(정본 ROOM_CODE_RE · ROOM_CODE_BODY_RE 와 함께)를 떼어 돌린다 */
function grabFn(src, head){
  const i = src.indexOf(head); if (i < 0) return null;
  let k = src.indexOf('{', i + head.length - 1), d = 0;
  for (; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  return null;
}
const grabLine = (src, head) => { const i = src.indexOf(head); return i < 0 ? null : src.slice(i, src.indexOf('\n', i)); };
function loadIsCode(entry){
  const parts = [grabLine(entry, 'const ROOM_CODE_RE ='), grabLine(entry, 'const ROOM_CODE_BODY_RE ='), grabFn(entry, 'function isRoomCode(code){')];
  if (parts.some(x => !x)) throw new Error('room-entry.js 에서 ROOM_CODE_RE · ROOM_CODE_BODY_RE · isRoomCode 를 못 찾음');
  return new Function(parts.join('\n') + '\nreturn isRoomCode;')();
}

/* 가짜 DOM — 쓰는 것만 */
function mkDoc(){
  const els = {};
  const mk = (tag) => {
    const L = {};
    const e = { tag, children: [], hidden: false, value: '', className: '', title: '', type: '', _text: '',
      appendChild(c){ this.children.push(c); return c; },
      addEventListener(t, fn){ (L[t] = L[t] || []).push(fn); },
      fire(t, ev){ (L[t] || []).forEach(fn => fn(Object.assign({ preventDefault(){ ev && (ev._pd = true); }, stopPropagation(){ ev && (ev._sp = true); } }, ev || {}))); },
      get textContent(){ return this._text + this.children.map(c => c.textContent).join(''); },
      set textContent(v){ this._text = String(v); this.children = []; },
      set innerHTML(v){ throw new Error('innerHTML 금지'); },
    };
    return e;
  };
  els.inviteCode = mk('input'); els.lobbyRecent = mk('div');
  return { els, getElementById: (id) => els[id] || null, createElement: mk };
}
const rows = (box) => box.children.filter(c => c.className === 'lb-recent-row');

const MIN = 60000, HOUR = 60 * MIN;
async function judge(src){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  try {
    const M = loadMod(src.mod);
    const isC = loadIsCode(src.entry);
    t(isC('WORK-AB2C') && isC('PLAY-1234') && isC('COZY-ZZ99') && isC('SCRT-AB2C') && !isC('ABCD-1234') && !isC('SCRT-AB') && !isC('work-ab2c') && !isC(null) && !isC('WORK-AB2C*'), 'isRoomCode(room-entry) — 공개 방 · 시크릿룸만 · 모르는 접두어 · 짧음 · 소문자 · null · 별표는 아님');
    const add = (l, c, ti, at) => M.add(l, c, ti, at, isC), parse = (raw) => M.parse(raw, isC);
    /* 1절 */
    let L = add([], 'WORK-AB2C', '조용한 방', 100);
    L = add(L, 'PLAY-K3MM', '수다방', 200);
    t(L.map(x => x.code).join() === 'PLAY-K3MM,WORK-AB2C', 'add — 새 방이 맨 앞');
    L = add(L, 'WORK-AB2C', '조용한 방 2', 300);
    t(L.map(x => x.code).join() === 'WORK-AB2C,PLAY-K3MM' && L[0].title === '조용한 방 2' && L[0].at === 300, '  같은 방은 한 줄로 · 맨 앞으로 · 제목과 시각은 새 것');
    L = add(add(L, 'COZY-1111', '', 400), 'SCRT-2222', '비밀', 500);
    t(L.length === 3 && L.map(x => x.code).join() === 'SCRT-2222,COZY-1111,WORK-AB2C', '  최대 3개 — 가장 오래된 것이 빠진다 · 시크릿룸도 남는다');
    t(add(L, 'WORK-AB', 'x', 1).map(x => x.code).join() === L.map(x => x.code).join() && add(L, null, 'x', 1).length === 3 && add(L, 'work-ab2c', 'x', 1)[0].code === 'SCRT-2222', '  틀린 코드(짧음 · null · 소문자)는 안 넣는다');
    t(add([], 'WORK-AB2C', ' ' + '가'.repeat(50) + ' ', 1)[0].title === '가'.repeat(40) && add([], 'WORK-AB2C', null, 1)[0].title === '', '  제목은 다듬어 40자까지 · 없으면 빈 글');
    t(parse('') .length === 0 && parse('{망가짐').length === 0 && parse('{"a":1}').length === 0 && parse('null').length === 0, 'parse — 빈 글 · 망가진 글 · 배열 아님 → 빈 목록');
    const raw = JSON.stringify([{ code: 'WORK-AB2C', title: 'a', at: 5 }, { code: 'bad' , at: 5 }, { code: 'WORK-AB2C', title: 'dup', at: 4 }, { code: 'PLAY-1234', at: 0 }, { code: 'PLAY-5678', title: 7, at: 3 }, { code: 'COZY-9999', at: 2 }, { code: 'SCRT-0000', at: 1 }, { code: 'ABCD-1111', at: 9 }]);
    const P = parse(raw);
    t(P.map(x => x.code).join() === 'WORK-AB2C,PLAY-5678,COZY-9999' && P[1].title === '', '  틀린 줄 · 중복 · 시각 0 은 버리고 · 제목이 글이 아니면 빈 글 · 3개까지');
    t(M.agoText(0) === '방금' && M.agoText(59999) === '방금' && M.agoText(MIN) === '1분 전' && M.agoText(59 * MIN) === '59분 전' && M.agoText(HOUR) === '1시간 전' && M.agoText(23 * HOUR + 59 * MIN) === '23시간 전' && M.agoText(24 * HOUR) === '1일 전' && M.agoText(-5) === '방금', 'agoText — 경계값(1분 · 1시간 · 1일 · 음수)');

    /* 2절 */
    const store = new Map();
    let uid = 'U1', clock = 1000;
    const S = { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, v) };
    const R = M.createRecentRooms({ storage: S, getMyUserId: () => uid, now: () => clock, isRoomCode: isC });
    R.record('WORK-AB2C', '조용한 방');
    t(store.has('tw.recentRooms.U1') && R.list()[0].code === 'WORK-AB2C' && R.list()[0].at === 1000, '저장 — tw.recentRooms.<내 id> 에');
    uid = 'U2';
    t(R.list().length === 0, '★ 다른 계정이면 앞 사람 목록이 안 보인다');
    R.record('PLAY-K3MM', 'b');
    uid = 'U1';
    t(R.list().map(x => x.code).join() === 'WORK-AB2C', '  계정마다 따로 쌓인다');
    uid = null; const before = store.size;
    R.record('COZY-1111', 'x');
    t(R.list().length === 0 && store.size === before, '  로그인 전 — 기록도 목록도 없음');
    uid = 'U1';
    const Rbad = M.createRecentRooms({ storage: { getItem(){ throw new Error('막힘'); }, setItem(){ throw new Error('막힘'); } }, getMyUserId: () => 'U1', now: () => 1, isRoomCode: isC });
    let threw = false; try { Rbad.record('WORK-AB2C', 'x'); Rbad.list(); } catch (_) { threw = true; }
    t(!threw && Rbad.list().length === 0, '  저장소가 막혀도 던지지 않는다(입장은 그대로)');

    /* 3절 */
    const U = loadUi(src.ui);
    const doc = mkDoc(), joined = [];
    let list = [{ code: 'WORK-AB2C', title: '<b>조용</b>', at: 1000 - 2 * HOUR }, { code: 'SCRT-2222', title: '', at: 1000 }];
    U.createRecentRoomsUi({ document: doc, recent: { list: () => list }, agoText: M.agoText, now: () => 1000, joinRoom: (c) => joined.push(c) });
    const inp = doc.els.inviteCode, box = doc.els.lobbyRecent;
    inp.fire('focus');
    t(!box.hidden && rows(box).length === 2 && /최근 들어간 방/.test(box.textContent), '칸을 누르면(빈 칸) 최근 방이 펼쳐진다');
    const r0 = rows(box)[0];
    t(r0.textContent === 'WORK-AB2C<b>조용</b>2시간 전' && r0.children[1]._text === '<b>조용</b>', '  줄 = 코드 · 제목(글 그대로 — HTML 로 안 읽힘) · 얼마 전');
    const md = {}; r0.fire('mousedown', md);
    t(md._pd === true, '  줄을 누르는 동안 칸이 포커스를 안 잃게(먼저 닫히지 않게)');
    rows(box)[1].fire('click');
    t(joined.join() === 'SCRT-2222' && box.hidden, '★ 줄을 누르면 그 방으로 들어가고 접힌다');
    inp.fire('focus'); inp.value = 'AB'; inp.fire('input');
    t(box.hidden, '  글자를 치면 접힌다');
    inp.value = ''; inp.fire('input');
    t(!box.hidden, '  다 지우면 다시 펼친다');
    const esc = { key: 'Escape' }; inp.fire('keydown', esc);
    t(box.hidden && esc._sp === true, '  ESC — 목록만 접고 모달까지 안 닫히게');
    inp.fire('focus'); inp.fire('blur');
    t(box.hidden, '  칸을 떠나면 접힌다');
    list = []; inp.fire('focus');
    t(box.hidden && rows(box).length === 0, '  최근 방이 없으면 안 펼친다');
  } catch (err) {
    t(false, '돌리다 오류 — ' + (err && err.message || err));
  }
  return r;
}

(async () => {
say('── 1 ~ 3. 규칙 · 저장 · 화면 (진짜 모듈을 돌린다)');
(await judge(SRC)).forEach(([ok, m]) => chk(ok, m));

say('── 3-2. 기록하는 제목 (app.js 의 진짜 연결 줄을 진짜 room-settings · banned-words 로 돌린다)');
function recordedTitle(s, meta, bannedList){
  const i = s.app.indexOf('roomEntryMod.onRoomJoined(');
  if (i < 0) throw new Error('app.js 에서 onRoomJoined 연결을 못 찾음');
  const line = s.app.slice(i, s.app.indexOf(';', s.app.indexOf('.text))', i)) + 1);
  const w = {}; new Function('window', s.settings)(w);
  const bw = {}; new Function('window', 'module', s.banned)(bw, undefined);
  let cb = null; const got = [];
  new Function('roomEntryMod', 'recentRooms', 'TwRoomSettings', 'TwBannedWords', 'acctStateMod', line)(
    { onRoomJoined: (fn) => { cb = fn; } }, { record: (c, t) => got.push([c, t]) }, w.TwRoomSettings, bw.TwBannedWords,
    { _rcStore: () => ({ bannedWords: () => bannedList }) });
  cb('WORK-AB2C', meta);
  return got[0] && got[0][1];
}
function titleJudge(s){
  const r = [];
  try {
    r.push([recordedTitle(s, { title: '조용한 방', hostName: '꿀곰' }, ['나쁜말']) === '조용한 방', '제목 그대로']);
    r.push([recordedTitle(s, { title: '나쁜말 방', hostName: '꿀곰' }, ['나쁜말']) === '꿀곰 님의 방', '★ 금칙어 제목 → «방장 님의 방»(방 안 제목 칸과 같다)']);
    r.push([recordedTitle(s, { title: '', hostName: '꿀곰' }, []) === '꿀곰 님의 방' && recordedTitle(s, null, []) === '이름 없는 방', '  제목 없음 · meta 없음 → 기본 제목']);
  } catch (err) { r.push([false, '돌리다 오류 — ' + (err && err.message || err)]); }
  return r;
}
titleJudge(SRC).forEach(([ok, m]) => chk(ok, m));

say('── 4. 연결');
function wire(s){
  const out = [];
  const w = (ok, msg) => out.push([!!ok, msg]);
  w((s.entry.match(/toast\('방에 연결됐어요: '\+code\);\n(?:  _clearPendingCreate\(\);\n)?  _roomJoined\(code\);/g) || []).length === 1, 'room-entry — «연결됐어요» 자리(방 포트 하나)에서 알림');
  w(/function onRoomJoined\(fn\)\{ _roomJoinedFns\.push\(fn\); \}/.test(s.entry) && /\n  onRoomJoined,/.test(s.entry) && !/TwRecentRooms|recentRooms/.test(s.entry), '  알림 걸기를 내놓고 · 최근 방 모듈은 모른다');
  w(!/CODE_RE|[A-Z]\]\{4\}/.test(s.mod), 'recent-rooms — 방 코드 모양을 다시 쓰지 않는다(room-entry isRoomCode 를 받는다)');
  w(/const recentRooms = TwRecentRooms\.createRecentRooms\(\{ storage: localStorage, getMyUserId: [^\n]*isRoomCode: roomEntryMod\.isRoomCode \}\);/.test(s.app) && /roomEntryMod\.onRoomJoined\(\(code, meta\)=>recentRooms\.record\(code, TwRoomSettings\.displayTitle\(meta && meta\.title, meta && meta\.hostName,\n  TwBannedWords\.cleanBannedList\(acctStateMod\._rcStore\(\)\.bannedWords\(\)\), TwBannedWords\)\.text\)\);/.test(s.app), 'app.js — 기록을 «연결됨» 알림에 건다(제목은 displayTitle 한 곳 · 방 안 제목 칸과 같이 금칙어 거름)');
  w(/TwRecentRoomsUi\.createRecentRoomsUi\(\{[^\n]*joinRoom: \(code\)=>roomEntryMod\.joinRoom\(code\)/.test(s.app), '  UI 의 입장은 로비 카드와 같은 joinRoom(입장 중 깃발 한 곳)');
  const iM = s.html.indexOf('<script src="parts/room/recent-rooms.js"'), iU = s.html.indexOf('<script src="parts/room/recent-rooms-ui.js"'), iA = s.html.indexOf('<script src="parts/app.js"');
  w(iM > 0 && iU > iM && iA > iU, 'html — 두 모듈을 app.js 보다 먼저');
  const foot = (s.html.match(/<div class="lb-foot">([\s\S]*?)\n        <\/div>/) || [])[1] || '';
  w(/class="lb-code-wrap"[\s\S]*id="inviteCode"[\s\S]*id="lobbyRecent" class="lb-recent" hidden/.test(foot), '  최근 방 칸은 로비 아래 줄 코드 칸 옆(처음엔 숨김)');
  return out;
}
wire(SRC).forEach(([ok, m]) => chk(ok, m));

say('── 5. 일부러 깨 보기');
const BREAKS = [
  ['mod', ".concat(list.filter((r) => r.code !== code))", '.concat(list)', '같은 방이 두 줄로 쌓임'],
  ['mod', '.slice(0, MAX);\n}', ';\n}', '3개를 넘게 쌓음'],
  ['mod', "return id ? KEY_PREFIX + id : null;", "return KEY_PREFIX + 'all';", '계정 구분 없이 한 키'],
  ['mod', "if(!isCode(code)) return list.slice();", "if(typeof code !== 'string') return list.slice();", '틀린 코드도 넣음'],
  ['mod', "if(!r || !isCode(r.code) || seen.has(r.code)) continue;", "if(!r || seen.has(r.code)) continue;", '저장본의 틀린 코드를 안 거름'],
  ['entry', "return ROOM_CODE_RE.test(code) || (code.startsWith('SCRT-') && ROOM_CODE_BODY_RE.test(code.slice(5)));", "return ROOM_CODE_RE.test(code);", '시크릿룸 코드를 안 받음'],
  ['ui', "const rows = input.value.trim() ? [] : recent.list();", 'const rows = recent.list();', '글자를 쳐도 안 접힘'],
  ['ui', "b.addEventListener('click', () => { hide(); joinRoom(r.code); });", "b.addEventListener('click', () => { hide(); });", '줄을 눌러도 안 들어감'],
  ['ui', "title.textContent = r.title;", "title._text = ''; title.textContent = '';", '제목을 안 그림'],
  ['ui', "b.addEventListener('mousedown', (e) => e.preventDefault());", '', '누르는 동안 먼저 닫힘'],
];
for (const [k, from, to, why] of BREAKS) {
  if (SRC[k].indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + why); continue; }
  const s2 = Object.assign({}, SRC, { [k]: SRC[k].replace(from, to) });
  chk((await judge(s2)).some(([ok]) => !ok), why + ' → 빨강');
}
const WB = [
  ['entry', "  _clearPendingCreate();\n  _roomJoined(code);\n", "  _clearPendingCreate();\n", '입장한 뒤 알림을 빠뜨림'],
  ['app', 'joinRoom: (code)=>roomEntryMod.joinRoom(code) });', 'joinRoom: (code)=>{} });', 'UI 가 입장을 안 함'],
  ['app', ",\n  TwBannedWords.cleanBannedList(acctStateMod._rcStore().bannedWords()), TwBannedWords).text));", ").text));", '최근 방 제목이 금칙어를 안 거름'],
];
{
  const from = ",\n  TwBannedWords.cleanBannedList(acctStateMod._rcStore().bannedWords()), TwBannedWords).text));";
  const s2 = Object.assign({}, SRC, { app: SRC.app.replace(from, ').text));') });
  chk(s2.app !== SRC.app && titleJudge(s2).some(([ok]) => !ok), '기록 제목이 금칙어를 안 거름 → 3-2절 빨강');
}
for (const [k, from, to, why] of WB) {
  if (SRC[k].indexOf(from) < 0) { chk(false, '깨 볼 글을 못 찾음 — ' + why); continue; }
  const s2 = Object.assign({}, SRC, { [k]: SRC[k].replace(from, to) });
  chk(wire(s2).some(([ok]) => !ok), why + ' → 빨강');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
