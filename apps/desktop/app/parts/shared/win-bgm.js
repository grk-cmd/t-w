/* win-bgm.js — 🎵 창 배경음악: 창이 열려 있는 동안만 · 사용자가 끄면 이 PC 에 기억(제목줄 «음악 끄기 / 음악 켜기») (검사 sim-win-bgm.js)
   스티커사진 창 · 크리스마스 창이 같이 쓴다 — 곡 목록(tracks)을 차례로 틀고 끝나면 처음 곡으로(한 곡이면 그 곡을 되풀이).
   ・받는 deps: Audio(생성자) · tracks(파일 이름) · dirs(폴더 후보 — 있는 곳 먼저) · volume · muteKey(tw. 로 시작 · 기기 칸) · tag(경고 줄 머리) ·
     storage(읽기 — localStorage) · save(key, val — 실패 알림은 그쪽) · officeMode(읽는 함수) · warn · others({ hush, unhush } — 듣던 유튜브 BGM 재우기 · 없으면 NO_OTHERS)
   ・내놓는 것: start() — 창을 열 때(첫 곡 처음부터 · 꺼 뒀으면 소리 없음) · stop() — 닫을 때(되감기) · toggle() · duck(on) — 다른 소리가 나는 동안 물러남 ·
     refresh() — 회사원 모드가 바뀌었을 때 다시 맞춤 · isMuted() · label()
   ★ 소리를 내기 시작할 때 others.hush 로 듣던 것을 재우고, 끄거나 닫으면 재웠던 쪽만 되살린다. duck 으로 물러난 것이면 재워 둔 것은 잊는다(재생 창이 넘어갔다).
   ⚠️ 효과음이 아니라 배경음이라 풀(_mkSndPool)을 쓰지 않는다 — 겹칠 일이 없다. Audio 하나를 갈아 끼워 쓴다.
   ⚠️ 회사원 모드에서는 소리를 내지 않는다. 듣던 음악은 그때도 재워 둔다(창이 열려 있는 동안 둘 다 조용하게 — 꺼 두었으면 재우지 않는다)
   classic script(window.TwWinBgm) — 쓰는 모듈 · app.js 보다 먼저 싣는다. */
(function(){
'use strict';

const LABEL = Object.freeze({ playing: '음악 끄기', muted: '음악 켜기' });
/* 남의 음악을 재우지 않는 창(스티커사진 — 재우기를 여닫을 때 따로 한다)이 넘기는 것 */
const NO_OTHERS = Object.freeze({ hush: () => null, unhush: () => {} });

/**
 * @param {{ Audio: (Function|null), tracks: ReadonlyArray<string>, dirs: ReadonlyArray<string>, volume: number, muteKey: string, tag: string,
 *   storage: { getItem(k: string): (string|null) }, save: (key: string, val: string) => any, officeMode: () => boolean, warn: (...a: any[]) => void,
 *   others: { hush: () => any, unhush: (h: any) => void } }} deps
 */
function createWinBgm(deps){
  const AudioCtor = deps.Audio;
  const tracks = deps.tracks;
  const dirs = deps.dirs;
  const volume = deps.volume;
  const muteKey = deps.muteKey;
  const tag = '[' + deps.tag + ']';
  const storage = deps.storage;
  const save = deps.save;
  const officeMode = deps.officeMode;
  const warn = deps.warn;
  const others = deps.others;

  let audio = null, dirIdx = 0, trackIdx = 0;
  let open = false, ducked = false, hushed = null;
  let muted = false;
  try{ muted = storage.getItem(muteKey) === '1'; }catch(_){}

  const srcNow = () => dirs[dirIdx] + tracks[trackIdx];
  function el(){
    if(audio) return audio;
    if(!AudioCtor) return null;
    try{
      const a = new AudioCtor(srcNow());
      a.loop = tracks.length === 1; a.preload = 'auto'; a.volume = volume;
      a.addEventListener('error', () => {
        /* 폴더 폴백 — 다음 후보 폴더로 갈아탄다. 다 떨어지면 소리가 없는 것으로 둔다(창은 그대로 쓴다). */
        if(dirIdx + 1 < dirs.length){ dirIdx++; load(); if(wants()) play(false); }
        else warn(tag + ' BGM 파일을 못 찾았어요 —', tracks[trackIdx]);
      });
      /* 한 곡이 끝나면 다음 곡 — 마지막 곡 뒤에는 처음 곡 */
      a.addEventListener('ended', () => { trackIdx = (trackIdx + 1) % tracks.length; load(); if(wants()) play(false); });
      audio = a;
    }catch(_){ audio = null; }
    return audio;
  }
  /* 지금 곡(trackIdx)으로 갈아 끼운다 */
  function load(){
    const a = audio; if(!a) return;
    try{ a.src = srcNow(); }catch(_){}
  }
  const holds = () => open && !muted && !ducked;   // 이 창이 소리 자리를 쥔다 — 듣던 음악을 재워 둔다
  const wants = () => holds() && !officeMode();    // 실제로 소리를 낸다
  function play(fromStart){
    const a = el(); if(!a) return;
    if(fromStart){ if(trackIdx !== 0){ trackIdx = 0; load(); } try{ a.currentTime = 0; }catch(_){} }
    a.volume = volume;
    const pr = a.play();
    /* 자동재생 잠금에 걸리면 삼키지 않는다 — 삼키면 «소리가 안 난다» 의 원인을 다음에 또 못 찾는다. */
    if(pr && pr.catch) pr.catch(e => warn(tag + ' BGM 재생이 막혔어요', e && e.name));
  }
  function halt(rewind){
    const a = audio; if(!a) return;
    try{ a.pause(); if(rewind) a.currentTime = 0; }catch(_){}
  }
  function wake(){ const h = hushed; hushed = null; others.unhush(h); }

  /* 지금 상태(열림 · 끔 · 물러남 · 회사원 모드)에 맞춘다 */
  function sync(fromStart){
    if(holds()){
      if(!hushed) hushed = others.hush();
      if(wants()) play(fromStart); else halt(false);
      return;
    }
    halt(false);
    if(!ducked) wake();   // 내가 끈 것 — 재웠던 쪽을 되살린다(물러난 것이면 재생 창이 넘어갔다 · 아래 duck)
  }

  function start(){ open = true; ducked = false; sync(true); }
  function stop(){
    open = false; halt(true);
    if(trackIdx !== 0){ trackIdx = 0; load(); }   // 다음에 열면(꺼 둔 채 열었다 켜도) 첫 곡부터
    if(ducked){ hushed = null; ducked = false; } else wake();
  }
  /** 바깥 상태(회사원 모드)가 바뀌었다 — 열려 있으면 지금 상태에 다시 맞춘다 */
  function refresh(){ if(open) sync(false); }
  function toggle(){
    muted = !muted;
    save(muteKey, muted ? '1' : '0');
    if(open) sync(false);
  }
  /** 다른 소리(크리스마스 편지 추천곡)가 나기 시작하면 true · 멈추면 false — 나는 동안 물러난다 */
  function duck(on){
    on = !!on;
    if(on === ducked) return;
    ducked = on;
    if(on) hushed = null;   // 그 소리가 재생 창을 가져갔다 — 재워 둔 것은 되살릴 수 없다
    if(open) sync(false);
  }

  return {
    start, stop, toggle, duck, refresh,
    isMuted: () => muted,
    label: () => (muted ? LABEL.muted : LABEL.playing),
  };
}


const api = Object.freeze({ createWinBgm, LABEL, NO_OTHERS });
if(typeof window !== 'undefined') window.TwWinBgm = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
