/* sim-fix-1008.js — 🐞 버그 제보 묶음(2026-10-08 접수분) 검사
   실행:  node sim-fix-1008.js   (app.js 와 같은 폴더에서)
   건마다 절을 하나씩 늘린다. 각 절은 «고친 자리가 그대로 있는가» 와 «옛 모양으로 되돌리면 잡히는가» 를 본다. */
'use strict';
const fs = require('fs');
const say = console.log;
let fail = 0;
const chk = (ok, msg) => { if (!ok) fail++; say((ok ? '  ✓ ' : '  ✗ ') + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const APP = read('app.js');
if (!APP) { say('  ? 원본 못 찾음 — app.js'); process.exit(2); }

say('§6 편집 → 완성 후 조는데 눈 뜸');
{
  const fn = (APP.match(/function applyCharToSeat\(seat,def\)\{[\s\S]*?\n\}/) || [''])[0];
  const sets = [/seat\.faceMat=inst\.faceMat; seat\.faceMapOrig=fT; seat\.blinkTex=bT;/, /seat\.faceMat=base\.faceMat;seat\.faceMapOrig=base\.fT;seat\.blinkTex=base\.bT;/];
  sets.forEach((re, i) => {
    const m = re.exec(fn);
    const after = m ? fn.slice(m.index, m.index + 700) : '';
    chk(!!m && /if\(seat\.blink\) seat\.blink\.closed = false;/.test(after), '★ ' + (i ? '대체(폴백) 모델' : 'GLB 모델') + ' — 뜬 눈 텍스처를 넣은 뒤 감김 표시도 «뜸» 으로');
  });
  chk(/if\(wantClosed!==seat\.blink\.closed\)\{seat\.blink\.closed=wantClosed;setFaceMap\(/.test(APP), '  프레임 루프는 표시가 바뀔 때만 텍스처를 바꾼다(그래서 위 초기화가 필요하다)');
  // 흉내: 졸던 중 모델 교체 → 다음 프레임에 감긴 그림으로 바뀌는가
  const sim = (reset) => { const seat = { blink: { closed: true }, tex: 'open' }; if (reset) seat.blink.closed = false; const want = true; if (want !== seat.blink.closed) { seat.blink.closed = want; seat.tex = 'closed'; } return seat.tex; };
  chk(sim(true) === 'closed' && sim(false) === 'open', '  흉내 — 초기화하면 다음 프레임에 감긴다 · 안 하면 뜬 눈으로 남는다(옛 동작)');
}

say('§1 옛 빌드 설정 파일 — 영상 겹침 실험이 켜진 채 남은 사람만 통째로 기본값');
{
  const MAIN = (() => { for (const c of ['main.js', '../main.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
  const PRE = (() => { for (const c of ['preload.js', '../preload.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
  if (!MAIN || !PRE) { chk(false, 'main.js · preload.js 를 찾았다'); }
  else {
    const grab = (re) => (MAIN.match(re) || [''])[0];
    const head = grab(/const SETTINGS_VER = \d+;[\s\S]*?\nfunction _settingsLegacyRisky\(data\)\{[\s\S]*?\n\}/);
    const load = grab(/function loadSettings\(\)\{[\s\S]*?\n\}/);
    const save = grab(/function saveSettings\(\)\{[\s\S]*?\n\}/);
    chk(!!head && !!load && !!save, 'SETTINGS_VER · loadSettings · saveSettings 를 찾았다');
    const os = require('os'), path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-set-'));
    const run = (fileObj) => {
      const P = path.join(dir, 'tw-settings.json');
      try { fs.unlinkSync(P); } catch (_) {}
      try { fs.unlinkSync(path.join(dir, 'tw-settings.before-reset.json')); } catch (_) {}
      if (fileObj) fs.writeFileSync(P, JSON.stringify(fileObj));
      const ov = { _g: 12, _a: 0, GAP_MAX: 64, GAP_VER: 2, GAP_LEGACY: [2, 6], GAP_DEFAULT: 12,
        setGap(v) { this._g = v; }, gap() { return this._g; }, setAlpha(v) { this._a = v; }, alpha() { return this._a; } };
      const body = 'let SETTINGS_PATH = P; let runDisplayId = null, runDisplayKey = null, uiZoom = 1, _gapMigratedFrom = null, _saveFailLogged = false;\n'
        + 'const _clampZoom = (z) => z; const _diagLog = () => {};\n' + head + '\n' + load + '\n' + save
        + '\nloadSettings(); const r = { runDisplayId, uiZoom, alpha: overlay.alpha(), reset: _settingsReset, notice: _settingsResetNotice };'
        + '\n_settingsReset = null; saveSettings(); r.saved = JSON.parse(fs.readFileSync(P, "utf8")); return r;';
      const out = new Function('fs', 'path', 'P', 'overlay', body)(fs, path, P, ov);
      out.backup = fs.existsSync(path.join(dir, 'tw-settings.before-reset.json'));
      return out;
    };
    const a = run({ runDisplayId: 7, runDisplayKey: 'k', overlayBottomGap: 12, overlayGapVer: 2, overlayLayeredAlpha: 252, uiZoom: 1.3 });
    chk(a.reset && a.notice && a.runDisplayId === null && a.uiZoom === 1 && a.alpha === 0, '★ 옛 파일 + 실험 켜짐(252) → 모니터 · 화면 크기 · 실험 전부 기본값');
    chk(a.backup, '  원본은 tw-settings.before-reset.json 으로 남는다');
    chk(a.saved.settingsVer === 1 && a.saved.overlayLayeredAlpha === 0, '  새 세대(settingsVer) 로 다시 저장 — 다음 부팅엔 다시 안 돈다');
    const b = run({ runDisplayId: 7, runDisplayKey: 'k', overlayLayeredAlpha: 0, uiZoom: 1.3 });
    chk(!b.reset && !b.notice && b.runDisplayId === 7 && b.uiZoom === 1.3, '옛 파일이라도 실험을 안 켰으면 그대로 (모니터 · 화면 크기 유지)');
    const c = run({ settingsVer: 1, runDisplayId: 7, overlayLayeredAlpha: 252, uiZoom: 1.3 });
    chk(!c.reset && c.alpha === 252 && c.runDisplayId === 7, '새 빌드에서 일부러 켠 실험은 존중한다');
    const d = run(null);
    chk(!d.reset && d.saved.settingsVer === 1, '파일이 없으면(첫 실행) 초기화 없이 새 세대로');
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    chk(/ipcMain\.handle\('companion:takeSettingsNotice'[\s\S]{0,200}_settingsResetNotice = false;/.test(MAIN), '안내는 한 번 돌려주면 끈다');
    chk(/takeSettingsNotice\(\) \{\s*return ipcRenderer\.invoke\('companion:takeSettingsNotice'\);/.test(PRE), 'preload 통로');
    chk(/if\(!\(window\.companion && companion\.takeSettingsNotice\)\) return;/.test(APP) && /기본값으로 되돌렸어요', null, 9000\)/.test(APP), '렌더러 안내(구버전 preload 면 조용히 건너뜀)');
  }
}

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅');
process.exit(fail ? 1 : 0);
