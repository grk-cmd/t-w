/* ═══ 🚀 sim-run-boot.js — 켜는 차례 표(launcher/run-boot.js · app.js 분리 F3) ═══════════════
   [왜] app.js INIT 덩이의 차례가 «파일 안 자리» 였다. 표 한 곳으로 모았다 — 0.13 의 sim-app-boot 와 같은 틀.
   ・1절: 차례 표 그대로(순서) · 만들 때 일하지 않음 · 표에 없는 이름 · 남는 이름 · baseBody 를 starts 로 주기 · 기본 몸 칸이 비면 던짐
   ・2절: begin — 표 순서대로 한 번씩 · 두 번 부르면 두 번째는 안 함(false · 경고) · 한 칸이 던져도 다음 칸은 돈다(비동기 거절 포함)
   ・3절: 기본 몸 — 읽기 → 피부 · 슬롯 → 런처 그리기 · 못 읽으면(false) 안내 한 번 뒤 이어 감 · 읽다 던지면 안내 한 번 뒤 런처만 그린다 · 피부 읽기가 던져도 런처는 그린다
   ・4절: 연결(html 순서 · app.js 가 표의 이름 그대로 이어 begin 한 번 · 옛 INIT 줄이 안 남음 · 안내는 E-SYS-08 · 번호가 표에 있음) · 5절: 일부러 깨 보기
   [실행] 러너 스테이징 또는 저장소 루트에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('launcher/run-boot.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html'), ERR = read('shared/error-codes.js');
if(!SRC || !APP || !HTML || !ERR){ say('  ? 원본 못 찾음 — run-boot.js · app.js · desk-companion-prototype.html · error-codes.js'); process.exit(2); }

const NAMES = ['seatTabs', 'appMode', 'adminUi', 'licenseLabel', 'myHome', 'baseBody', 'frameLoop', 'launcherLoop', 'faceHeal', 'resize'];
function load(src){ const win = {}; new Function('window', src)(win); return win.TwRunBoot; }
function mk(src, o){
  o = o || {};
  const log = [], warns = [];
  const w = console.warn; console.warn = (...a) => warns.push(a.join(' '));
  const starts = {};
  for(const n of NAMES) if(n !== 'baseBody') starts[n] = () => { log.push(n); if(o.throwAt === n) throw new Error('x'); if(o.rejectAt === n) return Promise.reject(new Error('r')); };
  const baseBody = {
    load: () => { log.push('load'); return o.loadThrows ? Promise.reject(new Error('l')) : Promise.resolve(o.loadOk !== false); },
    loadSkins: () => { log.push('skins'); if(o.skinsThrow) throw new Error('s'); },
    loadSlots: () => { log.push('slots'); },
    renderLauncher: () => log.push('render'),
    onFailed: () => log.push('failed'),
  };
  if(o.extraStart) starts[o.extraStart] = () => {};
  if(o.dropStart) delete starts[o.dropStart];
  if(o.baseInStarts) starts.baseBody = () => {};
  if(o.dropBase) delete baseBody[o.dropBase];
  const T = load(src);
  let boot, err = null;
  try{ boot = T.createRunBoot({ starts, baseBody }); }catch(e){ err = e; }
  return { T, boot, log, warns, err, restore: () => { console.warn = w; } };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  say('§1 표 · 만들기');
  {
    const t = mk(SRC);
    chk(t.T.STEPS.join() === NAMES.join(), '차례 표가 열 칸 그대로(' + t.T.STEPS.join(' → ') + ')');
    chk(!t.err && t.log.length === 0, '만들 때는 아무 일도 안 한다(시작은 begin)');
    for(const [o, re, label] of [[{ dropStart: 'frameLoop' }, /시작 함수가 없어요: frameLoop/, '표에 있는데 시작 함수가 없으면'], [{ extraStart: 'extra' }, /차례 표에 없는 시작이에요: extra/, '표에 없는 이름이 남으면'], [{ baseInStarts: true }, /차례 표에 없는 시작이에요: baseBody/, 'baseBody 를 시작으로 따로 주면'], [{ dropBase: 'onFailed' }, /기본 몸 칸에 onFailed/, '기본 몸 칸 함수가 빠지면']]){
      const x = mk(SRC, o); chk(!!x.err && re.test(x.err.message), label + ' 만들 때 던진다'); x.restore();
    }
    t.restore();
  }
  say('§2 begin');
  {
    const t = mk(SRC);
    const r1 = t.boot.begin(); await tick();
    const order = t.log.filter((x) => NAMES.includes(x) || x === 'load');
    chk(r1 === true && order.join() === ['seatTabs', 'appMode', 'adminUi', 'licenseLabel', 'myHome', 'load', 'frameLoop', 'launcherLoop', 'faceHeal', 'resize'].join(), '표 순서대로 한 번씩 — 기본 몸 읽기는 마이홈 시작 바로 뒤 · 프레임 루프 앞(' + order.join(' ') + ')');
    const n = t.log.length; const r2 = t.boot.begin(); await tick();
    chk(r2 === false && t.log.length === n && t.warns.some((w) => /이미 시작했어요/.test(w)), '★ 두 번 부르면 두 번째는 아무것도 안 하고 false(경고 한 줄)');
    t.restore();
    const e = mk(SRC, { throwAt: 'adminUi' }); e.boot.begin(); await tick();
    chk(e.log.includes('frameLoop') && e.log.includes('resize') && e.warns.some((w) => /adminUi 실패/.test(w)), '한 칸이 던져도 다음 칸은 돈다(경고만)'); e.restore();
    const a = mk(SRC, { rejectAt: 'myHome' }); a.boot.begin(); await tick();
    chk(a.log.includes('frameLoop') && a.warns.some((w) => /myHome 실패/.test(w)), '비동기로 거절돼도 다음 칸은 돈다'); a.restore();
  }
  say('§3 기본 몸');
  {
    const ok = mk(SRC); ok.boot.begin(); await tick(); await tick();
    chk(ok.log.filter((x) => ['load', 'skins', 'slots', 'render', 'failed'].includes(x)).join() === 'load,skins,slots,render', '읽으면 피부 · 슬롯을 읽고 런처를 그린다(안내 없음)'); ok.restore();
    const bad = mk(SRC, { loadOk: false }); bad.boot.begin(); await tick(); await tick();
    chk(bad.log.filter((x) => ['load', 'failed', 'skins', 'slots', 'render'].includes(x)).join() === 'load,failed,skins,slots,render', '★ 못 읽으면(false) 안내 한 번 뒤 대신 몸으로 이어 간다(피부 · 슬롯 · 런처)'); bad.restore();
    const thr = mk(SRC, { loadThrows: true }); thr.boot.begin(); await tick(); await tick();
    chk(thr.log.filter((x) => x === 'failed').length === 1 && thr.log.includes('render') && !thr.log.includes('skins'), '★ 읽다 던지면 안내 한 번 · 피부 · 슬롯 없이 런처는 그린다'); thr.restore();
    const sk = mk(SRC, { skinsThrow: true }); sk.boot.begin(); await tick(); await tick();
    chk(sk.log.includes('render'), '피부 읽기가 던져도 런처는 그린다'); sk.restore();
  }
  say('§4 연결');
  {
    const iO = HTML.indexOf('<script src="parts/launcher/run-boot.js"></script>'), iA = HTML.indexOf('<script src="parts/app.js"></script>');
    chk(iO > 0 && iA > iO, 'html — run-boot.js 를 app.js 보다 먼저 싣는다');
    const code = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
    const blk = (code.match(/const runBoot = TwRunBoot\.createRunBoot\(\{([\s\S]*?)\n\}\);\s*runBoot\.begin\(\);/) || [])[1] || '';
    const keys = [...(blk.match(/starts: \{([\s\S]*?)\n  \},/) || [, ''])[1].matchAll(/^    ([a-zA-Z]+): /gm)].map((m) => m[1]);
    chk(keys.join() === NAMES.filter((n) => n !== 'baseBody').join(), 'app.js — 만들고 begin 한 번 · starts 이름이 표(baseBody 뺀)와 같은 순서(' + keys.join(' ') + ')');
    chk(/baseBody: \{\s*load: \(\)=>loadBaseGLB\(\),\s*loadSkins: \(\)=>loadSkins\(\),\s*loadSlots: \(\)=>slotSaveMod\.loadSlots\(\),\s*renderLauncher: \(\)=>renderLauncher\(\),\s*onFailed: \(\)=>TwErrorCodes\.notify\('E-SYS-08'\),/.test(blk), '  기본 몸 칸 — 못 읽으면 E-SYS-08 안내');
    chk((code.match(/runBoot\.begin\(\)/g) || []).length === 1, '  begin 은 한 곳');
    chk(!/^mhInitMod\.initMyHome\(\);/m.test(code) && !/^requestAnimationFrame\(frame\);/m.test(code) && !/^launcherPrevMod\.startLauncherLoop\(\);/m.test(code) && !/^loadBaseGLB\(\)\.then/m.test(code) && !/^seatPanelMod\.renderSeatTabs\(\);/m.test(code), '  옛 INIT 줄이 app.js 바닥에 안 남음');
    chk(/'E-SYS-08':/.test(ERR), 'E-SYS-08 이 에러 코드 표에 있다');
  }
  say('§5 일부러 깨 보기');
  {
    const brk = (from, to) => { const m = SRC.replace(from, to); return m === SRC ? null : m; };
    const m1 = brk("if(began){ console.warn('[run-boot] 이미 시작했어요 — 두 번째 시작은 무시해요'); return false; }", '');
    chk(!!m1 && await (async () => { const t = mk(m1); t.boot.begin(); await tick(); const n = t.log.length; t.boot.begin(); await tick(); t.restore(); return t.log.length !== n; })(), '두 번째 시작을 막지 않으면 빨강');
    const m2 = brk("if(!ok) baseBody.onFailed();", '');
    chk(!!m2 && await (async () => { const t = mk(m2, { loadOk: false }); t.boot.begin(); await tick(); await tick(); t.restore(); return !t.log.includes('failed'); })(), '못 읽어도 안내를 안 하면 빨강');
    const m3 = brk(".catch(()=>baseBody.renderLauncher())", '');
    chk(!!m3 && await (async () => { const t = mk(m3, { loadThrows: true }); t.boot.begin(); await tick(); await tick(); t.restore(); return !t.log.includes('render'); })(), '던질 때 런처를 안 그리면 빨강');
    const m4 = brk("if(!STEPS.includes(name) || name === 'baseBody') throw", "if(false) throw");
    chk(!!m4 && (() => { const t = mk(m4, { extraStart: 'extra' }); t.restore(); return !t.err; })(), '남는 이름을 안 잡으면 빨강');
    const m5 = brk("'myHome',         // 🏠 마이홈 시작(첫 일이 «서버 모듈 붙을 때까지 기다리기» 라 실제 시작은 그 뒤)\n  'baseBody',", "'baseBody',\n  'myHome',");
    chk(!!m5 && (() => { const T = load(m5); return T.STEPS.join() !== NAMES.join(); })(), '표 순서를 바꾸면 차례 판정이 빨강');
  }
  say('');
  say((fail ? '✗' : '✓') + ' 통과 ' + pass + ' · 실패 ' + fail);
  process.exit(fail ? 1 : 0);
})();
