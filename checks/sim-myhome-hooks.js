/* sim-myhome-hooks.js — 🪝 마이홈 고리판(myhome-hooks.js) — 편집 묶음 · 마이홈 창이 거는 저장 · 배경 · 테마 · BGM 을 다른 파일이 이름으로 부르는 한 곳
   실행:  node sim-myhome-hooks.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 고리판은 이름으로 부르므로 코드만 보면 «누가 이 함수를 거나» 가 안 보이고, 이름을 잘못 쓰거나
     거는 줄을 빠뜨려도 부르는 자리의 try 가 삼켜 조용히 아무 일도 안 한다(배경이 안 바뀌는데 오류도 없다). 그래서 이름마다 거는 곳 · 부르는 곳을 센다.
   ・1절: 고리판 — 걸고 부르면 그 함수 · 인자 · 돌려준 값 그대로 · 안 걸린 이름은 던진다(예전 window.이름() 과 같다) · has · null 로 내리기
   ・2절: 이름마다 거는 곳이 정해진 한 파일 · 부르는 곳이 있다 · 아는 이름만 · 글자 이름으로 부르지 않음 · 받는 줄 모양 · 표
   ・3절: HTML 순서(쓰는 모듈 · app.js 보다 먼저) · smoke.js 가 진짜로 싣는다
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, 'checks/' + f, path.basename(f)]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('myhome/myhome-hooks.js'), HTML = read('desk-companion-prototype.html'), SMOKE = read('smoke.js');
if (!MOD || !HTML || !SMOKE) { say('  ? 원본 못 찾음 — myhome-hooks.js · desk-companion-prototype.html · smoke.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const SELF = 'myhome/myhome-hooks.js';
/* 이름 → 거는 파일(myhome-hooks.js 주석과 같다) */
const E = 'myhome/myhome-edit.js';
const OWNER = { COMMIT: E, APPLY_BG: E, APPLY_THEME: E, BGM_REFRESH: E, BGM_PLAYING: E, BGM_SET_PLAYING: E, BGM_DESTROY: E, DS_CLOSE: E, CANCEL_NAME_EDIT: E,
  SYNC_BGM_BOUNDS: 'myhome/myhome-ui.js' };

function load(mod) { const win = {}; new Function('window', 'module', mod)(win, undefined); return win.TwMyHomeHooks; }
function judge(mod, html, files) {
  const r = {};
  try {
    const H = load(mod);
    r.names = Object.keys(H.HOOK).sort().join() === Object.keys(OWNER).sort().join() && Object.isFrozen(H.HOOK);
    let got = null; H.on(H.HOOK.APPLY_BG, (...a) => { got = a; return 'ret'; });
    r.call = H.call(H.HOOK.APPLY_BG, 1, 'b') === 'ret' && got && got.join() === '1,b' && H.has(H.HOOK.APPLY_BG);
    let threw = null; try { H.call(H.HOOK.COMMIT, true); } catch (e) { threw = e; }
    r.unset = threw instanceof TypeError && !H.has(H.HOOK.COMMIT);
    H.on(H.HOOK.CANCEL_NAME_EDIT, () => 1); const on1 = H.has(H.HOOK.CANCEL_NAME_EDIT);
    H.on(H.HOOK.CANCEL_NAME_EDIT, null);
    r.clear = on1 && !H.has(H.HOOK.CANCEL_NAME_EDIT);
  } catch (e) { r.err = String(e && e.message || e); }
  const N = (() => { try { return Object.keys(load(mod).HOOK); } catch (_) { return []; } })();
  r.table = {}; r.unknown = []; r.literal = []; r.alias = [];
  for (const n of N) r.table[n] = { on: [], call: [] };
  for (const [f, t0] of files) {
    if (f === SELF) continue;
    const t = strip(t0);
    for (const m of t.matchAll(/\bmhHooks\.(on|call|has)\(\s*mhHooks\.HOOK\.([A-Z_]+)/g)) {
      if (!r.table[m[2]]) { r.unknown.push(f + ' ' + m[2]); continue; }
      const k = m[1] === 'on' ? 'on' : 'call';
      if (!r.table[m[2]][k].includes(f)) r.table[m[2]][k].push(f);
    }
    for (const m of t.matchAll(/\bmhHooks\.(on|call|has)\(\s*(?!mhHooks\.HOOK\.)/g)) r.literal.push(f + ' ' + m[1]);
    if (/\bmhHooks\./.test(t) && !/^const mhHooks = TwMyHomeHooks;/m.test(t0)) r.alias.push(f);
  }
  r.badOwner = N.filter(n => !(r.table[n].on.length === 1 && r.table[n].on[0] === OWNER[n]));
  r.noCaller = N.filter(n => !r.table[n].call.length);
  const order = [...html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
  const at = order.indexOf(SELF);
  const users = files.filter(([f, t]) => f !== SELF && /\bTwMyHomeHooks\b/.test(strip(t))).map(([f]) => f);
  r.late = at < 0 ? ['(myhome-hooks.js 를 안 싣는다)'] : users.concat('app.js').filter(f => order.indexOf(f) >= 0 && order.indexOf(f) < at);
  r.users = users.length;
  return r;
}

const ORDER = [...HTML.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b[^>]*\bsrc="parts\/([^"]+\.js)"/g)].map(m => m[1]);
const FILES = ORDER.map(f => [f, read(f)]).filter(([, t]) => t);
const R = judge(MOD, HTML, FILES);

say('── 1. 고리판');
chk(!R.err && R.names, '이름 ' + Object.keys(OWNER).length + '개(저장 · 배경 · 테마 · BGM 넷 · BGM 창 · 스튜디오 · 닉네임 취소 · BGM 창 자리) · 바꿀 수 없는 표' + (R.err ? ' — ' + R.err : ''));
chk(R.call, '건 함수를 그 인자로 부르고 돌려준 값을 그대로 돌려준다 · has 가 참');
chk(R.unset, '안 걸린 이름을 부르면 던진다(TypeError — 예전 window.이름() 과 같다 · 부르는 자리의 try 가 받는다)');
chk(R.clear, 'null 로 걸면 내려간다(닉네임 입력칸이 닫힐 때)');

say('── 2. 거는 곳 · 부르는 곳');
chk(!R.badOwner.length, '이름마다 거는 곳은 정해진 한 파일' + (R.badOwner.length ? ' — 어긋남: ' + R.badOwner.map(n => n + '(' + R.table[n].on.join(' · ') + ')').join(', ') : ''));
chk(!R.noCaller.length, '이름마다 부르는 곳이 있다(안 쓰는 이름을 남기지 않는다)' + (R.noCaller.length ? ' — ' + R.noCaller.join(' · ') : ''));
chk(!R.unknown.length && !R.literal.length, '부르는 곳은 mhHooks.HOOK.이름 으로만(모르는 이름 · 글자 이름 없음)' + (R.unknown.concat(R.literal).length ? ' — ' + R.unknown.concat(R.literal).join(' · ') : ''));
chk(!R.alias.length, '쓰는 파일은 «const mhHooks = TwMyHomeHooks;» 한 줄로 받는다' + (R.alias.length ? ' — ' + R.alias.join(' · ') : ''));
for (const n of Object.keys(R.table)) say('     ' + n + ' — 거는 곳 ' + R.table[n].on.join(' · ') + ' / 부르는 곳 ' + (R.table[n].call.join(' · ') || '(없음)'));

say('── 3. 싣는 순서');
chk(R.users >= 9 && !R.late.length, '쓰는 파일 ' + R.users + '개 · app.js 보다 myhome-hooks.js 를 먼저 싣는다' + (R.late.length ? ' — 먼저 실리는 것: ' + R.late.join(' · ') : ''));
chk(/PRELOAD\.push\('myhome-hooks\.js'\)/.test(SMOKE), 'smoke.js 가 진짜로 싣는다(빈 이름이면 거는 줄에서 선다)');

say('── 4. 일부러 깨 보기');
const twice = FILES.map(([f, t]) => [f, f === 'myhome/myhome-page.js' ? t + '\nmhHooks.on(mhHooks.HOOK.APPLY_BG, ()=>{});\n' : t]);
chk(judge(MOD, HTML, twice).badOwner.includes('APPLY_BG'), '다른 파일이 같은 이름을 또 걸면 빨강');
const unk = FILES.map(([f, t]) => [f, f === 'myhome/myhome-page.js' ? t + '\nmhHooks.call(mhHooks.HOOK.APPLY_BGG);\n' : t]);
chk(judge(MOD, HTML, unk).unknown.length > 0, '모르는 이름으로 부르면 빨강');
const lit = FILES.map(([f, t]) => [f, f === 'myhome/myhome-page.js' ? t + "\nmhHooks.call('applyBg');\n" : t]);
chk(judge(MOD, HTML, lit).literal.length > 0, '글자 이름으로 부르면 빨강');
const gone = FILES.map(([f, t]) => [f, f === 'purikura/purikura-ui.js' ? t.split('mhHooks.HOOK.BGM_SET_PLAYING').join('mhHooks.HOOK.BGM_PLAYING') : t]);
chk(judge(MOD, HTML, gone).noCaller.includes('BGM_SET_PLAYING'), '부르는 곳이 없어지면 빨강');
const line = '<script src="parts/myhome/myhome-hooks.js"></script>';
const lateHtml = HTML.indexOf(line) < 0 ? HTML : HTML.replace(line, '').replace('<script src="parts/app.js"></script>', '<script src="parts/app.js"></script>\n' + line);
chk(judge(MOD, lateHtml, FILES).late.length > 0, 'myhome-hooks.js 를 app.js 뒤로 옮기면 빨강');
chk(!judge(MOD.replace('function call(name, ...a){ return _fns[name](...a); }', 'function call(name, ...a){ const fn = _fns[name]; return fn ? fn(...a) : undefined; }'), HTML, FILES).unset, '안 걸린 이름을 조용히 넘기게 바꾸면 빨강');

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 마이홈 저장 · 배경 · 테마 · BGM 은 고리판 한 곳'));
process.exit(fail ? 1 : 0);
