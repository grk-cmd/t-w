/* playlist-like.js — 👍 플레이리스트 «노래가 좋아요» 의 규칙(순수) · 서버 읽기 · 쓰기(Realtime Database) (검사 sim-playlist-like.js)
   [왜] 받는 사람에게는 숫자만 보이고, 누른 사람은 그 플레이리스트(프리셋 하나)에 평생 한 번만 누른다(사용자 결정).
   ★ 자리: playlistLikes/{주인 코드}/{프리셋 0~2}/count(누르면 +1 · 로그인한 누구나 읽음) · by/{누른 사람 auth uid}(true · 그 본인만 읽음) · last(이번에 누른 auth uid — 아무도 못 읽음)
     규칙(firebase/firebase-database-rules.json 의 playlistLikes)이 «by 를 처음 만드는 같은 묶음에서만 count +1» 을 지킨다 —
     last 가 그 묶음의 by 를 가리켜야 해서 count 만 따로 올릴 수 없다. 지우기 · 취소는 없다.
   ★ 누른 표시는 로그인 토큰(auth.uid) 칸이다 — 친구 코드(userAuth)는 빈 코드를 새로 이어 붙일 수 있어 «한 번» 을 못 지킨다.
     친구 코드는 «내 것인가» 를 가를 때만 쓴다(규칙은 userAuth/{주인} 으로 막는다).
   ⚠️ 프리셋 번호는 주인의 프리셋 «자리» 다(이름 · 곡을 바꿔도 수는 그 자리에 남는다).
   ⚠️ 둘이 동시에 누르면 늦은 쪽은 규칙에 막힌다(count 가 이미 올라 있다) — 다시 읽고 RETRY_MAX 번까지 다시 쓴다.
   받는 것(provider): { db, ref, get, update, authUid }(authUid = 지금 로그인 uid · 없으면 null). 내보냄: window.TwPlaylistLike = { PRESETS, RETRY_MAX, presetKey, view, createPlaylistLikeNet }.
   app.js · firebase-init.js(type=module · 늦게 돈다)보다 먼저 싣는 classic script. */
(function(){
const PRESETS = 3;      // 플레이리스트 프리셋 수 — playlist.js PL_SETS · 규칙의 $preset(0~2)과 같다
const RETRY_MAX = 3;

/* 프리셋 번호 → 칸 이름('0'~'2'). 범위 밖 · 숫자 아님은 null */
function presetKey(idx){
  if(idx === null || idx === undefined || idx === '') return null;   // Number(null) 은 0 이라 1번 프리셋으로 읽힌다
  const n = Number(idx);
  return (Number.isInteger(n) && n >= 0 && n < PRESETS) ? String(n) : null;
}

/* 화면 모양 — 무엇을 보일지만 정한다(DOM 없음).
   ctx = { ro(남의 목록을 보는 중), ownerId, myId, setIdx }, st = { loaded, failed, count, mine, busy }
   → { mode: 'none' | 'count' | 'react', count, label, disabled, locked } */
function view(ctx, st){
  const c = ctx || {}, s = st || {};
  const key = presetKey(c.setIdx);
  if(!c.ownerId || !c.myId || key === null) return { mode: 'none' };
  const count = (s.loaded && !s.failed) ? Math.max(0, Number(s.count) || 0) : null;
  if(!c.ro || c.ownerId === c.myId) return { mode: 'count', count };
  const locked = !!s.mine;
  return { mode: 'react', count, locked,
    label: locked ? '보냈어요 👍' : '노래가 좋아요 👍',
    disabled: locked || !!s.busy || !s.loaded || !!s.failed };
}

/** @param {{ db: unknown, ref: Function, get: Function, update: Function, authUid: () => (string|null) }} d */
function createPlaylistLikeNet(d){
  const { db, ref, get, update, authUid } = d;
  const base = (owner, key) => 'playlistLikes/' + owner + '/' + key;

  /* 수 하나 · 내 표시 하나만 읽는다(노드 통째 읽기 없음). me = 내 친구 코드(내 것이면 표시를 안 읽는다). → { count, mine } · 못 읽음은 null */
  async function read(owner, idx, me){
    const key = presetKey(idx);
    if(!owner || key === null) return null;
    try{
      const c = await get(ref(db, base(owner, key) + '/count'));
      const uid = authUid();
      let mine = false;
      if(uid && me !== owner) mine = (await get(ref(db, base(owner, key) + '/by/' + uid))).exists();
      return { count: Number(c.val()) || 0, mine };
    }catch(_){ return null; }
  }
  /* 한 번 누르기 → { ok, count?, reason?: 'self' | 'already' | 'fail' } — 던지지 않는다 */
  async function like(owner, idx, me){
    const key = presetKey(idx);
    if(!owner || !me || key === null) return { ok: false, reason: 'fail' };
    if(owner === me) return { ok: false, reason: 'self' };
    const uid = authUid();
    if(!uid) return { ok: false, reason: 'fail' };
    for(let i = 0; i < RETRY_MAX; i++){
      const cur = await read(owner, idx, me);
      if(!cur) return { ok: false, reason: 'fail' };
      if(cur.mine) return { ok: false, reason: 'already', count: cur.count };
      const next = cur.count + 1;
      const w = {};
      w[base(owner, key) + '/count'] = next;
      w[base(owner, key) + '/last'] = uid;
      w[base(owner, key) + '/by/' + uid] = true;   // 시각은 안 남긴다(이 PC 시계가 빠르면 규칙에 막히고 · 언제 눌렀는지도 남길 까닭이 없다)
      try{ await update(ref(db), w); return { ok: true, count: next }; }
      catch(_){ /* 그새 누가 눌렀거나(수가 바뀜) 거절 — 다시 읽어 본다 */ }
    }
    return { ok: false, reason: 'fail' };
  }
  return { read, like };
}

const api = Object.freeze({ PRESETS, RETRY_MAX, presetKey, view, createPlaylistLikeNet });
if(typeof window !== 'undefined') window.TwPlaylistLike = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
