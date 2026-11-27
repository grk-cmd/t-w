/* update-diag.js — 🩺 업데이트 진단 · main.js 가 쓴다
   [왜] «업데이트를 받기 시작하면 먹통» 제보(B-1110-6)를 가를 기록이 없었다 — electron-updater 가 무엇을 받는지
     (조각만 받기 · 통째로 받기 · 이어 받기), 몇 % 에서 멈췄는지, 어떤 오류로 끝났는지를 진단 기록에 한 줄씩 남긴다.
   ・logger: electron-updater 의 자기 기록(info · warn · error)을 받는다 — debug 는 버린다(양이 많다).
   ・progress: 받는 중은 STEP % 마다 한 줄(받은 양 · 전체 · 속도). 새 판을 찾으면 reset 으로 다시 0 부터.
   ⚠️ 기록에는 사용자 폴더 이름이 들어가지 않게 홈 폴더를 ~ 로 바꾼다(제보자가 기록 파일을 그대로 보내 준다) — 규칙은 home-mask.js 한 벌.
   createUpdateDiag({ log, home }) → { logger, progress(p), reset() }
   검사: checks/sim-update-diag.js */
'use strict';

const { maskHome } = require('./home-mask');

const TAG = '[업데이트] ';
const STEP = 10;        // 진행 기록 간격(%)
const MSG_MAX = 300;    // 한 줄 글자 상한 — 긴 오류 본문이 기록을 덮지 않게

function createUpdateDiag(o){
  const log = o.log;
  const home = typeof o.home === 'string' ? o.home : '';
  const clean = (m) => {
    let s = (m && typeof m === 'object' && typeof m.message === 'string') ? m.message : String(m);
    s = maskHome(s, home);
    return s.replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, MSG_MAX);
  };
  const mb = (n) => (Number(n) > 0 ? (n / 1048576).toFixed(1) : '0');
  let lastStep = -1;

  const logger = {
    info: (m) => log(TAG + clean(m)),
    warn: (m) => log(TAG + '⚠ ' + clean(m)),
    error: (m) => log(TAG + '✗ ' + clean(m)),
    debug: () => {},
  };
  /* 받은 % 가 새 칸(STEP)에 들어설 때만 한 줄 — 한 줄이라도 남았으면 true */
  function progress(p){
    const pct = Math.max(0, Math.min(100, Number(p && p.percent) || 0));
    const step = Math.floor(pct / STEP) * STEP;
    if(step === lastStep) return false;
    lastStep = step;
    const kbs = Math.round((Number(p && p.bytesPerSecond) || 0) / 1024);
    log(TAG + '받는 중 ' + step + '% · ' + mb(p && p.transferred) + '/' + mb(p && p.total) + 'MB · ' + kbs + 'KB/s');
    return true;
  }
  function reset(){ lastStep = -1; }
  return { logger, progress, reset };
}

module.exports = { createUpdateDiag, STEP, MSG_MAX };
