#!/usr/bin/env node
/* 🔐 규칙을 실제로 돌려 보는 확인 — Firebase 데이터베이스 에뮬레이터에 firebase-database-rules.json 을 올리고
   «되어야 하는 쓰기는 되고, 막혀야 하는 쓰기는 막히는지» 를 REST 로 하나씩 보낸다.
   checks/sim-rules-keys.js 는 규칙 글에서 형식을 꺼내 JS 로 돌려 볼 뿐이라, 서버가 실제로 그렇게 판정하는지는 여기서만 안다.
   필요: firebase CLI(firebase-tools) · Java 11+. CI 에는 없어서 손으로 돌린다 — 규칙을 바꾼 PR 은 결과를 본문에 붙인다.
   실행: node scripts/rules-emu-check.js   (종료 코드 0 = 전부 기대대로) */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawnSync } = require('child_process');

const PROJECT = 'demo-tw-rules';                 // demo- 로 시작하면 에뮬레이터가 진짜 프로젝트에 닿지 않는다
const NS = PROJECT + '-default-rtdb';
const PORT = Number(process.env.TW_EMU_PORT) || 0;   // 바깥에서 빈 포트를 골라 안쪽에 넘긴다
const ROOT = path.resolve(__dirname, '..');
const RULES = path.join(ROOT, 'firebase-database-rules.json');

const GOOD_U = 'umu00pdxvk6d9x8mx';
const GOOD_U2 = 'u0abcdefgh12';
const OWNED_U = 'ureporter0001';                 // 로그인에 묶인 사람(신고하는 사람) — 다른 시험의 id 와 나눈다
const ROOM = 'PLAY-AB12';
const MEMBER = 'mabc12345';
const KEY = 'ABCDEFGHJKLMNPQRSTUVWXYZ';      // mobileKeys 형식(24자)

/* 사람이 보낸 것처럼 서명 없는 토큰 — 에뮬레이터는 서명을 보지 않는다 */
function userToken(uid){
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return b({ alg: 'none', typ: 'JWT' }) + '.' + b({ sub: uid, user_id: uid, iat: now, exp: now + 3600, aud: PROJECT, iss: 'https://securetoken.google.com/' + PROJECT, firebase: { sign_in_provider: 'google.com' } }) + '.';
}

const TS = { '.sv': 'timestamp' };

/* 📏 크기 · 키 제한 — 앱이 실제로 쓰는 모양(통째 payload)은 통과, 모르는 칸 · 너무 긴 값은 거절.
   모양은 firebase-init.js · presence.js · room-index.js · web-admin 쓰는 곳에서 그대로 옮겼다(v0.11.0~ 같은 모양).
   OWNER 는 규칙을 건너뛰는 준비용 쓰기(에뮬레이터 관리자) — 시험 데이터 깔기에만 쓴다. */
const OWNER = '!owner';
const ADMIN_A = 'adminA';
const MEMBER2 = 'mabc67890';
const OLD_U = 'uoldver00001';   // ≤0.10.2 앱을 켠 사람(로그인에 안 묶임)
const NEW_U = 'unewacct0001';   // 0.11 로 새로 가입하는 사람
const OLD2_U = 'uoldver00002', NEW2_U = 'unewacct0002', UP_U = 'uupgrade0001', LIS_U = 'ulisten00001', STUCK_U = 'ustuckpres01';   // 읽기 막기 시험용
const URL_S = 'https://firebasestorage.googleapis.com/v0/b/x/o/users%2Fu%2Fa.png?alt=media&token=abc';
const FUTURE = Date.now() + 10 * 60 * 1000;
const DEF = { v: 2, skin: '#ffddcc', faceUrl: URL_S, blinkUrl: URL_S, equippedParts: [{ id: 'p1', xf: { s: 1, y: 0.1 } }], scale: 1, animal: false };
const JOIN = { name: '민수', def: DEF, state: 'focus', userStatus: null, level: 12, userId: GOOD_U, lic: false, lastSeen: TS };
const BASE = { state: 'focus', userStatus: 'custom', customStatus: { emo: '🕒', text: '오늘 1:23' }, level: 12, exp: 5, cyc: 1, clv: 3, starC: '#ff00aa',
  awaySz: 80, lic: true, awayImg: URL_S, ridingOn: GOOD_U2, seatedOn: { host: 'self', slot: 1 }, bench: { seats: 2, deskId: '-Ndesk123' },
  mobile: '태블릿·폰', danceStyle: 'sway', tab: 's1', flyCool: 1760000000000, noise: 'pencil', lastSeen: TS };
const META_FULL = { channel: 'togetherroom', host: GOOD_U, open: true, chatOff: true, tabs: { s1: { name: '영화', ts: 1 }, s2: { name: '공부방', ts: 2 } }, ts: 3, openTs: 3, openLic: true, restoredTs: 3 };
const LIMIT_CASES = [
  ['준비: 관리자 한 명(admins/adminA)', 'PUT', `admins/${ADMIN_A}`, true, true, OWNER],

  /* 방 멤버 — 입장 set · _basePayload 통째 update · 채팅 · 탭 채팅 · 하트비트 · poke */
  ['멤버 — 입장 set(_myMemberData + lastSeen)', 'PUT', `rooms/${ROOM}/${MEMBER}`, JOIN, true],
  ['멤버 — _basePayload 통째 update', 'PATCH', `rooms/${ROOM}/${MEMBER}`, BASE, true],
  ['멤버 — null 칸 섞인 update(내리기)', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { ...BASE, ridingOn: null, seatedOn: null, bench: null, userStatus: null, customStatus: null, exp: null, flyCool: null, mobile: '', noise: '' }, true],
  ['멤버 — 이름 · def 바꾸기', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { ...BASE, name: '민수2', def: DEF }, true],
  ['멤버 — 채팅(날리기 포함)', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { ...BASE, chat: { text: '안'.repeat(140), ts: 1760000000000, fly: true, flyColor: '#ff0000', flySize: 's' } }, true],
  ['멤버 — 탭 채팅', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { ...BASE, chatTab: { text: 'hi', ts: 1760000000000, tab: 's1', fly: true, flyColor: 'rainbow', flySize: 'm' } }, true],
  ['멤버 — 하트비트 hb · exp', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { hb: 2, exp: 3, lastSeen: TS }, true],
  ['멤버 — 남이 poke(bonk)', 'PUT', `rooms/${ROOM}/${MEMBER}/poke`, { type: 'bonk:' + GOOD_U2, from: MEMBER2, ts: TS }, true],
  ['멤버 — 모르는 칸', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { junk: 'x' }, false],
  ['멤버 — 채팅 안 모르는 칸', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { chat: { text: 'a', ts: 1, img: 'x' } }, false],
  ['멤버 — poke 안 모르는 칸', 'PUT', `rooms/${ROOM}/${MEMBER}/poke`, { type: 'pet', from: MEMBER2, ts: TS, blob: 'x' }, false],
  ['멤버 — awayImg 601자', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { awayImg: 'a'.repeat(601) }, false],
  ['멤버 — userId 49자', 'PATCH', `rooms/${ROOM}/${MEMBER}`, { userId: 'u'.repeat(49) }, false],

  /* 방 표지 _meta — 쓰는 곳마다 */
  ['_meta — setRoomChannel update', 'PATCH', `rooms/${ROOM}/_meta`, { channel: 'workingroom', ts: TS, host: GOOD_U, open: true }, true],
  ['_meta — 채팅 잠금', 'PATCH', `rooms/${ROOM}/_meta`, { chatOff: false }, true],
  ['_meta — claimEmptyRoom 통째', 'PUT', `rooms/${ROOM}/_meta`, { host: GOOD_U, channel: 'togetherroom', openLic: true, openTs: 1, ts: 1 }, true],
  ['_meta — 채팅 탭 추가(tabs 통째)', 'PUT', `rooms/${ROOM}/_meta/tabs`, { s1: { name: '영화', ts: 1 }, s2: { name: '공부방', ts: 2 } }, true],
  ['_meta — 탭 이름 바꾸기', 'PUT', `rooms/${ROOM}/_meta/tabs/s1/name`, '영화관', true],
  ['_meta — restoreRoomMeta 통째(되살리기)', 'PUT', `rooms/${ROOM}/_meta`, META_FULL, true],
  ['_meta — claimHostIfVacant(지금 값 + host · ts)', 'PUT', `rooms/${ROOM}/_meta`, { ...META_FULL, host: GOOD_U2, ts: 4 }, true],
  ['_meta — 모르는 칸', 'PATCH', `rooms/${ROOM}/_meta`, { junk: 1 }, false],
  ['_meta — 탭 안 모르는 칸', 'PUT', `rooms/${ROOM}/_meta/tabs/s1`, { name: 'a', ts: 1, junk: 1 }, false],
  ['_meta — host 41자', 'PATCH', `rooms/${ROOM}/_meta`, { host: 'u'.repeat(41) }, false],
  ['준비: 옛 칸이 남은 _meta(규칙 건너뜀)', 'PUT', `rooms/WORK-ABCD/_meta`, { channel: 'workingroom', host: GOOD_U, ts: 1, legacy: 'x' }, true, OWNER],
  ['_meta — 옛 칸을 그대로 실은 통째 쓰기는 거절(바뀌지 않은 칸도 다시 검사된다 — 알고 둔다)', 'PUT', `rooms/WORK-ABCD/_meta`, { channel: 'workingroom', host: GOOD_U2, ts: 2, legacy: 'x' }, false],
  ['_meta — 옛 칸이 있어도 update 는 통과', 'PATCH', `rooms/WORK-ABCD/_meta`, { host: GOOD_U2, ts: 2 }, true],

  /* 대화 기록 */
  ['채팅 기록 — 1200자 · uid', 'PUT', `rooms/${ROOM}/chatLog/-Nmsg1`, { uid: GOOD_U, name: '민수', text: 'a'.repeat(1200), ts: TS }, true],
  ['채팅 기록 — 방장 지우기 표시 sys', 'PUT', `rooms/${ROOM}/chatLog/-Nmsg2`, { uid: GOOD_U, name: '민수', text: '', ts: TS, sys: 'clr' }, true],
  ['채팅 기록 — 탭(_chatTab)', 'PUT', `rooms/${ROOM}/_chatTab/s1/-Nmsg3`, { uid: GOOD_U, name: '민수', text: 'hi', ts: TS }, true],
  ['채팅 기록 — 모르는 칸', 'PUT', `rooms/${ROOM}/chatLog/-Nmsg4`, { name: 'a', text: 'b', ts: TS, img: 'x' }, false],
  ['채팅 기록 — 탭 모르는 칸', 'PUT', `rooms/${ROOM}/_chatTab/s1/-Nmsg5`, { name: 'a', text: 'b', ts: TS, img: 'x' }, false],
  ['채팅 기록 — 1201자', 'PUT', `rooms/${ROOM}/chatLog/-Nmsg6`, { name: 'a', text: 'a'.repeat(1201), ts: TS }, false],
  ['채팅 기록 — sys 11자', 'PUT', `rooms/${ROOM}/chatLog/-Nmsg7`, { name: 'a', text: 'b', ts: TS, sys: 'x'.repeat(11) }, false],

  /* 방 목록 */
  ['방 목록 — 하트비트 update', 'PATCH', `roomIndex/${ROOM}`, { lastSeen: TS, channel: 'togetherroom', open: true }, true],
  ['방 목록 — 마지막 사람 «비었음»', 'PATCH', `roomIndex/${ROOM}`, { lastSeen: 0, emptyAt: TS }, true],
  ['방 목록 — 미래 lastSeen', 'PATCH', `roomIndex/${ROOM}`, { lastSeen: FUTURE }, false],
  ['방 목록 — 미래 emptyAt', 'PATCH', `roomIndex/${ROOM}`, { lastSeen: 0, emptyAt: FUTURE }, false],
  ['방 목록 — 모르는 칸', 'PATCH', `roomIndex/${ROOM}`, { lastSeen: TS, junk: 1 }, false],

  /* 방 읽기 — 모음은 관리자만 · 방 하나는 누구나 */
  ['rooms 모음 읽기 — 로그인 없이', 'GET', 'rooms', null, false],
  ['rooms 모음 읽기 — 로그인(관리자 아님)', 'GET', 'rooms', null, false, 'authA'],
  ['rooms 모음 읽기 — 관리자', 'GET', 'rooms', null, true, ADMIN_A],
  ['rooms/방 하나 읽기 — 로그인 없이', 'GET', `rooms/${ROOM}`, null, true],

  /* 라이선스 신청 */
  ['라이선스 신청 — 앱 신청 통째', 'PUT', 'licenseRequests/r1abc', { name: '민수', status: 'pending', requestedAt: TS, issuedKey: null, ver: '0.11.3' }, true],
  ['라이선스 신청 — 관리자 승인(웹 관리자 · 칸 셋)', 'PATCH', '', { 'licenseRequests/r1abc/status': 'approved', 'licenseRequests/r1abc/issuedKey': 'ABCD-EFGH-JKLM-NPQR', 'licenseRequests/r1abc/approvedAt': TS }, true, ADMIN_A],
  ['라이선스 신청 — 모르는 칸', 'PUT', 'licenseRequests/r2abc', { name: 'a', status: 'pending', junk: 'x' }, false],

  /* 친구 코드 — 처음 쓰기 · 같은 사람 다시 쓰기는 통과, 남의 코드 덮기는 거절 */
  ['친구 코드 — 처음 선점', 'PUT', 'friendCodes/COZY-CD34', { userId: GOOD_U }, true],
  ['친구 코드 — 같은 사람이 다시(트랜잭션 재시도)', 'PUT', 'friendCodes/COZY-CD34', { userId: GOOD_U }, true],
  ['친구 코드 — 다른 사람이 덮기', 'PUT', 'friendCodes/COZY-CD34', { userId: GOOD_U2 }, false],
  ['친구 코드 — 로그인 없이 지우기', 'DELETE', 'friendCodes/COZY-CD34', null, false],
  ['친구 코드 — 관리자는 고칠 수 있다', 'PUT', 'friendCodes/COZY-CD34', { userId: GOOD_U2 }, true, ADMIN_A],
  ['친구 코드 — 모르는 칸', 'PUT', 'friendCodes/COZY-EF56', { userId: GOOD_U, junk: 1 }, false],

  /* 말랑이 선물 */
  ['말랑이 — 칸 묶음 {url, on} 저장(앱이 실제로 쓰는 모양)', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [{ url: URL_S, on: true }, { url: URL_S, on: false }] }, true],
  ['말랑이 — 옛 글자 모양도 받음', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [URL_S] }, true],
  ['말랑이 — 전부 지우기', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [] }, true],
  ['말랑이 — Storage 밖 주소', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [{ url: 'https://evil.example/a.png', on: true }] }, false],
  ['말랑이 — javascript 주소', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [{ url: 'javascript:alert(1)', on: true }] }, false],
  ['말랑이 — 1001자 주소', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [{ url: URL_S + 'a'.repeat(1001), on: true }] }, false],
  ['선물 — Storage 밖 그림 주소', 'PUT', `users/${GOOD_U2}/mallangGifts/-NgiftX`, { imgUrl: 'https://evil.example/t.png', ts: 1 }, false],
  ['말랑이 — 칸에 모르는 키', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [{ url: URL_S, junk: 1 }] }, false],
  ['말랑이 — 다섯 번째 칸', 'PUT', `users/${GOOD_U}/mallang/imgs/4`, { url: URL_S, on: true }, false],
  ['선물 — 보내기 통째', 'PUT', `users/${GOOD_U2}/mallangGifts/-Ngift1`, { imgUrl: URL_S, fromName: '민수', fromId: GOOD_U, ts: 1, msg: '안녕' }, true],
  ['선물 — 숨기기', 'PUT', `users/${GOOD_U2}/mallangGifts/-Ngift1/hidden`, true, true],
  ['선물 — 별표', 'PUT', `users/${GOOD_U2}/mallangGifts/-Ngift1/starred`, true, true],
  ['선물 — 모르는 칸', 'PUT', `users/${GOOD_U2}/mallangGifts/-Ngift2`, { imgUrl: URL_S, ts: 1, junk: 'x' }, false],
  ['선물 — fromName 21자', 'PUT', `users/${GOOD_U2}/mallangGifts/-Ngift3`, { imgUrl: URL_S, ts: 1, fromName: 'a'.repeat(21) }, false],

  /* 친구 · 방명록 */
  ['친구 — 모르는 칸', 'PUT', `users/${GOOD_U}/friends/${GOOD_U2}`, { addedAt: 1, junk: 1 }, false],
  ['방명록 — 글 통째(주인 본인)', 'PUT', `users/${GOOD_U}/guestbook/g1abc`, { name: '민수', text: '안녕', ts: 1, uid: GOOD_U }, true],
  ['방명록 — 모르는 칸', 'PUT', `users/${GOOD_U}/guestbook/g2abc`, { name: '민수', text: '안녕', ts: 1, uid: GOOD_U, junk: 1 }, false],

  /* 웹박수 — 박수는 누구나 +1 만, 그림 · 이모지는 주인만 */
  ['박수 — 첫 박수 1', 'PUT', `users/${OWNED_U}/clap/count`, 1, true],
  ['박수 — 누구나 +1', 'PUT', `users/${OWNED_U}/clap/count`, 2, true],
  ['박수 — +5 는 거절', 'PUT', `users/${OWNED_U}/clap/count`, 7, false],
  ['박수 그림 — 남(로그인 없이)', 'PATCH', `users/${OWNED_U}/clap`, { img: URL_S }, false],
  ['박수 그림 — 주인', 'PATCH', `users/${OWNED_U}/clap`, { img: URL_S }, true, 'authA'],
  ['박수 이모지 — 주인', 'PATCH', `users/${OWNED_U}/clap`, { emoji: '🎉' }, true, 'authA'],
  ['박수 이모지 — 남', 'PATCH', `users/${OWNED_U}/clap`, { emoji: '💩' }, false],
  ['박수 — 모르는 칸(주인이라도)', 'PATCH', `users/${OWNED_U}/clap`, { junk: 1 }, false, 'authA'],
  ['박수 그림 — 400001자(주인이라도)', 'PATCH', `users/${OWNED_U}/clap`, { img: 'a'.repeat(400001) }, false, 'authA'],

  /* 일정 알림 */
  ['일정 알림 — 보내기(여러 칸 한 번에)', 'PATCH', '', { [`users/${GOOD_U2}/schedNotices/n1abc`]: { fromId: GOOD_U, fromName: '민수', text: '회의', date: '2026-10-18', ts: 1 } }, true],
  ['일정 알림 — 모르는 칸', 'PUT', `users/${GOOD_U2}/schedNotices/n2abc`, { fromId: GOOD_U, fromName: 'a', text: 'b', date: '2026-10-18', ts: 1, junk: 1 }, false],
  ['일정 알림 — date 17자', 'PUT', `users/${GOOD_U2}/schedNotices/n3abc`, { fromId: GOOD_U, fromName: 'a', text: 'b', date: 'x'.repeat(17), ts: 1 }, false],

  /* 파도타기 색인 — 주인만 */
  ['파도타기 색인 — 안 묶인 코드(본인)', 'PUT', `playlistIndex/${GOOD_U}`, { name: '민수', n: 5, ts: 1 }, true],
  ['파도타기 색인 — 묶인 코드에 남', 'PUT', `playlistIndex/${OWNED_U}`, { name: 'x', n: 1, ts: 1 }, false],
  ['파도타기 색인 — 묶인 코드 주인', 'PUT', `playlistIndex/${OWNED_U}`, { name: '민수', n: 1, ts: 1 }, true, 'authA'],
  ['파도타기 색인 — 모르는 칸', 'PUT', `playlistIndex/${GOOD_U}`, { name: 'a', n: 1, ts: 1, junk: 1 }, false],

  /* 초대 코드 — 발급 · 소진 · 토큰→uid 는 통과, 발급자 바꾸기는 거절 */
  ['초대 — 발급 통째', 'PUT', 'invites/ABCD-EF12-GH35', { issuedBy: GOOD_U, createdAt: 1, usedBy: null, usedAt: null }, true],
  ['초대 — 소진(기기 토큰)', 'PUT', 'invites/ABCD-EF12-GH35', { issuedBy: GOOD_U, createdAt: 1, usedBy: 'tabcdefghij012345', usedAt: 2 }, true],
  ['초대 — 토큰을 uid 로', 'PUT', 'invites/ABCD-EF12-GH35', { issuedBy: GOOD_U, createdAt: 1, usedBy: GOOD_U2, usedAt: 2 }, true],
  ['초대 — 발급자 바꾸기', 'PUT', 'invites/ABCD-EF12-GH35', { issuedBy: GOOD_U2, createdAt: 1, usedBy: GOOD_U2, usedAt: 2 }, false],
  ['초대 — 발급 시각 바꾸기', 'PUT', 'invites/ABCD-EF12-GH35', { issuedBy: GOOD_U, createdAt: 9, usedBy: GOOD_U2, usedAt: 2 }, false],
  ['초대 — 웹 관리자 발급(admin)', 'PUT', 'invites/ADMN-EF12-GH36', { issuedBy: 'admin', createdAt: 3 }, true, ADMIN_A],
  ['초대 — 모르는 칸', 'PUT', 'invites/ABCD-EF12-GH37', { issuedBy: GOOD_U, createdAt: 1, junk: 1 }, false],
  ['초대 — usedBy 65자', 'PUT', 'invites/ABCD-EF12-GH38', { issuedBy: GOOD_U, createdAt: 1, usedBy: 'u'.repeat(65) }, false],

  /* 친구 요청 · 보낸 요청 · 방 초대 */
  ['친구 요청 — 요청 + 거울 한 번에', 'PATCH', '', { [`friendRequests/${GOOD_U2}/${GOOD_U}`]: { name: '민수', ts: 1 }, [`sentFriendRequests/${GOOD_U}/${GOOD_U2}`]: { ts: 1, toName: '지영', toCode: 'MATE-AB12' } }, true],
  ['친구 요청 — 모르는 칸', 'PUT', `friendRequests/${GOOD_U2}/${GOOD_U}`, { name: 'a', ts: 1, junk: 1 }, false],
  ['보낸 요청 — 모르는 칸', 'PUT', `sentFriendRequests/${GOOD_U}/${GOOD_U2}`, { ts: 1, junk: 1 }, false],
  ['방 초대 — 통째', 'PUT', `roomInvites/${GOOD_U2}/${GOOD_U}`, { roomCode: ROOM, fromName: '민수', ts: 1 }, true],
  ['방 초대 — 모르는 칸', 'PUT', `roomInvites/${GOOD_U2}/${GOOD_U}`, { roomCode: ROOM, ts: 1, junk: 1 }, false],

  /* 우편함 */
  ['우편함 — 앱 보내기 통째(bugId)', 'PUT', `inbox/${GOOD_U}/m1abc`, { tag: 'bug', title: '답변', body: '본문', ts: 1, read: false, bugId: '-Nbug1' }, true],
  ['우편함 — 읽음', 'PATCH', `inbox/${GOOD_U}/m1abc`, { read: true }, true],
  ['우편함 — 웹 관리자가 묶인 사람에게', 'PATCH', '', { [`inbox/${OWNED_U}/m2abc`]: { tag: 'reward', title: '보상', body: '', ts: 1, read: false } }, true, ADMIN_A],
  ['우편함 — 모르는 칸', 'PUT', `inbox/${GOOD_U}/m3abc`, { tag: 'notice', title: 'a', ts: 1, junk: 1 }, false],

  /* 안 묶인 옛 코드만 열린 users/* — 말랑이 · 접속 · 포커스 · 프로필 */
  ['말랑이 — 그림 목록', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [URL_S, URL_S, URL_S, URL_S] }, true],
  ['말랑이 — 다섯째 그림', 'PUT', `users/${GOOD_U}/mallang/imgs/4`, URL_S, false],
  ['말랑이 — 모르는 칸', 'PUT', `users/${GOOD_U}/mallang`, { imgs: [URL_S], junk: 1 }, false],
  ['말랑이 — 그림 200001자', 'PUT', `users/${GOOD_U}/mallang`, { imgs: ['a'.repeat(200001)] }, false],
  ['접속 — 켜기 통째(ver)', 'PUT', `users/${GOOD_U}/presence`, { online: true, lastSeen: 1, room: ROOM, inRoom: true, ver: '0.11.3' }, true],
  ['접속 — 방 나감 update', 'PATCH', `users/${GOOD_U}/presence`, { room: null, inRoom: false, lastSeen: 2 }, true],
  ['접속 — 모르는 칸', 'PATCH', `users/${GOOD_U}/presence`, { junk: 1 }, false],
  ['포커스 — 누적 초', 'PUT', `users/${GOOD_U}/focus/totalSec`, 100, true],
  ['포커스 — 모르는 칸', 'PUT', `users/${GOOD_U}/focus`, { totalSec: 1, junk: 1 }, false],
  ['프로필 — 통째(레벨 · 회차 · 별 색)', 'PUT', `users/${GOOD_U}/profile`, { name: '민수', updatedAt: 1, level: 120, cyc: 1, clv: 3, starC: '#ff00aa' }, true],
  ['프로필 — 모르는 칸', 'PUT', `users/${GOOD_U}/profile`, { name: '민수', junk: 1 }, false],

  /* 🚧 ≤0.10.2 막기 — 0.11.0 부터 presence 에 ver 를 싣는다. «presence 가 켜짐(online:true)인데 ver 가 없다» = 지금 ≤0.10.2 앱이 켜져 있다.
     그동안 그 사람 코드의 자기 칸 쓰기 · 남에게 보내는 쓰기를 막는다. presence 자체는 막지 않는다(그게 표지다). */
  ['옛 앱 — 0.10.2 모양 presence 켜기(ver 없음)는 받는다(표지)', 'PUT', `users/${OLD_U}/presence`, { online: true, lastSeen: 1, room: null, inRoom: false }, true],
  ['옛 앱 — 프로필', 'PUT', `users/${OLD_U}/profile`, { name: '옛앱', updatedAt: 1, level: 3 }, false],
  ['옛 앱 — 슬롯', 'PUT', `users/${OLD_U}/slots`, { ts: 1, v: 1, s: { 0: '{}' } }, false],
  ['옛 앱 — 포커스', 'PUT', `users/${OLD_U}/focus/totalSec`, 10, false],
  ['옛 앱 — 마이홈', 'PUT', `users/${OLD_U}/home`, { bio: 'a' }, false],
  ['옛 앱 — 랭킹', 'PUT', `leaderboard/${OLD_U}`, { sec: 1, ts: TS }, false],
  ['옛 앱 — 파도타기 색인', 'PUT', `playlistIndex/${OLD_U}`, { name: 'a', n: 1, ts: 1 }, false],
  ['옛 앱 — 말랑이', 'PUT', `users/${OLD_U}/mallang`, { imgs: [URL_S] }, false],
  ['옛 앱 — 박수 그림', 'PATCH', `users/${OLD_U}/clap`, { img: URL_S }, false],
  ['옛 앱 — 내 우편함 쓰기', 'PUT', `inbox/${OLD_U}/m1old`, { tag: 'notice', title: 'a', ts: 1, read: true }, false],
  ['옛 앱 — 관리자가 그 사람 우편함에 보내기는 그대로', 'PUT', `inbox/${OLD_U}/m2old`, { tag: 'reward', title: '보상', ts: 1, read: false }, true, ADMIN_A],
  ['옛 앱 — 친구 요청 보내기', 'PATCH', '', { [`friendRequests/${GOOD_U2}/${OLD_U}`]: { name: '옛앱', ts: 1 }, [`sentFriendRequests/${OLD_U}/${GOOD_U2}`]: { ts: 1 } }, false],
  ['옛 앱 — 방 초대 보내기', 'PUT', `roomInvites/${GOOD_U2}/${OLD_U}`, { roomCode: ROOM, fromName: '옛앱', ts: 1 }, false],
  ['옛 앱 — 내 방명록에 글', 'PUT', `users/${OLD_U}/guestbook/g1old`, { name: '옛앱', text: 'a', ts: 1, uid: OLD_U }, false],
  ['옛 앱 — 선물 보내기', 'PUT', `users/${GOOD_U2}/mallangGifts/-Nold1`, { imgUrl: URL_S, fromName: '옛앱', fromId: OLD_U, ts: 1 }, false],
  ['옛 앱 — 일정 알림 보내기', 'PUT', `users/${GOOD_U2}/schedNotices/n1old`, { fromId: OLD_U, fromName: '옛앱', text: 'a', date: '2026-10-18', ts: 1 }, false],
  ['준비: 옛 앱이 전에 보낸 친구 요청(규칙 건너뜀)', 'PUT', `friendRequests/${GOOD_U2}/${OLD_U}`, { name: '옛앱', ts: 1 }, true, OWNER],
  ['옛 앱 요청 — 받은 사람(새 앱)이 지우기는 된다', 'DELETE', `friendRequests/${GOOD_U2}/${OLD_U}`, null, true],
  ['옛 앱 — 박수 +1 은 누구나라 그대로(쓰는 사람을 모름)', 'PUT', `users/${OLD_U}/clap/count`, 1, true],
  ['옛 앱이 꺼짐(onDisconnect — online:false · ver 없음)', 'PUT', `users/${OLD_U}/presence`, { online: false, lastSeen: 2 }, true],
  ['옛 앱이 꺼진 뒤 — 막힘 풀림(새 앱 첫 부팅의 presence 전 쓰기가 안 깨지는 까닭)', 'PUT', `users/${OLD_U}/profile`, { name: '옛앱', updatedAt: 2 }, true],
  ['새 앱으로 올림 — presence 에 ver', 'PUT', `users/${OLD_U}/presence`, { online: true, lastSeen: 3, room: null, inRoom: false, ver: '0.11.3' }, true],
  ['새 앱 — 프로필', 'PUT', `users/${OLD_U}/profile`, { name: '새앱', updatedAt: 3 }, true],
  ['새 앱 — 친구 요청', 'PATCH', '', { [`friendRequests/${GOOD_U2}/${OLD_U}`]: { name: '새앱', ts: 1 }, [`sentFriendRequests/${OLD_U}/${GOOD_U2}`]: { ts: 1 } }, true],
  ['새 앱 — ver 를 늦게 받은 판(presence 먼저 · ver 는 update)', 'PUT', `users/${OLD_U}/presence`, { online: true, lastSeen: 4, room: null, inRoom: false }, true],
  ['  ↳ ver update', 'PATCH', `users/${OLD_U}/presence`, { ver: '0.11.3' }, true],
  ['  ↳ 그 뒤 쓰기는 된다', 'PUT', `users/${OLD_U}/focus/totalSec`, 20, true],

  /* 새 계정 · 새 PC — 0.11 부팅 순서 그대로(presence 보다 먼저 쓰는 것 포함) 끝까지 */
  ['새 계정 ① 코드를 로그인에 묶기', 'PUT', `userAuth/${NEW_U}`, 'authN', true, 'authN'],
  ['새 계정 ② 친구 코드 선점', 'PUT', 'friendCodes/COZY-NW12', { userId: NEW_U }, true, 'authN'],
  ['새 계정 ③ 초대권 칸', 'PUT', `users/${NEW_U}/invite`, { invitesLeft: 0, invitedBy: null, joinedAt: 1 }, true, 'authN'],
  ['새 계정 ④ 계정 요약(presence 전)', 'PUT', `accountSnap/${NEW_U}`, { ts: 1, name: '새사람', friendCode: 'COZY-NW12', ver: '0.11.3' }, true, 'authN'],
  ['새 계정 ⑤ 계정에 코드 기록', 'PUT', `users/${NEW_U}/friendCode`, 'COZY-NW12', true, 'authN'],
  ['새 계정 ⑥ 슬롯 올리기(presence 전)', 'PUT', `users/${NEW_U}/slots`, { ts: 1, v: 1, s: { 0: '{}' } }, true, 'authN'],
  ['새 계정 ⑦ 북마크(presence 전)', 'PUT', `bookmarks/${NEW_U}`, { order: '', ts: 1 }, true, 'authN'],
  ['새 계정 ⑧ presence(ver)', 'PUT', `users/${NEW_U}/presence`, { online: true, lastSeen: 1, room: null, inRoom: false, ver: '0.11.3' }, true, 'authN'],
  ['새 계정 ⑨ 프로필', 'PUT', `users/${NEW_U}/profile`, { name: '새사람', updatedAt: 1, level: 1 }, true, 'authN'],
  ['새 계정 ⑩ 기기 세션', 'PUT', `users/${NEW_U}/session`, { id: 'd1', at: 1 }, true, 'authN'],
  ['새 계정 ⑪ 포커스 · 랭킹 · 색인', 'PATCH', '', { [`users/${NEW_U}/focus/totalSec`]: 5, [`leaderboard/${NEW_U}`]: { sec: 5, ts: TS }, [`playlistIndex/${NEW_U}`]: { name: '새사람', n: 0, ts: 1 } }, true, 'authN'],
  ['새 계정 ⑫ 신고(쓰는 사람 = 나)', 'PUT', `reports/${GOOD_U2}/${NEW_U}`, { kind: 'etc', nick: 'a', code4: 'AB12', ts: 1 }, true, 'authN'],
  /* 🚧 ≤0.10.2 읽기 막기 — 읽는 사람의 로그인(auth.uid) → authUsers/{authUid}.userCode → 그 코드의 presence 가 «켜짐 · ver 없음» 이면 거절.
     로그인 안 함(auth null) · 이어진 코드 없음(익명 가입 중 · 봇)은 막지 않는다 — 0.11 의 로그인 없는 REST 읽기 · 가입 중 읽기가 산다. */
  ['준비: 옛 앱 로그인 이음(authUsers/authOld → OLD2)', 'PUT', `authUsers/authOld`, { userCode: OLD2_U, ts: 1 }, true, OWNER],
  ['준비: 새 앱 로그인 이음(authNew2 → NEW2) · presence 아직 없음', 'PUT', `authUsers/authNew2`, { userCode: NEW2_U, ts: 1 }, true, OWNER],
  ['준비: 올린 첫 부팅(authUp → UP) · 옛 앱이 남긴 꺼짐(ver 없음)', 'PATCH', '', { 'authUsers/authUp': { userCode: UP_U, ts: 1 }, [`users/${UP_U}/presence`]: { online: false, lastSeen: 1 } }, true, OWNER],
  ['새 앱(로그인 · presence 전) — 카탈로그 읽기', 'GET', 'catalog/parts', null, true, 'authNew2'],
  ['새 앱(로그인 · presence 전) — 내 authUsers 읽기', 'GET', 'authUsers/authNew2', null, true, 'authNew2'],
  ['새 앱(로그인 · presence 전) — 원격 설정', 'GET', 'config/minAppVer', null, true, 'authNew2'],
  ['새 앱(올린 첫 부팅 · presence 전) — 친구 사용자 칸', 'GET', `users/${GOOD_U2}`, null, true, 'authUp'],
  ['새 앱(익명 · 이음 없음) — 카탈로그', 'GET', 'catalog/parts', null, true, 'authAnon'],
  ['로그인 없음 — 방 하나 shallow(REST)', 'GET', `rooms/${ROOM}?shallow=true`, null, true],
  ['로그인 없음 — 공지', 'GET', 'announce', null, true],
  ['옛 앱 — presence 켜기(ver 없음)', 'PUT', `users/${OLD2_U}/presence`, { online: true, lastSeen: 1, room: null, inRoom: false }, true],
  ['옛 앱 — 카탈로그 읽기', 'GET', 'catalog/parts', null, false, 'authOld'],
  ['옛 앱 — 카탈로그 버전', 'GET', 'catalogMeta', null, false, 'authOld'],
  ['옛 앱 — 원격 설정(minRoomVer)', 'GET', 'config/minRoomVer', null, false, 'authOld'],
  ['옛 앱 — 공지 · 업데이트 공지', 'GET', 'announce/current', null, false, 'authOld'],
  ['옛 앱 — 업데이트 공지', 'GET', 'updateNotice/current', null, false, 'authOld'],
  ['옛 앱 — 친구 사용자 칸', 'GET', `users/${GOOD_U2}`, null, false, 'authOld'],
  /* 내 authUsers 한 칸은 막지 않는다 — 막으면 presence 가 «켜짐 · ver 없음» 으로 남은 사람은 새 앱으로도 로그인을 못 해 presence 를 고쳐 쓸 수 없다.
     칸에는 내 userCode 하나뿐이고 옛 앱은 바로 다음 읽기에서 막힌다. */
  ['옛 앱 — 내 authUsers(로그인 확인)는 읽힌다', 'GET', 'authUsers/authOld', null, true, 'authOld'],
  ['  ↳ 남의 authUsers 는 여전히 막힘', 'GET', 'authUsers/authNew2', null, false, 'authOld'],
  ['  ↳ 그다음 친구 사용자 칸은 막힘', 'GET', `users/${GOOD_U2}`, null, false, 'authOld'],
  ['옛 앱 — 방 하나', 'GET', `rooms/${ROOM}`, null, false, 'authOld'],
  ['옛 앱 — 파도타기(최근 60 쿼리)', 'GET', 'playlistIndex?orderBy=%22ts%22&limitToLast=5', null, false, 'authOld'],
  ['새 앱 — 파도타기(최근 60 쿼리)', 'GET', 'playlistIndex?orderBy=%22ts%22&limitToLast=5', null, true, 'authNew2'],
  ['옛 앱 — 랭킹 쿼리', 'GET', 'leaderboard?orderBy=%22sec%22&limitToLast=5', null, false, 'authOld'],
  ['새 앱 — 랭킹 쿼리', 'GET', 'leaderboard?orderBy=%22sec%22&limitToLast=5', null, true, 'authNew2'],
  ['옛 앱 — 우편함 공용', 'GET', 'inboxBroadcast', null, false, 'authOld'],
  ['옛 앱 — 관리자 칸은 원래 막힘(시험 도구 확인)', 'GET', 'adminTodos', null, false, 'authOld'],
  ['관리자(이음 없음) — 관리자 읽기 그대로', 'GET', 'rooms', null, true, ADMIN_A],
  ['옛 앱 — 꺼짐으로 빠져나가기(수동 오프라인 · inRoom 실림)', 'PUT', `users/${OLD2_U}/presence`, { online: false, lastSeen: 2, room: null, inRoom: false }, false],
  ['  ↳ 그래서 여전히 막힘', 'GET', 'catalog/parts', null, false, 'authOld'],
  ['옛 앱 — 꺼짐(onDisconnect 모양 · inRoom 없음)은 받는다', 'PUT', `users/${OLD2_U}/presence`, { online: false, lastSeen: 3 }, true],
  ['  ↳ 꺼진 뒤 다음 부팅의 presence 전 읽기는 열린다(규칙만으로 못 닫음)', 'GET', 'catalog/parts', null, true, 'authOld'],
  ['새 앱 — 수동 오프라인(ver 실림)', 'PUT', `users/${NEW2_U}/presence`, { online: false, lastSeen: 1, room: null, inRoom: false, ver: '0.11.3' }, true],
  ['새 앱 — presence(ver) 뒤 읽기', 'GET', 'catalog/parts', null, true, 'authNew2'],
  /* presence 가 «켜짐 · ver 없음» 으로 남은 채 다시 깐 PC 에서 새 앱으로 로그인 — 내 authUsers 로 코드를 찾고, presence(ver) 를 쓰면 풀린다 */
  ['준비: 남은 presence(켜짐 · ver 없음) · 로그인 이음(authStuck → STUCK)', 'PATCH', '', { 'authUsers/authStuck': { userCode: STUCK_U, ts: 1 }, [`userAuth/${STUCK_U}`]: 'authStuck', [`users/${STUCK_U}/presence`]: { online: true, lastSeen: 1, room: null, inRoom: false } }, true, OWNER],
  ['남은 presence — 로그인 때 내 authUsers 읽기', 'GET', 'authUsers/authStuck', null, true, 'authStuck'],
  ['  ↳ presence 를 고치기 전 다른 읽기는 막힘', 'GET', 'catalog/parts', null, false, 'authStuck'],
  ['  ↳ 새 앱이 presence(ver) 를 씀', 'PUT', `users/${STUCK_U}/presence`, { online: true, lastSeen: 2, room: null, inRoom: false, ver: '0.11.3' }, true, 'authStuck'],
  ['  ↳ 그 뒤 읽기는 열림', 'GET', 'catalog/parts', null, true, 'authStuck'],
];

/* 🤖 서버 봇(apiBots)의 통째 읽기 — API 읽기 사본이 노드 전체를 듣는다(조건 없음). «최근 N개» 조건이 봇 갈래보다 앞이면
   조건이 비어 규칙 계산이 먼저 실패해 봇까지 401 이 났다(10-18 Grafana 경고) — 봇 갈래를 앞에 둔다. */
const BOT = 'botApi';
const BOT_CASES = [
  ['준비: 서버 봇 등록(apiBots/botApi)', 'PUT', `apiBots/${BOT}`, true, true, OWNER],
  ['준비: 제보 한 줄', 'PUT', 'bugBoard/list/b1', { ts: 1, name: '익명' }, true, OWNER],
  ['준비: 파도타기 한 줄', 'PUT', `playlistIndex/${GOOD_U}`, { ts: 1 }, true, OWNER],
  ['서버 봇 — 제보 목록 통째 읽기', 'GET', 'bugBoard/list', null, true, BOT],
  ['서버 봇 — 파도타기 목록 통째 읽기', 'GET', 'playlistIndex', null, true, BOT],
  ['봇 아닌 사람 — 제보 목록 통째 읽기는 막힘', 'GET', 'bugBoard/list', null, false, 'authNew2'],
  ['봇 아닌 사람 — 파도타기 목록 통째 읽기는 막힘', 'GET', 'playlistIndex', null, false, 'authNew2'],
  ['봇 아닌 사람 — 제보 최근 20개(ts 순)는 읽힘', 'GET', 'bugBoard/list?orderBy=%22ts%22&limitToLast=20', null, true, 'authNew2'],
];

/* [이름, 방법, 경로(인코딩 전), 본문, 기대(true = 통과), 사용자 토큰?] — 경로 조각은 그대로 넣는다(공백 · null 도) */
const CASES = [
  ['준비: 폰 연결 키', 'PUT', `mobileKeys/${GOOD_U}`, KEY, true],
  ['준비: 신고하는 사람을 로그인에 묶기', 'PUT', `userAuth/${OWNED_U}`, 'authA', true, 'authA'],

  ['사용자 프로필 — 정상 id', 'PUT', `users/${GOOD_U}/profile`, { name: 'a' }, true],
  ['사용자 프로필 — 대문자 섞인 id(앱 _setMyUserId 와 같게 받음)', 'PUT', `users/U0ABCDEFGH/profile`, { name: 'a' }, true],
  ['사용자 프로필 — null', 'PUT', 'users/null/profile', { name: 'a' }, false],
  ['사용자 프로필 — undefined', 'PUT', 'users/undefined/profile', { name: 'a' }, false],
  ['사용자 프로필 — 앞 공백', 'PUT', ` ${GOOD_U}`.replace(/^/, 'users/') + '/profile', { name: 'a' }, false],
  ['사용자 프로필 — 너무 짧은 id', 'PUT', 'users/u1234/profile', { name: 'a' }, false],
  ['사용자 아래 깊은 칸 — null id', 'PUT', 'users/null/schedule/2026-10/17/x1', { text: 'a', ts: 1 }, false],
  ['일정 — 정상', 'PUT', `users/${GOOD_U}/schedule/2026-10/17/x1`, { text: 'a', ts: 1 }, true],
  ['일정 — 달 칸이 undefined', 'PUT', `users/${GOOD_U}/schedule/undefined/17/x1`, { text: 'a', ts: 1 }, false],
  ['일정 — 날 칸이 NaN', 'PUT', `users/${GOOD_U}/schedule/2026-10/NaN/x1`, { text: 'a', ts: 1 }, false],
  ['디데이 — 끝 공백', 'PUT', `users/${GOOD_U}/ddays/x1 `, { text: 'a', date: '2026-10-17', ts: 1 }, false],
  ['친구 — 정상', 'PUT', `users/${GOOD_U}/friends/${GOOD_U2}`, { addedAt: 1 }, true],
  ['친구 — 친구 id 가 null', 'PUT', `users/${GOOD_U}/friends/null`, { addedAt: 1 }, false],
  ['친구 신청 — 정상', 'PUT', `friendRequests/${GOOD_U2}/${GOOD_U}`, { name: 'a', ts: 1 }, true],
  ['친구 신청 — 받는 사람 null', 'PUT', `friendRequests/null/${GOOD_U}`, { name: 'a', ts: 1 }, false],
  ['친구 신청 — 보낸 사람 undefined', 'PUT', `friendRequests/${GOOD_U2}/undefined`, { name: 'a', ts: 1 }, false],
  ['보낸 친구 신청 — 정상', 'PUT', `sentFriendRequests/${GOOD_U}/${GOOD_U2}`, { ts: 1 }, true],
  ['방 초대 — 받는 사람 null', 'PUT', `roomInvites/null/${GOOD_U}`, { roomCode: ROOM, ts: 1 }, false],
  ['우편함 — 정상', 'PUT', `inbox/${GOOD_U}/m1`, { tag: 'notice', title: 'a', ts: 1 }, true],
  ['우편함 — 받는 사람 null', 'PUT', 'inbox/null/m1', { tag: 'notice', title: 'a', ts: 1 }, false],
  ['랭킹 — null', 'PUT', 'leaderboard/null', { sec: 1, ts: 1 }, false],
  ['플레이리스트 목록 — 정상', 'PUT', `playlistIndex/${GOOD_U}`, { ts: 1 }, true],
  ['플레이리스트 목록 — NaN', 'PUT', 'playlistIndex/NaN', { ts: 1 }, false],
  ['폰 연결 live — 정상', 'PUT', `mobileLink/${GOOD_U}/live`, { at: TS }, true],
  ['폰 연결 state — 정상(키 맞음)', 'PUT', `mobileLink/${GOOD_U}/state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — null', 'PUT', 'mobileLink/null/state', { on: true, ts: TS, key: KEY }, false],
  ['폰 연결 state — 앞 공백 · 연결 키 맞음(받고 서버 함수가 정상 칸으로 옮긴다)', 'PUT', `mobileLink/ ${GOOD_U}/state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — 뒤 공백 · 연결 키 맞음', 'PUT', `mobileLink/${GOOD_U} /state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — 공백 두 칸 · 연결 키 맞음', 'PUT', `mobileLink/  ${GOOD_U}/state`, { on: true, ts: TS, key: KEY }, true],
  ['폰 연결 state — 앞 공백 · 연결 키 틀림', 'PUT', `mobileLink/ ${GOOD_U}/state`, { on: true, ts: TS, key: 'ZZZZZZZZZZZZZZZZZZZZZZZZ' }, false],
  ['폰 연결 state — 앞 공백 · 연결 키 없음', 'PUT', `mobileLink/ ${GOOD_U}/state`, { on: true, ts: TS }, false],
  ['폰 연결 state — 연결 키가 없는 사람 코드에 공백', 'PUT', `mobileLink/ ${GOOD_U2}/state`, { on: true, ts: TS, key: KEY }, false],
  ['폰 연결 live — 앞 공백(PC 는 공백 칸에 쓰지 않는다)', 'PUT', `mobileLink/ ${GOOD_U}/live`, { at: TS }, false],
  ['폰 연결 — 공백 + undefined', 'PUT', 'mobileLink/ undefined/state', { on: true, ts: TS, key: KEY }, false],
  ['방 멤버 — 정상', 'PUT', `rooms/${ROOM}/${MEMBER}`, { name: 'a', state: 'idle' }, true],
  ['방 멤버 — 방 코드 null', 'PUT', `rooms/null/${MEMBER}`, { name: 'a', state: 'idle' }, false],
  ['방 멤버 — 멤버 id undefined', 'PUT', `rooms/${ROOM}/undefined`, { name: 'a', state: 'idle' }, false],
  ['방 채팅 — 정상', 'PUT', `rooms/${ROOM}/chatLog/-Nabc`, { name: 'a', text: 'b', ts: 1 }, true],
  ['방 채팅 — 글 id null', 'PUT', `rooms/${ROOM}/chatLog/null`, { name: 'a', text: 'b', ts: 1 }, false],
  ['방 목록 — 정상', 'PUT', `roomIndex/${ROOM}`, { lastSeen: 1 }, true],
  ['방 목록 — 소문자 코드', 'PUT', 'roomIndex/play-ab12', { lastSeen: 1 }, false],
  ['방 살아 있음 — 방 코드 null', 'PUT', `roomAlive/null/${MEMBER}`, TS, false],
  ['친구 코드 — 정상', 'PUT', 'friendCodes/MATE-AB12', { userId: GOOD_U }, true],
  ['친구 코드 — null', 'PUT', 'friendCodes/null', { userId: GOOD_U }, false],
  ['초대 코드 — 정상', 'PUT', 'invites/ABCD-EF12-GH34', { issuedBy: GOOD_U, createdAt: 1 }, true],
  ['초대 코드 — 형식 틀림', 'PUT', 'invites/INVT-123', { issuedBy: GOOD_U, createdAt: 1 }, false],
  ['라이선스 신청 — 정상', 'PUT', 'licenseRequests/-Nabc', { name: 'a', status: 'pending' }, true],
  ['라이선스 신청 — undefined', 'PUT', 'licenseRequests/undefined', { name: 'a', status: 'pending' }, false],
  ['신고 — 정상', 'PUT', `reports/${GOOD_U2}/${OWNED_U}`, { kind: 'etc', nick: 'a', code4: 'AB12', ts: 1 }, true, 'authA'],
  ['신고 — 로그인 없이(형식과 별개로 원래 막힘)', 'PUT', `reports/${GOOD_U2}/${OWNED_U}`, { kind: 'etc', nick: 'a', code4: 'AB12', ts: 1 }, false],
  ['로그인에 묶인 사람 데이터 — 로그인 없이(원래 막힘 · 시험 도구 확인)', 'PUT', `users/${OWNED_U}/profile`, { name: 'a' }, false],
  ['신고 — 대상 null', 'PUT', `reports/null/${OWNED_U}`, { kind: 'etc', nick: 'a', code4: 'AB12', ts: 1 }, false, 'authA'],
  ['여러 칸 한 번에 — 하나가 null 이면 통째로 거절', 'PATCH', '', { [`users/${GOOD_U}/focus`]: { totalSec: 1 }, 'users/null/focus': { totalSec: 1 } }, false],
  ['여러 칸 한 번에 — 전부 정상', 'PATCH', '', { [`users/${GOOD_U}/focus`]: { totalSec: 1 }, [`users/${GOOD_U2}/focus`]: { totalSec: 1 } }, true],
  ['지우기는 형식과 상관없음(잘못 들어간 것을 치울 수 있게)', 'DELETE', 'users/null/profile', null, true],
  ...LIMIT_CASES,
  ...BOT_CASES,
];

async function inner(){
  let fail = 0;
  const only = process.env.TW_EMU_ONLY;
  for(const [name, method, p, body, want, uid] of CASES){
    if(only && !name.includes(only) && !name.startsWith('준비')) continue;
    const [pp, qs] = p.split('?');   // 쿼리(orderBy · limitToLast)는 그대로 붙인다
    const enc = pp.split('/').map(encodeURIComponent).join('/');
    /* 토큰은 ?auth= 로 — Authorization 머리에 실으면 에뮬레이터가 관리자(규칙 건너뜀)로 본다 */
    const owner = uid === OWNER;   // 준비용 — Authorization 머리 = 에뮬레이터 관리자(규칙 건너뜀)
    const url = `http://127.0.0.1:${PORT}/${enc}.json?ns=${NS}` + (qs ? '&' + qs : '') + (uid && !owner ? '&auth=' + userToken(uid) : '');
    const headers = { 'Content-Type': 'application/json', ...(owner ? { Authorization: 'Bearer owner' } : {}) };
    const r = await fetch(url, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
    const ok = r.status === 200;
    const pass = ok === want;
    if(!pass) fail++;
    console.log(`  ${pass ? '✓' : '✗'} ${name} — ${ok ? '통과' : '거절'}${pass ? '' : ' (기대: ' + (want ? '통과' : '거절') + ')'}`);
  }
  /* 🎧 먼저 붙은 구독 — 옛 앱이 presence 를 쓰기 전에 건 듣기가, presence 가 «켜짐 · ver 없음» 으로 바뀌는 순간 끊기는가(event: cancel) */
  const listen = await listenCancelCase();
  if(!listen.pass) fail++;
  console.log(`  ${listen.pass ? '✓' : '✗'} 옛 앱 — 막히기 전에 건 구독(카탈로그)은 presence 가 켜지는 순간 끊긴다 — ${listen.got}`);
  const total = CASES.length + 1;
  console.log(fail ? `\n✗ ${fail}건이 기대와 다름` : `\n✓ ${total}건 모두 기대대로`);
  process.exit(fail ? 1 : 0);
}

async function listenCancelCase(){
  const base = `http://127.0.0.1:${PORT}`;
  const ownerPut = (p, b) => fetch(`${base}/${p}.json?ns=${NS}`, { method: 'PUT', headers: { Authorization: 'Bearer owner' }, body: JSON.stringify(b) });
  await ownerPut('authUsers/authListen', { userCode: LIS_U, ts: 1 });
  await ownerPut(`users/${LIS_U}/presence`, { online: false, lastSeen: 1 });
  const ctl = new AbortController();
  let log = '';
  try{
    const r = await fetch(`${base}/catalog/parts.json?ns=${NS}&auth=${userToken('authListen')}`, { headers: { Accept: 'text/event-stream' }, signal: ctl.signal });
    const rd = r.body.getReader(), dec = new TextDecoder();
    (async () => { try{ for(;;){ const { value, done } = await rd.read(); if(done) break; log += dec.decode(value); } }catch(_){} })();
    await new Promise(z => setTimeout(z, 600));
    if(!/event: put/.test(log)) return { pass: false, got: '구독이 처음 값을 못 받음' };
    await fetch(`${base}/users/${LIS_U}/presence.json?ns=${NS}`, { method: 'PUT', body: JSON.stringify({ online: true, lastSeen: 2, room: null, inRoom: false }) });
    await new Promise(z => setTimeout(z, 1200));
  }finally{ ctl.abort(); }
  const cancelled = /event: cancel/.test(log);
  return { pass: cancelled, got: cancelled ? '끊김(cancel)' : '안 끊김' };
}

function freePort(){
  return new Promise((ok, no) => { const s = net.createServer(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
}

async function outer(){
  const port = await freePort();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-rules-emu-'));
  fs.writeFileSync(path.join(dir, 'firebase.json'), JSON.stringify({
    database: { rules: RULES },
    emulators: { database: { port }, ui: { enabled: false }, singleProjectMode: true },
  }));
  const r = spawnSync('firebase', ['emulators:exec', '--only', 'database', '--project', PROJECT,
    `node "${__filename}" --inner`], { cwd: dir, env: { ...process.env, TW_EMU_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  if(r.error){ console.error('firebase CLI 를 못 찾음 — npm i -g firebase-tools', r.error.message); process.exit(2); }
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter(l => /^\s+[✓✗] |^[✓✗] /.test(l));
  if(!lines.length){ console.error(out); process.exit(2); }
  console.log(lines.join('\n'));
  process.exit(r.status === 0 ? 0 : 1);
}

if(process.argv.includes('--inner')) inner(); else outer();
