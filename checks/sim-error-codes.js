/* ═══ ⚠️ sim-error-codes.js — 에러코드 표 · 알리는 통로 · 부르는 곳 (error-codes.js) ═══════════
   ・1절: 표 — 번호 모양(E-영역-두자리) · 아는 영역 · 문구 · 자리 · 걷은 번호와 안 겹침
   ・2절: notify — 표의 문구 + 번호로 토스트 · 진단 한 줄 · 같은 번호 10초 안 한 번 · 모르는 번호는 E-SYS-01 · 최근 기록 상한
   ・3절: 부르는 곳 — 렌더러 전부에서 TwErrorCodes.notify('…') 의 번호가 표에 있다 · 표의 번호는 어디선가 쓴다(예비 E-SYS-01 빼고)
   ・4절: 배선 — html 이 부르는 모듈보다 먼저 싣는다 · 문서(docs/ERROR_CODES.md)에 번호가 다 있다
   [실행] node checks/run.js sim-error-codes */
'use strict';
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['error-codes.js', 'desk-companion-prototype.html', 'docs/ERROR_CODES.md'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const mod = { exports: {} };
new Function('window', 'module', SRC['error-codes.js'])(undefined, mod);
const E = mod.exports;

say('── 1. 표');
const codes = Object.keys(E.CODES);
chk(codes.length > 0 && codes.every(c => E.isCode(c)), '번호 ' + codes.length + '개가 전부 E-영역-두자리 · 아는 영역');
chk(codes.every(c => typeof E.CODES[c].msg === 'string' && E.CODES[c].msg.length >= 4 && E.CODES[c].msg.length <= 60), '문구가 다 있다(4~60자)');
chk(codes.every(c => typeof E.CODES[c].where === 'string' && E.CODES[c].where.length > 0), '찾을 자리(where)가 다 있다');
chk(Object.keys(E.RETIRED).every(c => E.isCode(c) && !E.CODES[c]), '걷은 번호는 표에 다시 없다');
chk(!!E.CODES['E-SYS-01'], '예비 번호 E-SYS-01 이 있다(모르는 번호의 갈 곳)');
chk(!E.isCode('E-XX-01') && !E.isCode('E-FR-1') && !E.isCode('FR-01') && !E.isCode(null), '모양이 틀린 번호는 번호가 아니다');

say('── 2. notify');
let t = 1000; const toasts = []; const diags = [];
const N = E.createErrorNotice({ now: ()=>t, toast: (m, i, ms)=>toasts.push({ m, ms }), diag: (l)=>diags.push(l) });
const origWarn = console.warn; console.warn = ()=>{};
try{
  chk(N.notify('E-FR-01', { code: 'PERMISSION_DENIED' }) === true, '처음 부르면 토스트를 띄운다');
  chk(toasts[0].m === '⚠️ ' + E.CODES['E-FR-01'].msg + ' · 오류 E-FR-01', '토스트 = 표 문구 + 번호: ' + toasts[0].m);
  chk(toasts[0].ms === E.TOAST_MS && E.TOAST_MS >= 3000, '번호를 읽을 시간(' + E.TOAST_MS + 'ms)');
  chk(diags[0] === '[오류] E-FR-01 PERMISSION_DENIED', '진단 한 줄: ' + diags[0]);
  t += E.REPEAT_MS - 1;
  chk(N.notify('E-FR-01') === false && toasts.length === 1 && diags.length === 2, '같은 번호를 10초 안에 또 → 토스트는 안 띄우고 기록만');
  chk(N.notify('E-FR-02') === true && toasts.length === 2, '다른 번호는 바로 띄운다');
  t += 1;
  chk(N.notify('E-FR-01', null, '3건은 수락하지 못했어요') === true && toasts[2].m === '⚠️ 3건은 수락하지 못했어요 · 오류 E-FR-01', '10초 뒤엔 다시 · 셋째 인자는 문구만 바꾸고 번호는 그대로');
  N.notify('E-NOPE-99', 'x');
  chk(toasts[3].m.endsWith('오류 E-SYS-01') && diags[diags.length - 1].startsWith('[오류] E-SYS-01'), '표에 없는 번호 → E-SYS-01 로');
  N.notify('E-ROOM-01', { message: 'a\nb'.repeat(100) });
  const last = diags[diags.length - 1];
  chk(!/\n/.test(last) && last.length <= '[오류] E-ROOM-01 '.length + 80, '원인 글은 한 줄 · 80자까지');
  for(let i = 0; i < E.KEEP + 5; i++){ t += 1; N.notify('E-ROOM-02'); }
  chk(N.recent().length === E.KEEP, '최근 기록은 ' + E.KEEP + '개까지만');
  const bad = E.createErrorNotice({ now: ()=>0, toast: ()=>{ throw new Error('x'); }, diag: ()=>{ throw new Error('y'); } });
  let threw = false; try{ bad.notify('E-FR-01'); }catch(_){ threw = true; }
  chk(!threw, '토스트 · 진단이 던져도 부른 쪽으로 새지 않는다');
} finally { console.warn = origWarn; }

say('── 3. 부르는 곳');
/* 스테이징은 원본을 한 층으로 펼친다 — 렌더러 파일은 이 폴더의 *.js 중 검사가 아닌 것. 원본 저장소에서 바로 돌릴 땐 app/parts. */
function rendererFiles(){
  const repo = path.join(__dirname, '..', 'app', 'parts');
  const walk = (d, out) => {
    for(const e of fs.readdirSync(d, { withFileTypes: true })){
      const p = path.join(d, e.name);
      if(e.isDirectory()){ if(e.name !== 'vendor' && e.name !== 'node_modules') walk(p, out); }
      else if(e.name.endsWith('.js')) out.push(p);
    }
    return out;
  };
  if(fs.existsSync(repo)) return walk(repo, []);
  return fs.readdirSync('.').filter(f => f.endsWith('.js') && !/^(sim-|audit|run\.js)/.test(f)).map(f => path.resolve(f));
}
const used = new Map();
let calls = 0, nonLiteral = [];
for(const f of rendererFiles()){
  const text = read(f) || '';
  for(const m of text.matchAll(/TwErrorCodes\.notify\(\s*([^,)]*)/g)){
    calls++;
    const lit = /^'([^']*)'$/.exec(m[1].trim());
    if(!lit){ nonLiteral.push(path.basename(f)); continue; }
    if(!used.has(lit[1])) used.set(lit[1], new Set());
    used.get(lit[1]).add(path.basename(f));
  }
}
chk(calls >= 10, '부르는 곳 ' + calls + '곳');
chk(!nonLiteral.length, '번호는 글자 그대로 쓴다(검사가 찾을 수 있게)' + (nonLiteral.length ? ' — ' + nonLiteral.join(', ') : ''));
const unknown = [...used.keys()].filter(c => !E.CODES[c]);
chk(!unknown.length, '부른 번호가 다 표에 있다' + (unknown.length ? ' — 없음: ' + unknown.join(', ') : ''));
const unused = codes.filter(c => c !== 'E-SYS-01' && !used.has(c));
chk(!unused.length, '표의 번호는 어디선가 쓴다(안 쓰게 되면 RETIRED 로)' + (unused.length ? ' — 안 씀: ' + unused.join(', ') : ''));
const retiredUsed = [...used.keys()].filter(c => E.RETIRED[c]);
chk(!retiredUsed.length, '걷은 번호를 다시 부르지 않는다');

say('── 4. 배선');
const html = SRC['desk-companion-prototype.html'];
const at = (s) => html.indexOf('<script src="parts/' + s + '"');
const me = at('shared/error-codes.js');
chk(me > 0, 'html 이 error-codes.js 를 싣는다');
const callers = new Set();
used.forEach(fs_ => fs_.forEach(f => callers.add(f)));
const late = [...callers].filter(f => { const i = html.search(new RegExp('<script[^>]*src="parts/(?:[\\w-]+/)?' + f.replace('.', '\\.') + '"')); return i >= 0 && i < me; });
chk(!late.length, '부르는 모듈보다 먼저 싣는다' + (late.length ? ' — 늦음: ' + late.join(', ') : ''));
chk(me < at('app.js'), 'app.js 보다 먼저 싣는다');
const doc = SRC['docs/ERROR_CODES.md'];
const missing = codes.filter(c => doc.indexOf(c) < 0);
chk(!missing.length, '문서에 번호가 다 있다' + (missing.length ? ' — 없음: ' + missing.join(', ') : ''));

say('\n결과: 통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
