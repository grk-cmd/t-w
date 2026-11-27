/* xmas-bgm.js — 🎄 크리스마스 창 배경음악의 곡 목록 · 출처 글(일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-bgm.js)
   재생 · 끄기 기억 · 듣던 BGM 재우기 · 추천곡에 물러나기는 shared/win-bgm.js — xmas-window.js 가 이 값들을 넘겨 만든다.
   classic script(window.TwXmasBgm) — xmas-window.js 보다 먼저 싣는다. */
(function(){
'use strict';

const MUTE_KEY = 'tw.xmasBgmMuted';   // '1' 이면 꺼 둠 — 기기 칸(account-store.js DEVICE_KEYS)
/* 곡 목록 — 이 순서로 틀고 끝나면 처음으로. 창을 열 때마다 첫 곡부터 */
const TRACKS = Object.freeze(['xmas-bgm.mp3', 'xmas-bgm-wish.mp3', 'xmas-bgm-jingle.mp3',
  'xmas-bgm-silent.mp3', 'xmas-bgm-jingle2.mp3', 'xmas-bgm-wish2.mp3',
  'xmas-bgm-jingle3.mp3', 'xmas-bgm-jingle4.mp3', 'xmas-bgm-wish3.mp3']);
const DIRS = Object.freeze(['parts/xmas/', 'xmas/', '']);   // 파일이 있는 폴더 후보 — 있는 곳 먼저
const VOLUME = 0.32;                  // 스티커사진 창 BGM 과 같은 크기
/* 출처 글 — 한 줄에 하나 · 빈 글은 한 줄 띄움. 첫 줄은 머리글 */
const CREDIT = Object.freeze(['♪ MUSIC ♪', '투게더트리', '음악 제작 HADA', 'CM @hada_msc', '',
  'We Wish You A Merry Christmas', 'Jingle Bell', 'Silent Night', '공유마당(한국저작권위원회)', '',
  'Jingle Bells', 'Jingle Punks', '', 'Jingle Bells (Jazz)', 'We Wish You a Merry Christmas (Jazz)', "E's Jammy Jams",
  '유튜브 오디오 라이브러리']);

const api = Object.freeze({ MUTE_KEY, TRACKS, DIRS, VOLUME, CREDIT, TAG: '크리스마스' });
if(typeof window !== 'undefined') window.TwXmasBgm = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
