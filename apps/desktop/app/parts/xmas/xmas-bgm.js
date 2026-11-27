/* xmas-bgm.js — 🎄 크리스마스 창 배경음악(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-bgm.js)
   창이 열려 있는 동안만 — 곡 목록(TRACKS)을 차례로 틀고 끝나면 처음 곡으로 돌아간다 · 제목줄 «음악 끄기 / 음악 켜기» 는 이 PC 에 기억한다 · 출처 글(CREDIT)도 여기 둔다.
   ★ 소리가 겹치지 않게 — 소리를 내기 시작할 때 듣던 유튜브 BGM(마이홈 · 플레이리스트)을 재우고(others.hush), 끄거나 닫으면 재웠던 쪽만 되살린다.
     편지 추천곡(xmas-song.js)이 나는 동안은 물러난다(duck) — 추천곡이 재생 창을 가져가므로 재워 둔 것은 그때 잊는다(되살릴 것이 없다).
   ⚠️ 회사원 모드에서는 소리를 내지 않고 남의 음악도 재우지 않는다.
   classic script(window.TwXmasBgm) — xmas-window.js 보다 먼저 싣는다. xmas-window.js 가 `createXmasBgm(deps)` 한 번. */
(function(){
'use strict';

const MUTE_KEY = 'tw.xmasBgmMuted';   // '1' 이면 꺼 둠 — 기기 칸(account-store.js DEVICE_KEYS)
/* 곡 목록 — 이 순서로 틀고 끝나면 처음으로. 창을 열 때마다 첫 곡부터 */
const TRACKS = Object.freeze(['xmas-bgm.mp3', 'xmas-bgm-noel.mp3', 'xmas-bgm-wish.mp3', 'xmas-bgm-jingle.mp3']);
const DIRS = Object.freeze(['parts/xmas/', 'xmas/', '']);   // 파일이 있는 폴더 후보 — 있는 곳 먼저(pk-bgm 과 같은 관례)
const VOLUME = 0.32;                  // 스티커사진 창 BGM 과 같은 크기
const LABEL = Object.freeze({ playing: '음악 끄기', muted: '음악 켜기' });
/* 출처 글 — 한 줄에 하나 · 빈 글은 한 줄 띄움. 첫 줄은 머리글 */
const CREDIT = Object.freeze(['♪ MUSIC ♪', '투게더트리', '음악 제작 HADA', 'CM @hada_msc', '',
  'The First Noel', 'We Wish You A Merry Christmas', 'Jingle Bell', '공유마당(한국저작권위원회)']);

/**
 * @param {{ Audio: (Function|null), tracks?: string[], dirs?: string[], volume?: number, storage: { getItem(k: string): (string|null) },
 *   save: (key: string, val: string) => any, officeMode: () => boolean, warn: (...a: any[]) => void,
 *   others: { hush: () => any, unhush: (h: any) => void } }} deps
 */
function createXmasBgm(deps){
  const AudioCtor = deps.Audio;
  const tracks = deps.tracks || TRACKS;
  const dirs = deps.dirs || DIRS;
  const volume = deps.volume == null ? VOLUME : deps.volume;
  const storage = deps.storage;
  const save = deps.save;
  const officeMode = deps.officeMode;
  const warn = deps.warn;
  const others = deps.others;

  let audio = null, dirIdx = 0, trackIdx = 0;
  let open = false, ducked = false, hushed = null;
  let muted = false;
  try{ muted = storage.getItem(MUTE_KEY) === '1'; }catch(_){}

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
        else warn('[크리스마스] BGM 파일을 못 찾았어요 —', tracks[trackIdx]);
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
  const wants = () => open && !muted && !ducked && !officeMode();
  function play(fromStart){
    const a = el(); if(!a) return;
    if(fromStart){ if(trackIdx !== 0){ trackIdx = 0; load(); } try{ a.currentTime = 0; }catch(_){} }
    a.volume = volume;
    const pr = a.play();
    /* 자동재생 잠금에 걸리면 삼키지 않는다 — 삼키면 «소리가 안 난다» 의 원인을 다음에 또 못 찾는다. */
    if(pr && pr.catch) pr.catch(e => warn('[크리스마스] BGM 재생이 막혔어요', e && e.name));
  }
  function halt(rewind){
    const a = audio; if(!a) return;
    try{ a.pause(); if(rewind) a.currentTime = 0; }catch(_){}
  }
  function wake(){ const h = hushed; hushed = null; others.unhush(h); }

  /* 지금 상태(열림 · 끔 · 물러남 · 회사원 모드)에 맞춘다 */
  function sync(fromStart){
    if(wants()){
      if(!hushed) hushed = others.hush();
      play(fromStart);
      return;
    }
    halt(false);
    if(!ducked) wake();   // 내가 끈 것 — 재웠던 쪽을 되살린다(추천곡에 물러난 것이면 재생 창이 넘어갔다 · 아래 duck)
  }

  function start(){ open = true; ducked = false; sync(true); }
  function stop(){ open = false; halt(true); if(ducked){ hushed = null; ducked = false; } else wake(); }
  function toggle(){
    muted = !muted;
    save(MUTE_KEY, muted ? '1' : '0');
    if(open) sync(false);
  }
  /** 편지 추천곡이 나기 시작하면 true · 멈추면 false — 나는 동안 물러난다 */
  function duck(on){
    on = !!on;
    if(on === ducked) return;
    ducked = on;
    if(on) hushed = null;   // 추천곡이 재생 창을 가져갔다 — 재워 둔 것은 되살릴 수 없다
    if(open) sync(false);
  }

  return {
    start, stop, toggle, duck,
    isMuted: () => muted,
    label: () => (muted ? LABEL.muted : LABEL.playing),
  };
}

const api = Object.freeze({ createXmasBgm, MUTE_KEY, TRACKS, DIRS, VOLUME, LABEL, CREDIT });
if(typeof window !== 'undefined') window.TwXmasBgm = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
