/* app-version-sync.js — 🔄 계정 단위 판 맞추기 — 켤 때 이 앱 판을 서버에 알리고, 더 새 판을 쓰는 기기가 있으면 업데이트 안내로 막는다 (검사 sim-app-version-sync.js)
   [왜] 같은 사람이 기기마다 다른 판을 쓰면 옛 판의 맞추기 장치가 서버 값을 덮는다. 한 사람이 한 PC 에서 업데이트하면 그 사람의 다른 PC 도 업데이트해야 쓰게 한다.
   [모양] report() → Promise<{ state }> — 'behind' 만 막은 것이다.
     POST /v2/me/app-version { version } → { highest, behind }. 계정은 로그인 토큰으로 서버가 정한다(본문 · 경로에 코드를 싣지 않는다).
     behind 가 참이면 block(my, highest) 로 업데이트 안내 화면을 띄운다(화면은 shared/app-version-gate.js 의 것).
   [막지 않는 때] 서버에 못 닿음 · 로그인 안 됨 · 가입 전 계정(401) · 이 앱 판을 모름 · 응답 모양이 다름 → 알리지 못한 채 그냥 쓴다
     (잘못 막는 쪽이 더 크다 — 켜는 길을 서버에 묶지 않는다). 다시 보내지 않는다 — 다음에 켤 때 다시 알린다.
   ⚠️ 판 비교는 서버가 한다. 앱은 behind 만 믿는다(판 순서 규칙을 두 곳에 두지 않는다).
   classic script — api-client.js 다음 · app.js 보다 먼저 싣는다(window.TwAppVersionSync). Firebase 를 모른다. */
(function(){
'use strict';

const PATH = '/v2/me/app-version';
const STATE = Object.freeze({ BEHIND: 'behind', OK: 'ok', SKIPPED: 'skipped' });
const VER_RE = /^[0-9A-Za-z.+-]{1,20}$/;   // 서버가 받는 판 글자 · 길이(앱 판 모양) — 틀리면 요청 없이 건너뛴다

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** @param {{ authed: { post: (path: string, body: object) => Promise<any> }, getVersion: () => Promise<string | null> | string | null,
 *   block: (my: string, highest: string) => void, warn: (...a: any[]) => void }} deps
 *   authed = 로그인 API 통로(TwApi.authed) · getVersion = 이 앱 판(preload companion.getAppVersion) · block = 업데이트 안내 화면 띄우기 */
function createAppVersionSync(deps){
  const authed = deps.authed;
  const getVersion = deps.getVersion;
  const block = deps.block;
  const warn = deps.warn;

  async function report(){
    let my = null;
    try{ my = await getVersion(); }catch(_){ my = null; }
    if(typeof my !== 'string' || !VER_RE.test(my)) return { state: STATE.SKIPPED, why: 'no-version' };
    let data;
    try{ data = await authed.post(PATH, { version: my }); }
    catch(e){ warn('[판 맞추기] 알리지 못해 건너뜀', (e && (e.code || e.kind || e.message)) || e); return { state: STATE.SKIPPED, why: 'request-failed' }; }
    if(!isObj(data) || typeof data.behind !== 'boolean' || typeof data.highest !== 'string' || !data.highest){
      warn('[판 맞추기] 응답 모양이 달라 건너뜀');
      return { state: STATE.SKIPPED, why: 'shape' };
    }
    if(!data.behind) return { state: STATE.OK };
    block(my, data.highest);
    return { state: STATE.BEHIND, my, highest: data.highest };
  }

  return { report };
}

const api = { createAppVersionSync, PATH, STATE };
if(typeof window !== 'undefined') window.TwAppVersionSync = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
