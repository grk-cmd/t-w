/*
 * 앱 버전을 presence 와 라이선스 요청에 싣는다 — 웹 관리자가 누가 어느 판을 쓰는지 본다.
 * 버전은 preload 의 companion.getAppVersion()(비동기 IPC)으로 한 번만 받는다.
 * companion 이 없거나(웹 · 검사) 실패하거나 모양이 이상하면 null — 그때는 ver 를 싣지 않는다(옛 앱과 같은 모양).
 *
 * deps: getVersion() — 버전 문자열(또는 그 Promise), onReady(ver) — 처음 받았을 때 한 번
 */
// 규칙(users/$userId/presence/ver · licenseRequests/$reqId)의 길이 상한과 같다.
export const APP_VER_MAX = 20;

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

  // 통째로 쓰는(set) 객체에 ver 를 붙인다. 아직 모르면 그대로 — 받은 뒤 onReady 가 메운다.
  function withVer(obj){ return ver ? { ...obj, ver } : obj; }

  return { get: ()=>ver, ready, withVer };
}
