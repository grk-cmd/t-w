/* ═══ 🖥️ sim-device-session.js — 한 계정 한 기기 (2026-09-17 제보 3 · 시안 확정) ═══════════════════════
   [무엇을 지키나] users/{uid}/session = {id, at}. 부팅 때 claim, 다른 기기가 claim 하면 이 기기는 «밀려난 것»:
     방에서 나오고 · presence onDisconnect 를 거두고 · 차단 화면을 띄운다. **로그아웃은 하지 않는다.**
   ・1절: firebase-init.js — claimDeviceSession / deviceSessionLost / releaseDeviceSession. 가짜 SDK 위에서 실제로 돌린다:
          로그인 없으면 false · 내 id 는 무시 · 남의 id 면 onLost 한 번 · presence onDisconnect cancel · release 는 내 것만.
   ・2절: app.js — claim 은 setMyPresenceOnline 직후 · 밀리면 doLeaveRoom + 화면 · startRoom 첫 줄 차단 · 계속 쓰기 = 재claim
          + presence 재등록 · _detachAccountLocal 이 release · 로그아웃(_loginDoLogout) 본문을 원격 신호가 부르지 않는다.
   ・3절: HTML — #deviceSessionOverlay 두 버튼 · 클릭 통과 화이트리스트(UI_HIT_SEL)에 등록.
   [실행] app.js · firebase-init.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const SRC  = fs.readFileSync('app.js', 'utf8');
const FB   = fs.readFileSync('firebase-init.js', 'utf8');
const HTML = fs.readFileSync('desk-companion-prototype.html', 'utf8');

let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
/* `name(args){ … },` 메서드 본문을 중괄호 짝으로 뗀다 */
function grabMethod(src, name){
  let i = src.indexOf('\n    ' + name + '(');
  if(i < 0) i = src.indexOf('\n    async ' + name + '(');
  if(i < 0) return null;
  let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i + 5, k + 1); }
  return null;
}

(async () => {
/* ── 1. firebase-init.js ── */
say('── 1. firebase-init.js — claim / lost / release 를 실제로 돌린다');
{
  const claim = grabMethod(FB, 'claimDeviceSession'), lost = grabMethod(FB, 'deviceSessionLost'), rel = grabMethod(FB, 'releaseDeviceSession');
  chk(!!claim && !!lost && !!rel, '세 메서드를 찾았다');
  chk(/필요한 규칙:\s+"session": \{/.test(FB) && /root\.child\('userAuth\/'\+\$uid\)\.val\(\) === auth\.uid/.test(FB), '  필요한 규칙 블록이 주석에 적혀 있다');
  /* 규칙 파일이 있으면 실제 블록을 본다 — 로그인 계정만 쓰고, 삭제(release)도 통과해야 한다. */
  if(fs.existsSync('firebase-database-rules.json')){
    const rules = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8'));
    const u = rules.rules && rules.rules.users && rules.rules.users['$userId'];
    const sess = u && u.session;
    chk(!!sess, '★ 규칙 users/$userId/session 블록이 있다');
    chk(!!sess && /root\.child\('userAuth\/'\+\$userId\)\.exists\(\) && root\.child\('userAuth\/'\+\$userId\)\.val\(\) === auth\.uid/.test(sess['.write']), '  .write: 구글에 묶인 계정 + 그 계정만(presence 와 달리 미연동 기기는 못 쓴다 — 대상이 아니다)');
    chk(!!sess && /^!newData\.exists\(\) \|\| \(newData\.hasChildren\(\['id','at'\]\)/.test(sess['.validate']), '  .validate: 삭제(release 트랜잭션) 허용 · 있으면 id·at 필수');
    chk(u['.read'] === true, '  .read 는 users/$userId 에서 내려온다(구독 가능)');
  }
  const env = { sets: [], listeners: {}, cancels: 0, lostCalls: [], user: { uid: 'auth1' }, txn: [] };
  const api = new Function('env',
    "let _sessionRef=null,_sessionId=null,_sessionUnsub=null,_sessionLost=false; let _myPresenceRef={p:1};\n" +
    "const auth={ get currentUser(){ return env.user; } }; const _whenAuthReady=()=>Promise.resolve();\n" +
    "const db={}; const ref=(d,p)=>({path:p}); const serverTimestamp=()=>'ST'; const _svNow=()=>1700000000000;\n" +
    "const set=async(r,v)=>{ env.sets.push([r.path,v]); }; const onValue=(r,cb)=>{ env.listeners[r.path]=cb; return ()=>{ delete env.listeners[r.path]; }; };\n" +
    "const onDisconnect=(r)=>({ cancel(){ env.cancels++; } }); const runTransaction=async(r,fn)=>{ env.txn.push([fn({id:env.mine}), fn({id:'sOTHER'})]); };\n" +
    "const console={warn:()=>{}};\n" +
    "const o={ " + claim + ",\n" + lost + ",\n" + rel + " };\n" +
    "o._peek=()=>({_sessionId,_sessionLost,_myPresenceRef,_sessionRef}); return o;")(env);
  env.user = null;
  chk((await api.claimDeviceSession('uA', ()=>{})) === false && env.sets.length === 0, '① 로그인 안 한 기기: false · 아무것도 안 쓴다(대상 아님)');
  env.user = { uid: 'auth1' };
  const ok = await api.claimDeviceSession('uA', (v)=>env.lostCalls.push(v));
  const st = api._peek();
  chk(ok === true && env.sets.length === 1 && env.sets[0][0] === 'users/uA/session' && env.sets[0][1].id === st._sessionId && env.sets[0][1].at === 'ST', '★ ② claim: users/uA/session = {id:내것, at:serverTimestamp}');
  chk(/^s[0-9a-z]+$/.test(st._sessionId), '  id 는 s+base36(서버 시계)');
  const cb = env.listeners['users/uA/session'];
  cb({ val: () => ({ id: st._sessionId, at: 1 }) });
  chk(env.lostCalls.length === 0 && !api.deviceSessionLost(), '  내 id 가 돌아오면 무시');
  cb({ val: () => null });
  chk(env.lostCalls.length === 0, '  빈 값도 무시(규칙 미배포로 지워진 경우)');
  cb({ val: () => ({ id: 'sOTHER', at: 2 }) });
  cb({ val: () => ({ id: 'sOTHER', at: 2 }) });
  chk(env.lostCalls.length === 1 && api.deviceSessionLost() === true, '★ ③ 남의 id: onLost 한 번(두 번 와도 한 번)');
  chk(env.cancels === 1 && api._peek()._myPresenceRef === null, '  내 presence onDisconnect 를 거두고 ref 를 놓는다 — 내가 꺼져도 이긴 쪽을 오프라인으로 안 만든다');
  await api.releaseDeviceSession();
  chk(env.txn.length === 0, '  밀린 뒤 release 는 서버를 안 건드린다(그 노드는 이긴 쪽 것)');
  /* 다시 claim → 이번엔 내 것 → release 가 트랜잭션으로 내 것일 때만 지운다 */
  await api.claimDeviceSession('uA', ()=>{});
  env.mine = api._peek()._sessionId;
  await api.releaseDeviceSession();
  chk(env.txn.length === 1 && env.txn[0][0] === null && env.txn[0][1] === undefined, '★ ④ release: 내 id 면 삭제(null) · 남의 id 면 손 안 댐(undefined=중단)');
  chk(api._peek()._sessionId === null && api._peek()._sessionRef === null, '  release 뒤 상태 초기화');
  /* 쓰기 거부(규칙 미배포) */
  const env2 = { sets: [], listeners: {}, cancels: 0, lostCalls: [], user: { uid: 'a' }, txn: [] };
  const api2 = new Function('env', "let _sessionRef=null,_sessionId=null,_sessionUnsub=null,_sessionLost=false; let _myPresenceRef={};\n" +
    "const auth={ get currentUser(){ return env.user; } }; const _whenAuthReady=()=>Promise.resolve(); const db={}; const ref=(d,p)=>({path:p});\n" +
    "const serverTimestamp=()=>'ST'; const _svNow=()=>1; const set=async()=>{ throw new Error('PERMISSION_DENIED'); }; const onValue=(r,cb)=>{ env.listeners[r.path]=cb; return ()=>{}; };\n" +
    "const onDisconnect=()=>({cancel(){}}); const runTransaction=async()=>{}; const console={warn:()=>{}};\n" +
    "return { " + claim + " };")(env2);
  chk((await api2.claimDeviceSession('uA', ()=>{})) === false && Object.keys(env2.listeners).length === 0, '  쓰기 거부(규칙 미배포): false · 구독도 안 건다 — 지금과 똑같이 둘 다 그대로');
}

/* ── 2. app.js ── */
say('── 2. app.js — 배선');
{
  const code = strip(SRC);
  const h = code.indexOf('async function initMyHome(');
  const i = code.indexOf('firebaseAPI.setMyPresenceOnline(myId);', h);
  chk(h >= 0 && i >= 0 && /firebaseAPI\.claimDeviceSession\(myId, _onDeviceSessionLost\)/.test(code.slice(i, i + 400)), '★ claim 은 presence 등록 직후(initMyHome)');
  const f = code.slice(code.indexOf('function _onDeviceSessionLost('), code.indexOf('function _deviceSessionContinueHere('));
  chk(/window\._deviceSessionLost = true/.test(f) && /doLeaveRoom\(\)/.test(f) && /deviceSessionOverlay/.test(f) && /display = 'flex'/.test(f), '  밀리면: 표식 · 방 나가기 · 화면');
  chk(!/_loginDoLogout|_detachAccountLocal|_wipeAccountLocal|authSignOut/.test(f), '★ 밀려도 로그아웃·지움은 안 부른다(원격 신호로 검문이 돌면 안 된다)');
  const g = code.slice(code.indexOf('function _deviceSessionContinueHere('), code.indexOf('let _ownerWriteWarned'));
  chk(/window\._deviceSessionLost = false/.test(g) && /claimDeviceSession\(myId, _onDeviceSessionLost\)/.test(g) && /setMyPresenceOnline\(myId\)/.test(g), '  계속 쓰기: 표식 해제 · 재claim · presence 재등록');
  chk(/deviceSessionContinue/.test(g) && /deviceSessionQuit/.test(g) && /companion\.quitApp\(\)/.test(g), '  버튼 둘 배선(계속 쓰기 · 앱 닫기)');
  const sr = code.slice(code.indexOf('async function startRoom(code){'), code.indexOf('async function startRoom(code){') + 300);
  chk(/if\(window\._deviceSessionLost\)\{ toast\(/.test(sr) && sr.indexOf('_deviceSessionLost') < sr.indexOf('_ensureRoomVersionOk'), '★ startRoom 첫 줄에서 막는다(생성·참여·초대수락·시크릿룸 공통 길목)');
  const d = code.slice(code.indexOf('async function _detachAccountLocal('), code.indexOf('async function _loginDoLogout('));
  chk(/_wipeAccountLocal\(\);[\s\S]*releaseDeviceSession\(\)/.test(d), '  로그아웃·연동해제(_detachAccountLocal)가 지운 뒤 release — authSignOut 보다 앞');
  chk(/#inviteGateOverlay, #deviceSessionOverlay,/.test(SRC), '  클릭 통과 화이트리스트(UI_HIT_SEL)에 등록');
}

/* ── 3. HTML ── */
say('── 3. HTML — 차단 화면');
{
  const i = HTML.indexOf('id="deviceSessionOverlay"');
  const ov = HTML.slice(i, i + 2500);
  chk(i >= 0 && /display:none/.test(ov.slice(0, 200)), '#deviceSessionOverlay — 숨긴 채 시작');
  chk(/id="deviceSessionContinue"/.test(ov) && /id="deviceSessionQuit"/.test(ov), '  버튼 둘(여기서 계속 쓰기 · 앱 닫기)');
  chk(/방 접속만 끊었어요/.test(ov) && /다른 PC가 이 화면을 보게 돼요/.test(ov), '  문구(시안 왼쪽): 캐릭터·기록 그대로 · 반대쪽이 이 화면을 본다');
  chk(!/로그아웃/.test(ov), '  «로그아웃» 이라는 말이 없다 — 시안 오른쪽(로그아웃 판)이 아니다');
}

say('\n결과: 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
})();
