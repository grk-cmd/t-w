/* 🗂️ sim-lobby-window.js — 방 찾기 · 만들기(로비)를 런처에서 열면 앱 창이 마이홈 크기로 — node sim-lobby-window.js
   app.js 의 applyDesktopRunClass 본문과 INIT 의 로비 감시(MutationObserver) 줄을 **실제로 떼어 돌린다**.
   ・1절: 화면 상태(런처 · 마이홈 · 로비 · 생성기) → main 에 보내는 창 모드 · 스티커 여백
   ・2절: 로비 .on 이 바뀌면 창 크기를 다시 맞춘다(감시 줄)
   ・3절: 깨 보기 — 로비를 안 보거나, 로비에도 스티커 여백을 보내면 빨강 */

const fs = require('fs');
const path = require('path');

const SRC_PATH = path.join(__dirname, 'app.js');
if(!fs.existsSync(SRC_PATH)){ console.log('✗ app.js 를 못 찾음 — node checks/run.js lobby-window 로 돌릴 것'); process.exit(2); }
const SRC = fs.readFileSync(SRC_PATH, 'utf8');

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if(!ok) fail++; };

/* 주석만 같은 길이의 공백으로(자리 보존) — 주석에 인용된 옛 코드에 걸리지 않게. 문자열 안은 안 건드린다. */
function stripComments(s){
  const out = s.split(''); let i = 0;
  while(i < s.length){
    const c = s[i];
    if(c === '"' || c === "'" || c === '`'){
      const q = c; i++;
      while(i < s.length){
        if(s[i] === '\\'){ i += 2; continue; }
        if(s[i] === q){ i++; break; }
        if(s[i] === '\n' && q !== '`') break;
        i++;
      }
      continue;
    }
    if(c === '/' && s[i+1] === '/'){ let j = s.indexOf('\n', i); if(j < 0) j = s.length; for(let k = i; k < j; k++) out[k] = ' '; i = j; continue; }
    if(c === '/' && s[i+1] === '*'){ let j = s.indexOf('*/', i+2); j = (j < 0) ? s.length : j + 2; for(let k = i; k < j; k++) if(out[k] !== '\n') out[k] = ' '; i = j; continue; }
    i++;
  }
  return out.join('');
}
/* 서명부터 중괄호를 세어 본문을 뗀다. */
function fnBody(src, sig){
  const at = src.indexOf(sig);
  if(at < 0) return null;
  const win = stripComments(src.slice(at, at + 20000));
  const open = win.indexOf('{');
  let depth = 0;
  for(let k = open; k < win.length; k++){
    const c = win[k];
    if(c === '"' || c === "'" || c === '`'){ const q = c; k++; while(k < win.length){ if(win[k] === '\\'){ k += 2; continue; } if(win[k] === q) break; k++; } continue; }
    if(c === '{') depth++;
    else if(c === '}'){ depth--; if(depth === 0) return win.slice(open + 1, k); }
  }
  return null;
}

const BODY = fnBody(SRC, 'function applyDesktopRunClass()');
if(BODY === null){ console.log('✗ app.js 에서 applyDesktopRunClass 를 못 뗐다 — 서명이 바뀌었는지 확인할 것'); process.exit(1); }

/* 가짜 화면 — 켜진 오버레이 id 묶음과 main 으로 간 마지막 요청만 본다 */
function mkEnv(on){
  const cls = (id) => ({ contains: (c) => c === 'on' && on.has(id), toggle(){} });
  const els = {};
  ['launcher', 'myHomeOverlay', 'inviteOverlay'].forEach(id => { els[id] = { classList: cls(id) }; });
  const sent = [];
  return {
    sent,
    document: { getElementById: (id) => els[id] || null, body: { classList: { toggle(){} } } },
    companion: { setConfigMode: (config, mode, extra) => sent.push({ config, mode, extra }) },
  };
}
const PAD = { l: 30, r: 0, t: 0, b: 0 };
function run(body, st){
  const env = mkEnv(new Set(st.on));
  const fn = new Function('document', 'window', 'companion', 'desktopMode', 'creatorOpen', 'myHomeOpen', 'appMode', 'mhStLayoutMod', body);
  fn(env.document, { companion: env.companion }, env.companion, true, !!st.creator, false, 'run', { _mhStickerOverhang: () => PAD });
  return env.sent[env.sent.length - 1];
}
const CASES = [
  { name: '런처만', on: ['launcher'], mode: 'launcher', extra: null },
  { name: '런처 + 로비 → 마이홈 크기 · 스티커 여백 없음', on: ['launcher', 'inviteOverlay'], mode: 'myhome', extra: null },
  { name: '런처 + 마이홈 → 마이홈 크기 · 스티커 여백', on: ['launcher', 'myHomeOverlay'], mode: 'myhome', extra: PAD },
  { name: '런처 + 마이홈 + 로비 → 마이홈 크기 · 스티커 여백', on: ['launcher', 'myHomeOverlay', 'inviteOverlay'], mode: 'myhome', extra: PAD },
  { name: '방 안(런처 닫힘) + 로비 → 실행 화면 그대로', on: ['inviteOverlay'], mode: 'run', extra: null },
  { name: '생성기 + 로비 → 생성기 크기', on: ['launcher', 'inviteOverlay'], creator: true, mode: 'creator', extra: null },
];
const passAll = (body) => CASES.every(c => { const r = run(body, c); return r && r.mode === c.mode && r.extra === c.extra; });

console.log('=== 1. 화면 상태 → 창 모드 ===');
CASES.forEach(c => { const r = run(BODY, c); chk(r && r.mode === c.mode && r.extra === c.extra, c.name + ' (받은 값: ' + (r ? r.mode + ' · ' + JSON.stringify(r.extra) : '요청 없음') + ')'); });

console.log('\n=== 2. 로비 .on 이 바뀌면 창 크기를 다시 맞춘다 ===');
{
  const MARK = "{ const ov=document.getElementById('inviteOverlay');";
  const at = SRC.indexOf(MARK);
  chk(at >= 0, 'INIT 에 로비 감시 줄이 있다');
  if(at >= 0){
    const line = SRC.slice(at, SRC.indexOf('\n', at));
    const target = {}; let watched = null, opts = null, calls = 0;
    function MutationObserver(cb){ this.observe = (el, o) => { watched = { el, cb }; opts = o; }; }
    new Function('document', 'MutationObserver', 'applyDesktopRunClass', line)(
      { getElementById: (id) => id === 'inviteOverlay' ? target : null }, MutationObserver, () => { calls++; });
    chk(!!watched && watched.el === target && opts && opts.attributes && (opts.attributeFilter || []).includes('class'), '  #inviteOverlay 의 class 를 본다');
    if(watched) watched.cb();
    chk(calls === 1, '  바뀌면 applyDesktopRunClass 를 한 번 부른다');
  }
}

console.log('\n=== 3. 깨 보기 ===');
{
  const noLobby = BODY.replace('(mhOn || lobbyOn) && launcherOn', 'mhOn && launcherOn');
  chk(noLobby !== BODY && !passAll(noLobby), '  로비를 안 보면(런처 크기에 갇힘) → 빨강');
  const padLobby = BODY.replace("(mode === 'myhome' && mhOn)", "(mode === 'myhome')");
  chk(padLobby !== BODY && !passAll(padLobby), '  로비에도 마이홈 스티커 여백을 보내면 → 빨강');
}

if(fail){ console.log('✗ 실패 ' + fail + '건'); process.exit(1); }
console.log('전부 통과 ✅');
