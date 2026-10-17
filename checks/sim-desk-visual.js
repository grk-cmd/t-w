/* ═══ 🪑 sim-desk-visual.js — 🪑 책상 모양 모듈 구조 (2026-10-16 신설 · 구역 떼기 C · w2) ═══════════════
   app.js 의 책상 모양 본문 을 parts/character/desk-visual.js 로 옮겼다(글자 그대로 · 바뀐 줄 1 — 읽는 · 쓰는 함수로 바꾼 자리). 동작 판정은 원래 검사들이 맡는다(4절 — 가짜 책상 그룹으로 바꿔 끼기 · 되돌리기 · 재생 모드 · 색 · 카탈로그 책상 · 라이선스).
   여기서는 모듈 모양 · app.js 연결을 본다.
   ・1절: 만들 때 — 아무 이름이나 받아 주는 가짜 DOM · deps 위에서 던지지 않고 만들어진다 · 내놓는 이름(applyDeskCatalogRefToSeat · applyDeskColorToCustom · swapDeskVisual)
   ・2절: app.js 연결 — 옮긴 꼭대기 선언이 app.js 에 안 남음 · 빈 껍데기 · deps 12줄 그대로 · 부르는 곳은 deskVisualMod.이름 · html(app.js 앞)
   ・4절: 동작 — 순수 판정 · 가짜 객체로 입력 → 출력 · 경계값(옮기기 전 app.js 글로도 같은 판정이 돈다)
   ・3절: 일부러 깨 보기 — 글을 망가뜨려 위 판정이 빨강이 되는지 스스로 굴려 본다
   [실행] app.js · desk-companion-prototype.html · desk-visual.js 가 있는 폴더에서(러너 스테이징이면 깊은 자리에서 끌어올린다). */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const SRC = read('app.js'), HTML = read('desk-companion-prototype.html');
if(!SRC || !HTML){ say('  ? 원본 못 찾음 — app.js · desk-companion-prototype.html'); process.exit(2); }
const MOD = ["desk-visual.js","parts/character/desk-visual.js","app/parts/character/desk-visual.js"].map(read).find(Boolean);
if(!MOD){ say('  ? 원본 못 찾음 — desk-visual.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');

const FN_DEPS = ["_applyItemMatTone","_setDeskMatColor","b64ToBuf","setDeskScale","toast"];
const VAL_DEPS = ["DEFAULT_DESK_OVERRIDE_ID","_idleItemPivots","activeItemMixers","assetCodeMod","commissionMod"];
const GET_DEPS = ["isAdmin","isPremium"];
const SET_DEPS = [];
const EXPORTS = ["applyDeskCatalogRefToSeat","applyDeskColorToCustom","swapDeskVisual"];
const MOVED = ["applyDeskCatalogRefToSeat","normalizeDeskObj","swapDeskVisual","applyDeskColorToCustom"];          // 옮긴 꼭대기 선언(app.js 에 남으면 두 벌)
const GLUE = ["  DEFAULT_DESK_OVERRIDE_ID: DEFAULT_DESK_OVERRIDE_ID,","  _applyItemMatTone: (...a)=>_applyItemMatTone(...a),","  _idleItemPivots: _idleItemPivots,","  _setDeskMatColor: (...a)=>_setDeskMatColor(...a),","  activeItemMixers: activeItemMixers,","  assetCodeMod: assetCodeMod,","  b64ToBuf: (...a)=>b64ToBuf(...a),","  commissionMod: commissionMod,","  isAdmin: ()=>isAdmin,","  isPremium: ()=>isPremium,","  setDeskScale: (...a)=>setDeskScale(...a),","  toast: (...a)=>toast(...a),"];

/* 아무 이름 · 아무 부름이나 받아 주는 가짜 — 만들 때 하는 일(버튼 연결 · 저장값 읽기)이 던지지 않는지만 본다.
   then 도 받는다 — 만들 때 부르는 서버 요청(.then 잇기)이 던지지 않게(풀리지는 않는다) */
function anything(){
  const f = function(){ return P; };
  const P = new Proxy(f, { get: (t, k) => k === Symbol.toPrimitive ? (() => '') : k === 'then' ? (() => P) : k === 'length' ? 0 : P, apply: () => P, construct: () => P, set: () => true, has: () => true });
  return P;
}
function build(src){
  const any = anything();
  const deps = {};
  FN_DEPS.forEach(n => { deps[n] = () => any; });
  VAL_DEPS.forEach(n => { deps[n] = any; });
  GET_DEPS.forEach(n => { deps[n] = () => any; });
  SET_DEPS.forEach(n => { deps['set' + n.replace(/^_+/, '').replace(/^./, c => c.toUpperCase())] = () => {}; });
  const win = new Proxy({}, { get: (t, k) => k in t ? t[k] : any, set: (t, k, v) => { t[k] = v; return true; } });
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const api = new Function('window', 'document', 'localStorage', 'navigator', 'firebaseAPI', 'companion', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'THREE', 'addEventListener', 'removeEventListener', 'module', 'MutationObserver', 'ResizeObserver',
    src + '\nreturn window.TwDeskVisual;')(win, any, ls, any, any, any, () => 0, () => 0, () => {}, () => {}, () => 0, any, () => {}, () => {}, undefined, class { observe(){} disconnect(){} }, class { observe(){} disconnect(){} });
  return api.createDeskVisual(deps);
}

function judgeAll(mod, app, html){
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let out = null, err = null;
  try{ out = build(mod); }catch(e){ err = e; }
  t(!err && out && typeof out === 'object', '만들 때 던지지 않는다' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  t(out && EXPORTS.every(n => n in out) && Object.keys(out).length === EXPORTS.length, '내놓는 이름 ' + EXPORTS.length + '개' + (EXPORTS.length ? ' — ' + EXPORTS.join(' · ') : ''));
  t(/window\.TwDeskVisual = api;/.test(mod) && /module\.exports = api;/.test(mod), '전역 이름 TwDeskVisual(Tw 접두사)');
  const A = strip(app.split('\n').filter(l => !l.includes('// 옛 전역 이름')).join('\n'));   // 옛 전역 이름 잇기 줄은 «남은 선언 · 옛 이름 부름» 이 아니다
  const left = MOVED.filter(n => new RegExp('^(?:async\\s+)?(?:function\\s+' + n.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + n.replace(/\$/g, '\\$') + '\\b)', 'm').test(A));
  t(!left.length, 'app.js 에 옮긴 꼭대기 선언이 안 남았다' + (left.length ? ' — ' + left.slice(0, 5).join(' · ') : ''));
  t(!app.includes("DESK_VISUAL_MOD_OFF") && app.includes("const deskVisualMod = TwDeskVisual.createDeskVisual({"), '빈 껍데기 없이 만든다(모듈은 늘 싣는다 — 가드 걷기 3차) · 만드는 줄');
  const mk = (app.match(new RegExp('const deskVisualMod = TwDeskVisual\\.createDeskVisual\\(\\{\\n([\\s\\S]*?)\\n?\\}\\);')) || [])[1] || '';
  /* 키 이름과 넘기는 방식만 본다 — 오른쪽(다른 모듈로 옮긴 이름이면 «mod.이름»)은 옮길 때마다 바뀔 수 있다 */
  const kindOf = (l) => { const m = /^  ([\w$]+): (\(\.\.\.a\)=>|\(\)=>|\(v\)=>)?/.exec(l); return m ? m[1] + '|' + (m[2] === '(...a)=>' ? 'fn' : m[2] === '()=>' ? 'get' : m[2] === '(v)=>' ? 'set' : 'val') : '?' + l; };
  const want = GLUE.map(kindOf), got = (mk ? mk.split('\n') : []).map(kindOf);   // deps 가 하나도 없으면 «({\n});»
  t(got.length === want.length && want.every((k, i) => got[i] === k), 'deps ' + GLUE.length + '개 — 키 · 넘기는 방식 그대로(함수 ' + FN_DEPS.length + ' · 값 ' + VAL_DEPS.length + ' · 읽는 함수 ' + GET_DEPS.length + ' · 쓰는 함수 ' + SET_DEPS.length + ')');
  /* 같은 이름의 딴 지역 변수가 app.js 에 따로 있는 이름(예: 함수 안 let)은 이 판정에서 뺀다 — 설정 localSame */
  const bare = EXPORTS.filter(n => ![].includes(n)).filter(n => new RegExp('(^|[^.\\w$])' + n.replace(/\$/g, '\\$') + '\\b(?!\\s*:[^:]|\\(\\)\\{\\})').test(A.replace(/const deskVisualMod = [\s\S]*?\n\}\);/, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g, "''")));   // 따옴표 글자 안의 이름(안내 문구)은 부르는 곳이 아니다
  t(!bare.length, '부르는 곳은 deskVisualMod.이름 — 옛 이름 그대로 부르는 자리 없음' + (bare.length ? ' — ' + bare.join(' · ') : ''));
  const iM = html.indexOf('<script src="parts/character/desk-visual.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — parts/character/desk-visual.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const rows = judgeAll(MOD, SRC, HTML);
rows.forEach(([ok, msg], i) => { if(i === 0) say('── 1. 만들 때'); if(i === 3) say('── 2. app.js 연결'); chk(ok, msg); });
say('── 3. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['html 줄 빠짐', null, null, h => h.replace('<script src="parts/character/desk-visual.js"></script>', '')],
  /* 같은 deps 줄이 다른 모듈을 만드는 줄에도 있을 수 있다 — 이 모듈을 만드는 줄 안의 마지막 deps 를 지운다 */
  /* deps 가 없는 모듈이면 거꾸로 한 줄을 끼워 넣어 본다(키 수가 어긋나야 잡힌다) */
  ['deps 하나 빠짐', null, GLUE.length ? (a => { const i = a.indexOf("const deskVisualMod = TwDeskVisual.createDeskVisual({"); const j = a.indexOf('\n});', i); const blk = a.slice(i, j); return a.slice(0, i) + blk.replace(/\n[^\n]*$/, '') + a.slice(j); }) : (a => a.replace("const deskVisualMod = TwDeskVisual.createDeskVisual({", "const deskVisualMod = TwDeskVisual.createDeskVisual({" + '\n  _extra: 1,')), null],
  ['전역 이름 안 걺', m => m.replace('window.TwDeskVisual = api;', ''), null, null],
  ['app.js 에 본문이 남음', null, a => a + '\nfunction ' + MOVED.find(n => /^[A-Za-z_$][\w$]*$/.test(n)) + '(){}', null],
  /* «옛 전역 이름» 이음 줄이 아닌 자리에서 하나를 옛 이름으로 되돌린다(이음 줄은 판정에서 빠진다) */
  ['부르는 곳이 옛 이름', null, a => { const ls = a.split('\n'); for(let i = 0; i < ls.length; i++){ if(ls[i].includes('// 옛 전역 이름') || ls[i].startsWith('const deskVisualMod =')) continue; const n = EXPORTS.find(x => ls[i].includes('deskVisualMod.' + x)); if(n){ ls[i] = ls[i].replace('deskVisualMod.' + n, n); return ls.join('\n'); } } return a; }, null],
  ['만들 때 던짐', m => m.replace('function createDeskVisual(deps){', 'function createDeskVisual(deps){ throw new Error("깨 봄");'), null, null],
];
for(const [name, fm, fa, fh] of breaks){
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(SRC) : SRC, h2 = fh ? fh(HTML) : HTML;
  const changed = m2 !== MOD || a2 !== SRC || h2 !== HTML;
  let rows2; try{ rows2 = judgeAll(m2, a2, h2); }catch(_){ rows2 = [[false, '던짐']]; }
  chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}

/* ── 4. 동작 — 가짜 THREE · 책상 그룹 위에서 바꿔 끼기 · 되돌리기 · 재생 모드 · 색 · 카탈로그 책상(옮기기 전 app.js 글로도 같은 판정이 돈다) */
say('── 4. 동작 — 책상 모양');
{
  const PREMOVE = !!process.env.TW_PREMOVE;
  const THREE_ = {
    LoopRepeat: 2201, LoopOnce: 2200,
    Vector3: class { constructor(){ this.x = 0; this.y = 0; this.z = 0; } },
    Box3: class { setFromObject(o){ this.o = o; this.min = { x: 0, y: o.__minY || 0, z: 0 }; return this; } getCenter(v){ Object.assign(v, this.o.__center || { x: 0, y: 0, z: 0 }); return v; } getSize(v){ return v; } },
    AnimationMixer: class { constructor(root){ this.root = root; this.actions = []; } clipAction(clip){ const a = { clip, loop: null, played: false, setLoop(l, n){ this.loop = [l, n]; }, play(){ this.played = true; } }; this.actions.push(a); return a; } },
  };
  const v3 = () => ({ x: 0, y: 0, z: 0, set(x, y, z){ this.x = x; this.y = y; this.z = z; } });
  const mkMesh = (name, mat) => ({ isMesh: true, name, material: mat, castShadow: false });
  const mkMat = (n) => ({ n, clone(){ return { n: n + "'" }; } });
  const mkTemplate = (o) => ({ clone(){
    const meshes = [mkMesh('top', mkMat('a')), mkMesh('leg_col', [mkMat('b'), mkMat('c')])];
    return { name: '', __minY: -0.5, __center: { x: 0.2, y: 0, z: 1.1 }, scale: v3(), position: v3(), updateMatrixWorld(){}, traverse(cb){ meshes.forEach(cb); }, meshes };
  } });
  const mkGroup = () => {
    const g = { userData: {}, children: [{ name: 'deskAnchor', visible: true }, { name: 'boardDefault', visible: true }, { name: 'legDefault', visible: true }],
      add(o){ this.children.push(o); }, remove(o){ this.children = this.children.filter(x => x !== o); }, getObjectByName(n){ return this.children.find(x => x.name === n); } };
    return g;
  };
  const load = (o) => {
    o = o || {};
    const log = { tone: [], color: [], scale: [], toast: [] };
    const raw = {
      DEFAULT_DESK_OVERRIDE_ID: '__default_desk__',
      _idleItemPivots: new Set(), activeItemMixers: new Set(),
      _applyItemMatTone: (m) => log.tone.push(m.n),
      _setDeskMatColor: (m, c) => log.color.push(m.n + '=' + c),
      setDeskScale: (d, s, l) => log.scale.push([s, l]),
      assetCodeMod: { parseGlbFull: async (b) => { if(o.parseThrows) throw new Error('bad'); log.parsed = b; return { scene: mkTemplate(), animations: o.anims || [] }; } },
      b64ToBuf: (b) => 'buf:' + b,
      commissionMod: { savedDesks: () => o.desks || [] },
      toast: (m) => log.toast.push(m),
      isPremium: !!o.premium, isAdmin: !!o.admin,
    };
    let api;
    if(!PREMOVE){
      const w = {}; new Function('window', 'module', 'THREE', MOD)(w, undefined, THREE_);
      api = w.TwDeskVisual.createDeskVisual(Object.assign({}, raw, { isPremium: () => raw.isPremium, isAdmin: () => raw.isAdmin }));
    } else {
      const a1 = SRC.indexOf('// 좌석의 charDef.deskCatalogId를 보고'), b1 = SRC.indexOf('\n/* (구역 떼기 C · w2) 이 자리의 본문도 character/catalog-sync.js', a1);
      const a2 = SRC.indexOf('/* 커스텀 책상: 기본 책상 메쉬'), b2 = SRC.indexOf('// ★ 어플 3-1: 책상 길이(X축)', a2);
      const names = Object.keys(raw);
      api = new Function(...names, 'THREE', SRC.slice(a1, b1) + '\n' + SRC.slice(a2, b2) + '\nreturn { swapDeskVisual, applyDeskColorToCustom, applyDeskCatalogRefToSeat };')(...names.map(n => raw[n]), THREE_);
    }
    return { api, log, raw };
  };
  (async () => {
    let { api, log, raw } = load();
    let thr = null; try{ api.swapDeskVisual(null, mkTemplate()); api.applyDeskColorToCustom(null, '#fff'); }catch(e){ thr = e; }
    chk(!thr, '책상 그룹이 없으면 아무 일 없이 지나간다');
    const g = mkGroup();
    api.swapDeskVisual(g, mkTemplate());
    const cd = g.getObjectByName('customDesk');
    chk(cd && g.children.filter(c => c.name === 'boardDefault' || c.name === 'legDefault').every(c => c.visible === false) && g.getObjectByName('deskAnchor').visible === true, '바꿔 끼기 — customDesk 를 더하고 기본 메쉬만 숨긴다(앵커는 그대로)');
    chk(cd.meshes.every(m => m.castShadow) && log.tone.join() === "a',b',c'" && cd.meshes[1].material[0].n === "b'", '  메쉬 머티리얼을 복제해 아이템 톤을 먹인다(배열 머티리얼도)');
    chk(g.userData.customMats.map(m => m.n).join() === "b',c'", '  _col 로 끝나는 메쉬의 머티리얼만 색 대상으로 모은다');
    chk(Math.abs(cd.position.x + 0.2) < 1e-9 && Math.abs(cd.position.z - (0.6 - 1.1)) < 1e-9 && Math.abs(cd.position.y - (0.5 + 0.15)) < 1e-9 && cd.scale.x === 1, '  자리 맞춤 — 가로 가운데 · 앞뒤 0.6 · 바닥에 피벗 + 0.15 · 크기는 원본 그대로(1)');
    api.applyDeskColorToCustom(g, '#c0ffee');
    chk(log.color.join() === "b'=#c0ffee,c'=#c0ffee", '색 — 모아 둔 _col 머티리얼마다 _setDeskMatColor');
    api.swapDeskVisual(g, mkTemplate());
    chk(g.children.filter(c => c.name === 'customDesk').length === 1, '  다시 바꿔 끼면 옛 customDesk 를 빼고 하나만');
    api.swapDeskVisual(g, null);
    chk(!g.getObjectByName('customDesk') && g.userData.customMats === null && g.children.every(c => c.visible !== false), '  템플릿 없이 부르면 기본 책상으로 되돌린다(색 대상 비움)');
    log.color.length = 0; api.applyDeskColorToCustom(g, '#000'); chk(!log.color.length, '  색 대상이 없으면 색칠 안 함');

    const clips = [{ name: 'Wave' }, { name: 'IdleLoop' }];
    const g2 = mkGroup();
    api.swapDeskVisual(g2, mkTemplate(), false, clips, 'auto');
    const mx = g2.userData.deskMixer, act = g2.userData.deskIdleAction;
    chk(mx && raw.activeItemMixers.has(mx) && act.clip.name === 'IdleLoop' && act.played && act.loop[0] === 2201 && act.loop[1] === Infinity && g2.userData.deskPlayMode === 'auto', '재생 auto — idle 이름 클립(없으면 첫 클립)을 반복 재생 · 재생 목록에 넣는다');
    g2.userData.__seat = { id: 'S' };
    api.swapDeskVisual(g2, mkTemplate(), false, [{ name: 'only' }], 'idle');
    const pv = g2.userData.deskIdlePivot;
    chk(!raw.activeItemMixers.has(mx) && pv && raw._idleItemPivots.has(pv) && pv.userData.holder.id === 'S' && pv.userData.idleAction.clip.name === 'only' && !pv.userData.idleAction.played, '재생 idle — 옛 믹서를 빼고 · 좌석(__seat)을 쥔 피벗을 idle 목록에 넣는다(재생은 그쪽이 정함)');
    api.swapDeskVisual(g2, mkTemplate(), false, clips, 'click');
    chk(!raw._idleItemPivots.has(pv) && g2.userData.deskIdleAction.loop[0] === 2200 && g2.userData.deskIdleAction.clampWhenFinished === true && !raw.activeItemMixers.has(g2.userData.deskMixer), '재생 click — 한 번 · 끝에서 멈춤 · 옛 피벗을 뺀다');
    api.swapDeskVisual(g2, mkTemplate(), false, clips, null);
    chk(!g2.userData.deskMixer, '  재생 모드가 없으면 믹서를 안 만든다');

    /* 좌석 책상 그리기 */
    const seat = (o) => Object.assign({ desk: mkGroup(), isMe: true }, o);
    ({ api, log } = load({ desks: [] }));
    let s = seat(); await api.applyDeskCatalogRefToSeat(s, { deskCatalogId: 'nope', deskScale: 0.2, deskLenX: 1.5 });
    chk(!s.desk.getObjectByName('customDesk') && log.scale[0].join() === '0.2,1.5', '카탈로그에 없는 책상 — 기본 책상 · 크기는 def 값');
    await api.applyDeskCatalogRefToSeat(seat(), { deskCatalogId: 'nope' });
    chk(log.scale[1].join() === '1,1', '  def 에 크기가 없으면 1 · 1');
    await api.applyDeskCatalogRefToSeat({ isMe: true }, { deskCatalogId: 'x' }); await api.applyDeskCatalogRefToSeat(null, {});
    chk(log.scale.length === 2, '  좌석 · 책상이 없으면 아무것도 안 한다');
    const lic = [{ id: 'L', glb: 'LG', licenseOnly: true, name: '금책상' }];
    ({ api, log } = load({ desks: lic }));
    s = seat(); await api.applyDeskCatalogRefToSeat(s, { deskCatalogId: 'L', deskScale: 0.3 });
    chk(!s.desk.getObjectByName('customDesk') && log.toast[0] === '🔒 "금책상"은(는) 라이선스 보유자만 사용할 수 있어요' && !log.parsed, '라이선스 전용 책상 — 내 좌석 · 라이선스 없음이면 기본 책상 + 안내');
    s = seat({ isMe: false }); await api.applyDeskCatalogRefToSeat(s, { deskCatalogId: 'L' });
    chk(log.toast.length === 1, '  내 좌석이 아니면 안내는 안 띄운다');
    s = seat({ remote: true, isMe: false }); await api.applyDeskCatalogRefToSeat(s, { deskCatalogId: 'L' });
    chk(s.desk.getObjectByName('customDesk'), '  친구 좌석(remote)은 막지 않는다 — 남이 쓴 책상은 보여야 한다');
    ({ api, log } = load({ desks: lic, premium: true })); s = seat(); await api.applyDeskCatalogRefToSeat(s, { deskCatalogId: 'L' });
    chk(s.desk.getObjectByName('customDesk'), '  라이선스가 있으면 그린다');
    ({ api, log } = load({ desks: lic, admin: true })); s = seat(); await api.applyDeskCatalogRefToSeat(s, { deskCatalogId: 'L' });
    chk(s.desk.getObjectByName('customDesk'), '  관리자도 그린다');
    ({ api, log } = load({ desks: [{ id: '__default_desk__', glb: 'OV', playMode: 'auto' }], anims: [{ name: 'idle' }] }));
    s = seat(); await api.applyDeskCatalogRefToSeat(s, { deskCatalogId: '__default_desk__', deskScale: 0.25, deskLenX: 2, deskColor: '#123' });
    chk(log.parsed === 'buf:OV' && s.desk.userData.__seat === s && s.desk.userData.deskScale === 0.25 && s.desk.getObjectByName('customDesk') && s.desk.userData.deskPlayMode === 'auto', '카탈로그 책상 — GLB 를 풀어 바꿔 끼고 · 좌석을 책상에 쥐여 주고 · 레코드의 재생 모드');
    chk(log.scale[0].join() === '0.25,2' && log.color.join() === "b'=#123,c'=#123", '  크기 · 길이 · 색을 다시 건다');
    ({ api, log } = load({ desks: [{ id: 'P', glb: 'X' }], parseThrows: true }));
    thr = null; try{ await api.applyDeskCatalogRefToSeat(seat(), { deskCatalogId: 'P' }); }catch(e){ thr = e; }
    chk(!thr && !log.scale.length, '  GLB 풀기가 실패하면 조용히 그대로 둔다');
    say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
    process.exit(fail ? 1 : 0);
  })().catch(e => { chk(false, '4절 던짐 — ' + (e && e.stack || e)); say(`\n✗ 통과 ${pass} · 실패 ${fail}`); process.exit(1); });
  return;
}

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
