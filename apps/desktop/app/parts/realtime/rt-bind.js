/* rt-bind.js — realtime 연결 만들기를 rt-hub 에 잇는다(한 번).
   책임: 연결 공통부(realtime-link.js · ES 모듈)와 토큰 · 버전 출처를 rt-hub.js(classic script)에 건넨다. 켜기(start) · 끄기는 로그인 흐름 몫.
   ES 모듈이라 classic script(app.js)가 realtime-link.js 를 못 불러 이 파일이 대신 건다. html 에서 type="module" 로 firebase-init.js 다음에 싣는다.
   토큰은 로그인(Auth) 창구 firebaseAPI.getIdToken — 연결을 만들 때 부르므로 이 파일이 먼저 돌아도 된다. */
import { createRealtimeLink } from "./realtime-link.js";
import { createAppVersion } from "../shared/app-version.js";

const appVer = createAppVersion({
  getVersion: () => (window.companion && window.companion.getAppVersion) ? window.companion.getAppVersion() : null,
});
window.TwRtHub.store.bind({
  createLink: createRealtimeLink,
  getToken: (force) => window.firebaseAPI.getIdToken(force),
  getVersion: () => appVer.ready,
});
