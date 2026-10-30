/* playlist-api.js — 🎵 플레이리스트 api provider (검사 sim-playlist-api.js)
   책임: 내 프리셋 세 벌 읽기 · 통째 저장(GET · PUT /v1/me/playlist) · 파도타기(GET /v1/playlists/random) · 남의 목록(GET /v1/playlists/{userCode}).
     서버 모양(tracks[{videoId,title}] · 프리셋 늘 3칸 · listed)을 화면이 쓰던 모양(items[{id,title}] · private)으로 맞추는 곳은 여기뿐이다.
   신원: 내 것은 토큰(/v1/me/…) · 남의 것은 사용자 코드(경로의 코드는 데이터 주소일 뿐). 내 코드(uid)는 «판(version) 기억 열쇠» 로만 받는다.
   deps: authed — 로그인 API 통로(TwApi.authed — get(path, { auth: true }) · put(path, body) → Promise<data>)
         random() → 0 이상 1 미만 수(친구 목록에서 곡 있는 벌을 고를 때) · warn(...a)(진단 로그)
   내보냄: createPlaylistApi(deps) → {
     fetchMine(uid) → Promise<{ sets:[{name, items:[{id,title}]}], bio, homePublic, private, ts:0, editTs:0 }> — 목록이 비어도 객체(빈 목록 ≠ 못 읽음). 못 읽으면 던진다.
     saveMine(uid, sets, meta) → Promise<boolean> — meta = { bio, homePublic, private }. 곡이 하나도 없는 세 벌을 보내면 «비움»(노드를 지우지 않고 빈 목록 저장).
     fetchRandom(excludeUid) → Promise<목록 한 벌 | null(들을 것 없음)> — 못 읽으면 던진다.
     fetchOf(userCode) → Promise<목록 한 벌 | null(곡 있는 벌 없음 · 열어 주지 않음)> — 못 읽으면 던진다.
   }
     목록 한 벌 = { uid, name?(무작위만), items:[{id,title}], setName, setIdx, bio, homePublic }
     순수: mineOf(data) · pickOf(data) · publicOf(data, random) · bodyOf(version, sets, meta) · PATHS · LIMITS (TwPlaylistApi 위)
   ⚠️ 서버에는 고친 시각(editTs)이 없고 판(version)이 있다 — 저장은 «마지막으로 읽은 판» 을 실어 보낸다. 다른 기기가 먼저 저장했으면(409)
     판을 다시 읽어 한 번 더 보낸다(예전과 같이 마지막에 저장한 쪽이 이긴다). 그래서 읽은 결과의 editTs 는 늘 0(= 시각 모름).
   ⚠️ 판은 계정(uid)별로 기억한다 — 계정이 바뀌어도 앞 계정의 판으로 저장하지 않게. 판을 모르면 저장 전에 한 번 읽는다.
   검사: checks/sim-playlist-api.js */
(function(){
'use strict';

const PATHS = Object.freeze({
  mine: '/v1/me/playlist',
  random: '/v1/playlists/random',
  of: (userCode) => '/v1/playlists/' + encodeURIComponent(userCode),
});
/* 서버 상한과 같은 값 — 넘기면 서버가 400 으로 거절한다 */
const LIMITS = Object.freeze({ SETS: 3, TRACKS: 20, NAME: 16, TITLE: 60, BIO: 140 });
const FRIENDS_ONLY_CODE = 'PLAYLIST_FRIENDS_ONLY';
const CONFLICT_STATUS = 409;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });

/* 서버 곡 → 화면 곡. videoId 가 없으면 버린다 */
function itemsOf(tracks){
  if(!Array.isArray(tracks)) return null;
  return tracks.filter((t) => isObj(t) && typeof t.videoId === 'string' && t.videoId).map((t) => ({ id: t.videoId, title: str(t.title) }));
}
function setsOf(sets){
  if(!Array.isArray(sets)) return null;
  const out = [];
  for(const s of sets){
    if(!isObj(s)) return null;
    const items = itemsOf(s.tracks);
    if(!items) return null;
    out.push({ name: str(s.name), items });
  }
  return out;
}

/* GET /v1/me/playlist 의 data → 화면 모양. 모양이 틀리면 undefined. private 는 «목록에 올리지 않음» (listed 의 반대) */
function mineOf(d){
  if(!isObj(d)) return undefined;
  const sets = setsOf(d.sets);
  if(!sets || typeof d.listed !== 'boolean') return undefined;
  return { sets, bio: str(d.bio), homePublic: d.homePublic === true, private: !d.listed, ts: 0, editTs: 0 };
}
const versionOf = (d) => (isObj(d) && typeof d.version === 'number' && isFinite(d.version) && d.version >= 0) ? d.version : undefined;

/* 무작위 파도타기 한 벌(data) → 목록 한 벌. 모양이 틀리면 undefined */
function pickOf(d){
  if(!isObj(d) || typeof d.userCode !== 'string' || !d.userCode || !isObj(d.set)) return undefined;
  const items = itemsOf(d.set.tracks);
  if(!items || !items.length) return undefined;
  const idx = (typeof d.setNo === 'number' && isFinite(d.setNo) && d.setNo >= 0) ? d.setNo : 0;
  return { uid: d.userCode, name: str(d.displayName) || '(이름 없음)', items, setName: str(d.set.name), setIdx: idx,
    bio: str(d.bio), homePublic: d.homePublic === true };
}

/* 남의 목록(세 벌) → 곡 있는 벌 중 하나를 무작위로 — 무작위 파도타기와 같은 규칙(친구 것이 늘 1번만 뜨지 않게).
   곡 있는 벌이 없으면 null · 모양이 틀리면 undefined */
function publicOf(d, random){
  if(!isObj(d) || typeof d.userCode !== 'string' || !d.userCode) return undefined;
  const sets = setsOf(d.sets);
  if(!sets) return undefined;
  const cand = [];
  sets.forEach((s, i) => { if(s.items.length) cand.push({ idx: i, name: s.name, items: s.items }); });
  if(!cand.length) return null;
  const pick = cand[Math.min(cand.length - 1, Math.floor(random() * cand.length))];
  return { uid: d.userCode, items: pick.items, setName: pick.name, setIdx: pick.idx, bio: str(d.bio), homePublic: d.homePublic === true };
}

/* 저장 본문 — 서버 상한으로 깎는다(화면이 이미 지키는 값이라 보통은 그대로) */
function bodyOf(version, sets, meta){
  const m = meta || {};
  const ss = (Array.isArray(sets) ? sets : []).slice(0, LIMITS.SETS).map((s) => ({
    name: str(s && s.name).slice(0, LIMITS.NAME),
    tracks: ((s && Array.isArray(s.items)) ? s.items : []).slice(0, LIMITS.TRACKS)
      .filter((x) => x && typeof x.id === 'string' && x.id)
      .map((x) => ({ videoId: x.id, title: str(x.title).slice(0, LIMITS.TITLE) })),
  }));
  return { version, sets: ss, bio: str(m.bio).slice(0, LIMITS.BIO), listed: !m.private, homePublic: !!m.homePublic };
}

function createPlaylistApi(deps){
  const authed = deps.authed;
  const random = deps.random;
  const warn = deps.warn;
  const versions = new Map();   // uid → 마지막으로 읽은(또는 저장한) 판

  async function readMine(uid){
    const d = await authed.get(PATHS.mine, { auth: true });
    const out = mineOf(d);
    const v = versionOf(d);
    if(!out || v === undefined) throw shapeError();
    versions.set(uid, v);
    return out;
  }

  async function fetchMine(uid){
    if(!uid){ const e = new Error('내 코드 없음'); e.code = 'NO_USER'; throw e; }
    return readMine(uid);
  }

  /* 저장 한 번 — 판을 모르면 먼저 읽는다 */
  async function putOnce(uid, sets, meta){
    if(!versions.has(uid)) await readMine(uid);
    const d = await authed.put(PATHS.mine, bodyOf(versions.get(uid), sets, meta));
    const v = versionOf(d);
    if(v === undefined) throw shapeError();
    versions.set(uid, v);
  }

  async function saveMine(uid, sets, meta){
    if(!uid) return false;
    try{
      try{ await putOnce(uid, sets, meta); }
      catch(e){
        if(!e || e.status !== CONFLICT_STATUS) throw e;
        versions.delete(uid);          // 다른 기기가 먼저 저장했다 — 판을 다시 읽어 한 번만 더
        await putOnce(uid, sets, meta);
      }
      return true;
    }catch(e){ warn('[플레이리스트] 저장 실패', (e && (e.code || e.message)) || e); return false; }
  }

  async function fetchRandom(excludeUid){
    const path = PATHS.random + (excludeUid ? '?exclude=' + encodeURIComponent(excludeUid) : '');
    const d = await authed.get(path, { auth: true });
    if(d === null) return null;
    const out = pickOf(d);
    if(!out) throw shapeError();
    return out;
  }

  async function fetchOf(userCode){
    if(!userCode){ const e = new Error('사용자 코드 없음'); e.code = 'NO_USER'; throw e; }
    let d;
    try{ d = await authed.get(PATHS.of(userCode), { auth: true }); }
    catch(e){ if(e && e.code === FRIENDS_ONLY_CODE) return null; throw e; }
    const out = publicOf(d, random);
    if(out === undefined) throw shapeError();
    return out;
  }

  return { fetchMine, saveMine, fetchRandom, fetchOf };
}

const api = { createPlaylistApi, mineOf, pickOf, publicOf, bodyOf, PATHS, LIMITS };
if(typeof window !== 'undefined') window.TwPlaylistApi = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
