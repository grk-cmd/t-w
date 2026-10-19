/* pk-bgm.js — 🎵 스티커사진 창 BGM: 창이 열려 있는 동안만 · 사용자가 끄면 이 PC 에 기억(제목줄 «음악 끄기 / 음악 켜기»)
   purikura-ui.js 의 재생 · 멈춤 몸통을 옮기고 끄기를 더했다. 다른 BGM(유튜브) 재우기 · 되살리기는 purikura-ui.js 그대로.
   ・받는 deps: Audio(생성자) · srcs(경로 후보 — 있는 곳 먼저) · volume · storage(읽기 — localStorage) · save(key, val — 실패 알림은 그쪽) · officeMode(읽는 함수) · warn
   ・내놓는 것: start() — 창을 열 때(꺼 뒀으면 소리를 안 낸다) · stop() — 창을 닫을 때 · toggle() · isMuted() · label() — 버튼 글
   ⚠️ 효과음이 아니라 배경음이라 풀(_mkSndPool)을 쓰지 않는다 — 겹칠 일이 없고 loop 이 필요하다. 인스턴스 하나를 되감아 쓴다.
   ⚠️ 회사원 모드에서는 아무 소리도 내지 않는다(소리를 내는 자리는 예외 없이 이 게이트를 지난다).
   검사: checks/sim-pk-bgm.js */
(function(){

const MUTE_KEY = 'tw.pkBgmMuted';
const LABEL = { playing: '음악 끄기', muted: '음악 켜기' };

/**
 * @param {{ Audio: Function, srcs: string[], volume: number, storage: { getItem(k: string): (string|null) },
 *   save: (key: string, val: string) => boolean, officeMode: () => boolean, warn: (...a: any[]) => void }} deps
 */
function createPkBgm(deps){
  const AudioCtor = deps.Audio;
  const srcs = deps.srcs;
  const volume = deps.volume;
  const storage = deps.storage;
  const save = deps.save;
  const officeMode = deps.officeMode;
  const warn = deps.warn;

  let audio = null, srcIdx = 0, open = false;
  let muted = false;
  try{ muted = storage.getItem(MUTE_KEY) === '1'; }catch(_){}

  function el(){
    if(audio) return audio;
    try{
      const a = new AudioCtor(srcs[srcIdx]);
      a.loop = true; a.preload = 'auto'; a.volume = volume;
      a.addEventListener('error', ()=>{
        /* 경로 폴백 — 다음 후보로 갈아탄다. 다 떨어지면 소리가 없는 것으로 둔다(창은 그대로 쓴다). */
        if(srcIdx + 1 < srcs.length){ srcIdx++; audio = null; }
        else warn('[스티커사진] BGM 파일을 못 찾았어요 —', srcs.join(' / '));
      });
      try{ a.load(); }catch(_){}
      audio = a;
    }catch(_){ audio = null; }
    return audio;
  }
  function play(fromStart){
    if(muted || officeMode()) return;
    const a = el(); if(!a) return;
    if(fromStart){ try{ a.currentTime = 0; }catch(_){} }
    a.volume = volume;
    const pr = a.play();
    /* 자동재생 잠금에 걸리면 삼키지 않는다 — 삼키면 «소리가 안 난다»의 원인을 다음에 또 못 찾는다. */
    if(pr && pr.catch) pr.catch(e=>warn('[스티커사진] BGM 재생이 막혔어요', e && e.name));
  }
  function halt(rewind){
    const a = audio; if(!a) return;
    try{ a.pause(); if(rewind) a.currentTime = 0; }catch(_){}
  }

  function start(){ open = true; play(true); }
  function stop(){ open = false; halt(true); }
  /* 창이 열려 있으면 바로 끄고 켠다 — 켤 때는 멈춘 자리부터(처음으로 되감지 않는다). */
  function toggle(){
    muted = !muted;
    save(MUTE_KEY, muted ? '1' : '0');
    if(!open) return;
    if(muted) halt(false); else play(false);
  }
  return {
    start, stop, toggle,
    isMuted: ()=>muted,
    label: ()=>muted ? LABEL.muted : LABEL.playing,
  };
}

const api = { createPkBgm, MUTE_KEY, LABEL };
if(typeof window !== 'undefined') window.TwPkBgm = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
