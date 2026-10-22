/*
 * 🎧 같이 듣기 규칙(room/listen-model.js) 검사 — 모듈을 그대로 불러 돌린다.
 * 1. 위치 · 어긋남  2. 지금 DJ  3. 곡 끝 · 다음 곡  4. `_music` 한 줄(만들기 · 멈춤 · 다시 · 길이)  5. 하트비트 읽기
 * 6. 범위가 규칙(rooms/$room/_music)과 같다  7. 깨 보기
 * 설계: docs/LISTEN_TOGETHER.md 2.2 · 3 · 4장
 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const need = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } };
const SRC = need('listen-model.js');
const RULES = JSON.parse(need('firebase-database-rules.json')).rules;
const load = (src) => { const w = {}; new Function('window', src)(w); return w.TwListenModel; };
const M = load(SRC);
const T0 = 1700000000000;
const song = (o) => Object.assign({ id: 'jfKfPfyJRdk', title: 'lofi', by: 'u1', at: T0, paused: false, pos: 0, seq: 3 }, o || {});

say('── 1. 위치 · 어긋남');
chk(M.posOf(song(), T0 + 30500) === 30.5, '재생 중 위치 = (지금 − at) / 1000');
chk(M.posOf(song({ paused: true, pos: 42 }), T0 + 999999) === 42, '멈춤이면 pos 그대로 — 시간이 흘러도');
chk(M.posOf(song(), T0 - 5000) === 0 && M.posOf(null, T0) === 0, '경계: 시계가 앞서 있어도 0 아래로 안 감 · 곡 없음 0');
chk(M.needSeek(song(), T0 + 60000, { pos: 54, ad: false }) === true, '★ 5초 넘게 어긋나면 옮긴다(60 ↔ 54)');
chk(M.needSeek(song(), T0 + 60000, { pos: 55, ad: false }) === false, '  딱 5초면 그대로(자주 튀지 않게)');
chk(M.needSeek(song(), T0 + 60000, { pos: 0, ad: true }) === false, '★ 광고 중이면 안 옮긴다(광고 위치를 노래 위치로 읽지 않게)');
chk(M.needSeek(song({ paused: true, pos: 10 }), T0, { pos: 99, ad: false }) === false && M.needSeek(null, T0, { pos: 1 }) === false && M.needSeek(song(), T0, null) === false, '  멈춤 · 곡 없음 · 하트비트 없음이면 안 옮긴다');

say('── 2. 지금 DJ');
chk(M.djOf({ host: 'u1' }, ['u2', 'u1']) === 'u1', '현재 방장이 방에 있으면 그 사람');
chk(M.djOf({ host: 'u1' }, ['u2', 'u3']) === null, '★ 방장이 방에 없으면 없음 — 시크릿룸 주인이 없을 때 «쉬는 중»');
chk(M.djOf(null, ['u1']) === null && M.djOf({}, ['u1']) === null && M.djOf({ host: 'u1' }, null) === null, '  경계: meta 없음 · 방장 없음 · 사람 목록 없음');

say('── 3. 곡 끝 · 다음 곡');
chk(M.isEnded(song({ dur: 200 }), T0 + 203000) === true && M.isEnded(song({ dur: 200 }), T0 + 202999) === false, '★ 곡 끝 예비 판정 = 길이 + 3초(경계 바로 앞은 아직)');
chk(M.isEnded(song(), T0 + 1e9) === false && M.isEnded(song({ dur: 200, paused: true, pos: 300 }), T0 + 1e9) === false && M.isEnded(null, T0) === false, '  길이를 모름 · 멈춤 · 곡 없음이면 끝이 아니다');
const L = [{ id: 'aaaaaaaaaaa' }, { id: 'bbbbbbbbbbb' }, { id: 'ccccccccccc' }];
chk(M.stepIndex(L, 'aaaaaaaaaaa', 1) === 1 && M.stepIndex(L, 'ccccccccccc', 1) === 0, '다음 곡 — 끝이면 처음으로');
chk(M.stepIndex(L, 'aaaaaaaaaaa', -1) === 2 && M.stepIndex(L, 'bbbbbbbbbbb', -1) === 0, '이전 곡 — 처음이면 끝으로');
chk(M.stepIndex(L, 'zzzzzzzzzzz', 1) === 0 && M.stepIndex(L, null, 1) === 0 && M.stepIndex([], 'a', 1) === -1, '  목록에 없는 곡(옛 DJ 것)은 처음부터 · 빈 목록 -1');
const BAD = [{ id: 'aaaaaaaaaaa' }, { id: 'bad id' }, { id: 'ccccccccccc' }];
chk(M.playableFrom(BAD, 1, 1) === 2 && M.playableFrom(BAD, 1, -1) === 0, '틀 수 없는 칸(옛 저장본)은 그 방향으로 건너뛴다');
chk(M.playableFrom([{ id: 'x' }], 0, 1) === -1 && M.playableFrom([], 0, 1) === -1 && M.playableFrom(L, -1, 1) === -1, '  틀 곡이 없으면 -1');

say('── 4. `_music` 한 줄');
let m = M.makeMusic({ id: 'aaaaaaaaaaa', title: '  비 오는 날  ' }, 'u1', T0 + 0.7, 3);
chk(m && JSON.stringify(m) === JSON.stringify({ id: 'aaaaaaaaaaa', title: '비 오는 날', by: 'u1', at: T0, paused: false, pos: 0, seq: 4 }), '★ 새 곡 = 0초 · 재생 · 차례 +1 · 제목 다듬기 · at 정수');
chk(M.makeMusic({ id: 'aaaaaaaaaaa', title: '' }, 'u1', T0, -1).title === 'aaaaaaaaaaa' && M.makeMusic({ id: 'aaaaaaaaaaa' }, 'u1', T0, -1).seq === 0, '  빈 제목은 id 로(규칙이 1자 이상) · 칸이 없으면 차례 0');
chk(M.makeMusic({ id: 'aaaaaaaaaaa', title: 'x'.repeat(150) }, 'u1', T0, 0).title.length === 100, '  제목 100자로 자른다');
chk(M.makeMusic({ id: 'bad' }, 'u1', T0, 0) === null && M.makeMusic({ id: 'aaaaaaaaaaa' }, '', T0, 0) === null && M.makeMusic(null, 'u1', T0, 0) === null, '  모양이 틀리면 null(쓰지 않음)');
chk(M.makeMusic({ id: 'aaaaaaaaaaa' }, 'u1', T0, 1e9) === null && M.makeMusic({ id: 'aaaaaaaaaaa' }, 'u1', T0, 1e9 - 1).seq === 1e9, '  경계: 차례 상한 10억(규칙과 같다)');
const p = M.paused(song({ seq: 7 }), T0 + 61900);
chk(p.paused === true && p.pos === 61 && p.seq === 8 && p.by === 'u1' && p.at === T0, '★ 멈춤 = 지금 위치를 pos 에 · 차례 +1 · 쓴 사람 그대로');
const r = M.resumed(p, T0 + 500000);
chk(r.paused === false && r.at === T0 + 500000 - 61000 && r.pos === 0 && r.seq === 9 && M.posOf(r, T0 + 500000) === 61, '★ 다시 = 멈춘 자리부터(at 을 다시 계산) · 차례 +1');
chk(M.paused(song({ seq: 1e9 }), T0) === null && M.resumed(null, T0) === null, '  상한 · 곡 없음이면 null');
chk(M.paused(song(), T0, 'u2').by === 'u2' && M.resumed(p, T0, 'u2').by === 'u2' && M.resumed(p, T0).by === 'u1', '★ by 를 주면 쓴 사람이 바뀐다(이어받은 DJ 의 멈춤 · 다시) · 안 주면 그대로');
chk(M.withDur(song(), 204.9).dur === 204 && M.withDur(song(), 204).seq === 4, '길이 적기 — 정수 · 차례 +1');
chk(M.withDur(song({ dur: 100 }), 204) === null && M.withDur(song(), -1) === null && M.withDur(song(), 0) === null, '  이미 있거나 모르면(-1 · 0) 안 쓴다 — 곡마다 한 번');

say('── 5. 하트비트 읽기');
chk(JSON.stringify(M.parseBeat('hb:61|204|0|1')) === '{"pos":61,"dur":204,"paused":false,"ad":true}', "'hb:위치|길이|멈춤|광고' → 칸 넷");
chk(JSON.stringify(M.parseBeat('hb:5|-1|1')) === '{"pos":5,"dur":-1,"paused":true,"ad":false}', '  옛 세 칸(광고 칸 없음)도 읽는다');
chk(M.parseBeat('ended') === null && M.parseBeat('hb:x|1') === null && M.parseBeat(null) === null, '  하트비트가 아니면 null');
chk(M.isMusicRoom({ music: true }) && !M.isMusicRoom({ music: 'true' }) && !M.isMusicRoom(null), '같이 듣기 방 = _meta.music === true 만');

say('── 6. 범위가 규칙과 같다');
{
  const R = RULES.rooms.$room._music;
  chk(R.id['.validate'].indexOf(String(M.ID_RE).slice(1, -1)) >= 0, 'id 모양이 규칙과 같다');
  chk(R.title['.validate'].indexOf('<= ' + M.TITLE_MAX) >= 0, '제목 상한이 규칙과 같다(' + M.TITLE_MAX + ')');
  chk(R.seq['.validate'].indexOf('<= ' + M.SEQ_MAX) >= 0, '차례 상한이 규칙과 같다');
  const need7 = (R['.validate'].match(/hasChildren\(\[([^\]]*)\]\)/) || [])[1] || '';
  const keys = need7.split(',').map(s => s.trim().replace(/'/g, ''));
  const made = Object.keys(M.makeMusic({ id: 'aaaaaaaaaaa' }, 'u1', T0, 0));
  chk(keys.length === 7 && keys.every(k => made.includes(k)) && made.every(k => k in R), '★ 만든 한 줄이 규칙의 필수 칸을 다 갖고 · 규칙에 없는 칸이 없다');
}

say('── 7. 깨 보기');
{
  const B1 = load(SRC.replace("return (h && Array.isArray(ids) && ids.indexOf(h) >= 0) ? h : null;", 'return h || null;'));
  chk(B1.djOf({ host: 'u1' }, ['u2']) !== null, '«방에 없어도 방장이 DJ» 로 깨면 2절이 빨강');
  const B2 = load(SRC.replace('if(!m || m.paused || !beat || beat.ad) return false;', 'if(!m || m.paused || !beat) return false;'));
  chk(B2.needSeek(song(), T0 + 60000, { pos: 0, ad: true }) === true, '광고 판정을 빼면 1절이 빨강');
  const B3 = load(SRC.replace('return s <= SEQ_MAX ? s : null;', 'return s;'));
  chk(B3.makeMusic({ id: 'aaaaaaaaaaa' }, 'u1', T0, 1e9) !== null, '차례 상한을 빼면 4절이 빨강');
}

say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
