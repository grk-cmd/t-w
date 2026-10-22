/* playlist-sync.js — 🎵 플레이리스트 기기 간 맞추기 규칙(순수 함수 · 검사 sim-playlist-sync.js)
   [왜] 서버 사본(users/{uid}/playlist)은 계정 연동 때만 읽었다. 평소 부팅은 이 기기 목록만 읽어서, 다른 기기에 남은
     옛(또는 빈) 목록이 한 번 저장되면 서버 사본을 통째로 덮어 메인 기기 목록이 사라졌다.
   [규칙] 부팅 때 서버 사본을 한 번 읽고, «마지막으로 목록을 고친 시각»(이 기기 editTs · 서버 ts)이 더 늦은 쪽을 따른다.
     ★ 이 기기에서 아직 한 번도 고친 적이 없으면(editTs 0 — 새 기기 · 이 판 전 저장분) 서버에 곡이 있으면 서버를 따른다.
     ★ 서버를 못 읽었으면 아무것도 하지 않고 다시 시도한다 — 모르는 채로 올리면 그게 곧 덮어쓰기다.
   DOM · firebase 없음. playlist.js 가 window.TwPlaylistSync 로 받는다. */
(function(){
'use strict';

const RETRY_MS = 30000;   // 서버를 못 읽었거나 계정이 아직 안 정해졌을 때 다시 볼 간격

const countItems = (sets) => (Array.isArray(sets) ? sets : []).reduce((n, s) => n + ((s && Array.isArray(s.items)) ? s.items.length : 0), 0);

/* srv: fetchMyPlaylistSets 결과({sets, ts} · 읽기 실패면 null) · localTs: 이 기기 editTs · localHas: 이 기기 곡 수 > 0
   → 'retry'(못 읽음) · 'adopt'(서버 것으로) · 'push'(이 기기 것을 올림) · 'none'(같다) */
function decide(srv, localTs, localHas){
  if(!srv || typeof srv !== 'object') return 'retry';
  const sTs = (typeof srv.ts === 'number' && isFinite(srv.ts) && srv.ts > 0) ? srv.ts : 0;
  const sHas = countItems(srv.sets) > 0;
  const lTs = (typeof localTs === 'number' && isFinite(localTs) && localTs > 0) ? localTs : 0;
  if(!lTs) return sHas ? 'adopt' : (localHas ? 'push' : 'none');
  if(sTs > lTs) return 'adopt';
  if(lTs > sTs) return 'push';
  return 'none';
}

window.TwPlaylistSync = Object.freeze({ RETRY_MS, countItems, decide });
})();
