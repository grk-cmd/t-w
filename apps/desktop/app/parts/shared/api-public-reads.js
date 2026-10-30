/*
 * 🌐 공개 읽기를 API 사본에서 먼저 (검사 sim-api-public-reads.js) — 명함 · 프로필 사진 · 랭킹 · 랜덤 참여 후보.
 *
 * [왜] Firebase 요금은 내려받은 바이트다. t-w-server 가 같은 데이터의 읽기 전용 사본을 두고 «필요한 한 줄» 모양으로 내준다
 *   (예: 랭킹 = 100줄 → 내 줄만). 쓰기 원본은 그대로 Firebase.
 * [규칙] 늘 API 먼저(window.TwApi.client — 시간 제한 · 쉬기는 api-client.js) → 실패면 **지금 Firebase 길 그대로**(원래 함수).
 *   실패 = ApiError 무엇이든(닿지 못함 · 5xx · 503 *_NOT_READY · RTDB_UNAVAILABLE · 4xx) 또는 모양이 다른 응답.
 *   data:null 은 실패가 아니라 «없음» 이다 — 없는 사람의 명함은 Firebase 로 다시 가지 않는다. (파도타기는 로그인 길로 옮겼다 — status/playlist-api.js)
 *   화면 · 고르기 규칙은 바꾸지 않는다 — 돌려주는 모양이 원래 함수와 같다(부르는 쪽 playlist.js · app.js 는 모름).
 * [안 바꾸는 것] 정원 · 방 만들기 상한 검사(getRoomCounts · getRoomCount)는 Firebase 그대로.
 *   랜덤 참여 후보도 들어가기 전 확인(checkRoomCapacity)은 app.js 그대로.
 *
 * deps: api(TwApi.client — get(path)) · readCell(path) → Promise<값>(Firebase 한 칸 · 사진이 사본에 없을 때만)
 * wrap(firebaseAPI) — 위 함수들(fetchAvatar · fetchMyRank 포함)을 «API 먼저» 판으로 바꿔 끼운다. 원래 함수는 대체 길로 남는다.
 *   fetchUserCardApi(uid) 는 명함 날것만 단다(대체 길 없음 — 친구 포트가 넘어가기를 정한다).
 */
export const API_PATHS = Object.freeze({
  card: (uid) => '/v1/users/' + encodeURIComponent(uid) + '/card',
  rank: (uid) => '/v1/leaderboard/rank/' + encodeURIComponent(uid),
  top: '/v1/leaderboard/top',
  randomRooms: '/v1/rooms/random',
});
export const TOP_MAX = 100;             // 서버 상한(n ≤ 100)
export const RANDOM_ROOMS_MAX = 50;
export const avatarPath = (uid) => 'users/' + uid + '/home/avatar';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');

/* API 명함 → fetchPlaylistCard 모양({ name, level, cyc, clv, starC, avatar }). avatar 는 avatarInline 이면 따로 읽는다. */
export function cardOf(d, avatar){
  const c = isObj(d) ? d : {};
  return { name: c.name ? String(c.name) : null,
    level: (typeof c.level === 'number' && c.level >= 1) ? c.level : null,
    cyc: c.cyc, clv: c.clv, starC: c.starC,
    avatar: avatar || null };
}

export function createApiPublicReads(deps){
  const api = deps.api || null;
  const readCell = deps.readCell || (() => Promise.resolve(null));

  const ask = (path) => (api && typeof api.get === 'function') ? api.get(path) : Promise.reject(new Error('API 없음'));
  // 쉬는 중(BACKOFF)은 이미 한 번 알렸다 — 부를 때마다 같은 말을 쌓지 않는다
  const warn = (what, e) => { if(!api || (e && e.code === 'BACKOFF')) return; try{ console.warn('[API] ' + what + ' — Firebase 길로', (e && (e.code || e.message)) || e); }catch(_){} };

  /* 명함의 사진 — avatarInline(사본에 안 싣는 큰 data URL)이면 Firebase 한 칸, 아니면 avatarUrl. */
  async function avatarFrom(uid, c){
    if(isObj(c) && c.avatarInline === true){ try{ return (await readCell(avatarPath(uid))) || null; }catch(_){ return null; } }
    return (isObj(c) && typeof c.avatarUrl === 'string' && c.avatarUrl) ? c.avatarUrl : null;
  }
  async function apiCard(uid){
    return ask(API_PATHS.card(uid));
  }

  function wrap(fb){
    if(!fb) return fb;
    const orig = {};
    for(const k of ['fetchPlaylistCard', 'fetchAvatar', 'fetchMyRank', 'fetchLeaderboardTop', 'findRandomRooms']){
      orig[k] = (typeof fb[k] === 'function') ? fb[k].bind(fb) : null;
    }

    if(orig.fetchPlaylistCard) fb.fetchPlaylistCard = async (uid) => {
      let d;
      try{ d = await apiCard(uid); }
      catch(e){ warn('명함', e); return orig.fetchPlaylistCard(uid); }
      if(d !== null && !isObj(d)){ warn('명함 모양', null); return orig.fetchPlaylistCard(uid); }
      return cardOf(d, await avatarFrom(uid, d));
    };

    /* 👥 명함 날것만(API · Firebase 대체 길 없음) — 친구 포트(friends-api.js)가 부른다. 넘어가기는 포트가 정한다(source-switch).
       data | null(없는 사람) · 실패는 던진다. */
    fb.fetchUserCardApi = (uid) => apiCard(uid);

    /* 🖼 프로필 사진 하나 — 예전엔 사진 하나 때문에 users/{uid}/home 을 통째로 받았다(게시글 · 스티커까지).
       API 명함 → 못 받으면 원래 함수(Firebase home/avatar 한 칸 · firebase-init). 없으면 null. */
    const avatarFb = (uid) => orig.fetchAvatar ? orig.fetchAvatar(uid) : Promise.resolve(readCell(avatarPath(uid))).then((v) => v || null, () => null);
    fb.fetchAvatar = async (uid) => {
      if(!uid) return null;
      try{
        const d = await apiCard(uid);
        if(d === null) return null;
        if(isObj(d)) return await avatarFrom(uid, d);
      }catch(e){ warn('프로필 사진', e); }
      return avatarFb(uid);
    };

    /* 🏆 내 순위 한 줄 — 1.. | null(표 밖 · 기록 없음). API 를 못 받으면 원래 함수(undefined) → 부르는 쪽이 예전처럼 100줄 받아 rankOf. */
    fb.fetchMyRank = async (uid) => {
      try{
        const d = await ask(API_PATHS.rank(uid));
        if(isObj(d) && (d.rank === null || (Number.isInteger(d.rank) && d.rank >= 1))) return d.rank;
      }catch(e){ warn('순위', e); }
      return orig.fetchMyRank ? orig.fetchMyRank(uid) : undefined;
    };

    if(orig.fetchLeaderboardTop) fb.fetchLeaderboardTop = async () => {
      try{
        const d = await ask(API_PATHS.top + '?n=' + TOP_MAX);
        if(isObj(d) && Array.isArray(d.items)){
          return d.items.filter((x) => isObj(x) && typeof x.uid === 'string').map((x) => ({ uid: x.uid, sec: Number(x.sec) || 0, ts: Number(x.ts) || 0 }));
        }
      }catch(e){ warn('랭킹 100줄', e); }
      return orig.fetchLeaderboardTop();
    };

    /* 🎲 랜덤 참여 후보 — 워킹룸만(투게더룸은 서버도 400). 들어가기 전 확인은 app.js 그대로. 빈 배열 = 후보 없음. */
    if(orig.findRandomRooms) fb.findRandomRooms = async (limit) => {
      const n = Math.max(1, Math.min(RANDOM_ROOMS_MAX, Math.floor(Number(limit) || RANDOM_ROOMS_MAX)));
      try{
        const d = await ask(API_PATHS.randomRooms + '?channel=workingroom&limit=' + n);
        if(isObj(d) && Array.isArray(d.rooms)) return d.rooms.filter((c) => typeof c === 'string' && c && c.indexOf('SCRT-') !== 0).slice(0, n);
      }catch(e){ warn('랜덤 참여 후보', e); }
      return orig.findRandomRooms(limit);
    };

    return fb;
  }

  return { wrap };
}
