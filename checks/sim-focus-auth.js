/* ═══ 🔑 sim-focus-auth.js — 포커스 동기화가 로그인 세션을 챙기는가 (제보 6 · 2026-09-15) ══════════
   [무엇을 지키나] 구글에 묶인 계정은 users/{코드}/focus 쓰기에 auth.uid 일치가 필요한데,
     ・firebase-init syncFocusTotal 이 auth 대기선을 안 지나 부팅 push 가 세션 복원과 경주했고,
     ・app.js syncFocusTotalToServer 는 실패를 `return` 한 줄로 삼켰다 — 세션이 풀린 기기의 기록이
       서버에 안 가는데 아무 데도 안 남았다(80 → 75 제보의 후보).
   ・1절: 서버 함수가 대기선을 지나고, 거부를 이름 붙여(denied·authed) 돌려준다.
   ・2절: _focusSyncFailed 를 떼어 와 돌린다 — 경고는 매번, 안내는 «거부 + 연동됨 + 세션 없음» 일 때 한 번, 재시도는 첫 실패에 한 번.
   ・3절: 배선 — 실패 경로가 그 함수를 지나고 성공이 연속 실패 수를 0 으로 되돌린다.
   [실행] app.js · firebase-init.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
const SRC = fs.readFileSync('app.js', 'utf8');
const FI  = fs.readFileSync('firebase-init.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
function grabFn(src, name, kw){
  const i = src.indexOf((kw || 'function ') + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1);
  }
  return null;
}

/* ── 1. 서버 함수 ── */
say('── 1. firebase-init syncFocusTotal — 대기선을 지나고 거부를 이름 붙인다');
const sft = grabFn(FI, 'syncFocusTotal', 'async ') || '';
const awaitIdx = sft.indexOf('await _whenAuthReady()'), refIdx = sft.indexOf('ref(db,');
chk(awaitIdx > 0, '★ await _whenAuthReady() 가 있다 (setMyProfile · 마이홈 저장과 같은 소유권 쓰기)');
chk(awaitIdx > 0 && refIdx > awaitIdx, '  그 줄이 ref/get 보다 앞이다 — 사전 get 도 세션 뒤에');
chk(/denied\s*=\s*\/permission\[_ \]denied\/i\.test\(reason\)/.test(sft), '★ 거부를 denied 로 돌려준다 (부르는 쪽이 «세션이 풀렸다» 를 가릴 유일한 근거)');
chk(/authed: !!\(auth && auth\.currentUser\)/.test(sft), '  그때 세션이 있었는지(authed)도 같이');
chk(/if\(want <= pre\) return \{ ok:true, totalSec: pre \};/.test(sft), '올릴 게 없으면 읽기 1회로 끝나는 기존 지점은 그대로');
const others = (FI.match(/await _whenAuthReady\(\);/g) || []).length;
chk(others >= 3, '대기선을 지나는 쓰기 ' + others + '곳 (setMyProfile · 마이홈 저장 · 포커스 = 3 이상)');

/* ── 2. 실패 처리 모델 ── */
say('── 2. _focusSyncFailed — 경고는 매번, 안내는 한 번, 재시도는 첫 실패에 한 번');
const ff = grabFn(SRC, '_focusSyncFailed');
if(!ff){ huh('_focusSyncFailed 를 못 찾음'); }
else{
  const env = { toasts:[], warns:[], timers:[], email:'me@x', syncCalls:[] };
  const decl = "let _focusSyncFailStreak = 0, _focusSyncNoticed = false, _focusSyncRetryTimer = null;\n";
  const factory = new Function('env', decl +
    "const console={ warn:(m)=>env.warns.push(m) };" +
    "const toast=(m)=>env.toasts.push(m);" +
    "const getMyLoginEmail=()=>env.email;" +
    "const setTimeout=(fn,ms)=>{ env.timers.push(ms); return env.timers.length; };" +
    "const syncFocusTotalToServer=(r)=>env.syncCalls.push(r);" +
    ff + "\nreturn { fail:_focusSyncFailed, streak:()=>_focusSyncFailStreak, reset:()=>{ _focusSyncFailStreak=0; } };");
  const m = factory(env);
  // ① 세션이 풀린 연동 기기 — 거부
  m.fail('boot', { ok:false, reason:'PERMISSION_DENIED: Permission denied', denied:true, authed:false }, 120);
  chk(env.warns.length === 1 && /못 올린 증분=120s/.test(env.warns[0]), '콘솔 경고에 이유와 못 올린 증분이 남는다');
  chk(env.toasts.length === 1 && /다시 로그인/.test(env.toasts[0]), '★ 거부 + 연동됨 + 세션 없음 → 재로그인 안내');
  chk(env.timers.length === 1 && env.timers[0] === 60000, '첫 실패 → 60초 뒤 재시도 예약');
  m.fail('tick', { ok:false, reason:'PERMISSION_DENIED', denied:true, authed:false }, 300);
  chk(env.toasts.length === 1, '  두 번째 거부에는 안내가 다시 안 뜬다 (부팅당 한 번)');
  chk(env.timers.length === 1, '  재시도도 다시 안 잡는다 (주기 타이머가 있다)');
  chk(env.warns.length === 2 && /연속 2회/.test(env.warns[1]), '  경고는 매번, 연속 횟수가 는다');
  // ② 세션은 있는데 거부 — 규칙 문제. 로그인 안내가 아니다
  const env2 = { toasts:[], warns:[], timers:[], email:'me@x', syncCalls:[] };
  factory(env2).fail('boot', { ok:false, reason:'PERMISSION_DENIED', denied:true, authed:true }, 10);
  chk(env2.toasts.length === 0 && env2.warns.length === 1, '세션이 있는데 거부 → 안내 없이 경고만 (재로그인으로 못 고치는 종류)');
  // ③ 연동 안 한 기기의 네트워크 오류 — 안내 없음
  const env3 = { toasts:[], warns:[], timers:[], email:null, syncCalls:[] };
  factory(env3).fail('tick', { ok:false, reason:'network', denied:false, authed:false }, 10);
  chk(env3.toasts.length === 0, '연동 안 한 기기의 일반 오류 → 안내 없음');
  // ④ 응답 자체가 없음(r=null)
  const env4 = { toasts:[], warns:[], timers:[], email:'me@x', syncCalls:[] };
  factory(env4).fail('boot', null, 0);
  chk(env4.warns.length === 1 && /응답 없음/.test(env4.warns[0]), 'r 가 null 이어도 던지지 않고 «응답 없음» 으로 남긴다');
}

/* ── 3. 배선 ── */
say('── 3. 배선');
const sync = grabFn(SRC, 'syncFocusTotalToServer', 'async function ') || '';
chk(/if\(!r \|\| !r\.ok\)\{ _focusSyncFailed\(reason, r, delta\); return; \}/.test(sync), '★ 실패가 _focusSyncFailed 를 지난 뒤 return (마크는 여전히 안 옮긴다)');
chk(/_focusSyncFailStreak = 0;/.test(sync), '성공하면 연속 실패 수가 0');
chk(/_setFocusSyncedMark\(newMark\)/.test(sync), '마크 처리는 그대로');
chk(/syncFocusTotalToServer\('retry'\)/.test(SRC), "재시도가 같은 함수를 'retry' 이유로 부른다");

say('');
say('통과 ' + pass + ' · 실패 ' + fail + ' · 검사못함 ' + huhs);
process.exit(fail ? 1 : 0);
