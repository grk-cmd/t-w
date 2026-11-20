/* device-register.js — 🖥️ 이 PC 등록(계정마다 PC 는 서버가 정한 상한까지) — 켤 때 · «다시 등록» 에서 realtime 보다 먼저 (검사 checks/sim-device-register.js)
   [왜] 한 계정이 쓰는 PC 수는 서버가 정한 상한까지다. 자리는 서버가 정한다(POST /v2/me/devices — 이 PC 의 기기 id · 이번 세션 id · OS).
     다 찬 계정에 새 PC 면 서버가 409 USER_DEVICE_LIMIT 와 «가장 오래 안 쓴 기기» 를 돌려준다 — 그 기기를 지울지 사람에게 묻고(ask),
     [지우고 사용]이면 그 기기 id 를 replaceOldest 로 실어 다시 부른다. 그사이 가장 오래된 기기가 바뀌었으면 서버가 또 409 — 새 기기로 다시 묻는다.
     아무것도 조용히 · 저절로 지우지 않는다. [취소]면 등록하지 않는다(부르는 쪽이 로그인 화면으로).
   [이름] 기기 이름은 OS + 처음 등록한 날(«Windows PC (11월 3일 등록)»), 마지막 사용은 따로. PC 이름(호스트 이름)은 쓰지 않는다 — 사람 이름이 든 경우가 많다.
   [모양] ensure() → 'ok' | 'canceled' | 'failed'. 겹쳐 부르면 같은 약속을 돌려준다. 실패(닿지 못함 · 그 밖의 거절)는 E-ACC-04 한 번.
   classic script — user-api.js 다음 · app.js 보다 먼저 싣는다(window.TwDeviceRegister). 화면(DOM)은 모른다 — 묻는 창은 deps.ask(device-limit-dialog.js). */
(function(){
'use strict';

const OS_NAMES = Object.freeze({ windows: 'Windows PC', mac: 'Mac', linux: 'Linux PC' });   // 그 밖 · 모름은 'PC'
const MAX_ASKS = 5;   // 묻는 사이 가장 오래된 기기가 계속 바뀌는 드문 경우 — 이만큼 물었으면 실패로 끝낸다(끝없이 묻지 않게)

/* 렌더러 navigator → 서버 os 칸('windows' · 'mac' · 'linux' · 'other') — 렌더러에는 process.platform 이 없다 */
function osOf(nav){
  const p = String((nav && nav.platform) || ''), ua = String((nav && nav.userAgent) || '');
  if(/^Win/i.test(p) || /Windows/i.test(ua)) return 'windows';
  if(/^Mac/i.test(p) || /Mac OS X/i.test(ua)) return 'mac';
  if(/Linux/i.test(p) || /Linux/i.test(ua)) return 'linux';
  return 'other';
}
/* ISO 시각 → «11월 3일»(이 PC 시간대) · 못 읽으면 null */
function dateKo(iso){
  const t = Date.parse(String(iso || ''));
  if(!isFinite(t)) return null;
  const d = new Date(t);
  return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}
/* 기기 이름 — «Windows PC (11월 3일 등록)» · 등록한 날을 모르면 «Windows PC» */
function deviceLabel(dev){
  const name = OS_NAMES[dev && dev.os] || 'PC';
  const reg = dateKo(dev && dev.claimedAt);
  return reg ? name + ' (' + reg + ' 등록)' : name;
}
/* 묻는 글 — «가장 오래된 기기 Windows PC (11월 3일 등록) · 마지막 사용 11월 10일 — 이 기기를 지우고 이 PC를 쓸까요?» */
function limitQuestion(oldest){
  const last = dateKo(oldest && oldest.lastSeenAt);
  return '가장 오래된 기기 ' + deviceLabel(oldest) + (last ? ' · 마지막 사용 ' + last : '') + ' — 이 기기를 지우고 이 PC를 쓸까요?';
}

/** @param {{
 *   registerDevice: (o: { deviceId: string, session: string, os: string, replaceOldest?: string }) => Promise<object>,   // user-api.js registerDevice
 *   limitOldestOf: (err: any) => ({ deviceId: string, os: string | null, claimedAt: string | null, lastSeenAt: string | null } | null),   // user-api.js — 409 USER_DEVICE_LIMIT 면 가장 오래된 기기
 *   deviceId: () => string,   // 이 PC 기기 id(device-id.js — API 머리 X-Device-Id · hello.deviceId 와 같은 값)
 *   session: () => string,    // 이번 연결의 세션 id(rt-hub session() — hello.session 과 같은 값)
 *   os: () => string,         // 'windows' · 'mac' · 'linux' · 'other'
 *   ask: (question: string, oldest: object) => Promise<boolean>,   // 묻는 글(limitQuestion) — [지우고 사용] true · [취소] false
 *   notifyError: (code: string, err?: any) => void,
 * }} deps */
function createDeviceRegister(deps){
  let running = null;

  async function run(){
    let replaceOldest = null;
    for(let asks = 0; asks <= MAX_ASKS; asks++){
      const body = { deviceId: deps.deviceId(), session: deps.session(), os: deps.os() };
      if(replaceOldest) body.replaceOldest = replaceOldest;
      try{
        await deps.registerDevice(body);
        return 'ok';
      }catch(e){
        const oldest = deps.limitOldestOf(e);
        if(!oldest){ deps.notifyError('E-ACC-04', e); return 'failed'; }
        if(asks === MAX_ASKS) break;
        let yes = false;
        try{ yes = (await deps.ask(limitQuestion(oldest), oldest)) === true; }catch(_){ yes = false; }
        if(!yes) return 'canceled';
        replaceOldest = oldest.deviceId;   // 보여 준 그 기기만 — 그사이 바뀌었으면 서버가 또 409(새 기기로 다시 묻는다)
      }
    }
    deps.notifyError('E-ACC-04', new Error('가장 오래된 기기가 계속 바뀌어요'));
    return 'failed';
  }
  /* 등록 — 'ok' · 'canceled' · 'failed'. 겹쳐 부르면 같은 약속 */
  function ensure(){
    if(running) return running;
    running = run().finally(() => { running = null; });
    return running;
  }

  return { ensure };
}

const api = { OS_NAMES, MAX_ASKS, osOf, dateKo, deviceLabel, limitQuestion, createDeviceRegister };
if(typeof window !== 'undefined') window.TwDeviceRegister = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
