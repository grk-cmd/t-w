/* playlist-sync.js — 🎵 플레이리스트 기기 간 맞추기 규칙(순수 함수 · 검사 sim-playlist-sync.js)
   [왜] 서버 사본(users/{uid}/playlist)은 계정 연동 때만 읽었다. 평소 부팅은 이 기기 목록만 읽어서, 다른 기기에 남은
     옛(또는 빈) 목록이 한 번 저장되면 서버 사본을 통째로 덮어 메인 기기 목록이 사라졌다.
   [규칙] 부팅 때 서버 사본을 한 번 읽고, 양쪽 «고친 시각» 을 견준다 — 이 기기 editTs(tw.playlistEditTs) · 서버 editTs.
     ★ 서버 editTs 는 이 판부터 앱만 쓰는 칸이다. 옛 앱은 노드를 통째로 set 해서 이 칸이 없다 = «시각 모름».
     ★ 한쪽이라도 시각을 모르면 곡이 있는 쪽을 덮지 않는다(업그레이드 첫 부팅 · 옛 앱과 섞어 쓸 때 좋은 목록을 잃지 않게).
       단 시각을 아는 서버 + 모르는 이 기기(새 기기 · 이 판 전 저장분)는 서버를 따른다 — 받기 전에 이 기기 목록은 백업한다(playlist.js).
     ★ 서버를 못 읽었으면 아무것도 하지 않고 다시 시도한다 — 모르는 채로 올리면 그게 곧 덮어쓰기다.
   DOM · firebase 없음. playlist.js 가 deps(playlistSync)로 받는다. */
(function(){
'use strict';

const RETRY_MS = 30000;            // 처음 다시 볼 간격 — 못 읽었거나 계정이 아직 없을 때
const RETRY_MAX_MS = 10 * 60000;   // 늘 실패하는 경우(권한 거부 등) 30초 폴링이 되지 않게 두 배씩 늘려 여기서 멈춘다

const countItems = (sets) => (Array.isArray(sets) ? sets : []).reduce((n, s) => n + ((s && Array.isArray(s.items)) ? s.items.length : 0), 0);
const tsOf = (x) => (typeof x === 'number' && isFinite(x) && x > 0) ? x : 0;

/* srv: playlistApi.fetchMine 결과({sets, editTs} · 읽기 실패면 null) · localTs: 이 기기 editTs · localHas: 이 기기 곡 수 > 0
   → 'retry'(못 읽음) · 'adopt'(서버 것으로) · 'push'(이 기기 것을 올림) · 'none'(그대로) */
function decide(srv, localTs, localHas){
  if(!srv || typeof srv !== 'object') return 'retry';
  const sTs = tsOf(srv.editTs), lTs = tsOf(localTs);
  const sHas = countItems(srv.sets) > 0;
  if(sTs && lTs) return sTs > lTs ? 'adopt' : (lTs > sTs ? 'push' : 'none');
  if(sTs) return sHas ? 'adopt' : (localHas ? 'push' : 'none');   // 이 기기만 모름 — 서버를 따른다(비운 서버는 이 기기 곡을 지우지 않음)
  if(!sHas) return localHas ? 'push' : 'none';                     // 서버가 시각을 모르고 비었다
  if(!localHas) return 'adopt';
  return lTs ? 'push' : 'none';                                    // 양쪽 곡 · 서버 시각 모름 — 이 판에서 고친 기기만 올린다
}
/* n 번째 다시 시도까지 기다릴 시간(0 부터) */
function retryDelay(n){
  const k = Math.max(0, Math.floor(Number(n) || 0));
  return Math.min(RETRY_MAX_MS, RETRY_MS * Math.pow(2, Math.min(k, 10)));
}

window.TwPlaylistSync = Object.freeze({ RETRY_MS, RETRY_MAX_MS, countItems, decide, retryDelay });
})();
