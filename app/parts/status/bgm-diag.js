/* bgm-diag.js — 🔍 플레이리스트 소리 진단 줄 (검사 sim-bgm-diag.js)
   [왜] «곡은 끝까지 넘어가는데 소리만 안 난다» 를 설치본에서 가를 길이 없다(개발자 도구가 막혀 있다).
     main.js 의 광고 게이트(bgmStartAdGate)가 음소거를 정할 때 본 값을 1초마다 보내 오면, 여기서 한 줄로 그린다.
   ★ 줄이 뜨는 때: ① 광고가 아닌데 앱 음소거가 안 풀림 · 확인이 FAIL_MIN 번 넘게 잇달아 실패 · 페이지가 NO_REPLY_MS 넘게
       답을 안 함 — 이 상태가 HOLD_MS 동안 이어질 때만(저절로 · 곡을 불러오는 짧은 순간에 번쩍이지 않게)
     ② 플레이리스트 음량 아이콘(#myPlVolIco)을 누르면 PEEK_MS 동안(다시 누르면 처음부터 · 저장 안 함).
   ⚠️ 읽기만 한다 — 음소거 · 음량을 정하는 것은 main.js 게이트 그대로다.
   순수 함수(read · suspect · line)는 따로 내놓아 검사가 돌린다. */
(function(){
'use strict';

const HOLD_MS = 5000;    // 게이트는 0.25초마다 보므로 정상이면 1초 안에 풀린다 — 이만큼 이어지면 진짜 문제
const PEEK_MS = 10000;   // 아이콘을 눌러 볼 때 — 캡처할 틈만 주고 저절로 닫힌다
const FAIL_MIN = 8;      // 0.25초 × 8 = 2초 동안 확인이 한 번도 안 됨
const NO_REPLY_MS = 2000;   // 답이 이만큼 없으면 음소거가 시작값(켜짐) 그대로 남아 있다

const num = (x) => (typeof x === 'number' && isFinite(x)) ? x : null;
const bool = (x) => (typeof x === 'boolean') ? x : null;

/* main 이 보낸 값 — 모르는 칸은 버리고 모양을 맞춘다(없으면 null) */
function read(s){
  if(!s || typeof s !== 'object') return null;
  return {
    gateMuted: s.gateMuted === true, audible: s.audible === true, isAd: s.isAd === true,
    videos: Math.max(0, Math.floor(num(s.videos) || 0)),
    vol: num(s.vol), want: num(s.want), vMuted: bool(s.vMuted), paused: bool(s.paused),
    pVol: num(s.pVol), pMuted: bool(s.pMuted),
    mutedMs: Math.max(0, num(s.mutedMs) || 0), fail: Math.max(0, Math.floor(num(s.fail) || 0)),
    pending: Math.max(0, Math.floor(num(s.pending) || 0)), noReplyMs: Math.max(0, num(s.noReplyMs) || 0),
  };
}
/* 지금 이 값이 이상한가(한 번의 값만 본다 — 이어지는지는 nextBadSince) */
function suspect(d){
  if(!d) return false;
  if(d.fail >= FAIL_MIN || d.noReplyMs >= NO_REPLY_MS) return true;
  return d.gateMuted && !d.isAd && d.videos > 0;
}
/* 이상한 상태가 언제부터 이어졌나 — 정상이면 0. 저절로 보일 때는 now - since >= HOLD_MS */
function nextBadSince(since, d, now){
  if(!suspect(d)) return 0;
  return since || now;
}
const held = (since, now) => since > 0 && now - since >= HOLD_MS;
const pct = (x) => x === null ? '—' : String(Math.round(x * 100));
const onOff = (b) => b === null ? '—' : (b ? '켜짐' : '꺼짐');
/* 화면에 쓸 한 줄(textContent 로만 넣는다) */
function line(d){
  if(!d) return '🔍 소리 진단 · 재생 중인 곡이 없어요';
  const out = ['🔍 소리 진단'];
  if(d.noReplyMs >= 1000) out.push('게이트 답 없음 ' + Math.floor(d.noReplyMs / 1000) + '초' + (d.pending > 1 ? '(기다리는 확인 ' + d.pending + ')' : ''));
  out.push('앱 음소거 ' + (d.gateMuted ? '켜짐' + (d.mutedMs >= 1000 ? ' ' + Math.floor(d.mutedMs / 1000) + '초' : '') : '꺼짐'));
  out.push('광고 ' + (d.isAd ? '맞음' : '아님'));
  out.push('영상 ' + d.videos + '개');
  out.push('영상 음량 ' + pct(d.vol) + '/' + pct(d.want));
  out.push('영상 음소거 ' + onOff(d.vMuted));
  if(d.paused === true) out.push('멈춤');
  if(d.pVol !== null || d.pMuted !== null) out.push('플레이어 ' + (d.pVol === null ? '—' : Math.round(d.pVol)) + (d.pMuted ? ' 음소거' : ''));
  out.push('소리 신호 ' + (d.audible ? '있음' : '없음'));   // 음소거여도 «있음» 일 수 있다 — 페이지가 소리를 내는가
  if(d.fail > 0) out.push('확인 실패 ' + d.fail + '회');
  return out.join(' · ');
}

/** @param {{ companion: { onBgmDiag: (cb: (d: object) => void) => void, onBgmClosed: (cb: () => void) => void, onBgmMode: (cb: (mode: string) => void) => void } }} deps */
function createBgmDiag(deps){
  const companion = deps.companion;
  const el = document.getElementById('myPlDiag');
  const ico = document.getElementById('myPlVolIco');
  let last = null, badSince = 0, peekUntil = 0, peekT = null;
  if(!companion || !el || !ico) return {};

  function paint(){
    const now = Date.now();
    const show = now < peekUntil || held(badSince, now);
    el.hidden = !show;
    if(show) el.textContent = line(last);
  }
  function clear(){ last = null; badSince = 0; paint(); }
  companion.onBgmDiag((s) => { last = read(s); badSince = nextBadSince(badSince, last, Date.now()); paint(); });
  // 곡이 멈추거나 마이홈 BGM 이 창을 가져가면 이 줄의 값은 낡은 것이다
  companion.onBgmClosed(clear);
  companion.onBgmMode((mode) => { if(mode !== 'playlist') clear(); });
  ico.addEventListener('click', (e) => {
    e.stopPropagation();
    peekUntil = Date.now() + PEEK_MS;
    clearTimeout(peekT);
    peekT = setTimeout(paint, PEEK_MS);
    paint();
  });
  paint();
  return {};
}

const mod = { HOLD_MS, PEEK_MS, FAIL_MIN, NO_REPLY_MS, read, suspect, nextBadSince, held, line, createBgmDiag };
window.TwBgmDiag = mod;
})();
