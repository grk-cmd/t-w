/* http-cache-reset.js — 🧹 앱 버전이 바뀐 뒤 처음 켤 때 웹(HTTP) 캐시를 한 번 비운다 · main.js 가 쓴다
   [왜] 웹 캐시에 깨진 응답(오류 본문)이 남으면 같은 주소를 서버에 다시 묻지 않고 그 깨진 것을 계속 꺼낸다 —
     꾸미기 썸네일 엑박 · 책상 · 장신구 못 받음(E-CHAR-14)이 그렇게 났다(앱 연결 기록으로 확인). 업데이트하면 저절로 풀리게 한다.
   ⚠️ 비우는 것은 웹 캐시뿐 — 로그인 · 설정(localStorage) · 모델 저장본(IndexedDB) · 설정 파일은 그대로다.
   ⚠️ 못 비우면 표시를 남기지 않는다(다음 실행에 다시 해 본다). 오래 걸려도 창 띄우기를 붙잡지 않게 기다리는 시간에 상한을 둔다.
   createHttpCacheReset({ fs, path, dir, version, session, log, waitMs }) → { needed(), run() }
   검사: checks/sim-http-cache-reset.js */
'use strict';

const MARK = 'http-cache-ver';        // userData 안 — 마지막으로 웹 캐시를 비운 앱 버전
const WAIT_MS = 3000;

function createHttpCacheReset(o){
  const file = o.path.join(o.dir, MARK);
  const log = o.log || (()=>{});
  function lastVersion(){ try{ return String(o.fs.readFileSync(file, 'utf8')).trim(); }catch(_){ return ''; } }
  function needed(){ return !!o.version && lastVersion() !== String(o.version); }
  async function clear(){
    await o.session.clearCache();
    try{ o.fs.writeFileSync(file, String(o.version)); }catch(_){}
    log('[캐시] 앱 버전이 바뀌어 웹 캐시를 비움 → ' + o.version);
    return true;
  }
  /* 돌려받는 값: true = 비움 · false = 할 필요 없음 · 'fail' = 못 비움 · 'timeout' = 기다리기를 그만둠(뒤에서 마저 끝날 수 있다) */
  function run(){
    if(!needed()) return Promise.resolve(false);
    const wait = (typeof o.waitMs === 'number') ? o.waitMs : WAIT_MS;
    const job = clear().catch((e)=>{ log('[캐시] 웹 캐시를 비우지 못함 — ' + ((e && e.message) || e)); return 'fail'; });
    return Promise.race([job, new Promise((res)=>setTimeout(()=>res('timeout'), wait))]);
  }
  return { needed, run };
}

module.exports = { createHttpCacheReset, MARK, WAIT_MS };
