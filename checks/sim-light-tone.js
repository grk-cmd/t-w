/* sim-light-tone.js — 💡 재질 톤(shared/light-tone.js) 계산 · 재질 함수 · 연결
   실행:  node sim-light-tone.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 화면 밝기는 «TONE_FRONT_TOTAL 하나에서 플랫 몫을 계산해 모든 재질이 같은 규칙으로 받는다» 에 걸려 있다.
     app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4) 계산식 · 경계(0 아래로 안 내려감) · 재질마다 emissive · baseFlat 을 입력 → 출력으로 고정한다.
   ・1절: 만들 때 · 상수 — 내놓는 이름 아홉 · LIGHT_PRESET · CREATOR_LIGHT_SL · TONE_FRONT_TOTAL · FLAT_EMISSIVE 식(조명 상수가 크면 0)
   ・2절: _applyPartMatTone — 텍스처 / 색 없음 / null · 3절: _applyItemMatTone — 텍스처 · solid · emissiveIntensity
   ・4절: _setDeskMatColor — 색 · baseFlat 처음 심기 / 지키기 · 색 없는 재질
   ・5절: app.js 연결 · 6절: 일부러 깨 보기(코어 빌드 사본을 깨 보는 것 포함 — 파츠 톤 · baseFlatOf 는 코어 tone.ts)
   ・7절: 실행 화면 조명 addRunLights — 일곱 자리(메인 · 종족 선택 · 런처 · 꾸미기 · 스티커사진 · 썸네일 · 동물 카드)가 손으로 적던 빛과
     색 · 세기 · 자리 · 차례가 같은가(옛 글을 그대로 옮긴 기대값과 === 로 견줌) · 그 자리들이 빛을 다시 손으로 적지 않는가
     · 세기를 다시 정하는 생성기 둘(생성기 미리보기 creator-preview.js · 동물 생성기 animal.js)도 addRunLights 로 만들고 runLightInts 로 세기를 읽어
       슬라이더 · 기본값에서 옛 손 글과 같은 빛인가 */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('shared/light-tone.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
/* 파츠 톤 · baseFlatOf 는 캐릭터 코어(createTone · #437) — 빌드 사본으로 돌린다 */
const CORE = read('vendor/char-core/char-core.iife.js');
if (!MOD || !APP || !HTML || !CORE || !read('character/animal.js')) { say('  ? 원본 못 찾음 — light-tone.js · animal.js · app.js · desk-companion-prototype.html · vendor/char-core/char-core.iife.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const near = (a, b) => Math.abs(a - b) < 1e-9;
/* «baseFlat 이 있으면 그 값, 없으면 대체값» 판단을 baseFlatOf 밖에서 다시 쓰는 글 — 대체값이 곳마다 갈라지던 원인 */
const REPEAT_RE = /userData\.baseFlat\s*!=\s*null\)\s*\?/;

/* 가짜 THREE.Color — 재질 함수가 쓰는 만큼(r 하나로 본다) */
/* 가짜 빛 — 만든 차례 · 색 · 세기 · 자리만 적는다 */
class Light { constructor(kind, c, i) { this.kind = kind; this.color = c; this.intensity = i; const p = this.pos = [0, 0, 0]; this.position = { set: (x, y, z) => { p[0] = x; p[1] = y; p[2] = z; } }; } }
class AmbientLight extends Light { constructor(c, i) { super('amb', c, i); } }
class DirectionalLight extends Light { constructor(c, i) { super('dir', c, i); } }
const LIGHT_COL = { col: 'main' }, KEY_MUL = 1.37;
class Color { constructor(v) { this.r = v == null ? 0 : (typeof v === 'number' ? (v === 0xffffff ? 1 : v) : 0.5); } copy(c) { this.r = c.r; return this; } multiplyScalar(k) { this.r *= k; return this; } setScalar(k) { this.r = k; return this; } set(v) { this.r = typeof v === 'number' ? v : 0.25; return this; } }
function make(src, M = 0.552, F = 0.3, core = CORE) {
  const fixed = [];
  const charCore = new Function(core + '\nreturn TwCharCore;')();
  const T = new Function('THREE', 'window', 'module', src + '\nreturn window.TwLightTone;')({ Color, AmbientLight, DirectionalLight }, {}, undefined);
  const out = T.createLightTone({ _MAIN_LIGHT_COL: LIGHT_COL, _MAIN_LIGHT_INT: M, _KEY_LIGHT_MUL: KEY_MUL, _FILL_LIGHT_MUL: F, _fixGlbMatLighting: (m) => fixed.push(m), charCore });
  return { out, fixed };
}
const mat = (o = {}) => Object.assign({ emissive: new Color(0), color: new Color(0.8), userData: undefined, needsUpdate: false }, o);

function behave(src, core = CORE) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = make(src, undefined, undefined, core); } catch (e) { err = e; }
  const NAMES = ['CREATOR_LIGHT_SL', 'FLAT_EMISSIVE', 'LIGHT_PRESET', 'TONE_FRONT_TOTAL', '_applyItemMatTone', '_applyPartMatTone', '_setDeskMatColor', 'addRunLights', 'baseFlatOf', 'runLightAt1', 'runLightInts', 'toneCore'];
  t(!err && w && Object.keys(w.out).sort().join() === NAMES.join() && w.out.toneCore.FLAT_EMISSIVE === w.out.FLAT_EMISSIVE, '만들 때 던지지 않고 내놓는 이름 열둘 · 코어 톤은 같은 FLAT_EMISSIVE' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  const { out } = w;
  t(out.LIGHT_PRESET.b === 1.2 && out.LIGHT_PRESET.h === 0.09 && out.LIGHT_PRESET.e === 0.46 && out.CREATOR_LIGHT_SL.s === 0.45 && out.CREATOR_LIGHT_SL.l === 0.85 && out.TONE_FRONT_TOTAL === 1.05, 'LIGHT_PRESET {b 1.2 · h 0.09 · e 0.46} · CREATOR_LIGHT_SL {s 0.45 · l 0.85} · TONE_FRONT_TOTAL 1.05(코어 값)');
  const F0 = 1.05 - 0.95 * 0.552 - 0.552 * 0.3;
  t(near(out.FLAT_EMISSIVE, F0), 'FLAT_EMISSIVE = 총합 − 0.95×주광 − 주광×채움(' + F0.toFixed(4) + ')');
  t(make(src, 2, 1, core).out.FLAT_EMISSIVE === 0, '조명 상수가 예산을 넘으면 0(음수로 안 내려감)');
  t(near(make(src, 0, 0, core).out.FLAT_EMISSIVE, 1.05), '조명이 0 이면 총합 그대로');

  let m = mat({ map: 'tex' });
  out._applyPartMatTone(m);
  t(m.emissiveMap === 'tex' && near(m.emissive.r, 0.8 * F0) && near(m.userData.baseFlat, F0) && m.needsUpdate && w.fixed.includes(m), '파츠 · 텍스처 — emissiveMap = map · emissive = 색 × 플랫 · baseFlat · needsUpdate · metalness 눕히기');
  m = mat({ color: null });
  out._applyPartMatTone(m);
  t(near(m.emissive.r, F0) && m.emissiveMap === undefined, '파츠 · 색 없음 — 흰색 × 플랫 · emissiveMap 없음');
  let threw = false; try { out._applyPartMatTone(null); out._applyItemMatTone(null); out._setDeskMatColor(null, '#fff'); } catch (_) { threw = true; }
  t(!threw, 'null 재질은 조용히 지나간다(셋 다)');

  m = mat({ map: 'tex', emissiveMap: 'old', emissiveIntensity: 3 });
  out._applyItemMatTone(m);
  t(m.emissiveMap === 'old' && near(m.emissive.r, 0.8 * F0) && near(m.userData.baseFlat, F0) && m.emissiveIntensity === 1, '아이템 · 텍스처 — 있던 emissiveMap 은 지킨다 · 색 × 플랫 · 1 넘는 emissiveIntensity 는 1');
  m = mat({ map: 'tex', color: null });
  out._applyItemMatTone(m);
  t(near(m.emissive.r, F0), '아이템 · 텍스처 · 색 없음 — setScalar(플랫)');
  m = mat({});
  out._applyItemMatTone(m);
  t(near(m.emissive.r, 0.8 * F0) && near(m.userData.baseFlat, F0) && !('emissiveIntensity' in m), 'solid 아이템 — 파츠와 같은 규칙(0 아님) · emissiveIntensity 없으면 안 만든다');

  m = mat({});
  out._setDeskMatColor(m, 0.4);
  t(m.color.r === 0.4 && near(m.emissive.r, 0.4 * F0) && near(m.userData.baseFlat, F0), '책상 색 — 색을 바꾸고 baseFlat 을 처음 심어 emissive 를 다시 계산');
  m = mat({ userData: { baseFlat: 0.1 } });
  out._setDeskMatColor(m, null);
  t(m.color.r === 0.8 && near(m.emissive.r, 0.08), '색 null — 색은 그대로 · 있던 baseFlat(0.1)을 지킨다');
  m = { emissive: new Color(0.7) };
  out._setDeskMatColor(m, 0.4);
  t(m.emissive.r === 0.7 && !m.userData, '색이 없는 재질은 건드리지 않는다');
  const bf = out.baseFlatOf;
  t(bf({ userData: { baseFlat: 0.2 } }) === 0.2 && bf({ userData: { baseFlat: 0 } }) === 0, 'baseFlatOf — 심은 값을 돌려준다(0 도 심은 값)');
  t([{ userData: {} }, { userData: { baseFlat: null } }, {}, null, undefined].every((x) => bf(x) === out.FLAT_EMISSIVE), 'baseFlatOf — 없으면(칸 없음 · null · userData 없음 · 재질 없음) 공용 기준 FLAT_EMISSIVE');
  t(bf({}, 0.4) === out.FLAT_EMISSIVE, 'baseFlatOf — 부르는 쪽이 대체값을 넘겨도 공용 기준(곳마다 갈라지지 않는다)');
  return r;
}

/* 7절 — 옛 손 글을 그대로 옮긴 기대값(#822 전 app.js · 모듈 다섯이 적던 식 · 차례). M · K · F · C 는 조명 상수, m 은 썸네일 배율.
   동물 카드는 옛 글(앰비언트 0.95 · 키 1.0 고정)이 공용 밝기 규칙으로 옮길 때 빠진 자리라 기대값은 옛 글이 아니라 종족 선택(사람 카드)과 같은 빛 */
const OLD_RIGS = {
  '메인 씬(app.js)': { opt: { keyPos: [0, 5, 0], backBounce: true }, old: (M, K, F, C) => [['amb', C, 0.95 * M, null], ['dir', C, 1.0 * M * K, [0, 5, 0]], ['dir', 0xbcd0ff, 0.12, [-3, 2, -1]], ['dir', C, M * F, [0.5, 1.0, 3]]] },
  '종족 선택(race-picker.js)': { opt: { keyPos: [0, 4, 0] }, old: (M, K, F, C) => [['amb', C, 0.95 * M, null], ['dir', C, 1.0 * M * K, [0, 4, 0]], ['dir', C, M * F, [0.5, 1.0, 3]]] },
  '런처 미리보기(launcher-preview.js)': { opt: { keyPos: [0, 4, 0] }, old: (M, K, F, C) => [['amb', C, 0.95 * M, null], ['dir', C, 1.0 * M * K, [0, 4, 0]], ['dir', C, M * F, [0.5, 1.0, 3]]] },
  '꾸미기(wardrobe.js)': { opt: { keyPos: [0, 5, 0], backBounce: true }, old: (M, K, F, C) => [['amb', C, 0.95 * M, null], ['dir', C, 1.0 * M * K, [0, 5, 0]], ['dir', 0xbcd0ff, 0.12, [-3, 2, -1]], ['dir', C, M * F, [0.5, 1.0, 3]]] },
  '스티커사진(purikura-ui.js)': { opt: { keyPos: [1, 2.5, 2] }, old: (M, K, F, C) => [['amb', C, 0.95 * M, null], ['dir', C, 1.0 * M * K, [1, 2.5, 2]], ['dir', C, M * F, [0.5, 1.0, 3]]] },
  '동물 카드(animal.js — 사람 카드와 같은 빛)': { opt: { keyPos: [0, 4, 0] }, old: (M, K, F, C) => [['amb', C, 0.95 * M, null], ['dir', C, 1.0 * M * K, [0, 4, 0]], ['dir', C, M * F, [0.5, 1.0, 3]]] },
  '썸네일(part-scene.js · 배율 0.83)': { opt: { keyPos: [1, 2.5, 2], mul: 0.83, frontFill: false }, old: (M, K, F, C) => [['amb', C, 0.95 * M * 0.83, null], ['dir', C, 1.0 * M * K * 0.83, [1, 2.5, 2]]] },
};
function runLights(src, core = CORE) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  for (const [M, F] of [[0.552, 0.3], [0.5, 0.29], [0, 0], [1.3, 0.7]]) {
    let w = null; try { w = make(src, M, F, core); } catch (_) { }
    const bad = [];
    for (const [name, rig] of Object.entries(OLD_RIGS)) {
      const added = [], target = { add: (l) => added.push(l) };
      let ret = null; try { ret = w && w.out.addRunLights(target, rig.opt); } catch (_) { }
      const got = added.map((l) => [l.kind, l.color, l.intensity, l.kind === 'amb' ? null : l.pos.slice()]);
      const want = rig.old(M, KEY_MUL, F, LIGHT_COL);
      const same = got.length === want.length && got.every((g, i) => g[0] === want[i][0] && g[1] === want[i][1] && g[2] === want[i][2] && JSON.stringify(g[3]) === JSON.stringify(want[i][3]));
      const retOk = ret && ret.amb === added[0] && ret.key === added[1] && (rig.opt.backBounce ? ret.back === added[2] : ret.back === null) && (rig.opt.frontFill === false ? ret.front === null : ret.front === added[added.length - 1]);
      if (!same || !retOk) bad.push(name);
    }
    t(w && !bad.length, '주광 ' + M + ' · 채움 ' + F + ' — 일곱 자리의 빛(종류 · 색 · 세기 · 자리 · 차례)이 옛 글과 같다 · 돌려준 amb/key/back/front 가 그 빛' + (bad.length ? ' — 다름: ' + bad.join(', ') : ''));
    if (w) t(w.out.runLightAt1() === (0.95 * M) + (M * KEY_MUL), '  runLightAt1 = 0.95×주광 + 주광×키(썸네일 배율 계산의 옛 식)');
  }
  const w = make(src);
  const added = [];
  t(w.out.addRunLights({ add: (l) => added.push(l) }, {}) === null && w.out.addRunLights(null, { keyPos: [0, 1, 0] }) === null && w.out.addRunLights({ add: (l) => added.push(l) }) === null && added.length === 0, '키 자리 · 대상 · opt 가 없으면 빛을 하나도 안 넣고 null');
  return r;
}
/* 생성기 둘 — 옛 손 글: 생성기 미리보기는 앰비언트 0.95×b×e · 키 1.0×b×e×키배율 · 정면 필 1.0×b×e×필배율(자리 [0,4,0] · [0.5,1,3]),
   동물 생성기는 앰비언트 0.95 · 키 1.0(자리 [0,4,0] · 정면 필 없음). 동물 생성기 옵션은 animal.js 의 AN_LIGHT_OPT 를 그대로 읽어 돌린다. */
function anOpt(ani) {
  const m = (ani || '').match(/^const AN_LIGHT_OPT=(\{[^\n]*\});/m);
  try { return m ? new Function('return ' + m[1])() : null; } catch (_) { return null; }
}
function genLights(src, ani, core = CORE) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const OPT = anOpt(ani);
  for (const [M, F] of [[0.552, 0.3], [0.5, 0.29], [1.3, 0.7]]) {
    let w = null; try { w = make(src, M, F, core); } catch (_) { }
    if (!w) { t(false, '만들 때 던짐'); continue; }
    const P = w.out.LIGHT_PRESET;
    const cases = [[P.b, P.e], [0.8, 0.5], [0, 0.46], [2, 1]];
    const ok = cases.every(([b, e]) => { const li = w.out.runLightInts({ int: b * e }); return near(li.amb, 0.95 * b * e) && near(li.key, 1.0 * b * e * KEY_MUL) && near(li.front, 1.0 * b * e * F); });
    const added = [], lt = w.out.addRunLights({ add: (l) => added.push(l) }, { keyPos: [0, 4, 0] });
    const shape = JSON.stringify(added.map((l) => [l.kind, l.kind === 'amb' ? null : l.pos])) === JSON.stringify([['amb', null], ['dir', [0, 4, 0]], ['dir', [0.5, 1.0, 3]]]) && lt.amb === added[0] && lt.key === added[1] && lt.front === added[2];
    t(ok && shape, '주광 ' + M + ' · 채움 ' + F + ' — 생성기 미리보기: 밝기 · 노출(기본 ' + P.b + '×' + P.e + ' · 0 · 큰 값)마다 세기가 옛 식과 같고, 만든 빛의 종류 · 자리 · 차례도 같다');
    const a2 = [];
    let lt2 = null, li2 = null; try { lt2 = w.out.addRunLights({ add: (l) => a2.push(l) }, OPT); li2 = w.out.runLightInts(OPT); } catch (_) { }
    t(OPT && lt2 && JSON.stringify(a2.map((l) => [l.kind, l.intensity, l.kind === 'amb' ? null : l.pos])) === JSON.stringify([['amb', 0.95, null], ['dir', 1, [0, 4, 0]]]) && lt2.front === null && li2.amb === 0.95 && li2.key === 1,
      '  동물 생성기(AN_LIGHT_OPT) — 앰비언트 0.95 · 키 1.0 · 자리 [0,4,0] · 정면 필 없음(조명 상수와 상관없이 옛 글 그대로)');
  }
  return r;
}
const RIG_FILES = ['creator/race-picker.js', 'launcher/launcher-preview.js', 'character/wardrobe.js', 'purikura/purikura-ui.js', 'character/part-scene.js', 'creator/creator-preview.js'];
function rigWire(app, files) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app);
  const iMk = A.indexOf('const lightToneMod = TwLightTone.createLightTone('), iMain = A.indexOf('lightToneMod.addRunLights(scene, { keyPos: [0, 5, 0], backBounce: true })');
  t(iMk > 0 && iMain > iMk && A.indexOf('const _MAIN_LIGHT_COL') < iMk, 'app.js — 조명 상수 뒤에서 lightToneMod 를 만들고 메인 씬 조명은 addRunLights 하나(정수리 위 · 뒤쪽 바운스)');
  const hand = /new THREE\.(AmbientLight|DirectionalLight)\(\s*(_MAIN_LIGHT_COL|0xbcd0ff)|_mkFrontFill/;
  t(!hand.test(A), 'app.js 는 실행 화면 빛을 손으로 만들지 않는다(_mkFrontFill 도 없음)');
  for (const [f, src] of Object.entries(files)) {
    const s = strip(src || '');
    t(src && /^const addRunLights = deps\.addRunLights;/m.test(src) && /addRunLights\(/.test(s.replace(/const addRunLights = deps\.addRunLights;/, '')) && !hand.test(s) && !/_MAIN_LIGHT_(COL|INT)|_KEY_LIGHT_MUL|_FILL_LIGHT_MUL|deps\.(mainLight|keyLight|fillLight|mkFrontFill)/.test(s),
      f + ' — deps 로 받은 addRunLights 로 빛을 넣고, 조명 상수 · 손 빛을 다시 받지 · 적지 않는다');
  }
  return r;
}
/* 생성기 둘은 빛을 손으로 만들지도 · 몫 숫자(0.95 · 1.0 · 정면 필 자리)를 다시 적지도 않는다 */
const ANY_HAND = /new THREE\.(AmbientLight|DirectionalLight)\(/;
const SHARE_NUM = /\.intensity\s*=\s*(0\.95|1(\.0)?)\s*\*|position\.set\(\s*0\.5\s*,\s*1(\.0)?\s*,\s*3\s*\)|AN_(AMB|KEY)_INT/;
function genWire(cp, ani) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const C = strip(cp || ''), N = strip(ani || '');
  const upd = (C.match(/function updateCreatorLights\(\)\{[\s\S]*?\n\}/) || [''])[0];
  t(/^const runLightInts = deps\.runLightInts;/m.test(cp || '') && /runLightInts\(\{ int: b\*e \}\)/.test(upd) && /addRunLights\(cScene\(\), \{ keyPos: \[0, 4, 0\] \}\); setCAmb\(lt\.amb\); setCKey\(lt\.key\); setCFill\(lt\.front\);/.test(C) && !ANY_HAND.test(C) && !SHARE_NUM.test(C),
    'creator/creator-preview.js — 빛은 addRunLights 로 만들고 세기는 runLightInts(예산 = 밝기×노출) · 손 빛 · 몫 숫자 없음');
  const card = (N.match(/function renderAnimalCardThumb\(\)\{[\s\S]*?\nfunction initCard\(/) || [''])[0];
  t(/^const addRunLights=lightToneMod\.addRunLights, runLightInts=lightToneMod\.runLightInts;/m.test(ani || '') && /addRunLights\(scene, AN_LIGHT_OPT\)/.test(N) && /runLightInts\(AN_LIGHT_OPT\)/.test(N) && !ANY_HAND.test(N) && !SHARE_NUM.test(N),
    'character/animal.js 동물 생성기 — 빛은 addRunLights(AN_LIGHT_OPT) · 세기는 runLightInts(AN_LIGHT_OPT) · 파일 어디에도 손 빛 · 몫 숫자 없음');
  t(/addRunLights\(_rcS, \{ keyPos: \[0, 4, 0\] \}\);/.test(card) && !/0x[0-9a-f]{6}\s*,\s*[\d.]+\)/i.test(card),
    'character/animal.js 동물 카드 — 종족 선택(사람 카드)과 같은 addRunLights({ keyPos: [0, 4, 0] }) · 색 · 세기를 손으로 적지 않는다');
  return r;
}

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app.split('\n').filter((l) => !l.includes('// 옛 전역 이름')).join('\n'));
  t(!/^const (TONE_FRONT_TOTAL|FLAT_EMISSIVE|PART_TEX_FLAT|ITEM_SOLID_FLAT)\b|function _applyPartMatTone\b|function _setDeskMatColor\b/m.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const lightToneMod = TwLightTone\.createLightTone\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim()).join('|') === '_FILL_LIGHT_MUL: _FILL_LIGHT_MUL,|_KEY_LIGHT_MUL: _KEY_LIGHT_MUL,|_MAIN_LIGHT_COL: _MAIN_LIGHT_COL,|_MAIN_LIGHT_INT: _MAIN_LIGHT_INT,|_fixGlbMatLighting: (...a)=>_fixGlbMatLighting(...a),|charCore: TwCharCore,', '만드는 줄(가드 없이) · deps 6');
  t(/^const LIGHT_PRESET = lightToneMod\.LIGHT_PRESET;\s+\/\/ 옛 전역 이름/m.test(app), '옛 전역 이름 LIGHT_PRESET 한 줄(animal.js 가 읽는다)');
  t(['MAIN_LIGHT_INT', 'KEY_LIGHT_MUL', 'FILL_LIGHT_MUL'].every((n) => new RegExp('^const _' + n + ' = TwCharCore\\.' + n + ';', 'm').test(app)), 'app.js 조명 상수 셋은 코어 값(숫자를 다시 적지 않는다 — 웹 생성기와 한 벌)');
  t(/^function _fixGlbMatLighting\(m\)\{\n  TwCharCore\.fixMatLighting\(m, /m.test(app), 'app.js 재질 고치기는 코어 fixMatLighting(콘솔 한 줄만 앱 몫)');
  t(/^  CREATOR_LIGHT_SL: lightToneMod\.CREATOR_LIGHT_SL,$/m.test(app) && /^  LIGHT_PRESET: lightToneMod\.LIGHT_PRESET,$/m.test(app) && !/TwCharCore\.(CREATOR_LIGHT_SL|LIGHT_PRESET)\b/.test(app), '생성기 미리보기 빛 숫자 둘은 lightToneMod 한 길로(코어를 따로 바로 받지 않는다)');
  t(!/(^|[^.\w$])(FLAT_EMISSIVE|TONE_FRONT_TOTAL|_applyPartMatTone|_applyItemMatTone|_setDeskMatColor)\b(?!\s*:)/.test(A.replace(/const lightToneMod = [\s\S]*?\n\}\);/, '')), '부르는 곳은 lightToneMod.이름');
  t(!REPEAT_RE.test(A), 'app.js 는 baseFlat 판단을 다시 쓰지 않는다(lightToneMod.baseFlatOf 로)');
  const iM = html.indexOf('<script src="parts/shared/light-tone.js"></script>'), iA = html.indexOf('<script src="parts/app.js"></script>');
  t(iM > 0 && iA > iM, 'html — shared/light-tone.js 를 app.js 보다 먼저 싣는다');
  return r;
}

const B = behave(MOD);
B.forEach(([ok, msg], i) => { const s = { 0: '── 1. 만들 때 · 상수', 5: '── 2. _applyPartMatTone', 8: '── 3. _applyItemMatTone', 11: '── 4. _setDeskMatColor' }; if (s[i]) say(s[i]); chk(ok, msg); });
say('── 5. app.js 연결');
wire(APP, HTML).forEach(([ok, msg]) => chk(ok, msg));
for (const f of ['character/wardrobe.js', 'creator/creator-xform.js']) { const x = read(f); chk(x && !REPEAT_RE.test(strip(x)), f + ' 도 baseFlat 판단은 baseFlatOf 로(다시 쓰지 않는다)'); }
const FILES = Object.fromEntries(RIG_FILES.map((f) => [f, read(f)]));
say('── 7. 실행 화면 조명 addRunLights');
runLights(MOD).forEach(([ok, msg]) => chk(ok, msg));
rigWire(APP, FILES).forEach(([ok, msg]) => chk(ok, msg));
const ANI = read('character/animal.js');
genLights(MOD, ANI).forEach(([ok, msg]) => chk(ok, msg));
genWire(FILES['creator/creator-preview.js'], ANI).forEach(([ok, msg]) => chk(ok, msg));
say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['코어 총합 1.05 → 1.10', null, null, null, (c) => c.replace('var TONE_FRONT_TOTAL = 1.05;', 'var TONE_FRONT_TOTAL = 1.10;')],
  ['코어 0 아래 막기 없앰', null, null, null, (c) => c.replace('return Math.max(0, total -', 'return (0, total -')],
  ['코어 대신 숫자로 다시 적음', (m) => m.replace('const TONE_FRONT_TOTAL = charCore.TONE_FRONT_TOTAL;', 'const TONE_FRONT_TOTAL = 1.10;'), null, null],
  ['app.js 조명 상수를 숫자로 다시 적음', null, (a) => a.replace('const _FILL_LIGHT_MUL = TwCharCore.FILL_LIGHT_MUL;', 'const _FILL_LIGHT_MUL = 0.29;'), null],
  ['app.js 재질 고치기를 코어 대신 직접', null, (a) => a.replace('TwCharCore.fixMatLighting(m, ', 'myFix(m, '), null],
  ['생성기 빛 채도를 코어에서 바로 받음', null, (a) => a.replace('  CREATOR_LIGHT_SL: lightToneMod.CREATOR_LIGHT_SL,', '  CREATOR_LIGHT_SL: TwCharCore.CREATOR_LIGHT_SL,'), null],
  ['light-tone 이 생성기 빛 채도를 안 내놓음', (m) => m.replace('  CREATOR_LIGHT_SL,\n', ''), null, null],
  ['코어 baseFlatOf 대체값을 숫자 0.4 로', null, null, null, (c) => c.replace('mat.userData.baseFlat != null ? mat.userData.baseFlat : FLAT;', 'mat.userData.baseFlat != null ? mat.userData.baseFlat : 0.4;')],
  ['코어 baseFlatOf 가 0 을 없음으로 봄', null, null, null, (c) => c.replace('mat.userData.baseFlat != null ? mat.userData.baseFlat', 'mat.userData.baseFlat ? mat.userData.baseFlat')],
  ['코어에 넘기는 FLAT 을 0 으로', (m) => m.replace('flatEmissive: FLAT_EMISSIVE,', 'flatEmissive: 0,'), null, null],
  ['solid 아이템 0 으로', (m) => m.replace('const ITEM_SOLID_FLAT = FLAT_EMISSIVE;', 'const ITEM_SOLID_FLAT = 0;'), null, null],
  ['책상 baseFlat 안 심음', (m) => m.replace('if(m.userData.baseFlat == null) m.userData.baseFlat = m.map ? FLAT_EMISSIVE : ITEM_SOLID_FLAT;', ''), null, null],
  ['만들 때 던짐', (m) => m.replace('function createLightTone(deps){', 'function createLightTone(deps){ throw new Error("깨 봄");'), null, null],
  ['app.js 에 본문이 남음', null, (a) => a + '\nfunction _setDeskMatColor(){}', null],
  ['옛 전역 이름 줄 빠짐', null, (a) => a.replace(/^const LIGHT_PRESET = lightToneMod\.LIGHT_PRESET;.*\n/m, ''), null],
  ['app.js 에 baseFlat 판단을 다시 씀', null, (a) => a + '\nconst _f = (m.userData && m.userData.baseFlat!=null) ? m.userData.baseFlat : 0.4;', null],
  ['html 줄 빠짐', null, null, (h) => h.replace('<script src="parts/shared/light-tone.js"></script>', '')],
];
breaks.push(
  ['앰비언트 몫 0.95 → 0.9', (m) => m.replace('const RUN_AMB_SHARE = 0.95;', 'const RUN_AMB_SHARE = 0.9;'), null, null],
  ['키에 키 배율을 안 곱함', (m) => m.replace('key: RUN_KEY_SHARE * int * keyMul * mul,', 'key: RUN_KEY_SHARE * int * mul,'), null, null],
  ['뒤쪽 바운스 세기 0.12 → 0.2', (m) => m.replace('BACK_BOUNCE_INT = 0.12', 'BACK_BOUNCE_INT = 0.2'), null, null],
  ['세기 예산(int) 옵션을 무시', (m) => m.replace('const int = o.int == null ? _MAIN_LIGHT_INT : o.int;', 'const int = _MAIN_LIGHT_INT;'), null, null],
  ['정면 필 자리를 옮김', (m) => m.replace('const FRONT_FILL_POS = [0.5, 1.0, 3];', 'const FRONT_FILL_POS = [0, 1.0, 3];'), null, null],
  ['정면 필을 키보다 먼저 넣음(차례)', (m) => m.replace('  target.add(key);\n', '').replace('    target.add(front);\n  }', '    target.add(front);\n  }\n  target.add(key);'), null, null],
  ['메인 씬 조명을 손으로 다시 적음', null, (a) => a + '\nscene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 0.95 * _MAIN_LIGHT_INT));', null],
);
const breaksMod = [
  ['꾸미기가 앰비언트를 손으로 다시 적음', 'character/wardrobe.js', (s) => s + '\nwdScene.add(new THREE.AmbientLight(_MAIN_LIGHT_COL, 1));'],
  ['스티커사진이 조명 상수를 다시 받음', 'purikura/purikura-ui.js', (s) => s.replace('const addRunLights = deps.addRunLights;', 'const addRunLights = deps.addRunLights;\nconst _MAIN_LIGHT_COL = deps.mainLightCol;')],
  ['썸네일이 addRunLights 를 안 부름', 'character/part-scene.js', (s) => s.replace(/  addRunLights\(_thumbScene, [^\n]*\n/, '')],
];
const breaksGen = [
  ['생성기 미리보기가 앰비언트를 손으로 다시 만듦', 'cp', (x) => x.replace('setCScene(new THREE.Scene());', 'setCScene(new THREE.Scene());setCAmb(new THREE.AmbientLight(0xfdfbf7,0.95));')],
  ['생성기 미리보기가 몫 0.95 를 다시 적음', 'cp', (x) => x.replace('cAmb().intensity=li.amb;', 'cAmb().intensity=0.95*b*e;')],
  ['생성기 미리보기가 예산에 노출을 안 곱함', 'cp', (x) => x.replace('runLightInts({ int: b*e })', 'runLightInts({ int: b })')],
  ['동물 생성기가 키를 손으로 다시 만듦', 'ani', (x) => x.replace('aAmb=lt.amb; aKey=lt.key; }', 'aAmb=lt.amb; aKey=new THREE.DirectionalLight(AN_KEY_COLOR,1.0); }')],
  ['동물 생성기 옵션에서 키 배율 1 을 뺌(키가 밝아짐)', 'ani', (x) => x.replace(' int:1, keyMul:1,', ' int:1,')],
  ['동물 카드가 앰비언트를 손으로 다시 만듦(옛 0.95)', 'ani', (x) => x.replace("    addRunLights(_rcS, { keyPos: [0, 4, 0] });", "    _rcS.add(new THREE.AmbientLight(0xfdfbf7,0.95));")],
  ['동물 카드가 사람 카드와 다른 키 자리', 'ani', (x) => x.replace('addRunLights(_rcS, { keyPos: [0, 4, 0] });', 'addRunLights(_rcS, { keyPos: [0, 5, 0] });')],
  ['동물 생성기 옵션에 정면 필이 켜짐', 'ani', (x) => x.replace(', frontFill:false }', ' }')],
];
for (const [name, which, fx] of breaksGen) {
  const cp = FILES['creator/creator-preview.js'] || '';
  const cp2 = which === 'cp' ? fx(cp) : cp, ani2 = which === 'ani' ? fx(ANI || '') : ANI;
  const changed = cp2 !== cp || ani2 !== ANI;
  let rows; try { rows = genLights(MOD, ani2).concat(genWire(cp2, ani2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
for (const [name, f, fx] of breaksMod) {
  const src2 = fx(FILES[f] || '');
  const rows = rigWire(APP, Object.assign({}, FILES, { [f]: src2 }));
  chk(src2 !== FILES[f] && rows.some(([ok]) => !ok), name + (src2 !== FILES[f] ? '' : ' — 바꿀 글을 못 찾음'));
}
for (const [name, fm, fa, fh, fc] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML, c2 = fc ? fc(CORE) : CORE;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML || c2 !== CORE;
  let rows; try { rows = (fm || fc ? behave(m2, c2).concat(runLights(m2, c2), genLights(m2, ANI, c2)) : []).concat(wire(a2, h2), rigWire(a2, FILES)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 재질 톤은 shared/light-tone.js 에서'));
process.exit(fail ? 1 : 0);
