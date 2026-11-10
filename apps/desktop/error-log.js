/* error-log.js — 🧯 오류 기록 파일(tw-error.log) · main.js 가 쓴다
   [왜] 오류가 진단 기록(tw-mouse-diag.log) 사이에 섞여 있으면 찾기 어렵고, 렌더러의 잡히지 않은 오류 · console.error 는
     아예 남지 않았다(개발자 도구는 설치본에서 막혀 있다). 오류만 한 파일에 모아 제보 때 그 파일 하나만 받는다.
   ・한 줄 모양: [시각] [앱 판] [종류] 출처 · 내용   (종류: ERROR · WARN · CODE(에러코드 알림) · CRASH(프로세스 종료))
   ・홈 폴더(사용자 이름)는 ~ 로 · 줄바꿈은 « ⏎ » 로 한 줄에 · 한 줄 MSG_MAX 자
   ・같은 오류가 몰아치면 REPEAT_WINDOW_MS 안에 REPEAT_MAX 번까지만 적고, 다음에 적을 때 «같은 오류 n번 더» 를 붙인다
   ・파일이 MAX_BYTES 를 넘으면 .1 로 밀고 새로 — 최근 기록은 늘 남고 디스크는 두 벌로 묶인다
   ⚠️ 쓰기 실패는 삼킨다(오류 기록 때문에 앱이 멈추면 안 된다).
   createErrorLog({ fs, path, dir, version, home, now }) → { write(kind, src, msg), file }
   검사: checks/sim-error-log.js */
'use strict';

const FILE = 'tw-error.log';
const MAX_BYTES = 256 * 1024;
const MSG_MAX = 600;
const REPEAT_MAX = 3;
const REPEAT_WINDOW_MS = 10 * 60 * 1000;
const KINDS = ['ERROR', 'WARN', 'CODE', 'CRASH'];

function createErrorLog(o){
  const fs = o.fs, path = o.path;
  const now = o.now || (() => Date.now());
  const home = typeof o.home === 'string' ? o.home : '';
  const file = () => path.join(typeof o.dir === 'function' ? o.dir() : o.dir, FILE);
  const seen = new Map();   // 같은 오류 열쇠 → { from, n, skipped }

  const clean = (v, max) => {
    let s = (v && typeof v === 'object' && typeof v.message === 'string') ? (v.stack || v.message) : String(v == null ? '' : v);
    if(home) s = s.split(home).join('~');
    return s.replace(/\r?\n\s*/g, ' ⏎ ').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max);
  };
  function rotate(f){
    try{
      if(fs.existsSync(f) && fs.statSync(f).size > MAX_BYTES){
        const old = f + '.1';
        try{ if(fs.existsSync(old)) fs.unlinkSync(old); }catch(_){}
        fs.renameSync(f, old);
      }
    }catch(_){}
  }
  /* 적었으면 true · 몰아쳐서 건너뛰었으면 false */
  function write(kind, src, msg){
    const k = KINDS.includes(kind) ? kind : 'ERROR';
    const where = clean(src, 60) || '?';
    const body = clean(msg, MSG_MAX);
    const key = k + '|' + where + '|' + body.slice(0, 120);
    const t = now();
    let r = seen.get(key);
    if(!r || t - r.from > REPEAT_WINDOW_MS){ r = { from: t, n: 0, skipped: r ? r.skipped : 0 }; seen.set(key, r); }
    if(r.n >= REPEAT_MAX){ r.skipped++; return false; }
    r.n++;
    const more = r.skipped ? ' (같은 오류 ' + r.skipped + '번 더 — 적지 않음)' : '';
    r.skipped = 0;
    if(seen.size > 500) seen.clear();   // 열쇠가 끝없이 쌓이지 않게
    try{
      const f = file();
      rotate(f);
      fs.appendFileSync(f, '[' + new Date(t).toISOString() + '] [앱 ' + (o.version || '?') + '] [' + k + '] ' + where + ' · ' + body + more + '\n', 'utf8');
      return true;
    }catch(_){ return false; }
  }
  return { write, file };
}

module.exports = { createErrorLog, FILE, MAX_BYTES, MSG_MAX, REPEAT_MAX, REPEAT_WINDOW_MS, KINDS };
