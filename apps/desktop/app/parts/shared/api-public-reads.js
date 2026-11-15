/*
 * 🌐 공개 읽기를 API 사본에서 (검사 sim-api-public-reads.js) — 명함(fetchPlaylistCard) 하나.
 *
 * [왜] Firebase 요금은 내려받은 바이트다. t-w-server 가 같은 데이터의 읽기 전용 사본을 두고 «필요한 한 줄» 모양으로 내준다
 *   쓰기 원본은 그대로 Firebase.
 * [규칙] API 한 길(window.TwApi.client — 시간 제한 · 쉬기는 api-client.js). 못 받으면 **던진다** — Firebase 로 물러나지 않는다(0.13 E-2 · R4).
 *   실패 = ApiError 무엇이든(닿지 못함 · 5xx · 503 *_NOT_READY · RTDB_UNAVAILABLE · 4xx) · 모양이 다른 응답 · API 통로 없음 · 사진 칸 읽기 실패.
 *   data:null 은 실패가 아니라 «없음» 이다 — 없는 사람의 명함은 빈 명함. (파도타기는 로그인 길로 옮겼다 — status/playlist-api.js)
 *   돌려주는 모양은 원래 함수와 같다. 던진 것은 부르는 쪽 playlist.js 가 E-PL-03 «명함을 못 받았어요» 로 알린다.
 *
 * deps: api(TwApi.client — get(path)) · readCell(path) → Promise<값>(Firebase 한 칸 · 사진이 사본에 없을 때만)
 * wrap(firebaseAPI) — fetchPlaylistCard 를 API 판으로 바꿔 끼운다(firebase-init.js 의 옛 함수는 쓰이지 않는다 — E-5 가 걷는다).
 */
export const API_PATHS = Object.freeze({
  card: (uid) => '/v2/users/' + encodeURIComponent(uid) + '/card',
});
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

  /* 명함의 사진 — avatarInline(사본에 안 싣는 큰 data URL)이면 Firebase 한 칸, 아니면 avatarUrl. 그 칸을 못 읽으면 던진다(사진 없는 명함으로 그리지 않는다). */
  async function avatarFrom(uid, c){
    if(isObj(c) && c.avatarInline === true) return (await readCell(avatarPath(uid))) || null;
    return (isObj(c) && typeof c.avatarUrl === 'string' && c.avatarUrl) ? c.avatarUrl : null;
  }

  /* fetchPlaylistCard 를 API 판으로 바꿔 끼운다. 못 받으면(닿지 못함 · 5xx · 모양이 다름 · API 통로 없음) 던진다 —
     Firebase 로 물러나지 않는다. 부르는 쪽(playlist.js)이 «못 받음» 을 알린다. */
  function wrap(fb){
    fb.fetchPlaylistCard = async (uid) => {
      const d = await ask(API_PATHS.card(uid));
      if(d !== null && !isObj(d)) throw new Error('명함 모양이 달라요');
      return cardOf(d, await avatarFrom(uid, d));
    };
    return fb;
  }

  return { wrap };
}
