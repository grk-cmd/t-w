/*
 * 🎄 크리스마스 이벤트(2026 · 일회성 — 1월 1일 전에 함수 · 규칙을 걷는다 · 이슈 #963).
 *   함께 꾸미는 트리 — 트리 하나에 장식 TREE_MAX 개 · 다 차면 다음 트리. 한 사람 장식 1개(바꾸기 가능).
 *   마니또 편지 — 한 사람 5통(규칙이 막는다) · 12/25 0시(서울)에 쓴 사람끼리 짝 지어 «쓴 만큼» 받는다.
 * 경로(규칙 firebase-database-rules.json 과 짝):
 *   xmasMeta            { cur: 지금 채우는 트리 번호(1~), cnt: 그 트리에 잡힌 자리 수, matchedAt }   ← 함수만 쓴다
 *   xmasTrees/{t}/o/{s} { k: 장식 종류, v: 판(바뀔 때마다 +1 — 앱이 그림을 다시 받을지 정한다), w?: 한마디 }
 *   xmasImg/{t}/{s}     { v, d: 64px PNG data URL } — 내 그림 장식만. 목록과 나눠서 앱은 바뀐 그림만 받는다
 *   xmasOwners/{t}/{s}  건 사람 auth uid — 관리자만 읽는다(이름은 아무에게도 안 보인다)
 *   xmasMine/{uid}      { t, s } — 내 장식 자리(본인만 읽는다)
 *   xmasLetters/{uid}/l1~l5  앱이 규칙으로 직접 쓴다(마감 전 · 본인)
 *   xmasGot/{uid}/{n}   받은 편지 { text, song?, ts } — 본인만 읽는다 · xmasGotFrom/{uid}/{n} 보낸 사람(관리자만)
 * 신원은 로그인 토큰(request.auth.uid)으로만 정한다. firebase-admin 은 index.js 가 넘긴다(맨 위 require 금지 — index.js ⚠️).
 */
'use strict';

const TREE_MAX = 300;
const KINDS = Object.freeze(['bulb', 'star', 'sock', 'cane', 'gift']);
const WORD_MAX = 30;
const IMG_PX = 64;                       // 앱이 64px 로 줄여 올린다 — 더 크면 거절
const IMG_DATA_MAX = 16000;              // data URL 글자 수 상한(64px PNG 는 보통 2~8KB → base64 3~11K)
const PNG_PREFIX = 'data:image/png;base64,';
// 한국 시간 — 편지 마감 12/24 23:59:59.999 · 이벤트 끝(버튼 숨김 · 장식 막음) 1/1 0시. 규칙의 숫자와 같다.
const LETTER_DEADLINE_MS = 1798124400000;   // 2026-12-25T00:00:00+09:00
const EVENT_END_MS = 1798729200000;          // 2027-01-01T00:00:00+09:00
const BUSY_STALE_MS = 60000;            // «거는 중» 표시가 이보다 오래면 빈 칸으로 — 함수가 시간 초과로 끝나 표시만 남아도 영영 막히지 않게
const INBOX_TITLE = '익명의 편지가 왔어요 🎄';
const INBOX_BODY = '크리스마스 창에서 [편지 열람]을 눌러 보세요.';

function fail(code, msg){ const e = new Error(msg); e.httpsCode = code; return e; }

/** 로그인한 사람(익명 거절)의 auth uid */
function authUidOf(request){
  const a = request && request.auth;
  if (!a || !a.uid) throw fail('unauthenticated', '로그인이 필요해요');
  const prov = a.token && a.token.firebase && a.token.firebase.sign_in_provider;
  if (prov === 'anonymous') throw fail('permission-denied', '가입이 끝나지 않은 계정이에요');
  return a.uid;
}

/** PNG data URL → { w, h } (IHDR) · PNG 가 아니면 null */
function pngSize(dataUrl){
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) return null;
  let buf;
  try { buf = Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64'); } catch (_) { return null; }
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || SIG.some((b, i) => buf[i] !== b) || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** 한마디 다듬기 — 줄바꿈 · 제어 문자를 빼고 앞뒤 공백을 걷는다. 빈 값이면 '' */
function cleanWord(w){
  return String(w == null ? '' : w).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * 장식 걸기 · 바꾸기 요청 검사(순수) — { kind, img?, word? } → { k, d|null, w|'' }.
 * kind 'img' 는 64px 이하 PNG 만. banned(글) → true 면 거절(금칙어 — 방 제목과 같은 목록 config/bannedWords).
 */
function parseHang(data, banned){
  const d = data || {};
  const kind = d.kind;
  if (kind !== 'img' && KINDS.indexOf(kind) < 0) throw fail('invalid-argument', '장식 종류를 알 수 없어요');
  let img = null;
  if (kind === 'img'){
    if (typeof d.img !== 'string' || d.img.length > IMG_DATA_MAX) throw fail('invalid-argument', '그림이 너무 커요');
    const sz = pngSize(d.img);
    if (!sz || sz.w < 1 || sz.h < 1 || sz.w > IMG_PX || sz.h > IMG_PX) throw fail('invalid-argument', '64px PNG 그림만 올릴 수 있어요');
    img = d.img;
  }
  const word = cleanWord(d.word);
  if (word.length > WORD_MAX) throw fail('invalid-argument', '한마디는 ' + WORD_MAX + '자까지예요');
  if (word && banned && banned(word)) throw fail('invalid-argument', '쓸 수 없는 말이 들어 있어요');
  return { k: kind, d: img, w: word };
}

/** 자리 잡기 트랜잭션(순수) — 지금 트리가 다 찼으면 다음 트리로. 돌려준 값을 그대로 xmasMeta 에 쓴다. */
function nextSeat(meta){
  const cur = meta && Number.isInteger(meta.cur) && meta.cur >= 1 ? meta.cur : 1;
  const cnt = meta && Number.isInteger(meta.cnt) && meta.cnt >= 0 ? meta.cnt : 0;
  const out = Object.assign({}, meta || {});
  if (cnt >= TREE_MAX){ out.cur = cur + 1; out.cnt = 1; out.seat = { t: cur + 1, s: 0 }; }
  else { out.cur = cur; out.cnt = cnt + 1; out.seat = { t: cur, s: cnt }; }
  return out;
}

/**
 * 장식 걸기 · 바꾸기(호출형 xmasHang). { kind, img?, word?, preview? } → { tree, slot, moved, changed }.
 *   이미 걸었으면 같은 자리에서 바꾸기(판 +1). 처음이면 xmasMeta 트랜잭션으로 자리를 잡는다 —
 *   동시에 여러 명이 걸어도 트리당 TREE_MAX 를 넘지 않는다. preview(앱이 보던 트리)와 다르면 moved = true
 *   → 앱이 «트리가 이미 다 차버렸어요. 다른 트리로 이동할게요.» 를 띄운다.
 *   같은 사람이 동시에 두 번 처음 걸기를 보내면 xmasMine 트랜잭션이 하나만 통과시킨다(나머지는 다시 눌러 달라고).
 */
async function handleHang(db, request, now, deps){
  const uid = authUidOf(request);
  if (now >= EVENT_END_MS) throw fail('failed-precondition', '크리스마스 이벤트가 끝났어요');
  const orn = parseHang(request.data, deps && deps.banned);
  const preview = request.data && Number.isInteger(request.data.preview) ? request.data.preview : null;
  const mineRef = db.ref('xmasMine/' + uid);
  const mine = (await mineRef.get()).val();
  if (liveBusy(mine, now)) throw fail('aborted', '장식을 거는 중이에요 — 잠시 뒤 다시 눌러 주세요');
  if (mine && Number.isInteger(mine.t) && Number.isInteger(mine.s)){
    // 판은 트랜잭션으로 올린다 — 같은 사람이 바꾸기를 동시에 두 번 보내도 판이 겹치지 않아 남의 앱이 새 그림을 받는다
    const vr = await db.ref('xmasTrees/' + mine.t + '/o/' + mine.s + '/v').transaction((v) => (Number.isInteger(v) ? v : 0) + 1);
    const v = vr.snapshot.val();
    await db.ref().update(writesFor(mine.t, mine.s, orn, v, null));
    return { tree: mine.t, slot: mine.s, moved: false, changed: true };
  }
  // 처음 — 내 자리를 «거는 중» 으로 잡아 두고(동시 두 번 막기) 트리 자리를 받는다. 오래된 표시는 빈 칸처럼
  const claim = await mineRef.transaction((cur) => (cur == null || isStaleBusy(cur, now) ? { busy: now } : undefined));
  if (!claim.committed) throw fail('aborted', '장식을 거는 중이에요 — 잠시 뒤 다시 눌러 주세요');
  try {
    const r = await db.ref('xmasMeta').transaction((m) => { const n = nextSeat(m); delete n.seat; return n; });
    if (!r.committed) throw fail('aborted', '잠시 뒤 다시 눌러 주세요');
    const after = r.snapshot.val();
    const seat = { t: after.cur, s: after.cnt - 1 };
    await db.ref().update(writesFor(seat.t, seat.s, orn, 1, uid));
    return { tree: seat.t, slot: seat.s, moved: preview != null && preview !== seat.t, changed: false };
  } catch (e) {
    await mineRef.remove().catch(() => {});
    throw e;
  }
}

/** «거는 중» 표시 — 시각이 BUSY_STALE_MS 안이면 아직 거는 중, 지났거나 시각이 없으면(옛 모양) 오래된 것 */
function liveBusy(m, now){ return !!(m && m.busy && Number.isFinite(m.busy) && now - m.busy < BUSY_STALE_MS); }
function isStaleBusy(m, now){ return !!(m && m.busy && !liveBusy(m, now)); }

/** 장식 한 자리의 쓰기 묶음 — owner 가 있으면 처음 걸기(주인 · 내 자리도 같이) */
function writesFor(t, s, orn, v, owner){
  const w = {};
  const o = { k: orn.k, v };
  if (orn.w) o.w = orn.w;
  w['xmasTrees/' + t + '/o/' + s] = o;
  w['xmasImg/' + t + '/' + s] = orn.d ? { v, d: orn.d } : null;
  if (owner){ w['xmasOwners/' + t + '/' + s] = owner; w['xmasMine/' + owner] = { t, s }; }
  return w;
}

/* ── ✉️ 편지 짝 짓기 ── */

/** 섞기(Fisher–Yates) — rnd 는 [0,1) */
function shuffle(arr, rnd){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

/**
 * 편지마다 받는 사람(순수). authors[i] = i 번째 편지를 쓴 사람 → 돌려준 recv[i] = 그 편지를 받을 사람(null = 못 보냄).
 *   ・받는 사람 묶음 = 쓴 사람 묶음 그대로 → 누구나 «쓴 만큼» 받는다.
 *   ・쓴 사람을 무작위 차례로 줄 세우고(같은 사람 편지는 붙여서) 가장 많이 쓴 수(m)만큼 밀어 짝 짓는다 —
 *     2m ≤ 전체면 자기 편지는 절대 안 받는다. 그보다 한 사람이 많이 썼으면(사람이 아주 적을 때) 자기 몫은 null.
 *   ・쓴 사람이 한 명뿐이면 모두 null.
 */
function matchLetters(authors, rnd){
  const n = authors.length;
  const recv = new Array(n).fill(null);
  if (!n) return recv;
  const byAuthor = new Map();
  authors.forEach((a, i) => { if (!byAuthor.has(a)) byAuthor.set(a, []); byAuthor.get(a).push(i); });
  if (byAuthor.size < 2) return recv;
  const order = [];   // 편지 번호를 «사람끼리 붙여» 줄 세운 것
  for (const a of shuffle([...byAuthor.keys()], rnd)) order.push(...shuffle(byAuthor.get(a), rnd));
  const m = Math.max(...[...byAuthor.values()].map(x => x.length));
  for (let p = 0; p < n; p++){
    const letter = order[p];
    const to = authors[order[(p + m) % n]];
    recv[letter] = to === authors[letter] ? null : to;
  }
  return recv;
}

const LETTER_ID_RE = /^l[1-5]$/;
const SONG_ID_RE = /^[A-Za-z0-9_-]{11}$/;
/** xmasLetters 통째 → [{ from, id, text, song }] (모양이 틀린 칸은 버린다 — 규칙이 막지만 한 번 더) */
function lettersOf(all){
  const out = [];
  for (const [from, box] of Object.entries(all || {})){
    if (!box || typeof box !== 'object') continue;
    for (const [id, l] of Object.entries(box)){
      if (!LETTER_ID_RE.test(id) || !l || typeof l.text !== 'string') continue;
      const text = l.text.trim().slice(0, 500);
      if (!text) continue;
      const song = l.song && SONG_ID_RE.test(l.song.id) ? { id: l.song.id, title: String(l.song.title || '').slice(0, 40) } : null;
      out.push({ from, id, text, song });
    }
  }
  return out;
}

/**
 * 12/25 0시 예약(xmasMatch) — 한 번만(xmasMeta/matchedAt). 받은 편지 · 보낸 사람(관리자용) · 알림함 «익명의 편지가 왔어요».
 * 알림함은 친구코드 단위라 authUsers/{uid}/userCode 를 찾아 넣는다(코드가 없으면 알림만 건너뛴다 — 편지는 받는다).
 */
async function runMatch(db, now, rnd){
  const done = await db.ref('xmasMeta/matchedAt').transaction((cur) => (cur == null ? now : undefined));
  if (!done.committed) return { skipped: 'already' };
  const letters = lettersOf((await db.ref('xmasLetters').get()).val());
  const recv = matchLetters(letters.map(l => l.from), rnd || Math.random);
  const seq = new Map();
  let w = {}, sent = 0, dropped = 0;
  const flush = async () => { if (Object.keys(w).length){ await db.ref().update(w); w = {}; } };
  for (let i = 0; i < letters.length; i++){
    const to = recv[i];
    if (!to){ dropped++; continue; }
    const k = (seq.get(to) || 0) + 1; seq.set(to, k);
    const got = { text: letters[i].text, ts: now };
    if (letters[i].song) got.song = letters[i].song;
    w['xmasGot/' + to + '/' + k] = got;
    w['xmasGotFrom/' + to + '/' + k] = letters[i].from + '/' + letters[i].id;
    sent++;
    if (Object.keys(w).length >= 400) await flush();
  }
  await flush();
  for (const to of seq.keys()){
    const code = (await db.ref('authUsers/' + to + '/userCode').get()).val();
    if (typeof code !== 'string' || !code) continue;
    w['inbox/' + code + '/xmas2026'] = { tag: 'xmas', title: INBOX_TITLE, body: INBOX_BODY, ts: now };
    if (Object.keys(w).length >= 400) await flush();
  }
  await flush();
  return { letters: letters.length, sent, dropped, people: seq.size };
}

/**
 * 관리자 지우기(호출형 xmasAdminRemove) — 신고된 장식 · 받은 편지를 지운다. 관리자(admins/{uid} === true)만.
 *   { tree, slot } → 장식 · 그림 · 주인 · 그 사람의 내 자리(다시 걸 수 있게) · 신고 묶음
 *   { got: uid, n } → 받은 편지 · 신고 묶음(보낸 사람 기록은 남긴다)
 */
async function handleAdminRemove(db, request){
  const uid = authUidOf(request);
  if ((await db.ref('admins/' + uid).get()).val() !== true) throw fail('permission-denied', '관리자만 쓸 수 있어요');
  const d = request.data || {};
  const w = {};
  if (Number.isInteger(d.tree) && Number.isInteger(d.slot) && d.tree >= 1 && d.slot >= 0 && d.slot < TREE_MAX){
    const owner = (await db.ref('xmasOwners/' + d.tree + '/' + d.slot).get()).val();
    w['xmasTrees/' + d.tree + '/o/' + d.slot] = null;
    w['xmasImg/' + d.tree + '/' + d.slot] = null;
    w['xmasOwners/' + d.tree + '/' + d.slot] = null;
    if (typeof owner === 'string' && owner) w['xmasMine/' + owner] = null;
    w['xmasReports/o-' + d.tree + '-' + d.slot] = null;
  } else if (typeof d.got === 'string' && /^[A-Za-z0-9]{10,40}$/.test(d.got) && Number.isInteger(d.n) && d.n >= 1 && d.n <= 50){
    w['xmasGot/' + d.got + '/' + d.n] = null;
    w['xmasReports/g-' + d.got + '-' + d.n] = null;
  } else {
    throw fail('invalid-argument', '지울 대상을 알 수 없어요');
  }
  await db.ref().update(w);
  return { ok: true };
}

/* ── 관리자 편지 반송 ── */
const RETURN_REASONS = Object.freeze({ abuse: '욕설 · 비방', privacy: '개인정보', spam: '광고 · 도배', etc: '기타' });
const RETURN_NOTE_MAX = 40;
const RETURN_CUTOFF_MS = 60000;

/**
 * 관리자 반송(호출형 xmasAdminReturn) — { uid, lid, ts(관리자가 본 편지의 ts), reason, note? }. 관리자만 · 마감 1분 전까지 · 짝 짓기 전만.
 *   관리자가 본 편지(ts)와 지금 칸이 같을 때만 지우고(칸이 비어 다시 쓸 수 있다) xmasReturned/{uid}/{lid} 에 사유 · 원래 글을 남긴다(본인이 고쳐 다시 쓰게).
 *   쓴 사람 알림함에 «편지가 반송됐어요» — 사유가 기타면 관리자가 적은 말을 같이.
 */
async function handleAdminReturn(db, request, now){
  const uid = authUidOf(request);
  if ((await db.ref('admins/' + uid).get()).val() !== true) throw fail('permission-denied', '관리자만 쓸 수 있어요');
  // 마감 1분 전부터 막는다 — 짝 짓기(마감 정각)가 편지를 읽은 뒤에 반송이 끝나 «배달된 편지에 반송 알림» 이 가는 틈을 닫는다(함수는 30초 안에 끝남)
  if (now >= LETTER_DEADLINE_MS - RETURN_CUTOFF_MS) throw fail('failed-precondition', '편지 마감이 가까워 반송할 수 없어요');
  if ((await db.ref('xmasMeta/matchedAt').get()).val() != null) throw fail('failed-precondition', '이미 편지를 나눠 보냈어요');
  const d = request.data || {};
  if (typeof d.uid !== 'string' || !/^[A-Za-z0-9]{10,40}$/.test(d.uid) || typeof d.lid !== 'string' || !LETTER_ID_RE.test(d.lid)) throw fail('invalid-argument', '반송할 편지를 알 수 없어요');
  if (typeof d.reason !== 'string' || !Object.prototype.hasOwnProperty.call(RETURN_REASONS, d.reason)) throw fail('invalid-argument', '반송 사유를 골라 주세요');
  if (!Number.isFinite(d.ts)) throw fail('invalid-argument', '반송할 편지를 다시 불러와 주세요');
  const note = d.reason === 'etc' ? cleanWord(d.note).slice(0, RETURN_NOTE_MAX) : '';
  if (d.reason === 'etc' && !note) throw fail('invalid-argument', '기타 사유를 적어 주세요');
  const path = 'xmasLetters/' + d.uid + '/' + d.lid;
  /* 관리자가 본 그 편지(ts 가 같을 때)만 지운다 — 목록을 연 사이 쓴 사람이 같은 칸을 고쳐 다시 맡겼으면 보지 않은 새 글을 반송하지 않게.
     트랜잭션이 지운 값을 그대로 반송 기록 · 알림에 쓴다(두 관리자가 동시에 눌러도 한 번만). */
  let why = null, letter = null;
  const tx = await db.ref(path).transaction((cur) => {
    if (!cur || typeof cur.text !== 'string'){ why = 'gone'; return undefined; }
    if (cur.ts !== d.ts){ why = 'changed'; return undefined; }
    why = null; letter = cur; return null;
  });
  if (!tx.committed){
    if (why === 'changed') throw fail('failed-precondition', '그새 고쳐 쓴 편지예요 — 다시 불러와 확인해 주세요');
    throw fail('not-found', '이미 없는 편지예요');
  }
  const ret = { reason: d.reason, ts: now, text: letter.text.slice(0, 500) };
  if (note) ret.note = note;
  if (letter.song && SONG_ID_RE.test(letter.song.id)) ret.song = { id: letter.song.id, title: String(letter.song.title || '').slice(0, 40) };
  const w = { ['xmasReturned/' + d.uid + '/' + d.lid]: ret };
  const code = (await db.ref('authUsers/' + d.uid + '/userCode').get()).val();
  if (typeof code === 'string' && code){
    w['inbox/' + code + '/xmasret' + d.lid + now] = { tag: 'xmas', title: '편지가 반송됐어요', body: returnBody(d.reason, note), ts: now };
  }
  await db.ref().update(w);
  return { ok: true, notified: !!(typeof code === 'string' && code) };
}
/** 알림함 본문 — 사유 · 다시 쓰기 안내 */
function returnBody(reason, note){
  const why = RETURN_REASONS[reason] + (note ? ' — ' + note : '');
  return '사유: ' + why + '\n크리스마스 창의 [편지 쓰기]에서 고쳐 다시 맡길 수 있어요(12월 24일 23:59까지).';
}

module.exports = {
  TREE_MAX, KINDS, WORD_MAX, IMG_PX, LETTER_DEADLINE_MS, EVENT_END_MS, INBOX_TITLE,
  BUSY_STALE_MS, pngSize, cleanWord, parseHang, nextSeat, liveBusy, matchLetters, lettersOf,
  handleHang, runMatch, handleAdminRemove,
  RETURN_REASONS, RETURN_CUTOFF_MS, handleAdminReturn, returnBody,
};
