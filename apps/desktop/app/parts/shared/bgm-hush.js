/* bgm-hush.js — 🔇 유튜브 BGM(마이홈 · 플레이리스트) 잠깐 재우기 · 되살리기 (검사 sim-bgm-hush.js)
   자기 배경음악을 트는 창(스티커사진 · 크리스마스)이 열 때 듣던 것을 재우고, 닫을 때 재웠던 쪽만 되살린다.
   ★ 유튜브 BGM 은 창 하나를 같이 쓴다(main.js bgmMode) — 재우는 것은 `companion.pauseBgm()` 한 번이고,
     «누가 나고 있었는지» 를 돌려주니 부르는 쪽이 들고 있다가 unhush 에 넘긴다(상태는 여기 두지 않는다 — 창마다 따로 재운다).
   ⚠️ 되살릴 때 그 사이에 사용자가 직접 다시 틀었으면 건드리지 않는다 — 또 resume 하면 두 소리가 겹친다.
   classic script(window.TwBgmHush) — 쓰는 모듈 · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

/**
 * @param {{ companion: () => ({ pauseBgm?: Function, resumeBgm?: Function } | null | undefined),
 *   plPlaying: () => boolean, setPlPlaying: (v: boolean) => void, plRender: () => void,
 *   homePlaying: () => boolean, setHomePlaying: (v: boolean) => void }} deps
 */
function createBgmHush(deps){
  const companion = deps.companion;
  const plPlaying = deps.plPlaying;
  const setPlPlaying = deps.setPlPlaying;
  const plRender = deps.plRender;
  const homePlaying = deps.homePlaying;
  const setHomePlaying = deps.setHomePlaying;

  /** 듣던 것을 재운다 — 재운 쪽 { pl, home } · 나던 것이 없거나 재울 수 없으면 null */
  function hush(){
    const c = companion();
    if(!(c && c.pauseBgm)) return null;
    const pl = !!plPlaying();
    const home = !!homePlaying();
    if(!pl && !home) return null;
    try{ c.pauseBgm(); }catch(_){}
    /* 각자의 «지금 나는 중» 표시도 내려 준다 — 안 내리면 ▶ 버튼이 재생 중인 척한다. */
    if(pl){ setPlPlaying(false); plRender(); }
    if(home) setHomePlaying(false);
    return { pl: pl, home: home };
  }

  /** hush 가 돌려준 것을 되살린다 — null 이면 아무것도 안 한다 */
  function unhush(h){
    if(!h) return;
    const c = companion();
    if(!(c && c.resumeBgm)) return;
    if(plPlaying() || homePlaying()) return;
    try{ c.resumeBgm(); }catch(_){}
    if(h.pl){ setPlPlaying(true); plRender(); }
    if(h.home) setHomePlaying(true);
  }

  return { hush, unhush };
}

const api = Object.freeze({ createBgmHush });
if(typeof window !== 'undefined') window.TwBgmHush = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
