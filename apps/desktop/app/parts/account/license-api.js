/* license-api.js — 🔑 라이선스 provider — 내 라이선스 · 기기 · 라이선스 요청 서버 길(/v1/me/license*) 한 벌 (검사 sim-license-api.js)
   [왜] 프리미엄은 «이 계정 + 이 기기가 등록돼 있음 + 키 유효» 를 서버가 판정한다(GET /v1/me 의 premium). 키 · 기기 목록은 서버가 들고,
     화면 · 흐름(license-premium.js)은 경로 · 본문 모양 · 오류 code 를 모르고 이 파일의 함수만 부른다.
   [모양] 모두 Promise. 성공은 서버 data(모양을 맞춘 값), 실패는 api-client.js 의 ApiError 그대로 던진다(«실패 ≠ 없음»).
     mine() 은 라이선스가 없는 계정이면 null(없음 ≠ 못 읽음).
   [신원] 토큰뿐 — 경로의 기기 id 는 기기 칸 이름일 뿐이다. 쓰기는 «읽은 토큰 주인» 과 묶는다: mine() 이 주인을 기억하고,
     register · putDevice · removeDevice 는 expectOwner 로 보낸다(읽은 적이 없으면 NOT_READ — 요청 0). 로그인한 사람이 그 사이 바뀌었으면 OWNER_CHANGED(요청 0).
   [기기 이름] 서버는 1~40자 일반 이름만 받는다(컴퓨터 이름은 보내지 않는다) — deviceNameOf(userAgent) 가 «Windows PC» · «Mac» 로 정한다.
   classic script — api-client.js 다음 · license-premium.js · app.js 보다 먼저 싣는다(window.TwLicenseApi). Firebase 를 모른다. */
(function(){
'use strict';

const PATHS = Object.freeze({
  mine: '/v1/me/license',
  device: (id) => '/v1/me/license/devices/' + encodeURIComponent(id),
  application: '/v1/me/license-requests',
});
const DEVICE_NAME_MAX = 40;   // 서버 상한 — 넘기면 400
const STATUS = Object.freeze({ VALID: 'VALID', REVOKED: 'REVOKED' });
/* 서버 오류 code(계약) — 흐름이 갈래를 가를 때 쓴다 */
const CODE = Object.freeze({ DEVICE_FULL: 'LICENSE_DEVICE_FULL', NOT_FOUND: 'LICENSE_NOT_FOUND', REVOKED: 'LICENSE_REVOKED',
  OWNED_BY_OTHER: 'LICENSE_OWNED_BY_OTHER', ALREADY_HAVE: 'LICENSE_ALREADY_HAVE', NOT_READ: 'NOT_READ' });

/* 서버 code → 키 입력 화면 한 줄. 서버 message 로 가르지 않는다(code 가 계약). */
const REASONS = Object.freeze({
  [CODE.NOT_FOUND]: '등록되지 않은 키예요 — 키를 다시 확인해 주세요',
  [CODE.REVOKED]: '사용이 중지된 키예요',
  [CODE.OWNED_BY_OTHER]: '이미 다른 계정에 등록된 키예요',
  [CODE.ALREADY_HAVE]: '이 계정에는 이미 라이선스가 있어요',
  [CODE.DEVICE_FULL]: '등록할 수 있는 기기를 모두 썼어요 — 다른 기기를 빼고 다시 해 주세요',
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : '');
const shapeError = () => Object.assign(new Error('응답 모양이 달라요'), { code: 'SHAPE' });

/* 이 기기의 일반 이름 — 컴퓨터 이름을 서버에 보내지 않는다. 같은 종류가 여러 대면 이름이 같다(마지막 사용 시각으로 구분) */
function deviceNameOf(userAgent){
  const ua = String(userAgent || '');
  if(/Windows/i.test(ua)) return 'Windows PC';
  if(/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  return '내 기기';
}

/* 서버 MyLicense → 앱 모양. 꼭 있어야 할 칸(licenseId · status · devices)이 없으면 undefined(받은 값을 믿지 않는다).
   premium(이 기기 판정 — 쓰기 뒤의 값) · deviceLimit(기기 상한 — 앱에 숫자를 박지 않는다)은 모양이 틀리거나 없으면 null(«모름» — 부르는 쪽이 다시 묻는다). */
function licenseFrom(d){
  if(!isObj(d) || !str(d.licenseId) || !Array.isArray(d.devices)) return undefined;
  const status = d.status === STATUS.VALID ? STATUS.VALID : d.status === STATUS.REVOKED ? STATUS.REVOKED : '';
  if(!status) return undefined;
  const devices = [];
  for(const x of d.devices){
    if(!isObj(x) || !str(x.deviceId)) return undefined;
    devices.push({ deviceId: x.deviceId, name: str(x.name), registeredAt: str(x.registeredAt), lastSeenAt: str(x.lastSeenAt) });
  }
  const premium = typeof d.premium === 'boolean' ? d.premium : null;
  const deviceLimit = Number.isInteger(d.deviceLimit) && d.deviceLimit > 0 ? d.deviceLimit : null;
  return { licenseId: d.licenseId, status, devices, premium, deviceLimit };
}
function applicationFrom(d){
  if(!isObj(d) || !str(d.name)) return undefined;
  return { name: d.name, status: d.status === 'APPROVED' ? 'APPROVED' : 'PENDING' };
}

/** @param {{ authed: { get: Function, post: Function, put: Function, del: Function } }} deps
 *   authed 는 로그인 API 통로(TwApi.authed — get(path, { auth: true, onOwner }) · post · put · del(…, { expectOwner }) → Promise<data>) */
function createLicenseApi(deps){
  const authed = deps.authed;
  let owner = null;   // 마지막으로 mine() 을 읽을 때 쓴 토큰의 주인 — 쓰기를 여기 묶는다

  async function write(send){
    if(!owner) throw Object.assign(new Error('내 라이선스를 읽기 전이에요'), { kind: 'auth', code: CODE.NOT_READ });
    return send({ expectOwner: owner });
  }
  async function licenseOrThrow(p){
    const l = licenseFrom(await p);
    if(!l) throw shapeError();
    return l;
  }

  /* 내 라이선스 → { licenseId, status, devices:[{deviceId,name,registeredAt,lastSeenAt}], premium, deviceLimit } · 라이선스가 없으면 null */
  async function mine(){
    const d = await authed.get(PATHS.mine, { auth: true, onOwner: (who) => { owner = who; } });
    if(d === null || d === undefined) return null;
    return licenseOrThrow(d);
  }
  /* 키 등록 — 키는 본문으로만. 같은 계정이 같은 키를 다시 등록하면 기기만 갱신(멱등) */
  async function register(key, device){
    return write((o) => licenseOrThrow(authed.post(PATHS.mine, { key: String(key || ''), device: { id: String(device.id), name: String(device.name) } }, o)));
  }
  /* 이 기기를 등록 기기로(이미 있으면 이름 · 마지막 사용 시각만) */
  async function putDevice(deviceId, name){
    return write((o) => licenseOrThrow(authed.put(PATHS.device(deviceId), { name: String(name) }, o)));
  }
  /* 기기 빼기(없는 기기도 그대로 — 같은 요청 두 번) */
  async function removeDevice(deviceId){
    return write((o) => licenseOrThrow(authed.del(PATHS.device(deviceId), o)));
  }
  /* 내 최근 라이선스 요청 → { name, status:'PENDING'|'APPROVED' } · 없으면 null. 승인된 키는 여기 없다(우편함으로 간다) */
  async function myApplication(){
    const d = await authed.get(PATHS.application, { auth: true });
    if(d === null || d === undefined) return null;
    const a = applicationFrom(d);
    if(!a) throw shapeError();
    return a;
  }
  /* 라이선스 요청 보내기 — requestId 는 같은 요청을 두 번 보내도 한 번만 되게 하는 번호(request-id.js) */
  async function apply(requestId, name){
    await authed.post(PATHS.application, { requestId: String(requestId), name: String(name) });
    return true;
  }
  function reasonOf(err){
    const code = String((err && err.code) || '');
    return Object.prototype.hasOwnProperty.call(REASONS, code) ? REASONS[code] : null;   // 표에 없으면 null — 부르는 쪽이 공통 문구(user-api reasonOf)로
  }

  return { mine, register, putDevice, removeDevice, myApplication, apply, reasonOf };
}

const out = { PATHS, STATUS, CODE, REASONS, DEVICE_NAME_MAX, deviceNameOf, licenseFrom, applicationFrom, createLicenseApi };
if(typeof window !== 'undefined'){
  /* 앱 한 벌 — 통로는 부를 때 찾는다(싣는 차례가 바뀌어도 만들 때 던지지 않게) */
  out.store = createLicenseApi({ authed: {
    get: (...a) => window.TwApi.authed.get(...a), post: (...a) => window.TwApi.authed.post(...a),
    put: (...a) => window.TwApi.authed.put(...a), del: (...a) => window.TwApi.authed.del(...a),
  } });
  window.TwLicenseApi = out;
}
if(typeof module !== 'undefined' && module.exports) module.exports = out;
})();
