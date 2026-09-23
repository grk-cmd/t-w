/* ═══ 🍎 sim-mac-0923.js — 2026-09-23 Mac 제보 여섯 (개정 67 신설) ═══════════════════════════
   ・1절: ⌨️ 한글 조합 중 Enter 무시 — 대화창(#chatInput) · 머리 위 말풍선 입력(#myChatInput) 둘 다
   ・2절: 🖊️ 표정 그리기 — 묶인 점(getCoalescedEvents)은 마지막 점이 이벤트와 2px 안일 때만 쓴다
   ・3절: 🧪 가짜 방 금지 — firebaseAPI 를 기다리고, 없으면 입장하지 않는다(개발 표식 tw.mockRoom=1 만 예외)
   ・4절: 🍎 단축키 — mac 은 ⌘1~⌘5 도 F1~F5 로 · 표시도 ⌘ 로
   ・5절: 🐢 성능 — mac 실행 화면 픽셀 비율 상한 · 설정(런처) 화면에서 숨은 3D 를 안 그린다
   ・6절: 🖌️ 펜 앱 — mac 은 표시 이름으로 판정(main.js _isPenApp)
   [실행] app.js · main.js 가 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), MAIN = read('main.js');
if(!SRC || !MAIN){ say('  ? 원본 못 찾음 — app.js · main.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const CODE = strip(SRC), MC = strip(MAIN);
const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return ''; let k = src.indexOf('{', i), d = 0;
  for(; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}' && --d === 0) return src.slice(i, k + 1); } return ''; };

(async ()=>{
say('── 1. ⌨️ 조합 중 Enter');
{
  chk(/if\(e\.isComposing \|\| e\.keyCode === 229\) return;\s*if\(e\.key==='Enter'\)\{ e\.preventDefault\(\); _sendChatWindowMsg\(\); \}/.test(CODE)
      && (CODE.match(/_sendChatWindowMsg\(\); \}/g) || []).length === 1, '대화창 — 조합 중이면 Enter 보다 먼저 빠진다(전송 줄은 하나)');
  const b = CODE.indexOf("chatInput.addEventListener('keydown', e=>{"), bSeg = CODE.slice(b, b + 400);
  chk(b > 0 && /if\(e\.isComposing \|\| e\.keyCode === 229\) return;\s*if\(e\.key==='Enter'\)\{/.test(bSeg), '말풍선 입력 — 같은 가드');
  /* 흉내: mac 순서(조합 중 Enter → 확정 → 다시 Enter)에서 한 번만 보낸다 */
  const sent = []; let val = '안녕하세';
  const h = (e)=>{ if(e.isComposing || e.keyCode === 229) return; if(e.key === 'Enter'){ sent.push(val); val = ''; } };
  val = '안녕하세요'; h({ key:'Enter', isComposing:true, keyCode:13 }); h({ key:'Enter', isComposing:false, keyCode:13 });
  chk(sent.length === 1 && sent[0] === '안녕하세요', 'mac 순서 흉내 — 한 줄만 간다');
}
say('── 2. 🖊️ 묶인 점');
{
  chk(/const _cOk = !!\(_cLast && Math\.abs\(_cLast\.clientX - e\.clientX\) <= 2 && Math\.abs\(_cLast\.clientY - e\.clientY\) <= 2\);/.test(CODE) && /if\(_cOk\)\{ for\(const ce of evs\) paintFromEvent\(ce\); \}\s*else paintFromEvent\(e\);/.test(CODE), '마지막 묶인 점이 이벤트와 2px 안일 때만 묶인 점을 쓴다');
  chk(!/if\(evs&&evs\.length\)\{ for\(const ce of evs\) paintFromEvent\(ce\); \}/.test(CODE), '무조건 쓰던 옛 줄이 없다');
}
say('── 3. 🧪 가짜 방');
{
  const i = CODE.indexOf('provider = window.firebaseAPI ? makeFirebaseProvider() : makeMockProvider();'), seg = CODE.slice(i - 700, i);
  chk(i > 0 && /if\(!window\.firebaseAPI\) await _waitFirebaseApi\(NET_READY_WAIT_MS\);/.test(seg) && /if\(!window\.firebaseAPI && !_mockRoomAllowed\(\)\)\{[\s\S]*return;\s*\}/.test(seg), '기다리고 · 없으면 입장하지 않는다');
  const W = { firebaseAPI:null, _l:{}, addEventListener(n, f){ this._l[n] = f; } };
  const mk = new Function('window', 'setTimeout', grab(SRC, '_waitFirebaseApi') + ' return _waitFirebaseApi;');
  const wait = mk(W, (f, ms)=>{ W._t = f; });
  let p = wait(10000); W.firebaseAPI = {}; W._l['firebase-ready'](); chk(await p === true, '준비 신호가 오면 곧바로 풀린다');
  const W2 = { firebaseAPI:null, addEventListener(){} }; const wait2 = new Function('window', 'setTimeout', grab(SRC, '_waitFirebaseApi') + ' return _waitFirebaseApi;')(W2, (f)=>f());
  chk(await wait2(10) === false, '시간이 다 되면 false(가짜 방으로 떨어지지 않음)');
  const A = new Function('localStorage', grab(SRC, '_mockRoomAllowed') + ' return _mockRoomAllowed;');
  chk(A({ getItem:()=>null })() === false && A({ getItem:()=>'1' })() === true, '가짜 방은 tw.mockRoom=1 일 때만');
}
say('── 4. 🍎 단축키');
{
  chk(/if\(_SC_MAC && e\.metaKey && !e\.ctrlKey && !e\.altKey && \/\^Digit\[1-5\]\$\/\.test\(e\.code \|\| ''\)\)\{/.test(CODE) && /key:'F' \+ _orig\.code\.slice\(5\)/.test(CODE), 'mac ⌘1~⌘5 → F1~F5 같은 분기');
  chk(/case 'F1': triggerClick\('myFocusGearBtn'\)/.test(CODE), 'F 키 분기는 그대로(한 벌)');
  chk(/el\.textContent = '⌘' \+ m\[1\]/.test(CODE) && /replace\(\/\\\(F\(\[1-5\]\)\\\)\/g, '\(⌘\$1\)'\)/.test(CODE), '표시(.fkey · title)를 ⌘ 로');
}
say('── 5. 🐢 성능');
{
  chk(/const MAC_RUN_MAX_PR = 1\.5;/.test(CODE) && /const _prCap = _IS_MAC_RENDER \? MAC_RUN_MAX_PR : 2;/.test(CODE) && /Math\.min\(devicePixelRatio,_prCap\)/.test(CODE), 'mac 실행 화면 픽셀 비율 상한 1.5 · Windows 는 2 그대로');
  chk(/if\(!\(document\.body\.classList\.contains\('desktop'\) && document\.body\.classList\.contains\('config'\)\)\) renderer\.render\(scene,camera\);/.test(CODE), '설정 화면(#scene 숨김)에서는 메인 3D 를 안 그린다');
}
say('── 6. 🖌️ 펜 앱(main.js)');
{
  const re = (MAIN.match(/const PEN_APPS_MAC_RE = (\/[^\n]+\/i);/) || [])[1];
  const mk = (plat) => new Function('PEN_APPS', 'sysinput', 'process', 'const PEN_APPS_MAC_RE = ' + re + ';' + grab(MAIN, '_isPenApp') + ' return _isPenApp;')(new Set(['clipstudiopaint.exe']), { displayNameOf:(p)=>String(p).split('/').filter(x=>/\.app$/.test(x)).pop()?.replace(/\.app$/, '') || '' }, { platform:plat });
  const mac = mk('darwin'), win = mk('win32');
  chk(!!re, 'mac 이름 목록이 있다');
  chk(mac('jp.co.celsys.clipstudiopaint', '/Applications/CLIP STUDIO 1.5/CLIP STUDIO PAINT.app/Contents/MacOS/CLIP STUDIO PAINT') === true, 'mac — CLIP STUDIO PAINT.app 은 펜 앱');
  chk(mac('com.adobe.photoshop', '/Applications/Adobe Photoshop 2026/Adobe Photoshop 2026.app/Contents/MacOS/Adobe Photoshop 2026') === true, 'mac — Photoshop');
  chk(mac('com.google.chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') === false, 'mac — Chrome 은 아님');
  chk(win('clipstudiopaint.exe', 'C:\\x\\CLIPStudioPaint.exe') === true && win('chrome.exe', 'C:\\x\\chrome.exe') === false, 'Windows 는 예전 exe 목록 그대로');
  chk(/const penNow = _isPenApp\(exeName, ownerPath\);/.test(MC) && !/const penNow = PEN_APPS\.has\(exeName\);/.test(MC), '활성 창 판정이 _isPenApp 을 거친다');
}
say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
})();
