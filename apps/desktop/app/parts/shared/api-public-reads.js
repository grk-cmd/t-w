/*
 * 🌐 공개 읽기를 API 에서 (검사 sim-api-public-reads.js) — 명함(fetchPlaylistCard) 하나.
 *
 * [왜] 명함은 서버 «마이홈 명함 묶음» 한 길(GET /v2/myhomes/cards?codes= — MyHomeController)에서만 받는다. 키는 userCode 다(uid 가 아니다 —
 *   0.13 앱의 uid 는 서버가 가입 때 만든 userCode 와 같은 값이다: app.js getMyUserId · 파도타기 playlist-api 의 uid). 쓰기 원본은 서버.
 *   예전 길 GET /v2/users/{uid}/card 는 서버에 없다(#887 이 /v1 → /v2 로 기계적으로 바꾸며 생긴 오류 — checks/sim-api-routes.js 가 막는다).
 * [규칙] 길 · 봉투 풀기 · 100개씩 나누기 · 모양 맞춤은 친구 쪽 social-api.js(fetchCards) 한 곳이다 — 여기서 다시 만들지 않는다.
 *   같은 순간(한 틱)에 여러 사람의 명함을 물으면 요청 하나로 묶는다(사람 수만큼 따로 부르지 않는다).
 *   못 받으면 **던진다** — Firebase 로 물러나지 않는다(0.13 E-2 · R4). 실패 = 닿지 못함 · 5xx · 4xx · 모양이 다른 응답 · 명함 통로 없음.
 *   서버는 없는 사람의 코드를 빼고 준다 — 그 사람은 실패가 아니라 «없음» 이라 빈 명함이다. (파도타기는 로그인 길로 옮겼다 — status/playlist-api.js)
 *   돌려주는 모양은 원래 함수와 같다({ name, level, cyc, clv, starC, avatar }). 던진 것은 부르는 쪽 playlist.js 가 E-PL-03 «명함을 못 받았어요» 로 알린다.
 *
 * deps: fetchCards(codes) → Promise<{ userCode: { name, avatar, bio, level, cyc, clv, starC } }> (social-api.js 의 fetchCards)
 * wrap(firebaseAPI) — fetchPlaylistCard 를 API 판으로 바꿔 끼운다(firebase-init.js 의 옛 함수는 쓰이지 않는다 — E-5 가 걷는다).
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/* 서버 명함(social-api cardOf 모양) → fetchPlaylistCard 모양({ name, level, cyc, clv, starC, avatar }). 없는 사람(null)은 빈 명함. */
export function cardOf(c){
  const d = isObj(c) ? c : {};
  return { name: d.name ? String(d.name) : null,
    level: (typeof d.level === 'number' && d.level >= 1) ? d.level : null,
    cyc: d.cyc, clv: d.clv, starC: d.starC,
    avatar: (typeof d.avatar === 'string' && d.avatar) ? d.avatar : null };
}

export function createApiPublicReads(deps){
  const fetchCards = (deps && typeof deps.fetchCards === 'function') ? deps.fetchCards : null;
  let batch = null;   // { codes: Set, done: Promise<{ userCode: 명함 }> } — 이번 틱에 모이는 묶음

  /* 같은 틱에 모인 코드를 한 번에 묻는다. 한 묶음이 실패하면 그 묶음의 모두가 같은 오류로 실패한다. */
  function ask(code){
    if(!fetchCards) return Promise.reject(new Error('명함 통로 없음'));
    if(!batch){
      const b = { codes: new Set(), done: null };
      b.done = Promise.resolve().then(() => {
        if(batch === b) batch = null;
        return fetchCards(Array.from(b.codes));
      });
      batch = b;
    }
    batch.codes.add(code);
    return batch.done.then((cards) => (isObj(cards) && isObj(cards[code])) ? cards[code] : null);
  }

  /* fetchPlaylistCard 를 API 판으로 바꿔 끼운다. 못 받으면(닿지 못함 · 5xx · 모양이 다름 · 통로 없음) 던진다 —
     Firebase 로 물러나지 않는다. 부르는 쪽(playlist.js)이 «못 받음» 을 알린다. */
  function wrap(fb){
    fb.fetchPlaylistCard = async (userCode) => cardOf(await ask(String(userCode)));
    return fb;
  }

  return { wrap };
}
