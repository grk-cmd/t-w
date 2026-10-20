/*
 * 앱 버전을 presence 와 라이선스 요청에 싣는다 — 웹 관리자가 누가 어느 판을 쓰는지 본다.
 * 버전은 preload 의 companion.getAppVersion()(비동기 IPC)으로 한 번만 받는다.
 * companion 이 없거나(웹 · 검사) 실패하거나 모양이 이상하면 get() · ready 는 null(최소 버전 게이트 · 방 서버 · 방문 집계는 «모름» 으로 본다).
 * ⚠️ 그래도 쓰는 객체(withVer)에는 ver 를 **늘** 싣는다 — 모르면 APP_VER_UNKNOWN.
 *   규칙은 presence 에 online:true 인데 ver 가 없으면 옛 앱(≤0.10.2)으로 보고 그 사람의 읽기 · 쓰기를 막는다
 *   (ver 없는 오프라인 쓰기도 inRoom 이 있으면 거절). 버전이 늦거나 못 받았다고 ver 를 빼면 지금 앱이 옛 앱으로 막힌다.
 *   받기 전에 쓴 것은 받은 뒤 onReady 가 진짜 버전으로 메운다.
 *
 * deps: getVersion() — 버전 문자열(또는 그 Promise), onReady(ver) — 처음 받았을 때 한 번
 */
// 규칙(users/$userId/presence/ver · licenseRequests/$reqId)의 길이 상한과 같다.
export const APP_VER_MAX = 20;
// 버전을 아직 모르거나 못 받았을 때 싣는 값 — 규칙은 «있는지» 만 본다. 길이 · 글자는 cleanAppVer 를 통과하는 모양.
export const APP_VER_UNKNOWN = 'unknown';

export function cleanAppVer(v){
  return (typeof v === 'string' && v.length <= APP_VER_MAX && /^[0-9A-Za-z.+-]+$/.test(v)) ? v : null;
}

export function createAppVersion(deps){
  const { getVersion, onReady } = deps;
  let ver = null;

  const ready = (async ()=>{
    try{ ver = cleanAppVer(await getVersion()); }catch(_){ ver = null; }
    if(ver && typeof onReady === 'function'){ try{ onReady(ver); }catch(_){} }
    return ver;
  })();

  // 쓰는 객체에 ver 를 붙인다. 아직 모르거나 못 받았으면 APP_VER_UNKNOWN — 받은 뒤 onReady 가 진짜 버전으로 메운다.
  function withVer(obj){ return { ...obj, ver: ver || APP_VER_UNKNOWN }; }

  return { get: ()=>ver, ready, withVer };
}
