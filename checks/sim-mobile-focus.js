/* ═══ 📱 sim-mobile-focus.js — 태블릿·폰 포커싱 연결 (2026-09-23 · 개정 74 신설 · handoff-2026-09-18 §4 · §5) ═══════
   [무엇을 지키나]
   ・1절: 판정 합치기 — 진짜 `_applyActiveAppState` 를 가짜 환경에서 돌린다.
          폰 켜짐 → focusGateSleep=false · _focusWasActive=true · PC 입력이 없어도 시간이 쌓인다 ·
          🎯집중(달성표)에는 안 들어간다 · 폰 꺼짐이면 예전과 똑같다 · 안전 상한(4시간)을 넘으면 꺼짐.
   ・2절: 곁가지 — 집중 포즈(seatState) · 자동 자리비움 건너뜀 · lastActivity 를 건드리지 않음 · main.js 무관.
   ・3절: 방 — 평소·입장 payload 에 mobile 한 칸 · 받는 쪽 거르기 · 말풍선 순서(상태 > 📱 > 🕒) · _statusOut 을 실제로 돌려 본다.
   ・4절: 서버 — live onDisconnect remove · 재접속 때 다시 걸기 · 부팅 초기화(on=false) · presence 를 live 로 안 씀 ·
          키 교체 때 state 지움 · 받은 state 는 이 PC 의 키로 쓴 것만 믿는다.
   ・5절: 규칙 — mobileKeys 읽기 금지 · state 쓰기 = 주인 또는 (key 일치 + live 있음) · 방 mobile ≤ 40.
   ・6절: 화면 — 📱 칸이 #fsTabApp 안 · #fsSlotHint 뒤 · QR 창 베젤 radius · 클릭 목록 두 곳 · QR 라이브러리가 로컬 파일 ·
          새 클래스에 fly 없음 · 키는 주소의 # 뒤 · 안내 페이지.
   [실행] app.js · desk-companion-prototype.html · firebase-init.js · firebase-database-rules.json 이 있는 폴더에서(run.js 가 맞춰 준다). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
/* 찾던 함수가 없으면(개명·삭제) 도중에 멈춘다 — 멈춘 것도 빨강으로 센다(판정 줄은 남긴다). */
process.on('uncaughtException', (e) => { fail++; say('  ✗ 판정 도중 멈춤 — 찾던 함수·글자가 없다(개명·삭제?): ' + (e && e.message)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
const read = (...fs_) => { for(const f of fs_){ try{ return fs.readFileSync(f, 'utf8'); }catch(_){} } return null; };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html'), FBI = read('firebase-init.js'), RULES = read('firebase-database-rules.json');
if(!SRC || !HTML || !FBI || !RULES){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html · firebase-init.js · firebase-database-rules.json'); process.exit(2); }
const QRLIB = read('vendor/qrcode.js', path.join('app', 'vendor', 'qrcode.js'), path.join('..', 'app', 'vendor', 'qrcode.js'));
const HOST  = read('hosting/link.html', path.join('..', 'hosting', 'link.html'));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const CODE = strip(SRC);
const HTMLC = HTML.replace(/<!--[\s\S]*?-->/g, ' ');
/* 함수 하나를 떼어 온다 — 여는 중괄호부터 짝이 맞는 닫는 중괄호까지(문자열 안 괄호는 이 파일들에 없다). */
function grabFn(name, src){
  src = src || SRC;
  const m = new RegExp('(?:async\\s+)?function\\s+' + name.replace(/\$/g, '\\$') + '\\s*\\(').exec(src);
  if(!m) return null;
  let i = src.indexOf('{', m.index), d = 0;
  for(let j = i; j < src.length; j++){ const c = src[j]; if(c === '{') d++; else if(c === '}'){ d--; if(!d) return src.slice(m.index, j + 1); } }
  return null;
}
function grabBlock(src, start){ const i = src.indexOf(start); if(i < 0) return null; let k = src.indexOf('{', i), d = 0;
  for(let j = k; j < src.length; j++){ const c = src[j]; if(c === '{') d++; else if(c === '}'){ d--; if(!d) return src.slice(i, j + 1); } } return null; }

say('── 1. 판정 합치기 (_applyActiveAppState 를 실제로 돌린다)');
{
  const need = ['_mobileNow', '_mobileOn', '_mobileRoomLabel', '_applyActiveAppState'];
  const parts = need.map(n => grabFn(n));
  const maxM = /const MOBILE_MAX_ON_MS = ([^;]+);/.exec(SRC);
  chk(parts.every(Boolean) && !!maxM, '함수 넷 + MOBILE_MAX_ON_MS 를 찾았다');
  chk(maxM && eval(maxM[1]) === 4*60*60*1000, '안전 상한 = 4시간 (§6-2 확정)');
  if(parts.every(Boolean) && maxM){
  const mk = () => {
    const env = { now: 100000, srv: 5e12, added: 0, chal: 0 };
    const ctx = {
      env, window: { firebaseAPI: { serverNow: () => env.srv } }, performance: { now: () => env.now },
      console,
    };
    ctx.firebaseAPI = ctx.window.firebaseAPI;
    vm.createContext(ctx);
    vm.runInContext(`
      const MOBILE_MAX_ON_MS = ${maxM[1]};
      let _mobileFocus = { on:false, app:'', since:0, seen:false };
      let lastActivity = 0, figureMode = false, focusGateSleep = true, _penAppFocused = false, _chalKeyPlatform = null;
      function focusWindowMs(){ return 1500; }
      function addFocusSeconds(d){ env.added += d; }
      function _chalFocusTick(s, d){ env.chal += d; }
      let _focusLastTick = performance.now(), _focusWasActive = false;
      ${parts.join('\n')}
      this.api = { apply: _applyActiveAppState, on: _mobileOn, label: _mobileRoomLabel,
        setMob: (o) => { _mobileFocus = o; }, setAct: (t) => { lastActivity = t; },
        get: () => ({ gate: focusGateSleep, was: _focusWasActive }) };`, ctx);
    return ctx;
  };
  const NOT_REG = { hasAnyRegistered: true, isFocusedAppRegistered: false };   // PC 는 등록 안 된 앱(예: 바탕화면)
  // (a) 폰 켜짐 · PC 입력 없음
  { const c = mk(), A = c.api, E = c.env;
    A.setMob({ on:true, app:'Procreate', since:E.srv - 60000, seen:true }); A.setAct(0);
    A.apply(NOT_REG); let g = A.get();
    chk(g.gate === false && g.was === true, '폰 켜짐 → focusGateSleep=false · _focusWasActive=true (PC 는 등록 안 된 앱)');
    E.now += 1000; A.apply(NOT_REG);
    chk(Math.abs(E.added - 1) < 1e-6, '폰 켜짐 → PC 입력이 없어도 1초가 쌓인다 (notFocusingNow 건너뜀)');
    chk(E.chal === 0, '🎯집중(달성표)에는 안 들어간다 (§6-3 · exe 기준)');
    chk(A.label() === 'Procreate', '방에 싣는 이름 = 앱 이름'); }
  // (b) 폰 꺼짐 — 예전과 동일
  { const c = mk(), A = c.api, E = c.env;
    A.setMob({ on:false, app:'Procreate', since:0, seen:true }); A.setAct(0);
    A.apply(NOT_REG); E.now += 1000; A.apply(NOT_REG); const g = A.get();
    chk(g.gate === true && g.was === false && E.added === 0, '폰 꺼짐 → 예전 그대로(재움 · 안 쌓임)');
    chk(A.label() === '', '폰 꺼짐 → 방에 빈 문자열');
    A.setAct(E.now); A.apply({ hasAnyRegistered:true, isFocusedAppRegistered:true }); E.now += 1000; A.setAct(E.now); A.apply({ hasAnyRegistered:true, isFocusedAppRegistered:true });
    chk(Math.abs(E.added - 1) < 1e-6 && Math.abs(E.chal - 1) < 1e-6, '폰 꺼짐 · PC 포커싱 어플 입력 → 예전처럼 쌓이고 달성표도 센다'); }
  // (c) 상한
  { const c = mk(), A = c.api, E = c.env;
    A.setMob({ on:true, app:'X', since:E.srv - 4*3600*1000 - 1, seen:true });
    chk(A.on() === false, '4시간 넘게 새 «열림» 이 없으면 꺼짐으로 본다');
    A.setMob({ on:true, app:'X', since:E.srv - 4*3600*1000 + 60000, seen:true });
    chk(A.on() === true, '4시간 안이면 켜짐');
    A.setMob({ on:true, app:'X', since:0, seen:true });
    chk(A.on() === false, 'since 가 없으면 켜짐으로 안 본다'); }
  // (d) figureMode 는 예전 그대로 이긴다
  { const c = mk(), A = c.api;
    vm.runInContext('figureMode = true;', c); A.setMob({ on:false, app:'', since:0 }); A.apply(NOT_REG);
    chk(A.get().gate === false, '피규어 모드 분기는 그대로'); }
  }
  const ap = strip(grabFn('_applyActiveAppState') || '');
  chk(/_chalFocusTick\(state, dt\)/.test(ap) && /!pcNotFocusing\) _chalFocusTick/.test(ap), '달성표는 PC 입력 기준(pcNotFocusing)을 본다');
}

say('── 2. 곁가지');
{
  const ss = strip(grabFn('seatState') || '');
  const iGate = ss.indexOf('if(desktopMode && focusGateSleep) return \'sleep\';'), iMob = ss.indexOf('_mobileOn()) return \'focus\'');
  chk(iGate > 0 && iMob > iGate && /seat\.isMe && typeof _mobileOn === 'function'/.test(ss), '집중 포즈 — 내 좌석 · 게이트 뒤 · 입력 판정(idle) 앞');
  chk(iMob < ss.indexOf('const idle=now-lastActivity'), '  입력 판정보다 앞이라 PC 입력이 없어도 집중 포즈');
  const aw = strip(grabFn('_autoAwayCheck') || '');
  chk(/const idle = \(typeof _mobileOn === 'function' && _mobileOn\(\)\) \? 0 : await _idleMs\(\);/.test(aw), '자동 자리비움 · 6시간 퇴장 — 폰 켜짐이면 유휴 0 (복원 갈래로 돌아온다)');
  const mobFns = ['_mobileOn', '_mobileApplyState', '_mobileStart', '_mobRenderPanel', '_mobMakeKey', '_applyActiveAppState'].map(n => strip(grabFn(n) || '')).join('\n');
  chk(!/lastActivity\s*=/.test(mobFns) && !/activity\(\)/.test(mobFns), 'lastActivity 를 인위로 갱신하지 않는다(펜 앱 판정·입력 진단과 섞이지 않게)');
  const MAIN = read('main.js');
  chk(!MAIN || !/mobileLink|_mobileOn/.test(MAIN), 'main.js 는 폰 판정을 모른다(렌더러에서 합친다)');
}

say('── 3. 방');
{
  chk(/bench:_myBench\(\), mobile:_mobileRoomLabel\(\), danceStyle:/.test(CODE), '평소 payload(_basePayload)에 mobile 한 칸');
  chk(/\.\.\.myStarOut\(\),mobile:_mobileRoomLabel\(\),userId:getMyUserId\(\)/.test(CODE), '입장 payload 에도 mobile');
  chk(/flyCool:_myFlyCool\(\), noise:myNoise\}; \}/.test(CODE) && /userId:getMyUserId\(\), noise:myNoise, lic:/.test(CODE), '  남의 검사가 붙잡은 글자(noise 끝 · 입장 줄)는 그대로');
  chk(/s\.remoteMobile=_mobileCleanApp\(friends\[id\]\.mobile\);/.test(CODE), '받는 쪽 — _mobileCleanApp 으로 거른다');
  const clean = new Function(grabFn('_mobileCleanApp').replace('MOBILE_APP_MAX', '40') + ' return _mobileCleanApp;')();
  chk(clean(undefined) === '' && clean(5) === '' && clean(' <b>Pro</b>\n') === 'bPro/b' && clean('x'.repeat(60)).length === 40, '  문자열만 · 제어문자·꺾쇠 제거 · 40자');
  const so = grabFn('_statusOut');
  const out = (u, f, c, mob) => new Function('u', 'f', 'c', 'm', 'let myUserStatus=u, myFocusShow=f, myCustomStatus=c; const _mobileOn=()=>m;' + so + ' return _statusOut();')(u, f, c, mob);
  const F = { emo:'🕒', text:'오늘 3:20' }, C = { emo:'✨', text:'마감 중' };
  let r = out(null, F, C, true);  chk(r.userStatus === null, '📱 켜짐 · 상태 없음 → 🕒 를 싣지 않는다(받는 쪽이 📱 를 띄운다)');
  r = out('custom', F, C, true);  chk(r.userStatus === 'custom' && r.customStatus === C, '📱 켜짐 · 사용자가 고른 상태 → 상태가 이긴다');
  r = out(null, F, C, false);     chk(r.userStatus === 'custom' && r.customStatus === F, '📱 꺼짐 → 🕒 예전 그대로');
  chk(/const _conf = \(_mobApp && !us\) \? null : statusConfFor\(seat, us\);/.test(CODE), '내 화면도 같은 순서(상태 > 📱 > 🕒)');
  chk(/setSeatHeadBubble\(seat, _conf \? _conf\.label : _mobileBubbleText\(_mobApp\), true\)/.test(CODE), '상태 말풍선 자리에 «📱 앱» (생각 말풍선 · 회사원·숨김 갈래는 그대로)');
  const bt = new Function(grabFn('_mobileBubbleText').replace('MOBILE_APP_MAX', '40') + ' return _mobileBubbleText;')();
  chk(bt('Procreate') === '📱 Procreate' && bt('') === null, '  «📱 Procreate» · 빈 값이면 말풍선 없음');
  chk(/function _mobileChanged\(\)\{[\s\S]*?Presence\.broadcastNow\(\)/.test(CODE), '켜짐/꺼짐이 바뀌면 방에 바로 싣는다');
}

say('── 4. 서버 (firebase-init)');
{
  const st = grabBlock(FBI, 'async mobileLinkStart(') || '';
  chk(/onDisconnect\(liveRef\)\.remove\(\)/.test(st), 'live — onDisconnect remove');
  chk(/\.info\/connected/.test(st) && /s\.val\(\) === true\) arm\(\)/.test(st), 'live — 재접속 때 다시 건다');
  chk(/s && s\.on === true\) await update\(stateRef, \{ on:false \}\)/.test(st), '부팅 초기화 — 켜짐이 남아 있으면 on=false');
  chk(st.indexOf('update(stateRef') < st.indexOf('onValue(stateRef'), '  초기화가 구독보다 먼저');
  chk(!/presence/.test(strip(st)), 'presence 를 «PC 켜짐» 으로 쓰지 않는다(오프라인 토글이 폰까지 끊는다)');
  chk(/await _whenAuthReady\(\)/.test(st), '세션 복원 뒤에 쓴다');
  const sk = grabBlock(FBI, 'async mobileSetKey(') || '';
  chk(/set\(ref\(db, `mobileKeys\/\$\{userId\}`\), key\)/.test(sk) && /remove\(ref\(db, `mobileLink\/\$\{userId\}\/state`\)\)/.test(sk), '키 교체 — 키를 적고 예전 state 를 지운다');
  const un = grabBlock(FBI, 'async mobileUnlink(') || '';
  chk(/remove\(ref\(db, `mobileLink\/\$\{userId\}`\)\)/.test(un) && /remove\(ref\(db, `mobileKeys\/\$\{userId\}`\)\)/.test(un), '연결 끊기 — 키 · live · state 전부');
  const as = strip(grabFn('_mobileApplyState') || '');
  chk(/v\.key !== key/.test(as), '받은 state 는 이 PC 의 키로 쓴 것만 믿는다');
  chk(/o\.u === uid/.test(strip(grabFn('_mobileGetKey') || '')), '로컬 키는 계정(uid)과 묶여 있다 — 계정을 바꾸면 없는 것으로 본다');
  const ms = strip(grabFn('_mobileStart') || '');
  chk(/if\(!uid \|\| !key/.test(ms), '키가 없는 사람은 서버에 한 번도 안 간다(비용 0)');
  const ak = (SRC.match(/const ACCOUNT_LOCAL_KEYS = \(\)=>\[([\s\S]*?)\n\];/) || [])[1] || '';
  chk(!!ak && !/MOBILE_KEY_LS|tw\.mobileKey/.test(ak), '  로그아웃 목록 밖(서버에서 돌아올 길이 없는 값 · uid 대조로 막는다)');
  const nk = grabFn('_mobileNewKey');
  const key = new Function('crypto', nk + ' return _mobileNewKey();')(require('crypto').webcrypto);
  chk(/^[A-Z2-9]{24}$/.test(key) && !/[01IO]/.test(key), '키 24자 · 헷갈리는 글자 없음 (' + key.slice(0, 4) + '…)');
}

say('── 5. 규칙');
{
  let R = null; try{ R = JSON.parse(RULES).rules; }catch(_){}
  chk(!!R, '규칙 파일이 JSON');
  const K = R && R.mobileKeys && R.mobileKeys.$userId, L = R && R.mobileLink && R.mobileLink.$userId;
  chk(!!K && K['.read'] === false, 'mobileKeys 읽기 금지 (users/* 는 공개 읽기라 최상위에 둔다)');
  chk(!!K && /userAuth/.test(K['.write']) && /\[A-Z2-9\]\{24\}/.test(K['.validate']), 'mobileKeys 쓰기 = 주인 · 24자 모양');
  const S = L && L.state;
  chk(!!S && /newData\.child\('key'\)\.val\(\) === root\.child\('mobileKeys\/'\+\$userId\)\.val\(\)/.test(S['.write'])
          && /root\.child\('mobileLink\/'\+\$userId\+'\/live'\)\.exists\(\)/.test(S['.write']), 'state 쓰기 — key 일치 + live 있음(PC 가 꺼지면 거절)');
  chk(!!S && S.app && /length <= 40/.test(S.app['.validate']) && S.on && /isBoolean/.test(S.on['.validate']) && S.$other && S.$other['.validate'] === false, 'state 검증 — on bool · app ≤40 · 다른 칸 거부');
  chk(!!L && L.live && /userAuth/.test(L.live['.write']), 'live 쓰기 = 주인');
  chk(!!L && /userAuth/.test(L['.read']), 'mobileLink 읽기 = 주인');
  const M = R && R.rooms && R.rooms.$room && R.rooms.$room.$memberId;
  chk(!!M && /newData\.child\('mobile'\)\.val\(\)\.length <= 40/.test(M['.validate']), '방 멤버 mobile ≤ 40');
}

say('── 6. 화면');
{
  const iTab = HTMLC.indexOf('id="fsTabApp"'), iHint = HTMLC.indexOf('id="fsSlotHint"'), iMob = HTMLC.indexOf('id="fsMob"'), iNext = HTMLC.indexOf('id="fsTabDisplay"');
  chk(iTab > 0 && iHint > iTab && iMob > iHint && iMob < iNext, '📱 칸 — #fsTabApp 안 · #fsSlotHint 뒤');
  const blk = HTMLC.slice(iMob, iNext);
  chk(/id="fsMobSt"/.test(blk) && /id="fsMobQr"/.test(blk) && /id="fsMobUnlink"/.test(blk) && /id="fsMobNote"/.test(blk), '  상태 칸 · 버튼 둘 · 안내 줄');
  chk((blk.match(/<button/g) || []).length <= 2, '  버튼 한 줄 최대 2개(패널 300px)');
  chk(/#mobLinkOverlay \.box\{[^}]*border-color:var\(--win-hi\)[^}]*border-radius:var\(--win-radius-el\)/.test(HTML), 'QR 창 베젤 radius');
  chk(/html\[data-theme="bubble"\] #mobLinkOverlay \.ttl,/.test(HTML), '  제목줄이 버블 목록에');
  chk(/const UI_HIT_SEL = '[^']*#mobLinkOverlay/.test(CODE), '클릭 통과 목록(UI_HIT_SEL)에 QR 창');
  chk(/FS_KEEP_OPEN_SEL = \[[\s\S]*?'#mobLinkOverlay'[\s\S]*?\]\.join/.test(CODE), '설정 바깥 클릭 예외에도 QR 창');
  const iQr = HTMLC.indexOf('<script src="vendor/qrcode.js"></script>'), iApp = HTMLC.indexOf('<script src="parts/app.js"></script>');
  chk(iQr > 0 && iQr < iApp, 'QR 라이브러리 — 로컬 파일 · app.js 앞');
  chk(!/<script[^>]+src="https?:[^"]*qr/i.test(HTMLC), '  CDN 이 아니다(CSP)');
  const newCls = [...HTML.matchAll(/class="([^"]*(?:fs-mob|mob-)[^"]*)"/g)].map(m => m[1]).join(' ');
  chk(!!newCls && !/\bfly\b/.test(newCls), '새 클래스에 fly 없음');
  chk(/'https:\/\/together-working\.web\.app\/link#u='/.test(CODE) && !/link\?[uk]=/.test(CODE), 'QR 주소 — 키는 # 뒤(서버 로그에 안 남는다)');
  if(QRLIB){
    const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(QRLIB, ctx);
    const q = ctx.window.TWQR && ctx.window.TWQR.make('https://together-working.web.app/link#u=umfk2x3ab9c8d7e6f&k=ABCDEFGHJKLMNPQRSTUVWX23', 'M');
    const finder = q && [0, 6].every(r => [0, 6].every(c => q.dark(r, c))) && q.dark(0, q.n - 1) && q.dark(q.n - 1, 0) && !q.dark(7, 7);
    chk(!!q && q.n === 37 && finder, 'QR 인코더가 돈다 — 37칸 · 세 모서리 파인더 (' + (q && q.n) + ')');
    chk(/MIT/.test(QRLIB.slice(0, 1200)), '  MIT 표기 남음');
  } else say('  · vendor/qrcode.js 를 못 찾음 — QR 인코더 판정 건너뜀');
  if(HOST){
    chk(/location\.hash/.test(HOST) && !/location\.search/.test(HOST), '안내 페이지 — # 뒤에서 읽는다');
    chk(/'\.sv': 'timestamp'/.test(HOST) && /method:'PUT'/.test(HOST) && /\/mobileLink\/' \+ U \+ '\/state\.json'/.test(HOST), '  REST PUT · 서버 시각');
    chk(/신호 보내 보기/.test(HOST) && /✓ PC에 신호가 갔어요/.test(HOST) && /iPhone·iPad/.test(HOST) && /갤럭시/.test(HOST), '  시안 ④ 문구(탭 · 테스트 · 결과)');
  } else say('  · hosting/link.html 을 못 찾음 — 안내 페이지 판정 건너뜀');
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
