/*
 * 방 목록 로비 사본(roomLobby)과 방 제목 금칙어 검사 — 서버 함수 모듈을 그대로 불러 가짜 DB 로 돌린다.
 * 1. functions/banned-words.js  2. functions/room-lobby.js(순수)  3. buildRoomLobby(가짜 DB)  4. room-stats 1분 실행이 부른다  5. 규칙  6. 깨 보기
 * 설계: docs/ROOM_LOBBY.md 2.2 · 5.2
 */
'use strict';
const { stripReadGate } = require('./sim-rules-src.js');
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
need('functions/room-lobby.js'); need('functions/banned-words.js'); need('functions/room-stats.js');
const RULES = JSON.parse(stripReadGate(need('firebase-database-rules.json'))).rules;

const BW = require(path.resolve('functions/banned-words.js'));
const RL = require(path.resolve('functions/room-lobby.js'));
const RS = require(path.resolve('functions/room-stats.js'));

/* 경로 하나짜리 메모리 DB — get · set · transaction · update · remove · 읽은 경로 기록 */
function fakeDb(init){
  const data = JSON.parse(JSON.stringify(init || {}));
  const reads = [];
  const parts = (p) => String(p).split('/').filter(Boolean);
  const at = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), data);
  const put = (p, v) => {
    const ks = parts(p); let o = data;
    for (let i = 0; i < ks.length - 1; i++){ if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  const snap = (p) => ({ val: () => { const v = at(p); return v === undefined ? null : JSON.parse(JSON.stringify(v)); }, exists: () => at(p) !== undefined });
  return {
    data, reads,
    ref: (p) => ({
      get: async () => { reads.push(p); return snap(p); },
      set: async (v) => put(p, v),
      remove: async () => put(p, null),
      update: async (o) => { for (const k in o) put(p + '/' + k, o[k]); },
      transaction: async (fn) => { const cur = snap(p).val(); const v = fn(cur); if (v === undefined) return { committed: false, snapshot: snap(p) }; put(p, v); return { committed: true, snapshot: snap(p) }; },
    }),
  };
}

(async () => {
  say('── 1. banned-words.js — 금칙어 판정');
  {
    chk(BW.normalizeWord(' 나 쁜.말1! ') === '나쁜말', '공백 · 기호 · 숫자를 빼고 맞춘다 — 끼워서 피해 가지 못하게');
    chk(BW.normalizeWord('BAD Word') === 'badword', '  영문은 소문자로');
    chk(BW.normalizeWord('ＢＡＤ') === 'bad', '  전각 글자도 같은 글자로(NFKC)');
    chk(BW.normalizeWord(null) === '' && BW.normalizeWord(undefined) === '', '  없음 → 빈 글');
    const L = BW.cleanBannedList(['나쁜말', ' 나 쁜 말 ', '', 3, null, 'Bad']);
    chk(JSON.stringify(L) === '["나쁜말","bad"]', '목록: 맞춘 뒤 겹침 · 빈 낱말 · 문자열 아닌 값은 버린다');
    chk(JSON.stringify(BW.cleanBannedList({ 0: '욕', 1: '욕설' })) === '["욕","욕설"]', '  규칙에 저장된 {0:…} 모양도 받는다');
    chk(BW.cleanBannedList(null).length === 0 && BW.cleanBannedList('욕').length === 0, '  없음 · 문자열 하나는 빈 목록(목록이 아니다)');
    chk(BW.cleanBannedList(Array.from({ length: BW.BANNED_MAX + 50 }, (_, i) => '가' + 'ㄱ'.repeat(i % 5) + i)).length <= BW.BANNED_MAX, '  상한(BANNED_MAX)까지만');
    chk(BW.hasBannedWord('오늘 나.쁜.말 하는 방', L) === true, '★ 기호를 끼운 금칙어도 잡는다');
    chk(BW.hasBannedWord('B a d 방', L) === true, '  대소문자 · 띄어쓰기 섞어도 잡는다');
    chk(BW.hasBannedWord('조용히 그림만 그려요', L) === false, '  금칙어 없으면 통과');
    chk(BW.hasBannedWord('나쁜말', []) === false && BW.hasBannedWord('', L) === false, '  목록이 비었거나 제목이 비면 걸지 않는다');
  }

  say('── 2. room-lobby.js — 목록 줄(순수)');
  const now = 1e12, LIVE = RS.ROOM_LIVE_MS, STALE = RS.ROOM_ALIVE_STALE_MS;
  {
    const idx = {
      'WORK-AA11': { lastSeen: now - 1000, channel: 'workingroom', open: true },
      'PLAY-BB22': { lastSeen: now - 1000, channel: 'togetherroom', open: true },
      'WORK-CC33': { lastSeen: now - 1000, channel: 'workingroom', open: false },     // 비공개
      'WORK-DD44': { lastSeen: now - LIVE, channel: 'workingroom', open: true },     // 90초 지남
      'SCRT-EE55': { lastSeen: now - 1000, channel: 'togetherroom', open: true },    // 시크릿룸
      'WORK-FF66': { lastSeen: now - 1000, channel: 'workingroom', open: true, srv: 'r1' },   // 방 서버 방
      'WORK-GG77': { lastSeen: 'x', open: true },
      'WORK-HH88': null,
    };
    const c = RL.lobbyCandidates(idx, now);
    chk(JSON.stringify(c) === '["WORK-AA11","PLAY-BB22"]', '★ 후보: 공개 · 90초 안 · 시크릿룸 아님 · 방 서버 방 아님만');
    const many = {}; for (let i = 0; i < RL.LOBBY_META_MAX + 20; i++) many['WORK-' + String(i).padStart(4, '0')] = { lastSeen: now, open: true };
    chk(RL.lobbyCandidates(many, now).length === RL.LOBBY_META_MAX, '  한 번에 읽을 _meta 는 LOBBY_META_MAX 까지');
    chk(RL.liveCount({ m1: now - 1000, m2: now - STALE, m3: 'x', m4: now - STALE + 1 }, now) === 2, '인원: 150초 안 도장만 센다(경계 150초는 뺀다)');
    chk(RL.liveCount(null, now) === 0, '  도장 없음 → 0');

    const meta = { channel: 'workingroom', open: true, title: '  조용히 그림만  ', max: 4, hostName: '새벽작업러', music: true, openTs: 5, ts: 9 };
    const r = RL.lobbyRow(meta, 3, []);
    chk(r && r.t === '조용히 그림만' && r.n === 3 && r.max === 4 && r.hn === '새벽작업러' && r.mu === true && r.since === 5, '줄: 제목(앞뒤 공백 걷음) · 인원 · 최대 · 방장 · 같이 듣기 · 연 시각(openTs 먼저)');
    chk(RL.lobbyRow(meta, 3, ['그림']).t === '', '★ 금칙어가 든 제목은 비운다 — 앱이 기본 제목으로 그린다');
    chk(RL.lobbyRow({ ...meta, title: '가'.repeat(21) }, 1, []).t === '' && RL.lobbyRow({ ...meta, title: 7 }, 1, []).t === '', '  규칙 범위 밖 제목(21자 · 문자열 아님)은 비운다');
    chk(RL.lobbyRow({ ...meta, max: 1 }, 1, []).max === null && RL.lobbyRow({ ...meta, max: 51 }, 1, []).max === null && RL.lobbyRow({ ...meta, max: 2.5 }, 1, []).max === null, '  최대 인원이 2~50 정수가 아니면 null(앱이 정원으로)');
    chk(RL.lobbyRow({ ...meta, max: 2 }, 1, []).max === 2 && RL.lobbyRow({ ...meta, max: 50 }, 1, []).max === 50, '  경계 2 · 50 은 그대로');
    chk(RL.lobbyRow({ ...meta, openTs: undefined }, 1, []).since === 9 && RL.lobbyRow({ channel: 'workingroom', open: true }, 1, []).since === 0, '  연 시각: openTs 없으면 ts · 둘 다 없으면 0');
    const bare = RL.lobbyRow({ channel: 'togetherroom', open: true }, 1, []);
    chk(bare && bare.t === '' && bare.max === null && bare.hn === '' && bare.mu === false, '  옛 앱이 만든 방(새 칸 없음)도 넣는다 — 빈 값으로');
    chk(RL.lobbyRow({ ...meta, open: false }, 3, []) === null, '★ _meta 가 비공개면 뺀다(roomIndex 의 open 은 사본이라 _meta 로 다시 본다)');
    chk(RL.lobbyRow(meta, 0, []) === null, '★ 살아 있는 도장 0 → 뺀다(0/10 방을 보이지 않게)');
    chk(RL.lobbyRow({ ...meta, channel: undefined }, 3, []) === null && RL.lobbyRow(null, 3, []) === null, '  채널 표지 없음 · _meta 없음 → 뺀다');

    const L = RL.lobbyFrom({ 'WORK-AA11': meta, 'PLAY-BB22': { channel: 'togetherroom', open: true, title: '수다' }, 'WORK-CC33': null },
      { 'WORK-AA11': { m1: now }, 'PLAY-BB22': { m1: now, m2: now } }, [], now);
    chk(L.workingroom.at === now && L.togetherroom.at === now && Object.keys(L.workingroom.rooms).join() === 'WORK-AA11' && Object.keys(L.togetherroom.rooms).join() === 'PLAY-BB22' && L.togetherroom.rooms['PLAY-BB22'].n === 2,
      '사본: 채널별 { at, rooms } — 채널마다 만든 시각을 적는다');
    const E = RL.lobbyFrom({}, {}, [], now);
    chk(E.workingroom.at === now && E.togetherroom.at === now && !Object.keys(E.workingroom.rooms).length, '★ 방이 없는 채널도 at 이 남는다 — 앱이 «빈 목록» 과 «못 불러옴 · 낡음» 을 가른다');
  }

  say('── 3. buildRoomLobby — 가짜 DB');
  {
    const db = fakeDb({
      config: { bannedWords: ['나쁜말'] },
      rooms: {
        'WORK-AA11': { _meta: { channel: 'workingroom', open: true, title: '나쁜말 하는 방', max: 4, hostName: 'a', ts: 1 }, m1: { def: { big: 'x'.repeat(100) } } },
        'PLAY-BB22': { _meta: { channel: 'togetherroom', open: true, title: '수다', hostName: 'b', ts: 2 } },
        'WORK-CC33': { _meta: { channel: 'workingroom', open: false } },
      },
    });
    const idx = { 'WORK-AA11': { lastSeen: now, open: true }, 'PLAY-BB22': { lastSeen: now, open: true }, 'WORK-CC33': { lastSeen: now, open: false } };
    const tree = { 'WORK-AA11': { m1: now }, 'PLAY-BB22': { m1: now, m2: now, m3: now - STALE } };
    const sum = await RL.buildRoomLobby(db, idx, tree, now);
    const W = db.data.roomLobby.workingroom.rooms, T = db.data.roomLobby.togetherroom.rooms;
    chk(W['WORK-AA11'].t === '' && W['WORK-AA11'].max === 4, '★ 서버가 금칙어 제목을 비워서 쓴다(config/bannedWords)');
    chk(T['PLAY-BB22'].n === 2 && !W['WORK-CC33'], '  인원은 살아 있는 도장 수 · 비공개 방은 없음');
    chk(sum.candidates === 2 && sum.working === 1 && sum.together === 1 && sum.failed === 0, '  요약(후보 · 채널별 수 · 실패)');
    chk(db.reads.every(p => p === 'config/bannedWords' || /^rooms\/[A-Z]{4}-[A-Z0-9]{4}\/_meta$/.test(p)), '★ 읽는 것은 금칙어와 후보 방의 _meta 뿐 — 멤버 노드(def)를 읽지 않는다');
    chk(!db.reads.includes('rooms/WORK-CC33/_meta'), '  roomIndex 에서 비공개인 방은 _meta 도 안 읽는다');
    db.data.roomLobby = { workingroom: { at: now + 5000 } };
    await RL.buildRoomLobby(db, idx, tree, now);
    chk(db.data.roomLobby.workingroom.at === now + 5000 && !db.data.roomLobby.workingroom.rooms, '★ 더 늦게 만든 사본이 있으면 덮지 않는다(겹친 실행)');
    const many = {}, mIdx = {}, mTree = {};
    for (let i = 0; i < 45; i++){ const c = 'WORK-' + String(i).padStart(4, '0'); many[c] = { _meta: { channel: 'workingroom', open: true } }; mIdx[c] = { lastSeen: now, open: true }; mTree[c] = { m1: now }; }
    const db3 = fakeDb({ rooms: many });
    let inFlight = 0, peak = 0;
    const realRef = db3.ref;
    db3.ref = (p) => { const r = realRef(p); if (!/_meta$/.test(p)) return r; return { ...r, get: async () => { inFlight++; peak = Math.max(peak, inFlight); await new Promise(res => setTimeout(res, 1)); inFlight--; return r.get(); } }; };
    const s3 = await RL.buildRoomLobby(db3, mIdx, mTree, now);
    chk(s3.working === 45 && peak > 1 && peak <= RL.LOBBY_READ_BATCH, '★ _meta 는 LOBBY_READ_BATCH 씩 동시에 읽는다(하나씩 기다리지 않음 · 한꺼번에 다 쏘지도 않음)');
    const db2 = fakeDb({ rooms: { 'WORK-AA11': { _meta: { channel: 'workingroom', open: true, title: '나쁜말' } } } });
    await RL.buildRoomLobby(db2, { 'WORK-AA11': { lastSeen: now, open: true } }, { 'WORK-AA11': { m1: now } }, now);
    const db4 = fakeDb({ roomLobby: { workingroom: { at: 1, rooms: { 'WORK-OLD1': { t: '옛 사본' } } } }, rooms: { 'WORK-AA11': { _meta: { channel: 'workingroom', open: true, title: '나쁜말' } } } });
    const realRef4 = db4.ref;
    db4.ref = (p) => p === 'config/bannedWords' ? { ...realRef4(p), get: async () => { throw new Error('denied'); } } : realRef4(p);
    const s4 = await RL.buildRoomLobby(db4, { 'WORK-AA11': { lastSeen: now, open: true } }, { 'WORK-AA11': { m1: now } }, now);
    chk(s4.bannedFailed === true && db4.data.roomLobby.workingroom.rooms['WORK-OLD1'] && !db4.data.roomLobby.workingroom.rooms['WORK-AA11'],
      '★ 금칙어를 못 읽은 회차는 쓰지 않는다(«목록 없음» 과 다름) — 옛 사본이 남는다');
    chk(db2.data.roomLobby.workingroom.rooms['WORK-AA11'].t === '나쁜말', '  금칙어 목록이 없으면(처음) 거르지 않는다 — 판정은 목록에 있는 말만');
  }

  say('── 4. room-stats 1분 실행이 사본을 만든다');
  {
    const db = fakeDb({
      roomIndex: { 'WORK-AA11': { lastSeen: now - 1000, channel: 'workingroom', open: true } },
      roomAlive: { 'WORK-AA11': { m1: now - 1000 } },
      rooms: { 'WORK-AA11': { _meta: { channel: 'workingroom', open: true, title: '방' } } },
    });
    const shallow = async () => ({});
    const sum = await RS.runRoomStats(db, now, { shallow });
    chk(db.data.roomLobby && db.data.roomLobby.workingroom && db.data.roomLobby.workingroom.rooms['WORK-AA11'].n === 1, '★ 주기 실행이 roomLobby 를 쓴다(같은 roomAlive 트리로 센다)');
    chk(sum.lobby && sum.lobby.working === 1, '  요약에 lobby 가 실린다');
    const reads = db.reads.filter(p => p === 'roomAlive').length;
    chk(reads === 1, '  roomAlive 트리는 한 번만 읽는다(로비가 다시 읽지 않는다)');
    const db2 = fakeDb({ roomIndex: { 'WORK-AA11': { lastSeen: now - 1000, open: true } } });
    await RS.runRoomStats(db2, now, { drop: false });
    chk(!db2.data.roomLobby, '  열림 · 닫힘 트리거(drop:false)는 사본을 만들지 않는다 — 주기 실행만');
  }

  say('── 5. 규칙');
  {
    chk(RULES.roomLobby && RULES.roomLobby['.read'] === true && !('.write' in RULES.roomLobby), 'roomLobby — 읽기만(쓰기는 서버 함수 · 맨 위 거절)');
    const M = RULES.rooms.$room._meta;
    chk(!!(M.title && M.max && M.hostName && M.music), '_meta — title · max · hostName · music 칸이 있다(없으면 $other 가 거절)');
    chk(/<= 20/.test(M.title['.validate']) && /<= 50/.test(M.max['.validate']) && />= 2/.test(M.max['.validate']), '  범위가 함수와 같다(제목 20 · 최대 인원 2~50)');
    chk(RL.TITLE_MAX === 20 && RL.ROOM_MAX_MIN === 2 && RL.ROOM_MAX_MAX === 50 && RL.HOST_NAME_MAX === 20, '  함수 상수도 같다');
    const B = RULES.config.bannedWords;
    chk(B && /admins/.test(B['.write']) && B['.read'] === true && /<= 20/.test(B.$i['.validate']), 'config/bannedWords — 관리자만 쓰고 누구나 읽는다 · 낱말 20자');
    chk(B['.validate'] === 'newData.hasChildren()', '  목록(자식 있음)만 받는다 — 글 하나를 통째로 넣지 못하게');
    const keyRe = new RegExp(B.$i['.validate'].match(/\$i\.matches\(\/(.+?)\/\)/)[1]);
    chk(keyRe.test(String(BW.BANNED_MAX - 1)) && !keyRe.test(String(BW.BANNED_MAX)) && keyRe.test('0') && !keyRe.test('00'), '★ 칸 번호 0 ~ BANNED_MAX-1 만 — 규칙 상한이 판정 상한(' + BW.BANNED_MAX + ')과 같다(넘는 낱말이 저장만 되고 안 걸리지 않게)');
    chk(RL.BANNED_PATH === 'config/bannedWords' && RL.LOBBY_PATH === 'roomLobby', '  함수가 쓰는 경로가 규칙과 같다');
  }

  say('── 6. 깨 보기 — 판정을 지우면 위 검사가 잡는가');
  {
    const src = fs.readFileSync(path.resolve('functions/room-lobby.js'), 'utf8');
    const load = (s) => { const m = { exports: {} }; new Function('module', 'exports', 'require', s)(m, m.exports, (p) => require(path.resolve('functions', p))); return m.exports; };
    const noBan = load(src.replace("hasBannedWord(title, banned) ? '' : title", 'title'));
    chk(noBan.lobbyRow({ channel: 'workingroom', open: true, title: '나쁜말' }, 1, ['나쁜말']).t === '나쁜말', '금칙어 거르기를 빼면 2절 «비운다» 가 빨강이 된다');
    const noOpen = load(src.replace("if (!meta || meta.open !== true || ", 'if (!meta || '));
    chk(noOpen.lobbyRow({ channel: 'workingroom', open: false }, 3, []) !== null, '공개 확인을 빼면 2절 «비공개면 뺀다» 가 빨강이 된다');
    const noAt = load(src.replace('[C.WORKING]: { at: now, rooms: {} }', '[C.WORKING]: { rooms: {} }'));
    chk(!noAt.lobbyFrom({}, {}, [], now).workingroom.at, '채널 at 을 빼면 2절 «방이 없는 채널도 at» 이 빨강이 된다');
    const noSecret = load(src.replace('if (code.indexOf(SECRET_ROOM_PREFIX) === 0) continue;', ''));
    chk(noSecret.lobbyCandidates({ 'SCRT-EE55': { lastSeen: now, open: true } }, now).length === 1, '시크릿룸 거르기를 빼면 2절 «후보» 가 빨강이 된다');
  }

  say('');
  say('통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
