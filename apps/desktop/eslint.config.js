/* eslint.config.js — 앱(apps/desktop) «우리 안티패턴 금지» 린트. 안내 docs/LINT.md · 검사 checks/sim-lint.js
   ★ 모양(스타일) 규칙 · 기본 추천 규칙은 켜지 않는다 — 아래 금지 규칙만. 렌더러는 classic script 라 전역이 많아
     «정의 안 된 변수» 같은 규칙은 소음만 낸다.
   ★ 지금 있는 위반은 eslint-suppressions.json 에 얼려 두었다(새 위반만 빨강). 고쳐서 줄면 `npm run lint:prune`.
   ★ 금지마다 이름을 따로 단다(tw/…). 몸은 내장 no-restricted-syntax 그대로고 이름만 다르다 — 억제 파일은
     «파일 × 규칙 이름» 으로 개수를 세서, 한 이름에 몰면 타이머 하나를 지우고 firebaseAPI 하나를 더해도 통과한다.
   ⚠️ 파일 경로는 이 파일 자리(apps/desktop) 기준이다. 루트에서는 `npm run lint`. */
'use strict';

const { builtinRules } = require('eslint/use-at-your-own-risk');
const restrict = builtinRules.get('no-restricted-syntax');

/* ── 금지 선택자 ─────────────────────────────────────────────────────────── */

const call = (name) => [
  `CallExpression[callee.type='Identifier'][callee.name='${name}']`,
  `CallExpression[callee.type='MemberExpression'][callee.object.name=/^(window|globalThis|self)$/][callee.property.name='${name}']`,
];

/* a. 렌더러의 타이머로 순서 맞추기 */
const NO_TIMER = [
  ...call('setTimeout').map((selector) => ({ selector,
    message: 'setTimeout 으로 순서를 맞추지 마세요 — 준비 알림(이벤트 · Promise · 모듈의 on…)을 받으세요. 시간 자체가 규칙이면(지연 표시 등) 이름 붙은 상수로 두고 PR «왜» 에 까닭을 적은 뒤 기준선에 올립니다.' })),
  ...call('requestAnimationFrame').map((selector) => ({ selector,
    message: 'requestAnimationFrame 으로 «한 프레임 뒤면 되겠지» 를 하지 마세요 — 레이아웃 · 준비 알림을 받으세요. 그리기 루프처럼 꼭 필요하면 PR «왜» 에 까닭을 적은 뒤 기준선에 올립니다.' })),
];

/* b. 도메인 모듈에서 firebaseAPI 직접 부르기 */
const NO_FIREBASE_API = [
  { selector: "Identifier[name='firebaseAPI']:not(MemberExpression > Identifier.property):not(Property > Identifier.key)",
    message: 'firebaseAPI 를 직접 부르지 마세요 — 도메인의 provider(…-api.js · …-provider.js)를 deps 로 받아 부르세요. 0.13 은 서버 API 가 원본이라 Firebase 길을 늘리면 다시 걷어야 합니다.' },
  { selector: "MemberExpression[object.name=/^(window|globalThis|self)$/][property.name='firebaseAPI']",
    message: 'window.firebaseAPI 를 직접 부르지 마세요 — 도메인의 provider(…-api.js · …-provider.js)를 deps 로 받아 부르세요. 준비 여부는 shared/net-ready.js(TwNetReady)로 봅니다.' },
];

/* c. tw. 접두사 없는 localStorage 키 — 글자 그대로 쓴 키만 본다(상수 키는 정의한 줄을 사람이 본다) */
const LS_CALL = "CallExpression[callee.property.name=/^(setItem|getItem|removeItem)$/]:matches([callee.object.name='localStorage'], [callee.object.property.name='localStorage'])";
const LS_MSG = 'localStorage 키는 «tw.» 로 시작해야 합니다 — 계정 전환 · 지우기 목록이 접두사로 우리 키를 찾습니다. 키는 모듈 위 상수 한 곳에 «tw.…» 로 두세요.';
const LS_KEY_PREFIX = [
  { selector: `${LS_CALL} > Literal.arguments:first-child[value=/^(?!tw\\.)/]`, message: LS_MSG },
  { selector: `${LS_CALL} > TemplateLiteral.arguments:first-child[quasis.0.value.cooked=/^(?!tw\\.)/]`, message: LS_MSG },
];

/* d. 메인(Node) 쪽이 렌더러 폴더(app/)를 require */
const NO_MAIN_REQUIRES_RENDERER = [
  { selector: "CallExpression[callee.name='require'] > Literal.arguments:first-child[value=/^\\.{1,2}\\/(.*\\/)?app\\//]",
    message: '메인 쪽에서 app/ (렌더러) 파일을 require 하지 마세요 — 메인 · 렌더러 경계가 무너집니다. 두 쪽이 같이 쓰는 순수 규칙은 공용 자리(packages/ 등)로 옮겨 거기서 부르세요.' },
];

/* ── 파일 무리 ──────────────────────────────────────────────────────────── */

const RENDERER = ['app/parts/**/*.js'];
/* firebaseAPI 를 만들거나 잇는 자리 — 여기서만 직접 쓴다(코드를 읽고 정함):
   · firebase-init.js — window.firebaseAPI 를 만드는 곳(옛 Firebase 길의 끝).
   · shared/net-ready.js — «네트워크 준비됨» 을 보는 한 곳(서버 이관 때 갈아 끼울 자리).
   · realtime/rt-bind.js — realtime 연결에 로그인 토큰(firebaseAPI.getIdToken) 출처를 거는 한 줄.
   · app.js — 조립 자리. provider · 도메인 deps 로 firebaseAPI 를 잇는다(조립만 — 로직은 모듈로).
   그 밖은 도메인 모듈이라 provider 를 거친다. */
const FIREBASE_API_OK = [
  'app/parts/firebase-init.js',
  'app/parts/shared/net-ready.js',
  'app/parts/realtime/rt-bind.js',
  'app/parts/app.js',
];
/* ES 모듈로 싣는 파일(html 의 type="module" · 그것들이 import 하는 것) */
const ESM = [
  'app/parts/firebase-init.js',
  'app/parts/firebase-config.js',
  'app/parts/chat/chat-history.js',
  'app/parts/shared/app-version.js',
  'app/parts/realtime/rt-bind.js',
  'app/parts/realtime/realtime-link.js',
];
/* 메인 쪽 — 앱 폴더 맨 위 파일(main · preload · 플랫폼 모듈 · 진단 등) */
const MAIN = ['*.js'];

module.exports = [
  { ignores: ['eslint.config.js', 'node_modules/**', 'archive/**', 'tools/**', 'scripts/**', 'build/**', 'dist/**', 'app/vendor/**'] },
  {
    plugins: { tw: { rules: {
      'no-timer': restrict,
      'no-firebase-api': restrict,
      'ls-key-prefix': restrict,
      'no-main-require-renderer': restrict,
    } } },
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script' },
    /* 옛 코드의 eslint-disable 줄은 여기서 안 켜는 규칙을 가리킨다 — 쓸모없다고 경고하지 않는다 */
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  { files: ESM, languageOptions: { sourceType: 'module' } },
  { files: MAIN, languageOptions: { sourceType: 'commonjs' },
    rules: { 'tw/no-main-require-renderer': ['error', ...NO_MAIN_REQUIRES_RENDERER] } },
  { files: RENDERER, rules: {
    'tw/no-timer': ['error', ...NO_TIMER],
    'tw/no-firebase-api': ['error', ...NO_FIREBASE_API],
    'tw/ls-key-prefix': ['error', ...LS_KEY_PREFIX],
  } },
  { files: FIREBASE_API_OK, rules: { 'tw/no-firebase-api': 'off' } },
];
