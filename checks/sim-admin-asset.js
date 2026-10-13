/* ═══ 📦 sim-admin-asset.js — 코드 굽는 창 셋 모듈 (2026-10-14 신설 · 관리자 코드 admin 폴더 6번) ═══════════════
   app.js 의 «책상·아이템 코드: 생성(판매자)» · «커미션 캐릭터 코드: 생성(관리자만)» · «풀 GLB: 암호화 / 불러오기» 를
   parts/admin/admin-asset.js 로 옮겼다. 동작은 그대로여야 한다 — 가짜 DOM 위에서 굴린다.
   ・1절: 만들 때 — 버튼 열다섯을 건다 · 빈 반환 · 아무것도 안 부름
   ・2절: 📦 책상·아이템 코드 — 파일 · 비밀번호 확인 · 크기 상한(지금 값을 읽음) · wrapAsset → encryptAssetCode(종류)
   ・3절: 🎁 커미션 — zip 상한(지금 값) · 풀기 → 페이로드(t:'comm' · name · glb base64 · face · blink) → encryptCommission
   ・4절: 🔐 GLB 불러오기 — .dcc 는 비밀번호로 풀고 · .glb 는 그대로 → loadEncryptedGlbAsSeat(이름.glb)
   ・5절: app.js 연결 — 본문이 안 남음 · 사용자 쪽(코드로 추가하기 · 커미션 코드 입력)은 남음 · 빈 껍데기 · deps 12 · 원래 자리 · html
   ・6절: 일부러 깨 보기
   [실행] app.js · desk-companion-prototype.html · admin-asset.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const { joinRenderer: _joinRenderer } = require('./sim-renderer-src.js');   // 앱 FSD 로 옮긴 모듈을 «옮기기 전 app.js 글» 로 되살려 읽는다
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = _joinRenderer(read('app.js')), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ['admin-asset.js', 'parts/admin/admin-asset.js', 'app/parts/admin/admin-asset.js'].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — admin-asset.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const BTNS = ['lcAssetGen', 'assetGenCancel', 'assetGenGo', 'assetGenCopy', 'assetGenSave', 'lcCommissionGen', 'commGenCancel', 'commGenGo', 'commGenCopy', 'commGenSave',
  'glbEncCancel', 'glbEncGo', 'lcGlbLoad', 'glbLoadCancel', 'glbLoadGo'];
const FNS = ['toast', 'encryptAssetCode', 'wrapAsset', '_b64', 'encryptCommission', 'unpackCommissionZip', 'encryptBytes', 'decryptBytes', 'downloadBlob', 'loadEncryptedGlbAsSeat'];

function build(src, st){
  const calls = [], els = {};
  const mk = (id) => ({ id, style: {}, value: '', textContent: '', files: [], onclick: null, _on: {},
    classList: { _s: new Set(), add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); }, contains(c){ return this._s.has(c); } },
    addEventListener(t, f){ (this._on[t] = this._on[t] || []).push(f); }, select(){}, click(){}, remove(){} });
  const document = { getElementById: (id) => els[id] || (els[id] = mk(id)), createElement: () => mk(''), body: { appendChild(){} }, execCommand(){} };
  const rec = (n, ret) => async (...a) => { calls.push([n, ...a]); return typeof ret === 'function' ? ret(...a) : ret; };
  const deps = {
    toast: (m) => calls.push(['toast', m]), wrapAsset: (n, i, g) => ({ n, i, g }), _b64: (b) => 'B64(' + b + ')',
    encryptAssetCode: rec('encryptAssetCode', 'DCK1:code'), encryptCommission: rec('encryptCommission', 'CMS1:code'),
    unpackCommissionZip: rec('unpackCommissionZip', { glbBuf: 'GLB', faceDataUrl: 'data:face', blinkDataUrl: 'data:blink' }),
    encryptBytes: rec('encryptBytes', 'ENC'), decryptBytes: rec('decryptBytes', 'PLAIN'), downloadBlob: (...a) => calls.push(['downloadBlob', ...a]),
    loadEncryptedGlbAsSeat: (...a) => calls.push(['loadEncryptedGlbAsSeat', ...a]),
    maxGlbBytes: () => st.maxGlb, maxCommissionBytes: () => st.maxComm,
  };
  const crypto = { subtle: {} };
  const win = { crypto };
  const api = new Function('window', 'document', 'crypto', 'Blob', 'URL', 'module', src + '\nreturn window.TwAdminAsset;')(win, document, crypto, class { constructor(){} }, { createObjectURL: () => 'blob:' }, undefined);
  const out = api.createAdminAsset(deps);
  return { out, calls, els: new Proxy(els, { get: (o, id) => document.getElementById(id) }) };
}
const file = (name, size) => ({ name, size, arrayBuffer: async () => 'BUF:' + name });

async function judgeAll(src, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const st = { maxGlb: 1000, maxComm: 2000 };
  let B;
  try{ B = build(src, st); }catch(e){ t(false, '모듈을 만들 수 없다 — ' + e.message); }
  if(B){
    const e = B.els;
    t(BTNS.every(id => typeof e[id].onclick === 'function') && B.out && !Object.keys(B.out).length && B.calls.length === 0, '만들 때 버튼 열다섯 · 빈 반환 · 아무것도 안 부름');
    /* 2. 📦 */
    e.assetGenKind.value = 'desk'; e.assetGenName.value = ''; e.assetGenIcon.value = '🪑'; e.assetGenPass.value = 'pw';
    st.maxGlb = 10; e.assetGenFile.files = [file('a.glb', 50)]; await e.assetGenGo.onclick();
    t(!B.calls.some(c => c[0] === 'encryptAssetCode') && B.calls.some(c => c[0] === 'toast' && /1MB/.test(c[1])), '📦 — 지금 상한(다시 읽음)보다 크면 안 굽는다');
    st.maxGlb = 1000; await e.assetGenGo.onclick();
    const ea = B.calls.find(c => c[0] === 'encryptAssetCode');
    t(ea && ea[1].n === '커스텀 책상' && ea[1].i === '🪑' && ea[1].g === 'BUF:a.glb' && ea[2] === 'pw' && ea[3] === 'desk' && e.assetGenOut.value === 'DCK1:code',
      '📦 — 이름 없으면 «커스텀 책상» · wrapAsset → encryptAssetCode(비밀번호 · 종류) · 결과 칸');
    e.assetGenPass.value = ''; const n0 = B.calls.length; await e.assetGenGo.onclick();
    t(B.calls.slice(n0).every(c => c[0] === 'toast'), '📦 — 비밀번호가 없으면 안 굽는다');
    /* 3. 🎁 */
    e.commGenName.value = '토끼'; e.commGenPass.value = 'pw2';
    st.maxComm = 10; e.commGenFile.files = [file('c.zip', 50)]; await e.commGenGo.onclick();
    t(!B.calls.some(c => c[0] === 'unpackCommissionZip'), '🎁 — 지금 상한보다 크면 안 굽는다');
    st.maxComm = 2000; await e.commGenGo.onclick();
    const ec = B.calls.find(c => c[0] === 'encryptCommission');
    t(ec && ec[1].t === 'comm' && ec[1].name === '토끼' && ec[1].glb === 'B64(GLB)' && ec[1].face === 'data:face' && ec[1].blink === 'data:blink' && ec[2] === 'pw2'
      && e.commGenOut.value === 'CMS1:code', '🎁 — zip 풀기 → 페이로드(comm · 이름 · glb base64 · 얼굴 둘) → encryptCommission');
    /* 4. 🔐 */
    e.glbLoadFile.files = [file('x.dcc', 5)]; e.glbLoadPass.value = ''; await e.glbLoadGo.onclick();
    t(!B.calls.some(c => c[0] === 'decryptBytes'), '🔐 — .dcc 인데 비밀번호가 없으면 안 연다');
    e.glbLoadPass.value = 'k'; await e.glbLoadGo.onclick();
    const ld = B.calls.find(c => c[0] === 'loadEncryptedGlbAsSeat');
    t(B.calls.some(c => c[0] === 'decryptBytes' && c[1] === 'BUF:x.dcc' && c[2] === 'k') && ld && ld[1] === 'PLAIN' && ld[2] === 'x.glb', '🔐 — .dcc 는 풀어서 «이름.glb» 로 앉힌다');
    e.glbLoadFile.files = [file('y.glb', 5)]; await e.glbLoadGo.onclick();
    const ld2 = B.calls.filter(c => c[0] === 'loadEncryptedGlbAsSeat')[1];
    /* 원래 동작: .glb 를 고르면 이름이 «y.glb.glb» 가 된다(.dcc 만 떼고 .glb 를 붙인다) — 옮기기 전과 같다. 고칠 일은 따로(개선 메모). */
    t(ld2 && ld2[1] === 'BUF:y.glb' && /\.glb$/.test(ld2[2]), '🔐 — .glb 는 풀지 않고 그대로 앉힌다');
  }
  /* 5. app.js 연결 */
  const A = strip(app);
  t(!/'lcAssetGen'|'assetGenGo'|'lcCommissionGen'|'commGenGo'|'lcGlbLoad'|'glbLoadGo'|'glbEncGo'/.test(A), 'app.js 에 옮긴 본문이 남지 않았다');
  t(/'assetImpFileBtn'/.test(A) && /'commImpFileBtn'/.test(A) && /function loadEncryptedGlbAsSeat\(/.test(A) && /function encryptAssetCode\(|async function encryptAssetCode\(/.test(A),
    '사용자 쪽(코드로 추가하기 · 커미션 코드 입력)과 굽는 함수들은 app.js 에 남았다');
  t(/const ADMIN_ASSET_OFF = \{\};/.test(app), '모듈이 없으면 빈 껍데기');
  const mk = (app.match(/const adminAsset = \(typeof TwAdminAsset === 'undefined'\) \? ADMIN_ASSET_OFF : TwAdminAsset\.createAdminAsset\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  const deps = mk.split('\n').map(l => l.trim()).filter(Boolean);
  t(deps.length === 12 && FNS.every(n => deps.includes(n + ': (...a)=>' + n + '(...a),')) && deps.includes('maxGlbBytes: ()=>MAX_GLB_BYTES,')
    && deps.includes('maxCommissionBytes: ()=>MAX_COMMISSION_BYTES,'), 'deps 12 — 함수 열 화살표 · 상한 둘은 읽는 함수(뒤에서 선언하는 const)');
  const iH = app.indexOf('/* === 책상·아이템 코드: 생성(판매자) === */'), iM = app.indexOf('const adminAsset ='), iImp = app.indexOf("document.getElementById('assetImpFileBtn')");
  t(iH > 0 && iM > iH && iM < iImp, '만드는 줄은 첫 덩이 자리(«책상·아이템 코드: 생성(판매자)» 머리 아래)');
  t(/window\.TwAdminAsset = api;/.test(src) && /module\.exports = api;/.test(src), '전역 이름 TwAdminAsset(Tw 접두사)');
  const iS = html.indexOf('<script src="parts/admin/admin-asset.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iS > 0 && iA > iS, 'html — admin/admin-asset.js 를 app.js 보다 먼저');
  return r;
}

(async () => {
  const rows = await judgeAll(MOD, SRC, HTML);
  const heads = { 0: '── 1. 만들 때', 1: '── 2. 📦 책상·아이템 코드', 4: '── 3. 🎁 커미션', 6: '── 4. 🔐 GLB 불러오기', 9: '── 5. app.js 연결' };
  rows.forEach(([ok, msg], i) => { if(heads[i]) say(heads[i]); chk(ok, msg); });
  say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const breaks = [
    ['상한을 값으로 붙잡음', { mod: s => s.replace('const MAX_GLB_BYTES = deps.maxGlbBytes;', 'const MAX_GLB_BYTES = ((v)=>()=>v)(deps.maxGlbBytes());') }],
    ['📦 상한 확인 빠짐', { mod: s => s.replace("if(f.size>MAX_GLB_BYTES()){toast(", "if(false){toast(") }],
    ['🎁 얼굴을 안 실음', { mod: s => s.replace('face: unpacked.faceDataUrl,', 'face: null,') }],
    ['🔐 .dcc 비밀번호 확인 빠짐', { mod: s => s.replace("if(nm.endsWith('.dcc')){ if(!p){toast('비밀번호를 입력하세요');return;}", "if(nm.endsWith('.dcc')){") }],
    ['버튼 하나 안 걺', { mod: s => s.replace("document.getElementById('lcGlbLoad').onclick=", "document.getElementById('lcGlbLoadX').onclick=") }],
    ['html 줄 빠짐', { html: s => s.replace('<script src="parts/admin/admin-asset.js"></script>', '') }],
    ['app.js 에 본문이 남음', { app: s => s + "\ndocument.getElementById('lcGlbLoad').onclick=()=>{};" }],
    ['deps 하나 빠짐', { app: s => s.replace('  maxCommissionBytes: ()=>MAX_COMMISSION_BYTES,\n', '') }],
  ];
  for(const [name, f] of breaks){
    const s2 = f.mod ? f.mod(MOD) : MOD, a2 = f.app ? f.app(SRC) : SRC, h2 = f.html ? f.html(HTML) : HTML;
    const changed = s2 !== MOD || a2 !== SRC || h2 !== HTML;
    let rows2; try{ rows2 = await judgeAll(s2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
