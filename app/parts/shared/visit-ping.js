/*
 * IP 기준 일일 방문자 — 앱이 켜질 때 서버 함수 visitPing 을 한 번 부른다(functions/visit-ping.js).
 * 로그인하지 않은 사람도 센다. 서버가 IP 를 해시로만 적으므로 여기서는 버전 말고 아무것도 보내지 않는다.
 * 지표가 앱을 막으면 안 된다 — 부팅이 붐비는 때를 피해 조금 뒤에 부르고, 어떤 실패도 삼키며, 다시 시도하지 않는다.
 *
 * deps: callPing(data) → Promise, getVersion() — 버전(또는 그 Promise · 없으면 null), delayMs, win(setTimeout 을 가진 것 · 검사용)
 */
export const VISIT_PING_DELAY_MS = 8000;
// firebase-init 이 다시 세워져도(감시견 재시도) 한 번만 부르게 창에 표시를 남긴다.
export const VISIT_PING_FLAG = '__twVisitPingStarted';

export function createVisitPing(deps){
  const { callPing, getVersion } = deps;
  const delayMs = typeof deps.delayMs === 'number' ? deps.delayMs : VISIT_PING_DELAY_MS;
  const win = deps.win || window;

  async function ping(){
    try{
      let ver = null;
      try{ ver = await getVersion(); }catch(_){ ver = null; }
      await callPing(typeof ver === 'string' && ver ? { ver } : {});
    }catch(_){ /* 함수 배포 전 · 오프라인 · CSP 차단 — 지표만 빠진다 */ }
  }

  // 한 프로세스에 한 번. 두 번째부터는 아무것도 안 한다.
  function start(){
    if(win[VISIT_PING_FLAG]) return false;
    win[VISIT_PING_FLAG] = true;
    try{ win.setTimeout(()=>{ ping(); }, delayMs); }catch(_){}
    return true;
  }

  return { start };
}
