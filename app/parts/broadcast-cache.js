/*
 * 공용 공지(inboxBroadcast)를 버전 확인 + 로컬 캐시로 받는다.
 * 부팅마다 inboxBroadcast 를 통째로 onValue 하던 것이 운영 다운로드의 몇 % 였다 — 공지는 거의 안 바뀐다.
 *
 * [구조] 카탈로그와 같다(catalog-cache.js 의 createCatalogSync 를 그대로 쓴다).
 *   관리자가 공지를 쓰거나 · 고정을 바꾸거나 · 지울 때 같은 다중 경로 update 로 inboxBroadcastMeta 에 서버 시각을 쓴다
 *   (앱 firebase-init.js _broadcastUpdate · 웹 관리자 entities/inbox broadcastCommit).
 *   앱은 inboxBroadcastMeta(숫자 하나)만 구독하고, 캐시와 버전이 같으면 캐시, 다르면 한 번 받는다.
 *   받을 때는 통째가 아니라 최근 BROADCAST_LATEST 개(ts 순) + 고정 공지 전부를 받아 id 로 합친다
 *   — 웹 관리자 listBroadcasts 와 같은 모양. 고정은 오래돼도 맨 위에 보여야 하므로 개수와 상관없이 받는다.
 *   안전장치(버전 없음 · 거부 · 받기 실패 → 예전처럼 통째 onValue, 수명 24시간, 오프라인이면 캐시 먼저,
 *   켜져 있는 동안의 바뀜은 10~50초 모아 한 번)는 catalog-cache.js 머리말 그대로다.
 *
 * 읽음 표시는 서버가 아니라 각 기기 localStorage(tw.inboxBcRead)에 id 로 남는다 — 받는 방법과 무관하게 그대로 맞는다.
 *
 * Firebase 를 직접 import 하지 않는다 — ref · query · onValue · get 은 firebase-init.js 가 넘긴다(검사 sim-broadcast-cache.js).
 */
import { createCatalogSync } from './catalog-cache.js';

export const BROADCAST_KIND = 'inboxBroadcast';   // 캐시 키 꼬리(DB 주소|inboxBroadcast) — 카탈로그 종류와 겹치지 않는다
export const BROADCAST_LATEST = 30;               // 최근 몇 개를 받나 — 웹 관리자 BROADCAST_PAGE 와 같다

function isMsg(m){
  return !!m && typeof m === 'object' && !Array.isArray(m);
}

/* 최근 n 개 + 고정 공지 → { id: 공지 } 하나로. 같은 id 는 같은 공지라 어느 쪽이 이겨도 같다.
   객체가 아닌 값(깨진 항목)은 뺀다 — 예전 통째 구독은 그대로 넘겼지만 화면이 객체만 다룬다. */
export function mergeBroadcasts(latest, pinned){
  const out = {};
  for(const src of [latest, pinned]){
    if(!isMsg(src)) continue;
    for(const id of Object.keys(src)) if(isMsg(src[id])) out[id] = src[id];
  }
  return out;
}

/* 공용 공지 구독기 — subscribe(onData) → 구독 해제 함수. onData 는 예전처럼 { id: 공지 } 객체를 받는다.
   deps
     metaRef() · fullRef() — inboxBroadcastMeta · inboxBroadcast ref (경로는 firebase-init.js 에 둔다 — audit 검사 7)
     latestQuery(n) · pinnedQuery() — 최근 n 개 · 고정 공지 query (규칙 .indexOn ["ts","pinned"])
     onValue · get — Firebase 것 그대로
     나머지(store · scope · now · setTimer …)는 createCatalogSync 로 그대로 넘긴다. */
export function createBroadcastSync(deps){
  const { metaRef, fullRef, latestQuery, pinnedQuery, get } = deps;
  const n = deps.latest || BROADCAST_LATEST;
  const sub = createCatalogSync(Object.assign({}, deps, {
    tag: 'broadcast-cache',
    metaRef: () => metaRef(),
    catalogRef: () => fullRef(),
    /* 둘 중 하나라도 실패하면(색인 없음 · 오프라인) 받기 실패 → 통째 onValue 로 물러난다. */
    fetch: async () => {
      const [a, b] = await Promise.all([get(latestQuery(n)), get(pinnedQuery())]);
      return { val: () => mergeBroadcasts(a.val(), b.val()) };
    },
  }));
  return (onData) => sub(BROADCAST_KIND, onData);
}
