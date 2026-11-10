/* error-report.js — 🧯 렌더러 오류를 오류 기록 파일(tw-error.log)로 (검사 sim-error-log.js)
   [왜] 설치본은 개발자 도구가 막혀 있어, 화면에서 난 오류(잡히지 않은 오류 · 처리 안 된 Promise 거절 · console.error / warn)를
     제보로 받을 길이 없었다. 여기서 모아 main 의 오류 기록(error-log.js)으로 보낸다 — 줄 모양 · 몰아칠 때 거르기 · 파일 크기는 main 이 정한다.
   ・install(win, send): window 의 error · unhandledrejection 을 듣고 console.error · console.warn 을 감싼다(원래 출력은 그대로).
   ⚠️ 에러코드 알림(TwErrorCodes.notify)은 스스로 CODE 로 보낸다 — 그 알림이 함께 찍는 console.warn('[오류] E-…') 는 여기서 다시 보내지 않는다.
   ⚠️ 보내다 다시 오류가 나도 되돌아 들어오지 않게(무한 반복) 보내는 동안은 막는다.
   ⚠️ 가장 먼저 싣는다 — 다른 스크립트가 실리다 난 오류도 잡게.
   window.TwErrorReport = { install(win, send, now?), format(args) } */
(function(){
'use strict';

const PART_MAX = 300;          // 인자 하나 글자 상한(큰 객체가 통째로 가지 않게)
const SAME_MS = 10000;         // 같은 줄은 이 안에 한 번만 보낸다 — 매 프레임 찍는 경고가 IPC 를 채우지 않게(파일 쪽 거르기는 main)
const CODE_PREFIX = '[오류] E-';

function one(v){
  if(v == null) return String(v);
  if(typeof v === 'string') return v;
  if(v && typeof v === 'object' && typeof v.message === 'string') return v.stack || (v.name + ': ' + v.message);
  try{ return JSON.stringify(v).slice(0, PART_MAX); }catch(_){ return String(v); }
}
function format(args){
  return Array.prototype.map.call(args || [], (v) => one(v).slice(0, PART_MAX)).join(' ');
}
function install(win, send, now){
  const clock = now || (() => Date.now());
  if(!win || !send || win.__twErrorReport) return false;
  win.__twErrorReport = true;
  let busy = false;
  const last = new Map();
  const post = (kind, src, msg) => {
    if(busy) return;
    const key = kind + '|' + src + '|' + String(msg).slice(0, 120), t = clock();
    if(last.has(key) && t - last.get(key) < SAME_MS) return;
    if(last.size > 200) last.clear();
    last.set(key, t);
    busy = true;
    try{ send({ kind, src, msg }); }catch(_){}
    busy = false;
  };
  win.addEventListener('error', (e) => {
    const where = e && e.filename ? String(e.filename).split('/').pop() + ':' + (e.lineno || 0) : '창';
    post('ERROR', where, (e && e.error) ? one(e.error) : (e && e.message) || '알 수 없는 오류');
  });
  win.addEventListener('unhandledrejection', (e) => { post('ERROR', '처리 안 된 Promise', one(e && e.reason)); });
  const c = win.console;
  if(c){
    ['error', 'warn'].forEach((name) => {
      const orig = c[name];
      c[name] = function(...args){
        try{ orig.apply(c, args); }catch(_){}
        if(typeof args[0] === 'string' && args[0].indexOf(CODE_PREFIX) === 0) return;   // 에러코드 알림은 CODE 로 따로 간다
        post(name === 'error' ? 'ERROR' : 'WARN', 'console.' + name, format(args));
      };
    });
  }
  return true;
}

const api = { install, format, PART_MAX, SAME_MS, CODE_PREFIX };
if(typeof window !== 'undefined'){
  window.TwErrorReport = api;
  if(window.companion && window.companion.errorLog) install(window, (p) => window.companion.errorLog(p));
}
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
