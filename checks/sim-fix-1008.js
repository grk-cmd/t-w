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
      const body = 'let SETTINGS_PATH = P; let runDisplayId = null, runDisplayKey = null, runDisplayWasPrimary = null, uiZoom = 1, _gapMigratedFrom = null, _saveFailLogged = false;\n'
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

say('§4 영상 겹침 실험이 재부팅 후 꺼짐 — 부팅 판정이 막히면 GPU 준비 뒤 한 번 더');
{
  const MAIN = (() => { for (const c of ['main.js', '../main.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
  if (!MAIN) chk(false, 'main.js 를 찾았다');
  else {
    const i = MAIN.indexOf("overlay.applyLayered('부팅');");
    const blk = MAIN.slice(i, i + 2200);
    chk(i > 0 && /if\(\/\^blocked\/\.test\(overlay\.layeredState\(\)\) && overlay\.alpha\(\) > 0 && overlay\.alpha\(\) < 255\)\{/.test(blk), '★ 부팅이 blocked 이고 실험이 켜져 있을 때만 재시도를 건다');
    chk(/app\.once\('gpu-info-update'/.test(blk) && /webContents\.once\('did-finish-load'/.test(blk), '  gpu-info-update · did-finish-load 중 먼저 오는 쪽');
    chk(/if\(_layRetried \|\| !mainWindow \|\| mainWindow\.isDestroyed\(\)\) return;\s*_layRetried = true;/.test(blk), '  딱 한 번 (주기 호출 없음)');
    chk(/overlay\.applyLayered\('재시도\(' \+ why \+ '\)'\)/.test(blk), '  재시도도 같은 함수 — GPU 합성 꺼짐 보호(10-01)를 그대로 지난다');
    const W = (() => { for (const c of ['overlay-win.js', '../overlay-win.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
    chk(!!W && /if\(_gpuCompositingOff\(\)\)\{\s*_layeredState = 'blocked\(GPU 합성 꺼짐\)';/.test(W), '  그 보호 줄이 overlay-win.js 에 그대로 있다');
    chk(/companion:getLabVideo'[\s\S]{0,200}state: overlay\.layeredState\(\)/.test(MAIN) && /setLabVideo'[\s\S]{0,700}state: overlay\.layeredState\(\)/.test(MAIN), '설정 조회 · 토글이 실제 적용 상태(state)를 돌려준다');
    // 화면 흉내
    const fn = (APP.match(/function _labVideoShow\(btn, r\)\{[\s\S]*?\n\}/) || [''])[0];
    const show = new Function(fn + '\nreturn _labVideoShow;')();
    const mk = () => ({ textContent: '', title: '', classList: { v: false, toggle(c, on) { this.v = on; } } });
    const b1 = mk(); show(b1, { on: true, state: 'blocked(GPU 합성 꺼짐)' });
    const b2 = mk(); show(b2, { on: true, state: 'on(alpha 252)' });
    const b3 = mk(); show(b3, { on: false, state: 'off(미적용)' });
    const b4 = mk(); show(b4, { on: true });   // 옛 main(state 없음)
    chk(b1.textContent === '적용 안 됨' && b1.classList.v === true, '★ 켜 두었는데 막혔으면 「적용 안 됨」(누르면 꺼짐으로)');
    chk(b2.textContent === '켜짐' && b3.textContent === '꺼짐' && b4.textContent === '켜짐', '  정상 · 꺼짐 · state 없는 옛 응답은 예전 그대로');
  }
}

say('§12 내 캐릭터(동물 포함)를 쓰다듬으면 상대 화면에도 하트');
{
  const up = APP.slice(APP.indexOf("Presence.poke(seat.friendId, 'pet');"), APP.indexOf("Presence.poke(seat.friendId, 'pet');") + 1400);
  chk(/else if\(seat\.isMe && !seat\.isExtra && Presence\.active\(\) && Presence\.pokeSelf\)\{/.test(up), '★ 내 좌석 클릭도 pokeSelf(\'pet\') 로 알린다 (자리추가 좌석은 제외)');
  chk(/if\(_t - _myPetSentAt >= MY_PET_SEND_GAP_MS\)\{ _myPetSentAt = _t; Presence\.pokeSelf\('pet'\); \}/.test(up), '  0.5초 쓰로틀');
  chk(/const MY_PET_SEND_GAP_MS = 500, MY_PET_ECHO_MS = 1500;/.test(APP), '  간격 500ms · 에코 창 1.5초');
  chk(/if\(p\.type==='pet'\)\{\s*\/\/[^\n]*\n\s*if\(performance\.now\(\) - _myPetLocalAt < MY_PET_ECHO_MS\) return;/.test(APP), '★ 내 노드로 돌아온 에코는 건너뛴다 (내 화면 하트 두 번 방지)');
  // 흉내: 0ms·100ms·600ms 클릭 → 보내기 2번, 에코(+300ms)는 무시, 2초 뒤 친구가 쓰다듬은 것은 재생
  let sentAt = -Infinity, localAt = -Infinity, sent = 0;
  const click = (t) => { localAt = t; if (t - sentAt >= 500) { sentAt = t; sent++; } };
  const recv = (t) => !(t - localAt < 1500);
  [0, 100, 600].forEach(click);
  chk(sent === 2, '  흉내 — 0 · 100 · 600ms 연타 → 2번만 보낸다 (' + sent + ')');
  chk(!recv(900) && recv(2600), '  흉내 — 직후 에코는 무시, 한참 뒤 남이 쓰다듬은 것은 재생');
}

say('§7 자리비움 이미지 위 동물 — 보이는 히트 먼저 잡는다');
{
  const fv = (APP.match(/function _hitVisible\(obj\)\{[\s\S]*?\n\}/) || [''])[0];
  const fp = (APP.match(/function _preferVisibleHit\(hits\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(!!fv && !!fp, '_hitVisible · _preferVisibleHit 를 찾았다');
  const pref = new Function(fv + '\n' + fp + '\nreturn _preferVisibleHit;')();
  const node = (vis, parent) => ({ visible: vis, parent: parent || null });
  const hostRoot = node(true), hostBody = node(false, hostRoot);   // 자리비움 — 몸만 숨김
  const riderRoot = node(true), rider = node(true, riderRoot);
  const r1 = pref([{ object: hostBody, n: 'host' }, { object: rider, n: 'rider' }]);
  chk(r1[0].n === 'rider' && r1.length === 2, '★ 숨은 몸(자리비움) 앞에 맞아도 보이는 탑승자를 먼저 잡는다');
  const r2 = pref([{ object: hostBody, n: 'host' }]);
  chk(r2[0].n === 'host', '  보이는 히트가 없으면 예전처럼 — 이미지 없는 자리비움 캐릭터도 쓰다듬을 수 있다');
  const r3 = pref([{ object: rider, n: 'rider' }, { object: hostBody, n: 'host' }]);
  chk(r3[0].n === 'rider', '  이미 보이는 것이 앞이면 그대로');
  const hiddenParent = node(false), inHidden = node(true, hiddenParent);
  chk(pref([{ object: inHidden, n: 'a' }, { object: rider, n: 'b' }])[0].n === 'b', '  조상이 숨은 메시도 «안 보임» 으로 본다');
  chk(/const hit=_preferVisibleHit\(_skipHiddenDesk\(_hitsSkipHidden\(ray\.intersectObjects\(seats\.map\(s=>s\.group\),true\)\)\)\);/.test(APP), '잡기(pointerdown)가 그 순서를 쓴다');
  chk(/if\(seat\.ridingOn && !seat\.remote\) unmountRide\(seat\);/.test(APP), '  내 탑승 동물이 잡히면 내려온다(예전 규칙 그대로)');
}

say('§10 듀얼 모니터 — 위치순 이름 · 저장 모니터 다시 찾기');
{
  const MAIN = (() => { for (const c of ['main.js', '../main.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
  if (!MAIN) chk(false, 'main.js 를 찾았다');
  else {
    const g = (re) => (MAIN.match(re) || [''])[0];
    const src = [g(/function _displayKey\(d\)\{[\s\S]*?\n\}/), g(/function _displaySize\(d\)\{[^\n]*\}/),
                 g(/function _displaysByPosition\(all\)\{[\s\S]*?\n\}/), g(/function _pickRunDisplay\(all, primaryId, saved\)\{[\s\S]*?\n\}/)].join('\n');
    const M = new Function(src + '\nreturn { _displayKey, _pickRunDisplay, _displaysByPosition };')();
    const D = (id, x, w, h, sf) => ({ id, bounds: { x, y: 0, width: w, height: h }, rotation: 0, scaleFactor: sf || 1 });
    // 제보 PC 모양: 주 모니터가 열거 두 번째로 온다
    const left = D(11, -1920, 1920, 1080), main = D(22, 0, 2560, 1440);
    const all = [main, left];
    const order = M._displaysByPosition(all).map(d => d.id);
    chk(order.join() === '11,22', '★ 이름 번호는 위치순(왼→오) — 열거 순서가 아니다');
    chk(/label: `모니터 \$\{i\+1\} · \$\{d\.bounds\.width\}×\$\{d\.bounds\.height\}` \+ \(d\.id === primaryId \? ' \(주\)' : ''\)/.test(MAIN) && /_displaysByPosition\(all\)\.map\(\(d, i\) =>/.test(MAIN), '  「모니터 N · 해상도 (주)」 · 위치순 목록');
    const keyL = M._displayKey(left);
    // ① 지문 정확 일치가 id 보다 먼저 — id 가 서로 뒤바뀐 경우
    const swapped = [D(11, 0, 2560, 1440), D(22, -1920, 1920, 1080)];   // id 만 뒤바뀜
    const r1 = M._pickRunDisplay(swapped, 11, { id: 11, key: keyL, wasPrimary: false });
    chk(r1.stage === 'key' && r1.display.id === 22, '★ id 가 뒤바뀌어도 지문으로 원래 모니터(왼쪽 1920)를 찾는다');
    // ② id 일치는 크기가 같을 때만
    const r2 = M._pickRunDisplay([D(11, 0, 2560, 1440)], 11, { id: 11, key: keyL, wasPrimary: false });
    chk(r2.stage !== 'id' && !r2.strong, '★ id 만 같고 크기가 다르면 그 모니터로 굳히지 않는다');
    const r2b = M._pickRunDisplay([D(11, 50, 1920, 1080, 1.5), main], 22, { id: 11, key: keyL, wasPrimary: false });
    chk(r2b.stage === 'id' && r2b.strong, '  배율 · 위치만 바뀐 같은 모니터(id · 크기 같음)는 찾는다');
    // ④ 주 아님이었으면 주 아닌 쪽
    const r4 = M._pickRunDisplay([D(33, 0, 2560, 1440), D(44, 2560, 1680, 1050)], 33, { id: 11, key: keyL, wasPrimary: false });
    chk(r4.stage === 'non-primary' && r4.display.id === 44 && !r4.strong, '저장한 게 «주 아님» 이면 대체도 주 아닌 쪽 — 저장은 덮지 않는다');
    const r5 = M._pickRunDisplay([main], 22, { id: 11, key: keyL, wasPrimary: false });
    chk(r5.display === null, '  모니터가 하나뿐이면 주 모니터');
    const r6 = M._pickRunDisplay(all, 22, { id: null, key: null, wasPrimary: null });
    chk(r6.display === null && /고른 적 없음/.test(r6.stage), '고른 적 없으면 주 모니터(예전 그대로)');
    const gr = g(/function getRunDisplay\(\)\{[\s\S]*?\n\}/);
    chk(/if\(r\.strong && \(found\.id !== runDisplayId/.test(gr) && /_diagLog\('\[화면\] 실행 모니터 — '/.test(gr), '확실히 찾았을 때만 저장 갱신 · 어느 단계였는지 진단 로그(바뀔 때만)');
    chk(/runDisplayWasPrimary = \(target\.id === screen\.getPrimaryDisplay\(\)\.id\);/.test(MAIN) && /typeof data\.runDisplayWasPrimary === 'boolean'/.test(MAIN), '고를 때 주 모니터였는지 저장 · 불러오기');
  }
}

say('§2 계정을 바꾼 뒤 자동 저장이 옛 계정 마이홈으로 덮어쓰지 않는다');
{
  const load = (APP.match(/async function loadMyHomePage\(\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/const _loadUid = getMyUserId\(\);/.test(load) && /if\(getMyUserId\(\) !== _loadUid\) return;/.test(load) && /_myHomeUid = _loadUid;/.test(load),
    '★ 불러올 때 계정 코드를 적어 둔다 · 불러오는 사이 계정이 바뀌면 붙들지 않는다');
  const i = APP.indexOf('async function commitMyHomePage(silent){');
  const commit = APP.slice(i, i + 2500);
  const iUid = commit.indexOf('if(_myHomeLoaded && _myHomeUid !== getMyUserId()){'), iSave = commit.indexOf('firebaseAPI.saveMyHome(');
  chk(iUid > 0 && iSave > iUid, '★ 저장 전에 «불러온 계정 = 지금 계정» 을 본다');
  chk(/_myHomeLoaded = false;[\s\S]{0,200}return;/.test(commit.slice(iUid, iUid + 400)), '  다르면 저장하지 않고 불러온 상태도 무효로');
  // 흉내 — 계정 A 로 불러온 뒤 B 로 바뀐 상태에서 저장
  const sim = (loadedUid, nowUid) => { let loaded = true, saved = false; if (loaded && loadedUid !== nowUid) { loaded = false; return { saved, loaded }; } saved = true; return { saved, loaded }; };
  chk(!sim('uA', 'uB').saved && sim('uA', 'uA').saved, '  흉내 — 바뀐 계정이면 안 쓰고, 같은 계정이면 쓴다');
}

say('');
say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅');
process.exit(fail ? 1 : 0);
