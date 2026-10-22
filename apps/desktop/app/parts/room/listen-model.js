/* listen-model.js — 🎧 같이 듣기 규칙 한 곳(순수 함수 · DOM · firebase 없음) — 설계 docs/LISTEN_TOGETHER.md 2.2 · 4장.
   지금 위치 · 어긋남 · 지금 DJ · 곡 끝 · 다음 곡 · `_music` 한 줄 만들기를 같이 듣기 창(listen-ui.js)과 이름표 딱지(app.js → overhead.js)가 같이 부른다.
   `_music` 모양 · 범위는 규칙(rooms/$room/_music)과 같아야 한다 — sim-listen-model 이 견준다.
   classic script(window.TwListenModel) — listen-ui.js · app.js 보다 먼저. */
(function(){

const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const TITLE_MAX = 100;
const SEQ_MAX = 1e9;          // 규칙 상한 — 아주 큰 차례 번호로 다음 쓰기를 막아 두지 못하게
const DRIFT_SEC = 5;          // 이만큼 넘게 다르면 위치를 옮긴다(하트비트가 5초마다라 그 아래는 못 잰다)
const END_GRACE_SEC = 3;      // 곡 끝 예비 판정 — 재생 창의 «곡 끝» 신호를 못 받았을 때

/** 지금 위치(초) — 멈췄으면 pos, 아니면 (지금 − at) · 곡이 없으면 0. now 는 서버 시각(ms). */
function posOf(m, now){
  if(!m) return 0;
  if(m.paused) return Math.max(0, Number(m.pos) || 0);
  return Math.max(0, (now - (Number(m.at) || 0)) / 1000);
}

/** 위치를 옮겨야 하나 — 재생 중 · 광고 아님 · DRIFT_SEC 넘게 다를 때만. beat 는 parseBeat 결과. */
function needSeek(m, now, beat){
  if(!m || m.paused || !beat || beat.ad) return false;
  return Math.abs(posOf(m, now) - beat.pos) > DRIFT_SEC;
}

/** 지금 DJ — 현재 방장이 방에 있으면 그 사람, 아니면 없음(null). 시크릿룸은 방장이 늘 주인이라 «주인이 없으면 쉬는 중» 이 같은 규칙이다.
 *  @param {{ host?: string }|null} meta  @param {string[]} ids 방에 있는 사람의 내 코드(나 포함) */
function djOf(meta, ids){
  const h = meta && meta.host;
  return (h && Array.isArray(ids) && ids.indexOf(h) >= 0) ? h : null;
}

/** 곡 끝 예비 판정 — 길이를 알고 · 재생 중이고 · 길이 + END_GRACE_SEC 를 지났다. */
function isEnded(m, now){
  if(!m || m.paused) return false;
  const d = Number(m.dur);
  return d > 0 && posOf(m, now) >= d + END_GRACE_SEC;
}

/** 다음(dir 1) · 이전(dir -1) 곡 번호 — 끝에서는 반대쪽 끝으로 · 목록에 없으면 처음 · 빈 목록이면 -1.
 *  @param {{ id: string }[]} items DJ 플레이리스트  @param {string|null} curId  @param {1|-1} dir */
function stepIndex(items, curId, dir){
  if(!Array.isArray(items) || !items.length) return -1;
  const i = curId ? items.findIndex(x => x && x.id === curId) : -1;
  if(i < 0) return 0;
  return (i + (dir < 0 ? -1 : 1) + items.length) % items.length;
}

/** 목록에서 틀 수 있는 첫 곡 번호(from 부터 dir 쪽으로 한 바퀴) — 모양이 틀린 칸(옛 저장본)은 건너뛴다 · 없으면 -1 */
function playableFrom(items, from, dir){
  if(!Array.isArray(items) || !items.length || !(from >= 0)) return -1;
  const d = (dir < 0) ? -1 : 1, n = items.length;
  for(let k = 0; k < n; k++){
    const i = ((from + d * k) % n + n) % n;
    if(items[i] && ID_RE.test(String(items[i].id))) return i;
  }
  return -1;
}

/** `_music` 한 줄 — 새 곡(0초 · 재생). prevSeq 는 지금 칸의 seq(없으면 -1). 모양이 틀리면 null.
 *  @param {{ id: string, title?: string }} item  @param {string} by 쓰는 사람  @param {number} now 서버 시각  @param {number} prevSeq */
function makeMusic(item, by, now, prevSeq){
  if(!item || !ID_RE.test(String(item.id)) || !by) return null;
  const seq = nextSeq(prevSeq);
  if(seq === null) return null;
  const t = (typeof item.title === 'string') ? item.title.trim().slice(0, TITLE_MAX) : '';
  return { id: String(item.id), title: t || String(item.id), by: String(by).slice(0, 64), at: Math.floor(now), paused: false, pos: 0, seq };
}
function nextSeq(prev){
  const s = (typeof prev === 'number' && isFinite(prev) && prev >= 0) ? Math.floor(prev) + 1 : 0;
  return s <= SEQ_MAX ? s : null;
}

/** 멈춤 · 다시 — 차례 +1 · 상한을 넘으면 null. by 를 주면 쓴 사람을 바꾼다 — 이어받은 DJ 가 멈추거나 다시 튼 곡은 그 DJ 것으로 친다
 *  («옛 DJ 가 멈춘 채 나감» 으로 다시 읽혀 멈춤이 바로 풀리지 않게 · 그 곡이 내 목록에 있으면 다음 곡은 그 뒤부터). 안 주면 그대로. */
function paused(m, now, by){
  const seq = m ? nextSeq(m.seq) : null;
  if(seq === null) return null;
  return Object.assign({}, m, { paused: true, pos: Math.floor(posOf(m, now)), seq }, by ? { by } : {});
}
function resumed(m, now, by){
  const seq = m ? nextSeq(m.seq) : null;
  if(seq === null) return null;
  return Object.assign({}, m, { paused: false, at: Math.floor(now - (Number(m.pos) || 0) * 1000), pos: 0, seq }, by ? { by } : {});
}
/** 길이를 적은 한 줄(DJ 재생 창 하트비트가 알려 줄 때 한 번) — 이미 있으면 null */
function withDur(m, dur){
  if(!m || Number(m.dur) > 0 || !(dur > 0)) return null;
  const seq = nextSeq(m.seq);
  return seq === null ? null : Object.assign({}, m, { dur: Math.floor(dur), seq });
}

/** 재생 창 하트비트 'hb:위치|길이|멈춤|광고' → { pos, dur, paused, ad } · 아니면 null */
function parseBeat(s){
  if(typeof s !== 'string' || s.indexOf('hb:') !== 0) return null;
  const p = s.slice(3).split('|');
  const pos = Number(p[0]), dur = Number(p[1]);
  if(!isFinite(pos)) return null;
  return { pos, dur: isFinite(dur) ? dur : -1, paused: p[2] === '1', ad: p[3] === '1' };
}

/** 같이 듣기 방인가 — `_meta.music === true` */
function isMusicRoom(meta){ return !!(meta && meta.music === true); }

window.TwListenModel = Object.freeze({ ID_RE, TITLE_MAX, SEQ_MAX, DRIFT_SEC, END_GRACE_SEC,
  posOf, needSeek, djOf, isEnded, stepIndex, playableFrom, makeMusic, paused, resumed, withDur, parseBeat, isMusicRoom });

})();
