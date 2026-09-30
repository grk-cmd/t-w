#!/usr/bin/env node
/* ═══ 🛡️ patch-nwm.js — node-window-manager macOS 네이티브의 NULL 문자열 크래시를 막는다 ═══
   [2026-09-30 · Mac 크래시 제보 2건의 후속]  `npm install` 뒤(postinstall)에 자동으로 돈다.

   [무엇을 고치나] node-window-manager 2.2.4 `lib/macos.mm` 에 **NSString → char* 를 그대로
     Napi 에 넘기는 자리가 두 곳** 있다. 값이 nil 이면 UTF8String 이 NULL 이고, N-API 가
     strlen(NULL) 에서 세그폴트로 **앱 전체**를 죽인다. JS 의 try/catch 로는 못 잡는다.
       ① getWindowTitle — `kCGWindowOwnerName` 이 없는 창 (제보 2건이 바로 이것)
       ② initWindow     — `app.bundleURL` 이 없는 프로세스(.app 번들이 아닌 GUI — 터미널에서
                          띄운 파이썬 창 등). getActiveWindow()/getWindows() 가 창 객체를 만들 때마다
                          지나가므로 **JS 쪽에서 피할 방법이 없다.** (아직 제보는 없다)
     ★ ① 은 sysinput-mac.js 가 getTitle() 을 안 부르는 것으로 이미 막았다. 여기서 한 번 더 막는 것은
       누가 나중에 getTitle() 을 다시 불러도 안 죽게 하려는 것이다. ② 는 여기서만 막을 수 있다.

   [왜 patch-package 가 아닌가] 의존성을 하나 늘리지 않으려고. 바꾸는 것은 두 줄이고, 원문이
     다르면(라이브러리 버전이 바뀌면) 아래에서 **크게 실패**한다 — 조용히 넘어가지 않는다.

   [왜 여기서 다시 빌드하나] node-window-manager 는 프리빌드가 없어 **설치 순간 소스를 컴파일한다.**
     postinstall 은 그 뒤에 돈다 — 즉 소스만 고치면 이미 만들어진 addon.node 는 옛 코드 그대로다.
     그래서 고친 직후 `npm rebuild node-window-manager` 로 다시 컴파일한다(mac 에서만).
     ⚠️ electron-builder 도 패키징 때 네이티브를 다시 빌드하지만(npmRebuild), `npm start` 개발 실행은
       그걸 안 거친다. 여기서 빌드해야 개발 실행과 설치본이 같은 코드를 쓴다.

   [동작]
     ・이미 고쳐져 있으면(표식 TW-PATCH) 아무것도 안 한다 — 몇 번을 돌아도 같다.
     ・원문을 못 찾으면: mac 에서는 **실패(종료 1)**, 그 외 OS 에서는 경고만.
       mac 에서 조용히 넘어가면 고치지 않은 네이티브로 릴리스가 나간다.
     ・Windows 에서는 macos.mm 을 컴파일하지 않지만 글자는 똑같이 고친다(해가 없고, 저장소를
       어느 OS 에서 설치했든 node_modules 모양이 같게). 다시 빌드는 mac 에서만.

   실행:  node scripts/patch-nwm.js [--check]     (--check = 고치지 않고 상태만 보고) */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const MM = path.join(ROOT, 'node_modules', 'node-window-manager', 'lib', 'macos.mm');
const IS_MAC = process.platform === 'darwin';
const CHECK_ONLY = process.argv.includes('--check');
const MARK = '/* TW-PATCH v1 */';
const say = (m) => console.log('[patch-nwm] ' + m);

/* nil 이면 "" 를 주는 도우미. getWindowInfo 바로 앞에 한 번 넣는다. */
const HELPER =
  MARK + '\n' +
  'static inline const char* tw_cstr(NSString* s) {\n' +
  '  const char* c = s ? [s UTF8String] : NULL;\n' +
  '  return c ? c : "";\n' +
  '}\n\n';
const HELPER_ANCHOR = 'NSDictionary* getWindowInfo(int handle) {';

const EDITS = [
  { what: '① getWindowTitle — kCGWindowOwnerName 이 nil',
    from: 'return Napi::String::New(env, [windowName UTF8String]);',
    to:   'return Napi::String::New(env, tw_cstr(windowName));' },
  { what: '② initWindow — app / bundleURL 이 nil',
    from: 'obj.Set("path", [app.bundleURL.path UTF8String]);',
    to:   'obj.Set("path", tw_cstr(app ? app.bundleURL.path : nil));' },
];

function main(){
  if(!fs.existsSync(MM)){
    say('node-window-manager 가 없다 — 건너뜀 (' + MM + ')');
    return 0;
  }
  let src = fs.readFileSync(MM, 'utf8');

  if(src.includes(MARK)){
    /* 표식만 믿지 않는다 — 위험한 줄이 정말 없는지 한 번 더 본다. */
    const left = EDITS.filter(e => src.includes(e.from));
    if(left.length){ say('⚠️ 표식은 있는데 안 고친 줄이 남았다: ' + left.map(e => e.what).join(' / ')); return IS_MAC ? 1 : 0; }
    say('이미 고쳐져 있다 — 할 일 없음');
    return 0;
  }

  const missing = [HELPER_ANCHOR, ...EDITS.map(e => e.from)].filter(s => !src.includes(s));
  if(missing.length){
    say('✗ 원문이 예상과 다르다 — 라이브러리 버전이 바뀌었을 수 있다. 못 찾은 줄:');
    missing.forEach(s => say('    ' + s));
    say(IS_MAC ? '✗ mac 에서는 여기서 멈춘다 — 고치지 않은 네이티브로 릴리스가 나가면 안 된다.'
               : '(mac 이 아니라 경고만 남긴다 — 이 OS 에서는 macos.mm 을 컴파일하지 않는다)');
    return IS_MAC ? 1 : 0;
  }

  if(CHECK_ONLY){ say('고칠 필요 있음(아직 안 고침) — --check 라 그대로 둔다'); return 0; }

  src = src.replace(HELPER_ANCHOR, HELPER + HELPER_ANCHOR);
  for(const e of EDITS){ src = src.replace(e.from, e.to); say('고침: ' + e.what); }
  fs.writeFileSync(MM, src);

  if(!IS_MAC){ say('소스만 고쳤다 (mac 이 아니라 다시 빌드하지 않는다)'); return 0; }

  say('다시 빌드: npm rebuild node-window-manager');
  try{
    execSync('npm rebuild node-window-manager', { cwd: ROOT, stdio: 'inherit' });
  }catch(err){
    say('✗ 다시 빌드 실패 — addon.node 는 옛 코드 그대로다. Xcode 명령줄 도구(xcode-select --install)를 확인할 것');
    return 1;
  }
  say('완료');
  return 0;
}

process.exitCode = main();
