/* system-prompt.js — 🔐 시스템 확인 창이 맨 앞인가 (검사 sim-system-prompt.js)
   [왜] 실행 화면은 모니터 전체를 덮는 투명 «항상 위» 창이다. 맥은 앱스토어 «받기» · 암호 · Touch ID 같은 확인 창을
     다른 앱 창이 덮고 있으면 보안 때문에 그 칸을 비워 보여 준다(B-1104-10). 이 창들이 맨 앞인 동안 실행 화면을 아래로 내린다.
   판정은 활성 창 키(main.js focusKeyOf(sysinput.procNameOf(경로)))로만 한다. 표시 이름은 현지화로 흔들려서 쓰지 않는다.
   ⚠️ procNameOf 는 `.app` 이면 번들 id, 아니면 파일 이름이다 — 암호 · Touch ID 창은 `.bundle` 이라 `mac:securityagent.bundle` 처럼 잡힌다.
   내보냄: SYSTEM_PROMPT_KEYS · isSystemPrompt(activeKey). 순수 함수 — electron 을 모른다. */
'use strict';

const SYSTEM_PROMPT_KEYS = Object.freeze(new Set([
  'mac:com.apple.appstore',           // 앱스토어 «받기» · 구입 확인
  'mac:securityagent.bundle',         // 관리자 암호 창(SecurityAgent.bundle — .app 이 아니라 파일 이름 키)
  'mac:coreautha.bundle',             // Touch ID · 암호 확인(coreautha.bundle — 같은 까닭)
  'mac:com.apple.systempreferences',  // 시스템 설정(잠금 풀기 · 권한 허용)
  'mac:com.apple.installer',          // 설치 프로그램
]));

function isSystemPrompt(activeKey){
  return SYSTEM_PROMPT_KEYS.has(String(activeKey || '').trim().toLowerCase());
}

module.exports = { SYSTEM_PROMPT_KEYS, isSystemPrompt };
