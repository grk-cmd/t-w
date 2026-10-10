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
  /* 자동 저장(commitMyHomePage)은 myhome-edit.js 로 옮겼다(앱 FSD 7-2) — 거기서는 app.js 의 let 을
     읽는 함수 _myHomeLoaded() · _myHomeUid() 와 쓰는 함수 _setMyHomeLoaded(false) 로 다룬다. */
  const EDIT = read('myhome-edit.js') || '';
  const i = EDIT.indexOf('async function commitMyHomePage(silent){');
  const commit = i < 0 ? '' : EDIT.slice(i, i + 2500);
  const iUid = commit.indexOf('if(_myHomeLoaded() && _myHomeUid() !== getMyUserId()){'), iSave = commit.indexOf('firebaseAPI.saveMyHome(');
  chk(iUid > 0 && iSave > iUid, '★ 저장 전에 «불러온 계정 = 지금 계정» 을 본다' + (EDIT ? '' : ' — myhome-edit.js 를 못 찾음'));
  chk(/_setMyHomeLoaded\(false\);[\s\S]{0,200}return;/.test(commit.slice(iUid, iUid + 400)), '  다르면 저장하지 않고 불러온 상태도 무효로');
  // 흉내 — 계정 A 로 불러온 뒤 B 로 바뀐 상태에서 저장
  const sim = (loadedUid, nowUid) => { let loaded = true, saved = false; if (loaded && loadedUid !== nowUid) { loaded = false; return { saved, loaded }; } saved = true; return { saved, loaded }; };
  chk(!sim('uA', 'uB').saved && sim('uA', 'uA').saved, '  흉내 — 바뀐 계정이면 안 쓰고, 같은 계정이면 쓴다');
}

say('§3 표정 도장 — 턱 아래로 감아 칠하기 (공 모양 머리 흉내)');
{
  const THREE_SRC = (() => { for (const c of ['three.min.js', 'vendor/three/three.min.js', 'app/vendor/three/three.min.js', '../app/vendor/three/three.min.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
  const AN = read('animal.js');
  if (!THREE_SRC) say('  · three.min.js 가 이 폴더에 없어 흉내는 건너뜀');
  else {
    const vm = require('vm'); const ctx = {}; vm.createContext(ctx);
    vm.runInContext(THREE_SRC, ctx);
    const g = (re) => (APP.match(re) || [''])[0];
    const src = ['const _picCastRay=new THREE.Raycaster();', g(/const _pskVec=new THREE\.Vector3\(\)[\s\S]*?\nconst _pskLA=[^\n]*\n/),
      'function _picIsSkinned(o){ return false; } function _picSkinnedIntersect(){ return null; }',
      g(/function _picIntersect\(ray, meshes\)\{[\s\S]*?\n\}/),
      g(/const STAMP_WRAP_RINGS[\s\S]*?\nfunction _wdPicHit/).replace(/\nfunction _wdPicHit$/, '')].join('\n');
    vm.runInContext(src + '\nthis._stampWrapFill=_stampWrapFill; this._stampWrapCenter=_stampWrapCenter; this._picIntersect=_picIntersect;', ctx);
    const out = vm.runInContext(`(()=>{
      const head=new THREE.Mesh(new THREE.SphereGeometry(1,48,32), new THREE.MeshBasicMaterial({side:THREE.DoubleSide})); head.updateMatrixWorld(true);
      const cam=new THREE.PerspectiveCamera(30,1,0.1,100); cam.position.set(0,0,6); cam.lookAt(0,0,0); cam.updateMatrixWorld(true);
      const run=(y0,y1)=>{ const N=28, uvs=[], rays=[], rc=new THREE.Raycaster(), ndc=new THREE.Vector2();
        for(let j=0;j<=N;j++) for(let i=0;i<=N;i++){ ndc.set(-0.15+0.3*i/N, y0+(y1-y0)*j/N); rc.setFromCamera(ndc,cam);
          const h=_picIntersect(rc.ray,[head]); uvs.push(h?{x:h.uv.x,y:h.uv.y,p:h.point.clone()}:null); if(!h) rays[uvs.length-1]=1; }
        const filled=_stampWrapFill(uvs,N,rays,[head],_stampWrapCenter(head));
        const w=uvs.filter(x=>x&&x.wrap); const col=[]; for(let j=0;j<=N;j++){ const u=uvs[j*(N+1)+14]; if(u) col.push(u.p); }
        let mono=true; for(let k=1;k<col.length;k++) if(col[k].y>col[k-1].y+1e-6 || col[k].z>col[k-1].z+1e-6) mono=false;
        return { filled, below: w.every(x=>x.p.y<-0.3), uniq: new Set(w.map(x=>x.x.toFixed(4)+','+x.y.toFixed(4))).size, n: w.length, mono }; };
      return { chin: run(-0.3,-0.9), top: run(0.3,0.9) };
    })()`, ctx);
    chk(out.chin.filled > 0 && out.chin.below, '★ 턱 아래로 나간 칸을 아래쪽 실제 표면에 이어 칠한다 (' + out.chin.filled + '칸)');
    chk(out.chin.uniq === out.chin.n, '  감은 점의 UV 가 전부 다르다 — 한 점에 뭉쳐 번지던 예전 띠와 다르다');
    chk(out.chin.mono, '  한 열을 따라 내려갈수록 아래 · 뒤로 이어진다 (그림이 접히지 않는다)');
    chk(out.top.filled === 0, '  머리 위로 나간 도장은 감지 않는다 (아래쪽만)');
  }
  chk(/const _wrapN=_stampWrapFill\(uvs, N, _wrapRays, \[cBase\.face\], _wrapCtr\);/.test(APP) && /_stampWrapFill\(uvs2, N, _wrapRays2, \[cBase\.face\], _wrapCtr\);/.test(APP), '사람 도장 · 거울 도장 둘 다 감는다');
  chk(!!AN && /if\(faceMesh\) _stampWrapFill\(uvs, N, wrapRays, \[faceMesh\], _stampWrapCenter\(faceMesh\)\);/.test(AN), '동물 도장도 감는다 (얼굴 메시만)');
  chk(/const EXTRA_MAX = 2;/.test(APP), 'EXTRA_MAX 는 그대로 2 — 예전 번짐 띠 보호 유지');
}

say('§5 호버해도 클릭이 바로 안 잡힘 — 일반 앱 첫 재판정 0.4초 · 펜 앱 근처 재질문');
{
  const MAIN = (() => { for (const c of ['main.js', '../main.js']) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; })();
  if (!MAIN) chk(false, 'main.js 를 찾았다');
  else {
    chk(/const GHOST_MS = 2000;/.test(MAIN) && /const GHOST_MS_PLAIN = 400;/.test(MAIN), '펜 앱 2초 그대로 · 일반 앱 0.4초');
    chk(/if\(now - _ghostSince < \(_penAppActive \? GHOST_MS : GHOST_MS_PLAIN\)\) return;/.test(MAIN), '★ 첫 찌르기 문턱만 앱 종류로 가른다');
    chk(/const GHOST_REPOKE_MS = 3000;/.test(MAIN) && /const GHOST_MAX_POKES = 3;/.test(MAIN), '  찌르기 간격 · 포기 한도는 그대로 (렌더러 사다리와의 결합 유지)');
    const fwd = (MAIN.match(/function _forwardFor\(\)\{[\s\S]*?\n\}/) || [''])[0];
    chk(/if\(_lastIgnoreRequested\) return true;/.test(fwd) && /return !_penAppActive \|\| _penMouseNearChar;/.test(fwd), '  _forwardFor(클립 스튜디오 보호) 그대로');
    const chkFn = (MAIN.match(/function _checkCursorNearChar\(\)\{[\s\S]*?\n\}/) || [''])[0];
    const re = chkFn.slice(chkFn.indexOf('if(near && _penMouseNearChar && _lastIgnoreRequested){'), chkFn.indexOf('if(near !== _penMouseNearChar){'));
    chk(re.length > 0 && /_now - _penRepokeAt >= PEN_REPOKE_MS/.test(re) && /_moved/.test(re) && /_sendHitTest\(\{ x: cx, y: cy \}\)/.test(re), '★ 펜 앱 — 근처 · 통과 중 · 움직였으면 150ms 간격으로 다시 묻는다');
    chk(!/setIgnoreMouseEvents|_reapplyIgnoreMouse|_applyForwardOnly/.test(re), '  찌르기만 — 통과 설정을 다시 걸지 않는다(영상 깜빡임 방지)');
    chk(/\) pen=' \+ \(_penAppActive \? 1 : 0\)\);/.test(MAIN), '「유령 의심」 로그 끝에 pen= (일반 · 펜 구분)');
    // 흉내 — 500ms 폴링으로 일반 앱 첫 찌르기까지 걸리는 시간
    const firstPoke = (pen) => { let since = 0; for (let t = 0; t <= 5000; t += 500) { if (!since) { since = t || 1; continue; } if (t - since >= (pen ? 2000 : 400)) return t; } return -1; };
    chk(firstPoke(false) <= 1000 && firstPoke(true) >= 2000, '  흉내 — 일반 앱은 1초 안에 첫 재판정(' + firstPoke(false) + 'ms) · 펜 앱은 예전대로(' + firstPoke(true) + 'ms)');
  }
}

say('§1-A 렌더러 사망 · 로드 실패 진단 + 1회 자동 재로드');
{
  const MAIN = fs.readFileSync(fs.existsSync('main.js') ? 'main.js' : '../main.js', 'utf8');
  const fn = (MAIN.match(/function _watchRendererHealth\(win\)\{[\s\S]*?\n\}/) || [''])[0];
  const iW = MAIN.indexOf('_watchRendererHealth(mainWindow);'), iL = MAIN.indexOf("mainWindow.loadFile(path.join(__dirname, 'app', 'desk-companion-prototype.html'));");
  chk(fn && iW > 0 && iL > iW, '★ 창을 불러오기 전에 감시를 건다 (첫 로드 실패도 잡힌다)');
  chk(/wc\.on\('render-process-gone'/.test(fn) && /reason === 'clean-exit' \|\| reason === 'killed'\) return;/.test(fn), '렌더러 사망 기록 — 정상 종료 · 강제 종료는 재로드 안 함');
  chk(/const RENDERER_AUTO_RELOAD_MAX = 1;/.test(MAIN) && /if\(_rendererReloads >= RENDERER_AUTO_RELOAD_MAX\) return;\s*_rendererReloads\+\+;/.test(fn), '★ 자동 재로드는 한 번만 (계속 죽는 PC 에서 무한 재시작 없음)');
  chk(/wc\.on\('did-fail-load'/.test(fn) && /if\(isMainFrame === false\) return;/.test(fn), '로드 실패 기록 — 본 화면만 (iframe 실패 제외)');
  chk(/win\.on\('unresponsive'/.test(fn) && /win\.on\('responsive'/.test(fn), '무응답 · 응답 재개 기록');
  chk(/if\(!_childGoneHooked\)\{\s*_childGoneHooked = true;\s*app\.on\('child-process-gone'/.test(fn), 'GPU 등 자식 프로세스 종료 기록 — 한 번만 건다');
  // 흉내 — 세 번 죽어도 재로드는 한 번
  let reloads = 0, n = 0; const gone = (reason) => { if (reason === 'clean-exit' || reason === 'killed') return; if (n >= 1) return; n++; reloads++; };
  ['crashed', 'clean-exit', 'oom', 'crashed'].forEach(gone);
  chk(reloads === 1, '  흉내 — 네 번 종료(정상 1 포함)에도 재로드 1번');
}

say('§1-B 그래픽카드 · GPU 기능 상태 · 시험 스위치 기록');
{
  const MAIN = fs.readFileSync(fs.existsSync('main.js') ? 'main.js' : '../main.js', 'utf8');
  const iG = MAIN.indexOf('_logGpuOnce(mainWindow);'), iL = MAIN.indexOf("mainWindow.loadFile(path.join(__dirname, 'app', 'desk-companion-prototype.html'));");
  chk(iG > 0 && iL > iG, '창을 불러오기 전에 건다');
  const lg = (MAIN.match(/function _logGpuOnce\(win\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/if\(_gpuLogged\) return;/.test(lg) && /app\.once\('gpu-info-update', go\)/.test(lg) && /did-finish-load', \(\) => setTimeout\(go, 1500\)/.test(lg), '★ GPU 준비 뒤 · 부팅마다 한 번만');
  chk(!/appendSwitch\('disable-gpu-compositing'\)/.test(MAIN.replace(/^\s*\/\/.*$/mg, '')) && !/disableHardwareAcceleration\(\)/.test(MAIN.replace(/^\s*\/\/.*$/mg, '').replace(/\/\*[\s\S]*?\*\//g, '')), '★ CPU 합성 · 하드웨어 가속 끄기는 켜지 않았다 (기록만)');
  const src = (MAIN.match(/const GPU_TEST_SWITCHES[\s\S]*?\nfunction _gpuSummary\(info, feat, sw\)\{[\s\S]*?\n\}/) || [''])[0];
  let sum = null; try { sum = new Function(src + '\nreturn _gpuSummary;')(); } catch (e) { say('  ' + e.message); }
  if (!sum) chk(false, '_gpuSummary 를 꺼냈다');
  else {
    const sw = (on) => ({ has: (s) => s in on, value: (s) => on[s] || '' });
    const a = sum({ gpuDevice: [{ vendorId: 0x8086, deviceId: 0x9bc4, active: true }, { vendorId: 0x10de, deviceId: 0x1f95, active: false, driverVersion: '31.0.15' }] },
      { gpu_compositing: 'enabled', webgl: 'enabled' }, sw({ 'use-angle': 'gl' }));
    chk(/Intel 0x9bc4\(사용 중\)/.test(a) && /NVIDIA 0x1f95 드라이버 31\.0\.15/.test(a) && /그래픽카드 2개/.test(a), '  실행 — 내장 + 외장 노트북이 한 줄에 보인다: ' + a.slice(0, 70) + '…');
    chk(/gpu_compositing=enabled/.test(a) && /rasterization=\?/.test(a) && /시험 스위치 use-angle=gl/.test(a), '  실행 — 기능 상태 · 시험 스위치 값이 남는다');
    const b = sum(null, null, sw({}));
    chk(/\[GPU\] 정보 없음/.test(b) && /시험 스위치 없음/.test(b), '  실행 — 정보가 없어도 죽지 않는다');
  }
}

say('§13 꾸미기 초안 — 캐릭터를 바꾼 뒤 저장해도 원래 캐릭터에만');
{
  const cm = (APP.match(/async function _commitWdDraftNow\(silent\)\{[\s\S]*?\n\}/) || [''])[0];
  const iG = cm.indexOf('if(draft._srcDef && draft._srcDef !== mySeat.charDef) return _commitWdDraftToOwner(draft, silent);');
  const iW = cm.indexOf('const def=mySeat.charDef;');
  chk(iG > 0 && iW > iG, '★ 저장 전에 초안 주인을 대조한다 (다르면 지금 캐릭터에 쓰지 않음)');
  const sw = (APP.match(/function switchMainCharacter\(i\)\{[\s\S]*?\n\}/) || [''])[0];
  chk((sw.match(/_wdAfterMainSwap\(\);/g) || []).length === 2, '캐릭터 교체 · 자리 교체 두 갈래 모두 교체 뒤 초안을 정리한다');
  const af = (APP.match(/function _wdAfterMainSwap\(\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/if\(!editing\)\{ wdDraftDef = null; return; \}/.test(af), '  창이 닫혀 있으면 다시 쓰지 않고 초안만 버린다');
  const src = (APP.match(/async function _commitWdDraftToOwner\(draft, silent\)\{[\s\S]*?\n\}/) || [''])[0];
  let run = null;
  try {
    run = new Function('env', 'let wdDraftDef = env.draft; const {seats, slots, saveSlots, toast, Presence, pruneSeatPartsAgainstDef, applyEquippedPartsToSeat, fitModel} = env; const console = { warn(){} };\n'
      + src + '\nreturn _commitWdDraftToOwner(env.draft, true).then(r => ({ r, left: wdDraftDef }));');
  } catch (e) { say('  ' + e.message); }
  if (!run) chk(false, '_commitWdDraftToOwner 를 꺼냈다');
  else {
    const mk = () => {
      const A = { name: 'A', equippedParts: { hat: { id: 'old' } } }, B = { name: 'B', equippedParts: { hat: { id: 'b' } } };
      const draft = Object.assign({}, A, { equippedParts: { hat: { id: 'ribbon' }, face: { id: 'blush' } }, partXfMemory: {} }); draft._srcDef = A;
      const applied = [];
      return { A, B, draft, applied, saved: 0, presence: 0 };
    };
    // 자리 교체 — A 는 자리추가 좌석으로 남아 있다
    const t1 = mk();
    const e1 = { draft: t1.draft, slots: [t1.A, t1.B], seats: [{ isMe: true, charDef: t1.B }, { isExtra: true, charDef: t1.A }],
      saveSlots: () => t1.saved++, toast(){}, Presence: { active: () => true, updateDef: () => t1.presence++ },
      pruneSeatPartsAgainstDef(){}, applyEquippedPartsToSeat: async (s, d) => t1.applied.push(d.name), fitModel(){} };
    // 캐릭터 교체 — A 는 화면에 없고 슬롯에만 있다
    const t2 = mk();
    const e2 = Object.assign({}, e1, { draft: t2.draft, slots: [t2.A, t2.B], seats: [{ isMe: true, charDef: t2.B }], saveSlots: () => t2.saved++,
      applyEquippedPartsToSeat: async (s, d) => t2.applied.push(d.name), Presence: { active: () => true, updateDef: () => t2.presence++ } });
    // 원래 캐릭터를 찾을 수 없음
    const t3 = mk();
    const e3 = Object.assign({}, e2, { draft: t3.draft, slots: [t3.B], seats: [{ isMe: true, charDef: t3.B }], saveSlots: () => t3.saved++ });
    Promise.all([run(e1), run(e2), run(e3)]).then(([r1, r2, r3]) => {
      chk(t1.A.equippedParts.face && t1.A.equippedParts.hat.id === 'ribbon' && t1.B.equippedParts.hat.id === 'b' && !t1.B.equippedParts.face,
        '★ 실행 — 자리 교체 뒤: A 에 저장 · B 는 그대로');
      chk(t1.applied.join() === 'A' && t1.presence === 0 && t1.saved === 1 && r1.left === null, '  자리추가로 남은 A 좌석에만 입히고, 방에는 안 보낸다 · 초안 버림');
      chk(t2.A.equippedParts.hat.id === 'ribbon' && t2.B.equippedParts.hat.id === 'b' && t2.applied.length === 0 && t2.saved === 1, '★ 실행 — 캐릭터 교체 뒤: 슬롯의 A 에만 저장 · B 는 그대로');
      chk(r3.r === false && t3.B.equippedParts.hat.id === 'b' && t3.saved === 0 && r3.left === null, '  실행 — A 를 못 찾으면 아무 데도 안 쓴다');
      done13();
    });
  }
}
let _done13 = null; const done13 = () => { if (_done13) _done13(); else _done13 = true; };

say('§9 보관함 이동 — 연타 · 동기화 경쟁');
{
  const mv = (APP.match(/async function doMoveCurSlotToBox\(\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/if\(_moveToBoxBusy\)\{ toast\(/.test(mv) && /finally\{ _moveToBoxBusy = false; \}/.test(mv), '★ 진행 중이면 다시 안 들어간다 (연타 방지 · 실패해도 풀린다)');
  chk(/const at = slots\.indexOf\(slotObj\);/.test(mv) && /for\(let k = at; k < slots\.length - 1; k\+\+\)/.test(mv) && !/for\(let k = i; k < slots\.length - 1/.test(mv), '★ 기다린 뒤에는 번호 대신 그 캐릭터로 칸을 다시 찾아 당긴다');
  chk(/_charsMoveFailLog\(r, i\);/.test(mv) && /localStorage\.setItem\('tw\.charsMoveFails'/.test(APP), '실패 이유를 기록한다 (콘솔 + 최근 10건)');
  const d2b = (APP.match(/async function _charsDeskToBox\(i\)\{[\s\S]*?\n\}/) || [''])[0];
  chk(/await _idle\(\);\s*try\{ await _charsSync\('force'\); \}catch\(_\)\{\}\s*await _idle\(\);/.test(d2b) && /_charsSyncing && t < 200/.test(d2b), '★ 도는 동기화를 기다린 뒤 올리고, 끝날 때까지 다시 기다린다');
  chk(/const j = desk\.indexOf\(cid\); if\(j < 0\) return \{ ok: false, why: 'moved' \}; i = j;/.test(d2b), '  번호가 바뀌었으면 그 캐릭터의 새 번호로 따라간다');
  const sy = (APP.match(/async function _charsSync\(reason\)\{[\s\S]*?\n\}/) || [''])[0];
  const iLoad = sy.indexOf('try{ await loadSlots(); }catch(_){}'), iGen = sy.indexOf("if(gen !== _charsGen){ _charsSyncAgain = true; return { ok: true, did: '불러오는 중 바뀜 — 다시' }; }"), iSave = sy.indexOf('try{ saveSlots(); }catch(_){}', iLoad);
  chk(iLoad > 0 && iGen > iLoad && iSave > iGen, '★ 동기화 — loadSlots 를 기다린 뒤 칸이 바뀌었으면 saveSlots 를 건너뛴다 (양쪽에 남던 자리)');
  chk(/return '옮기지 못했어요 — 다시 눌러 주세요' \+ \(w \? ' \(' \+ w \+ '\)' : ''\);/.test(APP), '기본 실패 문구에 이유 코드');
  // 흉내 — 연타 두 번이 겹쳐도 한 번만 옮긴다
  (async () => {})();
  let busy = false, moved = 0;
  const press = async () => { if (busy) return 'busy'; busy = true; try { await new Promise(r => setTimeout(r, 5)); moved++; } finally { busy = false; } return 'ok'; };
  Promise.all([press(), press(), press()]).then(rs => {
    chk(moved === 1 && rs.filter(x => x === 'busy').length === 2, '  흉내 — 세 번 연타해도 한 번만 옮긴다');
    const fin = () => { say(''); say(fail ? '문제 ' + fail + '건' : '전부 통과 ✅'); process.exit(fail ? 1 : 0); };
    if (_done13 === true) fin(); else _done13 = fin;
  });
}

