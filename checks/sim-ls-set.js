/* ═══ 💾 sim-ls-set.js — localStorage 쓰기 · 지우기 한 곳(shared/ls-set.js) · 저장 실패 안내 자리(app.js 분리 F5) ═══════════════
   ・1절: 규칙 — 남으면 true · 값이 안 남는 환경 · setItem 이 던지는 환경 · 지우기 · 번호(설정 E-SYS-09 / 데이터 E-SYS-10) · 번호마다 세션당 한 번
   ・2절: 자리마다 — 렌더러에서 TwLsSet 을 부르는 줄을 모두 찾아 «그 줄의 부르기» 를 그대로 돌린다(이름은 가짜 값).
     저장소가 던지면 안내가 한 번 · 두 번째는 조용 · 잘 되면 안내 없음. 자리 표(SITES)와 개수 · 번호가 맞는지.
     별 색(setStarColor)은 함수째로 돌려 실패면 false(내 정보가 그 값으로 멈춘다) · 자리 고정(saveMode)은 받은 저장 함수로 쓴다.
   ・3절: 연결 — html 순서 · app.js 가 만드는 줄 · 옛 이름
   ・4절: 일부러 깨 보기 */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const stripC = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const depPairs = (APP, mod, glob, create) => { const m = APP.match(new RegExp('const ' + mod + ' = ' + glob + '\\.' + create + '\\(\\{\\n([\\s\\S]*?)\\n\\}\\);')); return m ? m[1].split('\n').map(l => /^  ([\w$]+): (.+),$/.exec(l)).filter(Boolean).map(x => [x[1], x[2]]) : null; };
const SRC = read('shared/ls-set.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !APP || !HTML){ say('  ? 원본 못 찾음'); process.exit(2); }

/* 저장소 — ok: 남는다 · drop: 던지지 않는데 안 남는다 · throw: 쓰기 · 지우기가 던진다 */
function mkStore(mode){
  const store = {};
  return {
    store,
    setItem: (k, v) => { if(mode === 'throw') throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); if(mode !== 'drop') store[k] = String(v); },
    getItem: (k) => (k in store ? store[k] : null),
    removeItem: (k) => { if(mode === 'throw') throw new Error('quota'); if(mode !== 'drop') delete store[k]; },
  };
}
/* 파일을 새로 실어 window 것과 createLsSet 것을 함께 돌려준다(세션 = 한 번 실린 동안). */
function build(src, mode){
  const ls = mkStore(mode), notes = [], warns = [];
  const win = { TwErrorCodes: { notify: (c, e) => { notes.push(c); return true; } } };
  new Function('window', 'localStorage', 'console', 'module', src)(win, ls, { warn: (...a) => warns.push(a), log(){}, error(){} }, undefined);
  const own = [];
  const mod = win.TwLsSet.createLsSet({ notifyError: (c) => own.push(c) });
  return { api: win.TwLsSet, mod, ls, notes, own, warns };
}

say('§1 규칙');
{
  let b = build(SRC, 'ok');
  chk(b.api.lsSet('tw.a', 5) === true && b.ls.store['tw.a'] === '5' && b.notes.length === 0, '설정 — 남으면 true · 글자로 저장 · 안내 없음');
  chk(b.api.lsSave('tw.d', 7) === true && b.ls.store['tw.d'] === '7' && b.notes.length === 0, '데이터 — 남으면 true · 안내 없음');
  chk(b.api.lsUnset('tw.a') === true && b.api.lsRemove('tw.d') === true && !('tw.a' in b.ls.store) && !('tw.d' in b.ls.store) && b.notes.length === 0, '지우기 — 지워지면 true');
  chk(b.api.lsSet('tw.n', null) === true && b.ls.store['tw.n'] === 'null', 'null · 0 도 글자로 남긴다(setItem 과 같게)');
  b = build(SRC, 'drop');
  chk(b.api.lsSet('tw.a', 1) === false && b.warns.length === 1 && b.notes.join() === 'E-SYS-09', '★ setItem 이 던지지 않아도 값이 안 남으면 실패(왕복 확인) — 경고 + E-SYS-09');
  b = build(SRC, 'throw');
  chk(b.api.lsSet('tw.a', 1) === false && b.notes.join() === 'E-SYS-09', '설정 쓰기가 던지면 false · E-SYS-09');
  b.api.lsSet('tw.b', 1); b.api.lsUnset('tw.c');
  chk(b.notes.length === 1 && b.warns.length === 3, '설정 안내는 세션당 한 번 · 콘솔 경고는 매번');
  chk(b.api.lsSave('tw.s', 'x') === false && b.notes.join() === 'E-SYS-09,E-SYS-10', '데이터 쓰기가 던지면 false · 번호가 달라 따로 한 번(E-SYS-10)');
  b.api.lsRemove('tw.s'); b.api.lsSave('tw.t', 'y');
  chk(b.notes.length === 2, '데이터 안내도 세션당 한 번');
  b.mod._lsSet('tw.z', 1); b.mod.lsSave('tw.z', 1);
  chk(b.own.length === 0, '★ app.js 가 만든 것과 window 것이 «한 번» 을 같이 센다(둘이 따로 뜨지 않음)');
  b = build(SRC, 'throw');
  chk(b.api.lsRemove('tw.r') === false && b.notes.join() === 'E-SYS-10', '데이터 지우기가 던지면 false · E-SYS-10');
  let threw = false; try{ build(SRC, 'throw').api.lsSave('k', 'v'); }catch(_){ threw = true; }
  chk(!threw, '던지지 않는다(부르는 자리의 try 를 걷어도 된다)');
}

say('§2 자리마다');
/* 부르는 쪽 파일 → 부르는 이름별 개수. 줄이 사라지거나(그냥 localStorage 로 되돌림) 이름이 바뀌면(데이터 ↔ 설정) 빨강. */
const SITES = {
  'app.js': { lsSave: 2, lsSet: 2 },                       // 새 친구 코드 · 이름 / 고른 슬롯 · 업데이트 공지 «다시 보지 않기»
  'shared/theme-ui.js': { lsSet: 3 },
  'chat/chat-prefs.js': { lsSet: 6 },
  'launcher/settings-panel.js': { lsSet: 9 },              // 토글 여섯(seatEq · 자리 고정 · decoParts · chipHorz · emoji · dot · nameplate) · 이름표 크기 · 추가 좌석
  'room/seats.js': { lsSet: 2 },
  'room/interaction-desk.js': { lsSet: 1, lsUnset: 1 },
  'room/away-pic.js': { lsSet: 2, lsUnset: 1 },
  'room/char-place.js': { lsSet: 2 },
  'status/noise.js': { lsSet: 1 },
  'status/status-chip.js': { lsSet: 1 },
  'focus/pomodoro.js': { lsSet: 1 },
  'focus/focus-log.js': { lsSet: 1 },
  'focus/focus-level.js': { lsSet: 1, lsSave: 1 },         // 별 색 / 폰 연결 키
  'myhome/scheduler.js': { lsSet: 2 },
  'account/account.js': { lsSave: 12, lsRemove: 2 },
  'account/account-state.js': { lsSave: 1 },
  'account/license-gate.js': { lsSave: 11, lsRemove: 2 },
  'character/slot-save.js': { lsSave: 1 },
  'character/commission.js': { lsSave: 1 },
  'room/hidden-seats.js': { lsSave: 1 },
  'status/user-status.js': { lsSave: 2 },
  'myhome/mallang.js': { lsSave: 2 },
  'myhome/myhome-desktop.js': { lsSave: 1 },
  'myhome/bookmark.js': { lsSave: 1 },
};
const CODE_OF = { lsSet: 'E-SYS-09', lsUnset: 'E-SYS-09', lsSave: 'E-SYS-10', lsRemove: 'E-SYS-10' };
/* 아무 이름이나 받아 주는 가짜 값 — 부르면 자기, 속성도 자기, 글자 ''/숫자 0, 비어 있는 반복 */
const ANY = new Proxy(function(){}, {
  get(t, k){
    if(k === Symbol.toPrimitive) return (h) => (h === 'number' ? 0 : '');
    if(k === Symbol.iterator) return function*(){};
    if(k === 'then') return undefined;
    if(k === 'length') return 0;
    return ANY;
  },
  apply(){ return ANY; },
});
const REAL = new Set(['JSON', 'String', 'Number', 'Math', 'Array', 'Object', 'Set', 'Map', 'Date', 'parseInt', 'isFinite', 'undefined', 'NaN', 'Infinity', 'Error', 'Symbol']);
function scopeWith(over){
  return new Proxy({}, { has: (t, k) => typeof k === 'string' && !REAL.has(k), get: (t, k) => (k === Symbol.unscopables ? undefined : k in over ? over[k] : ANY) });
}
/* 줄에서 «TwLsSet.이름(…)» 부르기를 괄호 짝까지 잘라 낸다 */
function callsIn(src){
  const out = [];
  const code = stripC(src);
  const re = /TwLsSet\.(lsSet|lsUnset|lsSave|lsRemove)\b/g;
  let m;
  while((m = re.exec(code))){
    let i = m.index + m[0].length, depth = 0, j = i;
    if(code[i] !== '('){ out.push({ name: m[1], expr: m[0], ref: true }); continue; }   // 저장 함수로 넘김(saveMode)
    for(; j < code.length; j++){ if(code[j] === '(') depth++; else if(code[j] === ')' && --depth === 0) break; }
    out.push({ name: m[1], expr: code.slice(m.index, j + 1) });
  }
  return out;
}
function runExpr(expr, api, over){
  return new Function('__s', 'with(__s){ return (' + expr + '); }')(scopeWith(Object.assign({ TwLsSet: api, TwSeatPin: over.TwSeatPin }, over)));
}
const PIN_SRC = read('room/seat-pin.js');
const PIN = (() => { const w = {}; new Function('window', 'module', PIN_SRC)(w, undefined); return w.TwSeatPin; })();
function checkSites(srcOf, sites){
  const bad = [];
  let n = 0;
  for(const f of Object.keys(sites)){
    const src = srcOf(f);
    if(!src){ bad.push(f + ' 원본 없음'); continue; }
    const calls = callsIn(src);
    const count = {};
    for(const c of calls) count[c.name] = (count[c.name] || 0) + 1;
    const want = sites[f];
    for(const k of new Set([...Object.keys(want), ...Object.keys(count)])) if((want[k] || 0) !== (count[k] || 0)) bad.push(f + ' ' + k + ' ' + (count[k] || 0) + '/' + (want[k] || 0));
    for(const c of calls){
      n++;
      const expr = c.ref ? 'TwSeatPin.saveMode(' + c.expr + ', "right")' : c.expr;
      const b = build(SRC, 'throw');
      try{
        const r1 = runExpr(expr, b.api, { TwSeatPin: PIN });
        const r2 = runExpr(expr, b.api, { TwSeatPin: PIN });
        if(!(r1 === false && r2 === false && b.notes.length === 1 && b.notes[0] === CODE_OF[c.name])) bad.push(f + ' «' + expr.slice(0, 60) + '» 실패 → ' + b.notes.join('|'));
        const g = build(SRC, 'ok');
        if(runExpr(expr, g.api, { TwSeatPin: PIN }) !== true || g.notes.length) bad.push(f + ' «' + expr.slice(0, 60) + '» 성공 길');
      }catch(e){ bad.push(f + ' «' + expr.slice(0, 60) + '» 던짐 ' + e.message); }
    }
  }
  return { bad, n };
}
{
  const r = checkSites(read, SITES);
  const total = Object.values(SITES).reduce((a, o) => a + Object.values(o).reduce((x, y) => x + y, 0), 0);
  chk(!r.bad.length && r.n === total, '자리 ' + r.n + '곳 — 저장소가 던지면 안내 한 번 · 두 번째는 조용 · 잘 되면 안내 없음 · 표와 개수 · 번호가 맞다' + (r.bad.length ? ' — ' + r.bad.slice(0, 6).join(' / ') : ''));
  /* 자리 표 밖에서 새로 부르면 표에 더한다(어느 번호로 알리는지 정하고) */
  const parts = (() => { const out = []; const root = ['app/parts', 'parts', '.'].find(d => fs.existsSync(path.join(d, 'app.js'))); const walk = (d) => { for(const e of fs.readdirSync(d, { withFileTypes: true })){ const p = path.join(d, e.name); if(e.isDirectory()){ if(!/node_modules|vendor/.test(e.name)) walk(p); } else if(e.name.endsWith('.js') && !/^(sim-|audit|run\.js|smoke)/.test(e.name)) out.push(p); } }; walk(root); return out; })();
  const known = new Set(Object.keys(SITES).map(f => f.split('/').pop()).concat(['ls-set.js']));
  const extra = parts.filter(p => !known.has(path.basename(p)) && callsIn(fs.readFileSync(p, 'utf8')).length).map(p => path.basename(p));
  chk(!extra.length, '표 밖에서 부르는 파일 없음' + (extra.length ? ' — ' + extra.join(', ') : ''));
}
{
  /* 별 색 — 함수째. 내 정보 팔레트는 false 면 아무것도 안 하고 멈춘다(그 전에 안내가 떠야 한다) */
  const FL = read('focus/focus-level.js');
  const m = /function setStarColor\(c\)\{[\s\S]*?\n\}/.exec(FL);
  const run = (mode) => { const b = build(SRC, mode); const f = new Function('__s', 'with(__s){ return ' + m[0] + '; }')(scopeWith({ TwLsSet: b.api, _starColorOk: (c) => c === '#fff', STAR_COLOR_KEY: 'tw.starColor' })); return { b, f }; };
  let t = run('throw');
  chk(!!m && t.f('#fff') === false && t.b.notes.join() === 'E-SYS-09', '별 색 — 못 남기면 false · 안내(E-SYS-09)');
  t = run('ok');
  chk(t.f('#fff') === true && t.b.ls.store['tw.starColor'] === '#fff' && t.f('bad') === false, '  남으면 true · 모르는 색은 쓰지 않고 false');
  const got = [];
  chk(PIN.saveMode((k, v) => { got.push([k, v]); return true; }, 'right') === true && got[0][0] === PIN.MODE_KEY && got[0][1] === 'right' && PIN.saveMode((k, v) => { got.push([k, v]); return false; }, '???') === false && got[1][1] === 'row', '자리 고정 — 받은 저장 함수로 쓰고 그 결과를 돌려준다 · 모르는 값은 «줄 안에 함께»');
}

say('§3 연결');
{
  const iE = HTML.indexOf('<script src="parts/shared/error-codes.js"></script>'), iM = HTML.indexOf('<script src="parts/shared/ls-set.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
  chk(iE > 0 && iM > iE && iA > iM, 'html — error-codes.js 다음 · app.js 보다 먼저 싣는다');
  const late = Object.keys(SITES).filter(f => f !== 'app.js').filter(f => { const i = HTML.indexOf('<script src="parts/' + f + '"'); return i >= 0 && i < iM; });
  chk(!late.length, '  부르는 모듈보다 먼저' + (late.length ? ' — 늦음: ' + late.join(', ') : ''));
  const code = stripC(APP);
  const pairs = depPairs(APP, 'lsSetMod', 'TwLsSet', 'createLsSet');
  chk(!!pairs && pairs.length === 1 && pairs[0][0] === 'notifyError' && pairs[0][1] === '(...a)=>TwErrorCodes.notify(...a)', 'app.js — 만든다 · deps 는 notifyError 하나');
  chk(/^const _lsSet = lsSetMod\._lsSet;/m.test(code) && !/function _lsSet\b/.test(code), '  옛 이름을 const 로 받고 본문은 안 남음');
}

say('§4 일부러 깨 보기');
{
  const brk = (s, a, b) => { const m = s.replace(a, b); return m === s ? null : m; };
  const m1 = brk(SRC, "if(localStorage.getItem(key) !== s) throw new Error('값이 남지 않음');", "");
  chk(!!m1 && build(m1, 'drop').api.lsSet('k', 1) === true, '왕복 확인을 빼면 빨강');
  const m2 = brk(SRC, "if(_warned[code]) return false;", "");
  chk(!!m2 && (() => { const b = build(m2, 'throw'); b.api.lsSave('a', 1); b.api.lsSave('b', 1); return b.notes.length === 2; })(), '세션당 한 번 제한을 빼면 빨강');
  const m3 = brk(SRC, "function lsSave(key, val){ const e = _write(key, val); if(e && _first('E-SYS-10', key, e)) notifyError('E-SYS-10', e);", "function lsSave(key, val){ const e = _write(key, val); if(e && _first('E-SYS-09', key, e)) notifyError('E-SYS-09', e);");
  chk(!!m3 && build(m3, 'throw').api.lsSave('a', 1) === false && (() => { const b = build(m3, 'throw'); b.api.lsSave('a', 1); return b.notes[0] !== 'E-SYS-10'; })(), '데이터 실패를 설정 번호로 바꾸면 빨강');
  /* 자리 하나를 옛 모양(빈 catch)으로 되돌리면 2절이 빨강 */
  const BM = read('myhome/bookmark.js');
  const bm = brk(BM, /TwLsSet\.lsSave\(BM_KEY, ([^\n]*)\);/, 'try{ localStorage.setItem(BM_KEY, $1); }catch(_){}');
  chk(!!bm && checkSites((f) => f === 'myhome/bookmark.js' ? bm : read(f), { 'myhome/bookmark.js': { lsSave: 1 } }).bad.length > 0, '자리를 빈 catch 로 되돌리면 빨강');
  const sv = brk(read('character/slot-save.js'), 'TwLsSet.lsSave(LS_KEY', 'TwLsSet.lsSet(LS_KEY');
  chk(!!sv && checkSites((f) => sv, { 'character/slot-save.js': { lsSave: 1 } }).bad.length > 0, '캐릭터 슬롯을 설정 번호로 바꾸면 빨강');
  const FL = read('focus/focus-level.js');
  const sc = brk(FL, "  return TwLsSet.lsSet(STAR_COLOR_KEY, c);", "  TwLsSet.lsSet(STAR_COLOR_KEY, c);\n  return true;");
  chk(!!sc && (() => { const m = /function setStarColor\(c\)\{[\s\S]*?\n\}/.exec(sc); const b = build(SRC, 'throw'); return new Function('__s', 'with(__s){ return ' + m[0] + '; }')(scopeWith({ TwLsSet: b.api, _starColorOk: () => true }))('#fff') === true; })(), '별 색이 실패를 true 로 덮으면 빨강(판정이 잡는다)');
}
say(''); say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail); process.exit(fail ? 1 : 0);
