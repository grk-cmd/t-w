/*
 * 방 서버 문지기 — 이 방을 방 서버로 열지 · 들어갈지, 어느 서버로 갈지를 정한다.
 * 실제 웹소켓은 room-server-net.js, 화면 쪽은 app.js _startRoomOnServer. Firebase 를 직접 부르지 않는다
 * (firebase-init.js 가 read(path) 를 넘긴다).
 *
 * 관리자 스위치 — RTDB config/roomServer (웹 관리자 ⚙️ 설정 «방 서버(시험)»):
 *   on      : true 일 때만 아래가 동작한다. 아니면 전원 Firebase(비상 정지 스위치).
 *             켜져 있으면 허용 목록에 없는 사람도 «서버에 있는 방» 코드로 들어갈 때 늘 그 서버로 따라간다 —
 *             안 따라가면 Firebase 의 «같은 코드 다른 방» 에 들어가 서로 못 본다. (예전 follow 칸은 더 읽지 않는다.)
 *   servers : { <서버 이름>: 'wss://…' } — 주소가 KNOWN_SERVER_URLS(= CSP connect-src) 에 없으면 무시.
 *   allow   : { <사용자 코드>: <서버 이름> } — 이 사람이 방을 «만들면» 그 서버에 연다.
 *   default · defaultPercent : 허용 목록에 없는 사람도 이 비율(0~100 정수)만큼 default 서버에 방을 연다.
 *             누가 들어가는지는 사용자 코드의 해시(userBucket 0~99)로 정해서, 비율이 같으면 늘 같은 사람이 같은 쪽이고
 *             비율을 올리면 사람이 더해지기만 한다. 앱 릴리스 없이 관리자가 10 → 50 → 100 으로 넓힌다.
 *             허용 목록에 있는 사람은 늘 그쪽이 먼저. 비율 안의 사람은 허용된 사람과 똑같이 다룬다(«내 서버» · peek).
 * 방 주소록 — roomDir/{방 코드} = { srv: <서버 이름>, ts }. 방 서버가 방을 열 때 쓰고 닫을 때 지운다(앱은 읽기만).
 *
 * 읽는 양: 입장 한 번에 on(+ allow/{내 코드} · roomDir/{방 코드} · default · defaultPercent) 칸 몇 개 + servers/{이름} 한 칸.
 *   목록(allow · servers · roomDir)을 통째로 읽지 않는다 — 규칙도 칸 단위로만 열려 있다.
 * 읽기가 실패하면 «없음» 으로 보고 Firebase 로 간다(입장을 막지 않는다).
 */
export const ROOM_SERVER_CFG = 'config/roomServer';
export const ROOM_DIR_ROOT = 'roomDir';
// 운영 · dev 방 서버 — desk-companion-prototype.html CSP connect-src 와 같은 주소여야 한다.
export const ROOM_SERVER_URLS = {
  prod: 'wss://rooms.togetherworking.duckdns.org',
  dev: 'wss://rooms-dev.togetherworking.duckdns.org',
};
// 로컬 시험용 — dev 환경(--tw-firebase=dev)에서만 받는다. 운영 앱은 CSP 에 있어도 여기로 붙지 않는다.
export const LOCAL_SERVER_URLS = ['ws://127.0.0.1:8787', 'ws://localhost:8787'];
export const SERVER_NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
// 개발용 켜기(dev 환경에서만) — 관리자 스위치 없이 이 PC 만 «허용» 으로 · 주소는 tw.roomServerUrl.
export const ROOM_SERVER_FLAG_KEY = 'tw.roomServer';
export const ROOM_SERVER_URL_KEY = 'tw.roomServerUrl';
const SERVERS_CACHE_MS = 5 * 60 * 1000;

const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');

/* 사용자 코드 → 0~99 칸(FNV-1a 32비트). 순수 함수 — 같은 코드는 어느 PC · 어느 버전에서도 같은 칸이다.
   서버 이름을 섞지 않는다: 기본 서버를 바꿔도 비율 안의 사람이 그대로여야 한다. */
export function userBucket(uid){
  const s = String(uid || '');
  let h = 0x811c9dc5;
  for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % 100;
}

/* defaultPercent 칸 → 0~100 정수. 형식이 틀리면 0(아무도 안 감). */
export function defaultPercentOf(v){
  return (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100) ? v : 0;
}

/* 비율 안인가 — 칸이 percent 보다 작으면. 0 이면 아무도, 100 이면 모두. */
export const inDefaultPercent = (uid, percent) => !!uid && userBucket(uid) < defaultPercentOf(percent);

/* 이 환경의 앱이 붙어도 되는 주소인가 — 운영 앱은 운영 주소만, dev 앱은 dev 주소 + 로컬. */
export function serverUrlOk(url, env){
  const u = trimUrl(url);
  if(!u) return false;
  if(env === 'dev') return u === ROOM_SERVER_URLS.dev || LOCAL_SERVER_URLS.indexOf(u) >= 0;
  return u === ROOM_SERVER_URLS.prod;
}

/* dev 환경의 개발용 켜기 — { url } 또는 null. 운영 앱에서는 늘 null. */
export function devOverride(env, storage){
  if(env !== 'dev' || !storage) return null;
  try{
    if(storage.getItem(ROOM_SERVER_FLAG_KEY) !== '1') return null;
    const o = trimUrl(storage.getItem(ROOM_SERVER_URL_KEY));
    const url = o || ROOM_SERVER_URLS.dev;
    return serverUrlOk(url, env) ? { url } : null;
  }catch(_){ return null; }
}

export const roomDirPath = (code) => ROOM_DIR_ROOT + '/' + code;

/* deps: read(path) → Promise<값 | null>, getUserId() → 문자열 | null, env 'prod' | 'dev', storage, now() */
export function createRoomServerGate(deps){
  const now = deps.now || (() => Date.now());
  const env = deps.env === 'dev' ? 'dev' : 'prod';
  const serverCache = {};   // 이름 → { url | null, until }
  let mine = null;          // 마지막으로 확인한 «내가 만들 때 쓸 서버» { name, url } | null — 방 개수 · 랜덤에 쓴다

  const read = async (path) => { try{ const v = await deps.read(path); return v === undefined ? null : v; }catch(_){ return null; } };
  const myId = () => { try{ return deps.getUserId() || null; }catch(_){ return null; } };

  /* 서버 이름 → 주소. 표에 없거나 낯선 주소면 null. */
  async function serverUrl(name){
    if(typeof name !== 'string' || !SERVER_NAME_RE.test(name)) return null;
    const c = serverCache[name];
    if(c && c.until > now()) return c.url;
    const v = await read(ROOM_SERVER_CFG + '/servers/' + name);
    const url = (typeof v === 'string' && serverUrlOk(v, env)) ? trimUrl(v) : null;
    serverCache[name] = { url, until: now() + SERVERS_CACHE_MS };
    return url;
  }

  /* 이 방을 어디로 — { via:'server', url, server, from } | { via:'firebase', why }
       from 'allow' = 허용 목록 · 'default' = 기본 서버 비율 · 'dir' = 주소록을 따라감 · 'dev' = 개발용 켜기
     ★ «어디에 물어볼지» 는 이 함수 하나다. 서버가 여러 대가 돼도 바뀌는 곳은 여기뿐이다. */
  async function resolveRoomServer(code, opts){
    const creating = !!(opts && opts.creating);
    const dev = devOverride(env, deps.storage);
    if(dev){ mine = { name: 'dev', url: dev.url, from: 'dev' }; return { via: 'server', url: dev.url, server: 'dev', from: 'dev' }; }
    const uid = myId();
    const on = await read(ROOM_SERVER_CFG + '/on');
    if(on !== true){ mine = null; return { via: 'firebase', why: 'off' }; }
    // 비율 두 칸은 허용 목록과 같이 읽는다(입장이 한 번 더 기다리지 않게 · 둘 다 작은 칸)
    const [allowName, dir, defName, defPct] = await Promise.all([
      uid ? read(ROOM_SERVER_CFG + '/allow/' + uid) : Promise.resolve(null),
      (creating || !code) ? Promise.resolve(null) : read(roomDirPath(code)),
      uid ? read(ROOM_SERVER_CFG + '/default') : Promise.resolve(null),
      uid ? read(ROOM_SERVER_CFG + '/defaultPercent') : Promise.resolve(null),
    ]);
    const myUrl = (typeof allowName === 'string') ? await serverUrl(allowName) : null;
    mine = myUrl ? { name: allowName, url: myUrl, from: 'allow' } : null;
    // 허용 목록에서 서버를 못 얻었으면 기본 서버 · 비율 — 표에 없는 이름 · 낯선 주소면 Firebase
    if(!mine && typeof defName === 'string' && inDefaultPercent(uid, defPct)){
      const du = await serverUrl(defName);
      if(du) mine = { name: defName, url: du, from: 'default' };
    }
    // 이미 서버에 있는 방 — 누구든 주소록이 가리키는 서버로 따라간다(서버가 거절하면 app.js 가 Firebase 로)
    if(!creating && dir && typeof dir.srv === 'string'){
      const url = await serverUrl(dir.srv);
      if(url) return { via: 'server', url, server: dir.srv, from: 'dir' };
    }
    /* 칸이 없으면 «아직 서버에 없는 방» 으로 본다. 서버는 재시작해도 칸을 지우지 않고(되살릴 후보) 빈틈은 쓰기 실패뿐이라,
       따라가는 사람까지 서버에 peek 하러 붙게 하지 않는다(입장마다 웹소켓이 생긴다). 허용된 사람 · 비율 안의 사람만 자기 서버에 peek(app.js). */
    if(mine) return { via: 'server', url: mine.url, server: mine.name, from: mine.from };
    return { via: 'firebase', why: creating ? 'notAllowed' : 'noDir' };
  }

  /* 방 개수 · 랜덤 입장 전에 «내 서버» 만 다시 확인(on · allow/{내 코드} · default · defaultPercent). 방 코드가 없어 주소록은 안 본다. */
  async function refreshMine(){
    await resolveRoomServer(null, { creating: true });
    return mine;
  }

  return { resolveRoomServer, refreshMine, mine: () => mine, serverUrl };
}
