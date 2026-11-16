/*
 * 앱 버전 — preload 의 companion.getAppVersion()(비동기 IPC)을 한 번만 받는다. realtime 연결의 hello 가 싣는다(realtime/rt-bind.js).
 * companion 이 없거나(웹 · 검사) 실패하거나 모양이 이상하면 ready 는 null(최소 버전 게이트 · 방 서버는 «모름» 으로 본다).
 *
 * deps: getVersion() — 버전 문자열(또는 그 Promise)
 */
// 서버 hello 의 ver 길이 상한과 같다.
export const APP_VER_MAX = 20;

export function cleanAppVer(v){
  return (typeof v === 'string' && v.length <= APP_VER_MAX && /^[0-9A-Za-z.+-]+$/.test(v)) ? v : null;
}

export function createAppVersion(deps){
  const { getVersion } = deps;
  const ready = (async ()=>{
    try{ return cleanAppVer(await getVersion()); }catch(_){ return null; }
  })();
  return { ready };
}

/* 앱 한 벌에 하나 — 버전 IPC 를 한 번만 부른다. */
let _shared = null;
export function sharedAppVersion(win){
  if(!_shared) _shared = createAppVersion({ getVersion: () => (win.companion && win.companion.getAppVersion) ? win.companion.getAppVersion() : null });
  return _shared;
}
