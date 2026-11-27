/* xmas-song.js — 🎄 편지 추천곡 뮤직바(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-song.js)
   마이홈 BGM 위젯(#mhBgmWidget)과 같은 모양 · 같은 동작 — [▶ / ▐▐][긴 제목은 흐름][((o 링크 · 제목 넣기](쓰기 칸만).
   ★ 소리는 공용 배경음악 창 하나(main.js bgmOpen) — 이 모듈은 그 창의 주인 'xmas' 로 연다. 나중에 튼 쪽이 이긴다:
     마이홈 · 플레이리스트 · 같이 듣기가 창을 가져가면(onBgmMode) · 창이 닫히면(onBgmClosed) 재생 표시를 내린다.
   ★ 바가 여럿(쓰는 편지 · 받은 편지)이어도 재생은 한 곡 — 컨트롤러 하나가 «지금 나는 곡» 을 들고 모든 바를 다시 그린다.
   ★ 곡 제목은 남이 쓴 값일 수 있다 — textContent 로만.
   classic script(window.TwXmasSong) — xmas-letter.js 보다 먼저 싣는다. xmas-window.js 가 `createXmasSong(deps)` 한 번. */
(function(){
'use strict';

const WATCH_URL = 'https://www.youtube.com/watch?v=';

/**
 * @param {{ doc?:Document, win?:Window, companion:()=>any, ytVideoId:(url:string)=>string|null,
 *           asyncPrompt:(o:object)=>Promise<string|null>, toast:(msg:string)=>void, songTitleMax:number }} deps
 */
function createXmasSong(deps){
  const doc = deps.doc || document;
  const win = deps.win || window;
  const companion = deps.companion;
  const toast = deps.toast;
  const bars = new Set();
  let playingId = null, paused = false, bound = false;
  const playFns = [];
  let sounding = false;

  /* 바를 다시 그리고, «지금 소리가 나는가» 가 바뀌었으면 알린다(크리스마스 창 배경음악이 그동안 물러난다) */
  const repaint = (taken) => {
    bars.forEach(b => b.paint());
    const on = !!playingId && !paused;
    if (on !== sounding){ sounding = on; playFns.slice().forEach(fn => fn(on, !!taken)); }
  };
  /* taken — 다른 주인(마이홈 · 플레이리스트 · 같이 듣기)이 재생 창을 가져가서 멈춘 것 */
  function lose(taken){ playingId = null; paused = false; repaint(taken === true); }
  /* 재생 창 알림은 처음 틀 때 건다 — 앱이 아닌 곳(웹 미리보기 · smoke)엔 companion 이 없다 */
  function bindPlayer(c){
    if (bound) return;
    bound = true;
    c.onBgmMode((mode) => { if (mode !== 'xmas') lose(true); });
    c.onBgmClosed(() => lose());
  }

  /** 지금 나는 곡을 멈추고 창을 닫는다(편지 창을 닫을 때) — 내가 주인일 때만 */
  function stop(){
    if (!playingId) return;
    const c = companion();
    if (c) c.closeBgm();
    lose();
  }

  function toggle(song){
    if (!song) return false;
    const c = companion();
    if (!c){ toast('이 기능은 앱을 재시작한 후에 사용할 수 있어요'); return false; }
    bindPlayer(c);
    if (playingId === song.id){
      if (paused){ c.resumeBgm(); paused = false; }
      else { c.pauseBgm(); paused = true; }
    } else {
      c.openXmasSong(WATCH_URL + song.id, song.title || '추천곡');
      playingId = song.id; paused = false;
    }
    repaint();
    return true;
  }

  /* 긴 제목은 한 방향으로 흐른다 — 마이홈 위젯과 같은 방식(한 벌 + 간격 + 복제본 · 한 벌 폭만큼 민다) */
  function marquee(vp, lab, txt){
    lab.classList.remove('xm-marq');
    lab.style.removeProperty('--xmW'); lab.style.removeProperty('--xmDur');
    lab.textContent = txt;
    win.requestAnimationFrame(() => {
      if (!(lab.scrollWidth - vp.clientWidth > 2)) return;
      const oneW = lab.scrollWidth + 32;
      const gap = doc.createElement('span'); gap.className = 'xm-gap';
      const dup = doc.createElement('span'); dup.textContent = txt;
      lab.appendChild(gap); lab.appendChild(dup);
      lab.style.setProperty('--xmW', oneW + 'px');
      lab.style.setProperty('--xmDur', Math.max(4, oneW / 30).toFixed(1) + 's');
      lab.classList.add('xm-marq');
    });
  }

  /**
   * 바 하나 — el 안을 채운다. editable 이면 ((o 로 링크 · 제목을 넣고 onChange(song|null) 를 부른다.
   * @returns {{ set:(song:{id:string,title:string}|null)=>void, get:()=>({id:string,title:string}|null), remove:()=>void }}
   */
  function bar(el, opts){
    const o = opts || {};
    el.textContent = '';
    el.classList.add('xm-mbar');
    const play = doc.createElement('button'); play.type = 'button'; play.className = 'xm-mplay'; play.title = '재생 / 정지';
    const vp = doc.createElement('span'); vp.className = 'xm-mvp';
    const lab = doc.createElement('span'); lab.className = 'xm-mlab';
    vp.appendChild(lab);
    el.appendChild(play); el.appendChild(vp);
    let song = null, shown = null;
    const b = {
      paint(){
        play.textContent = (song && playingId === song.id && !paused) ? '▐▐' : '▶';
        const txt = song ? (song.title || 'YouTube 추천곡') : '추천곡 없음';
        if (txt !== shown){ shown = txt; marquee(vp, lab, txt); }
      },
    };
    play.onclick = () => {
      if (!song){ if (o.editable) toast('오른쪽 ((o 를 눌러 유튜브 링크를 먼저 넣어 주세요'); return; }
      toggle(song);
    };
    if (o.editable){
      const set = doc.createElement('button'); set.type = 'button'; set.className = 'xm-mset'; set.title = '유튜브 링크 넣기 · 바꾸기';
      set.textContent = '((o';
      el.appendChild(set);
      set.onclick = async () => {
        const url = await deps.asyncPrompt({ title: '추천곡', message: '편지에 붙일 유튜브 링크를 넣어 주세요\n(비우고 확인 = 빼기)', defaultValue: song ? WATCH_URL + song.id : '', placeholder: 'https://youtu.be/…' });
        if (url === null) return;
        if (!url.trim()){ api.set(null); o.onChange(null); return; }
        const id = deps.ytVideoId(url);
        if (!id){ toast('유튜브 링크를 인식하지 못했어요'); return; }
        const title = await deps.asyncPrompt({ title: '곡 제목', message: '뮤직바에 보일 곡 제목 (선택)', defaultValue: (song && song.id === id && song.title) || '', maxLength: deps.songTitleMax });
        const next = { id, title: String(title || '').trim().slice(0, deps.songTitleMax) };
        api.set(next); o.onChange(next);
      };
    }
    const api = {
      set(s){
        if (song && playingId === song.id && (!s || s.id !== song.id)) stop();   // 듣던 곡을 빼거나 바꾸면 멈춘다
        song = s ? { id: s.id, title: s.title || '' } : null;
        b.paint();
      },
      get: () => song,
      remove(){ bars.delete(b); },
    };
    bars.add(b);
    b.paint();
    return api;
  }

  /** 추천곡 소리가 나기 시작하면 fn(true) · 멈추면 fn(false, taken) — taken: 다른 주인이 재생 창을 가져가서 멈췄다 */
  function onPlay(fn){ playFns.push(fn); }

  return { bar, stop, playing: () => playingId, onPlay };
}

const api = Object.freeze({ createXmasSong });
if (typeof window !== 'undefined') window.TwXmasSong = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
