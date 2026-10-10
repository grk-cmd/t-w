/* ═══ 🎬 sim-lab-video-restore.js — 영상 겹침 실험 재발(0.11.2 제보) 검사 (2026-10-10 신설) ═══════════════════
   윈도우에서 유튜브 · 디스코드 영상이 다시 깜빡이거나 검어졌다. 원인 둘:
     ① 0.11.0 설정 초기화(#43, sim-fix-1008 §1)가 실험을 켜 둔 사람의 실험까지 껐고, 알림은 9초 토스트뿐이었다.
     ② 부팅 때 GPU 상태가 '?' 면 «꺼짐» 으로 보고 한 번만 다시 봤다 — 그때도 '?' 면 그 실행 내내 꺼짐.
   ・1절: 설정 파일 — 옛 파일 + 실험 켜짐은 여전히 꺼짐으로(자동 복원 안 함 · #43 재발 방지) · 안내 'reset'
           · [다시 켜기] = 시험 켜기 · 확인 없이 끝나면 다음 부팅에 꺼짐 + 'trial-reverted' · [잘 보여요] 면 유지
           · 직접 끈 것은 그대로 꺼짐 · [괜찮아요] 면 다시 안 띄움 · 초기화를 안 겪은 사람은 보통 토글
   ・2절: GPU 재시도 — '?' 동안은 창을 안 건드리고 기다림 · 정해지면 한 번 적용하고 멈춤 · 끝내 모르면 포기('unknown')
           · 처음부터 꺼짐(disabled)이면 예전처럼 한 번만 · 실험 꺼짐이면 안 건다
   ・3절: 렌더러 안내 모듈(lab-video-notice.js) — 종류별 글 · 버튼 · 부팅 토스트 한 번 · app.js · html · preload 배선
   [실행] main.js · overlay-win.js · preload.js · app.js · lab-video-notice.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'app/parts/' + f, 'parts/' + f]) { try { return fs.readFileSync(c, 'utf8'); } catch (_) {} } return null; };
const need = ['main.js', 'overlay-win.js', 'preload.js', 'app.js', 'lab-video-notice.js', 'desk-companion-prototype.html'];
const SRC = {};
for (const f of need) { SRC[f] = read(f); if (SRC[f] == null) { say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const MAIN = SRC['main.js'], OW = SRC['overlay-win.js'], APP = SRC['app.js'], MOD = SRC['lab-video-notice.js'];
const sec = (title, fn) => { say(title); try { fn(); } catch (e) { chk(false, '이 절을 못 돌았다 — ' + (e && e.stack || e)); } };
const grab = (re) => (MAIN.match(re) || [''])[0];

/* main.js 의 설정 · 재시도 · IPC 조각을 떼어 가짜 overlay · app · 창 위에서 돌린다. */
const HEAD = grab(/const SETTINGS_VER = \d+;[\s\S]*?\nfunction _settingsLegacyRisky\(data\)\{[\s\S]*?\n\}/);
const LOAD = grab(/function loadSettings\(\)\{[\s\S]*?\n\}/);
const SAVE = grab(/function saveSettings\(\)\{[\s\S]*?\n\}/);
const RETRY = grab(/const LAY_RETRY_AT_MS = [\s\S]*?\nfunction _labNotice\(\)\{[\s\S]*?\n\}/);
const handler = (name) => grab(new RegExp("  ipcMain\\.handle\\('companion:" + name + "'[\\s\\S]*?\\n  \\}\\);"));
const IPCS = ['getLabVideo', 'setLabVideo', 'labVideoNotice'].map(handler).join('\n');

function mkWorld(dir, gpuSeq){
  /* 가짜 overlay — overlay-win.js 의 판정을 그대로 흉내 낸다(? → wait, enabled → on, 그 밖 → blocked). */
  const gpu = { seq: (gpuSeq || ['enabled']).slice(), cur: null };
  gpu.cur = gpu.seq.shift();
  const ov = { _a: 0, _st: 'off', LAYERED_ALPHA_ON: 252, GAP_MAX: 64, GAP_VER: 2, GAP_LEGACY: [2, 6], GAP_DEFAULT: 12, _g: 12,
    opacityCalls: [], applyCalls: 0,
    setGap(v) { this._g = v; }, gap() { return this._g; }, setAlpha(v) { this._a = v; }, alpha() { return this._a; },
    layeredState() { return this._st; },
    applyLayered(where) {
      this.applyCalls++;
      const a = this._a, s = gpu.cur;
      if (a > 0 && a < 255 && s === '?') { this._st = 'wait(GPU 상태 모름)'; return; }
      if (!/^enabled/.test(s)) { this._st = 'blocked(GPU 합성 꺼짐)'; return; }
      if (a > 0 && a < 255) { this.opacityCalls.push(a / 255); this._st = 'on(alpha ' + a + ')'; }
      else { this._st = 'off(미적용)'; }
    } };
  const listeners = {};
  const app = { on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); },
    removeListener(ev, f) { listeners[ev] = (listeners[ev] || []).filter(x => x !== f); },
    emit(ev) { (listeners[ev] || []).slice().forEach(f => f()); }, count(ev) { return (listeners[ev] || []).length; } };
  const timers = [];
  const setT = (f, ms) => { const t = { f, ms, dead: false }; timers.push(t); return t; };
  const clearT = (t) => { if (t) t.dead = true; };
  const loadOnce = [];
  const win = { isDestroyed: () => false, webContents: { once(ev, f) { if (ev === 'did-finish-load') loadOnce.push(f); } } };
  const ipc = {};
  const ipcMain = { handle(n, f) { ipc[n.replace('companion:', '')] = f; } };
  const logs = [];
  const P = path.join(dir, 'tw-settings.json');
  const body = 'let SETTINGS_PATH = P; let runDisplayId = null, runDisplayKey = null, runDisplayWasPrimary = null, uiZoom = 1, _gapMigratedFrom = null, _saveFailLogged = false;\n'
    + 'let mainWindow = win;\nconst _clampZoom = (z) => z; const _diagLog = (m) => logs.push(m);\n'
    + HEAD + '\n' + LOAD + '\n' + SAVE + '\n' + RETRY + '\n' + IPCS + '\n'
    + 'return { loadSettings, saveSettings, _armLayeredRetry, _labNotice, get trial(){ return _labTrial; }, get group(){ return _labResetGroup; } };';
  const api = new Function('fs', 'path', 'P', 'overlay', 'app', 'win', 'ipcMain', 'logs', 'setTimeout', 'clearTimeout', 'process', body)
    (fs, path, P, ov, app, win, ipcMain, logs, setT, clearT, { platform: 'win32' });
  return { api, ov, app, ipc, logs, gpu, timers, loadOnce, P,
    setGpu(s) { gpu.cur = s; },
    finishLoad() { loadOnce.splice(0).forEach(f => f()); },
    runTimers() { timers.slice().sort((a, b) => a.ms - b.ms).forEach(t => { if (!t.dead) { t.dead = true; t.f(); } }); },
    saved() { return JSON.parse(fs.readFileSync(P, 'utf8')); } };
}
/* 한 번의 «앱 실행»: 파일을 읽고 → 창을 만들며 부팅 적용 → 재시도 무장 */
function boot(dir, gpuSeq){
  const w = mkWorld(dir, gpuSeq);
  w.api.loadSettings();
  w.ov.applyLayered('부팅');
  w.api._armLayeredRetry('부팅', true);
  return w;
}
const fresh = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tw-lab-'));
const writeFile = (dir, name, obj) => fs.writeFileSync(path.join(dir, name), JSON.stringify(obj));

sec('1절 설정 파일 — 초기화로 꺼진 실험 · 시험 켜기 · 사용자의 선택', () => {
  chk(!!HEAD && !!LOAD && !!SAVE && !!RETRY && IPCS.split('ipcMain.handle').length === 4, '조각을 찾았다(설정 머리 · load · save · 재시도 · IPC 셋)');

  // (가) 옛 파일 + 실험 켜짐 + GPU 합성 켜짐 → 그래도 꺼짐으로(자동 복원 안 함), 안내 'reset'
  let d = fresh();
  writeFile(d, 'tw-settings.json', { runDisplayId: 7, overlayLayeredAlpha: 252, uiZoom: 1.3 });
  let w = boot(d, ['enabled']);
  chk(w.ov.alpha() === 0 && w.ov.opacityCalls.length === 0, '★ 옛 파일 + 실험 켜짐 + GPU 합성 켜짐이어도 자동으로 켜지 않는다 — 초기화가 구한 사람이 바로 그 PC(electron#40515)');
  chk(fs.existsSync(path.join(d, 'tw-settings.before-reset.json')) && w.api.group, '  백업이 남고 «초기화를 겪은 사람» 으로 안다');
  chk(w.api._labNotice() === 'reset', '★ 설정 › 시스템 안내 = reset(«꺼졌어요 — [다시 켜기]»)');
  w.api.saveSettings();

  // (나) 0.11.x 에서 이미 초기화된 사람(백업 켜짐 · 지금 0 · 새 세대) → 재부팅해도 안내가 남는다(답할 때까지)
  w = boot(d, ['enabled']);
  chk(w.ov.alpha() === 0 && w.api._labNotice() === 'reset', '★ 이미 초기화된 사람(before-reset 켜짐 · 지금 꺼짐)도 안내가 뜬다 — 9초 토스트로 끝나지 않는다');

  // (다) [다시 켜기] → 시험 켜기 · 바로 적용 · 안내 'trial'
  let r = w.ipc.setLabVideo(null, true);
  chk(r.on && /^on/.test(r.state) && w.ov.opacityCalls.length === 1 && r.notice === 'trial' && w.api.trial, '★ [다시 켜기] = 시험 켜기 — 즉시 적용 · «잘 보이면 [잘 보여요]» 안내');
  chk(w.saved().overlayLayeredTrial === true && w.saved().overlayLayeredAlpha === 252, '  파일에 시험 중 표시가 같이 적힌다');

  // (라) 확인 없이 끝남(창이 안 보였다고 가정) → 다음 부팅은 꺼짐 + 'trial-reverted'
  w = boot(d, ['enabled']);
  chk(w.ov.alpha() === 0 && w.ov.opacityCalls.length === 0, '★ 확인 없이 끝난 시험 켜기는 다음 부팅에 꺼짐 — 창이 안 보이던 사람도 재시작만으로 풀린다');
  chk(w.api._labNotice() === 'trial-reverted' && w.logs.some(m => /확인이 없어 꺼짐으로 되돌림/.test(m)) === false, '  안내 = trial-reverted (부팅 로그는 createWindow 가 찍는다 — 아래 배선)');
  w.api.saveSettings();
  chk(w.saved().overlayLayeredTrial === false && w.saved().overlayLayeredAlpha === 0, '  꺼짐으로 다시 저장된다');

  // (마) 다시 켜기 → [잘 보여요] → 다음 부팅에도 켜짐 · 안내 없음 · 한 번만
  r = w.ipc.setLabVideo(null, true);
  r = w.ipc.labVideoNotice(null, 'confirm');
  chk(r.on && r.notice === null && w.saved().overlayLayeredConfirmed === true && w.saved().overlayLayeredTrial === false, '★ [잘 보여요] → 확정(시험 표시 지움)');
  w = boot(d, ['enabled']);
  chk(w.ov.alpha() === 252 && w.ov.opacityCalls.length === 1 && w.api._labNotice() === null, '  다음 부팅에도 켜짐 · 안내 없음(되살림은 한 번)');
  r = w.ipc.setLabVideo(null, false); r = w.ipc.setLabVideo(null, true);
  chk(r.notice === null && !w.api.trial, '  확인한 사람은 그 뒤 보통 토글(시험 켜기 아님)');

  // (바) 사용자가 직접 끔 → 그대로 꺼짐 · 안내 없음
  r = w.ipc.setLabVideo(null, false);
  w = boot(d, ['enabled']);
  chk(w.ov.alpha() === 0 && w.api._labNotice() === null && w.ov.opacityCalls.length === 0, '★ 직접 끈 것은 다음 부팅에도 꺼짐 · 안내도 다시 안 뜬다');

  // (사) [괜찮아요] → 다시 안 띄움
  d = fresh();
  writeFile(d, 'tw-settings.json', { overlayLayeredAlpha: 252 });
  w = boot(d, ['enabled']); w.api.saveSettings();
  w = boot(d, ['enabled']);
  r = w.ipc.labVideoNotice(null, 'dismiss');
  chk(r.notice === null && w.ov.alpha() === 0, '[괜찮아요] → 안내 닫힘 · 꺼짐 유지');
  w = boot(d, ['enabled']);
  chk(w.api._labNotice() === null, '  다음 부팅에도 다시 안 뜬다');

  // (아) 초기화 뒤 0.11.x 에서 스스로 켜 쓰던 사람 → 켜짐 그대로 · 확인한 것으로
  d = fresh();
  writeFile(d, 'tw-settings.before-reset.json', { overlayLayeredAlpha: 252 });
  writeFile(d, 'tw-settings.json', { settingsVer: 1, overlayLayeredAlpha: 252 });
  w = boot(d, ['enabled']);
  r = w.ipc.setLabVideo(null, false); r = w.ipc.setLabVideo(null, true);
  chk(w.ov.alpha() === 252 && r.notice === null && !w.api.trial, '초기화 뒤 스스로 다시 켜 쓰던 사람은 그대로 · 껐다 켜도 시험 켜기 아님');

  // (자) 초기화를 안 겪은 사람 → 안내 없음 · 보통 토글
  d = fresh();
  writeFile(d, 'tw-settings.json', { settingsVer: 1, overlayLayeredAlpha: 0 });
  w = boot(d, ['enabled']);
  r = w.ipc.setLabVideo(null, true);
  chk(w.api._labNotice() === null && !w.api.trial && r.on && r.notice === null, '초기화를 안 겪은 사람은 안내 없음 · 켜면 보통 켜짐');
  w = boot(d, ['enabled']);
  chk(w.ov.alpha() === 252, '  다음 부팅에도 켜짐(#4 «재부팅 후 꺼짐» 이 다시 안 생긴다)');
});

sec('2절 GPU 재시도 — 정해질 때까지 · 정해지면 멈춤', () => {
  // (가) '?' → '?' → enabled: 기다리다 한 번 적용하고 멈춘다
  let d = fresh();
  writeFile(d, 'tw-settings.json', { settingsVer: 1, overlayLayeredAlpha: 252 });
  let w = boot(d, ['?']);
  chk(/^wait/.test(w.ov.layeredState()) && w.ov.opacityCalls.length === 0, '★ 부팅 때 GPU 상태 모름 → 꺼짐으로 단정하지 않고 «기다림»(창은 안 건드림)');
  chk(w.api._labNotice() === 'wait' && w.app.count('gpu-info-update') === 1, '  안내 wait · gpu-info-update 를 듣는다');
  w.app.emit('gpu-info-update');                 // 아직 '?'
  chk(/^wait/.test(w.ov.layeredState()) && w.app.count('gpu-info-update') === 1, '  첫 gpu-info-update 에도 모름 → 계속 기다린다(예전엔 여기서 끝)');
  w.setGpu('enabled'); w.app.emit('gpu-info-update');
  chk(/^on/.test(w.ov.layeredState()) && w.ov.opacityCalls.length === 1, '★ 정해지면(enabled) 그때 한 번 적용');
  chk(w.app.count('gpu-info-update') === 0, '  듣기를 뗀다');
  w.finishLoad(); w.runTimers(); w.app.emit('gpu-info-update');
  chk(w.ov.opacityCalls.length === 1 && w.timers.length === 0, '★ 그 뒤로는 다시 부르지 않는다(타이머도 안 건다 — 주기 호출 없음)');

  // (나) 타이머 쪽에서 정해짐
  w = boot(d, ['?']);
  w.finishLoad();
  chk(w.timers.length === 4, '  화면 로드 뒤 정해진 시각 4번(1.5 · 5 · 15 · 40초)');
  w.timers[0].f(); w.setGpu('enabled'); w.timers[1].f();
  chk(/^on/.test(w.ov.layeredState()) && w.ov.opacityCalls.length === 1 && w.timers.slice(2).every(t => t.dead), '  타이머에서 정해져도 한 번 적용 · 남은 타이머 끔');

  // (다) 끝내 모름 → 포기 · 'unknown'
  w = boot(d, ['?']);
  w.finishLoad(); w.runTimers();
  chk(/^wait/.test(w.ov.layeredState()) && w.ov.opacityCalls.length === 0 && w.api._labNotice() === 'unknown', '★ 끝내 모르면 이번 실행엔 적용 안 함 · 안내 unknown(«재시작하면 다시 시도»)');
  chk(w.app.count('gpu-info-update') === 0 && w.logs.some(m => /재시도 끝/.test(m) && /끝내 못 읽음/.test(m)), '  듣기를 떼고 진단 로그 한 줄');
  const n = w.ov.applyCalls;
  for (let k = 0; k < 20; k++) w.app.emit('gpu-info-update');
  chk(w.ov.applyCalls === n, '  포기한 뒤엔 더 부르지 않는다');

  // (라) 처음부터 GPU 합성 꺼짐(disabled) → 예전처럼 한 번만 다시 보고 멈춤
  w = boot(d, ['disabled_software']);
  chk(/^blocked/.test(w.ov.layeredState()) && w.api._labNotice() === 'blocked', '처음부터 꺼짐 → blocked · 안내 blocked');
  w.app.emit('gpu-info-update');
  const n2 = w.ov.applyCalls; w.app.emit('gpu-info-update'); w.finishLoad(); w.runTimers();
  chk(w.ov.applyCalls === n2 && w.ov.opacityCalls.length === 0, '  한 번 다시 보고 멈춘다 · 꺼진 PC 에는 끝까지 안 건다(10-01 보호)');

  // (마) 실험 꺼짐 → 재시도를 안 건다
  d = fresh();
  writeFile(d, 'tw-settings.json', { settingsVer: 1, overlayLayeredAlpha: 0 });
  w = boot(d, ['?']);
  chk(w.app.count('gpu-info-update') === 0 && w.loadOnce.length === 0, '실험이 꺼져 있으면 재시도를 안 건다');
  // (바) 토글로 켰는데 모름 → 그 자리에서 기다리기 시작
  let r = w.ipc.setLabVideo(null, true);
  chk(r.notice === 'wait' && w.app.count('gpu-info-update') === 1 && w.timers.length === 4, '토글로 켰는데 모름 → 바로 기다리기 시작(화면은 이미 떠 있어 지금부터 센다)');
  r = w.ipc.setLabVideo(null, false); w.runTimers();
  chk(w.app.count('gpu-info-update') === 0 && w.ov.opacityCalls.length === 0, '  기다리는 중에 끄면 멈춘다');

  // overlay-win.js 원문
  chk(/if\(a > 0 && a < 255 && _gpuCompStatus\(\) === '\?'\)\{\s*_layeredState = 'wait\(GPU 상태 모름\)';[\s\S]{0,200}?return;\s*\}\s*if\(_gpuCompositingOff\(\)\)\{/.test(OW), '★ overlay-win.js — 켜려는데 모름이면 wait 후 return(창 안 건드림), 그 다음 줄이 10-01 꺼짐 보호');
});

sec('3절 렌더러 안내 · 배선', () => {
  const store = {};
  const ctx = { window: {}, localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    document: { createElement: (t) => mkEl(t) } };
  function mkEl(t){ let txt = ''; return { tagName: t, children: [], style: {}, dataset: {}, className: '', type: '',
    get textContent(){ return txt; }, set textContent(v){ txt = String(v); this.children = []; },   // DOM 처럼 자식을 비운다
    appendChild(c){ this.children.push(c); return c; } }; }
  new Function('window', 'localStorage', 'document', MOD)(ctx.window, ctx.localStorage, ctx.document);
  const N = ctx.window.LabVideoNotice;
  chk(!!N && ['reset', 'trial-reverted', 'trial', 'wait', 'unknown', 'blocked'].every(k => N.view(k)), '모듈이 main 의 안내 종류 여섯을 다 안다');
  const kinds = [...grab(/function _labNotice\(\)\{[\s\S]*?\n\}/).matchAll(/return (?:_labRetryGaveUp \? )?'([a-z-]+)'(?: : '([a-z-]+)')?;/g)].flatMap(m => [m[1], m[2]]).filter(Boolean);
  chk(kinds.length >= 6 && kinds.every(k => N.view(k)), '  main 의 _labNotice 가 돌려주는 종류가 모두 모듈에 있다');
  const box = mkEl('div'); box.textContent = 'x';
  let acted = null;
  N.render(box, { notice: 'reset' }, (a) => { acted = a; });
  const btns = box.children[1] ? box.children[1].children : [];
  chk(box.style.display === '' && /꺼졌어요/.test(box.children[0].textContent) && btns.map(b => b.dataset.act).join() === 'on,dismiss', '★ reset — «꺼졌어요» + [다시 켜기] [괜찮아요]');
  btns[0].onclick();
  chk(acted === 'on', '  [다시 켜기] → on');
  N.render(box, { notice: 'trial' }, () => {});
  chk(box.children[1].children.map(b => b.dataset.act).join() === 'confirm,off', '  trial — [잘 보여요] [끄기]');
  N.render(box, { notice: 'unknown' }, () => {});
  chk(/다시 시작하면/.test(box.children[0].textContent) && box.children.length === 1, '  unknown — «다시 시작하면 다시 시도» · 버튼 없음');
  N.render(box, { notice: null }, () => {});
  chk(box.style.display === 'none' && box.children.length === 0, '  안내 없으면 칸을 숨긴다');
  const shown = [];
  const t = (m) => shown.push(m);
  N.bootToast({ notice: 'reset' }, t); N.bootToast({ notice: 'reset' }, t); N.bootToast({ notice: 'wait' }, t);
  chk(shown.length === 1 && /설정 › 시스템/.test(shown[0]), '★ 부팅 토스트는 같은 종류 한 번만 · 설정 › 시스템을 가리킨다');
  chk(N.TOAST_KEY.startsWith('tw.'), '  localStorage 키는 tw. 접두사');

  // 배선
  const HTML = SRC['desk-companion-prototype.html'], PRE = SRC['preload.js'];
  const iMod = HTML.indexOf('<script src="parts/lab-video-notice.js">'), iApp = HTML.indexOf('<script src="parts/app.js">');
  chk(iMod > 0 && iMod < iApp, 'html — lab-video-notice.js 를 app.js 앞에 싣는다');
  chk(/id="progLabVideoNotice"[^>]*display:none/.test(HTML), 'html — 안내 칸(기본 숨김)');
  chk(/labVideoNotice\(act\) \{\s*return ipcRenderer\.invoke\('companion:labVideoNotice'/.test(PRE), 'preload — labVideoNotice 통로');
  chk(/companion\.getLabVideo\(\)\.then\(r=>\{ _labVideoShow\(btn, r\); _labVideoNotice\(r\); \}\)/.test(APP), 'app.js — 시스템 탭을 열 때 안내도 다시 그린다');
  chk(/LabVideoNotice\.bootToast\(v, \(r && r\.reset\) \? \(\)=>\{\} : toast\)/.test(APP), 'app.js — 부팅 때 한 번(방금 초기화 토스트를 띄웠으면 겹치지 않게)');
  chk(/if\(!box \|\| !window\.LabVideoNotice\) return;/.test(APP), 'app.js — 모듈이 없으면 조용히 건너뜀');
  const cw = MAIN.slice(MAIN.indexOf('function createWindow() {'), MAIN.indexOf('function createWindow() {') + 6000);
  chk(/if\(_labTrialReverted\)\{\s*_diagLog\('\[설정\] 영상 겹침 실험 — 지난 실행에 다시 켠 뒤/.test(cw) && /_labNotice\(\) === 'reset'\)\{\s*_diagLog\('\[설정\] 영상 겹침 실험 — 0\.11\.0 초기화로 꺼진 사람/.test(cw), 'main — 부팅 진단 로그([설정] 되돌림 · 초기화로 꺼진 사람)');
  // _labVideoShow 흉내 — 기다리는 중 · 포기
  const fn = (APP.match(/function _labVideoShow\(btn, r\)\{[\s\S]*?\n\}/) || [''])[0];
  const show = new Function(fn + '\nreturn _labVideoShow;')();
  const mk = () => ({ textContent: '', title: '', classList: { v: false, toggle(c, on) { this.v = on; } } });
  const b1 = mk(); show(b1, { on: true, state: 'wait(GPU 상태 모름)', notice: 'wait' });
  const b2 = mk(); show(b2, { on: true, state: 'wait(GPU 상태 모름)', notice: 'unknown' });
  chk(b1.textContent === '확인 중' && b2.textContent === '적용 안 됨' && b1.classList.v && b2.classList.v, '토글 글 — 기다리는 중 «확인 중» · 끝내 모르면 «적용 안 됨»(누르면 꺼짐)');
});

say('\n' + (fail ? '✗ 실패 ' + fail + '건' : '✓ 전부 통과') + ' — ' + pass + ' · ' + fail);
process.exit(fail ? 1 : 0);
