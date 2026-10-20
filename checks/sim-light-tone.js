/* sim-light-tone.js — 💡 재질 톤(shared/light-tone.js) 계산 · 재질 함수 · 연결
   실행:  node sim-light-tone.js   (러너 스테이징 또는 저장소 루트에서)
   ★ 왜 이 검사가 있는가 — 화면 밝기는 «TONE_FRONT_TOTAL 하나에서 플랫 몫을 계산해 모든 재질이 같은 규칙으로 받는다» 에 걸려 있다.
     app.js 에서 모듈로 옮겼으니(C 구역 떼기 w4) 계산식 · 경계(0 아래로 안 내려감) · 재질마다 emissive · baseFlat 을 입력 → 출력으로 고정한다.
   ・1절: 만들 때 · 상수 — 내놓는 이름 여덟 · LIGHT_PRESET · TONE_FRONT_TOTAL · FLAT_EMISSIVE 식(조명 상수가 크면 0)
   ・2절: _applyPartMatTone — 텍스처 / 색 없음 / null · 3절: _applyItemMatTone — 텍스처 · solid · emissiveIntensity
   ・4절: _setDeskMatColor — 색 · baseFlat 처음 심기 / 지키기 · 색 없는 재질
   ・5절: app.js 연결 · 6절: 일부러 깨 보기(코어 빌드 사본을 깨 보는 것 포함 — 파츠 톤 · baseFlatOf 는 코어 tone.ts) */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { for (const c of [f, 'parts/' + f, 'app/parts/' + f, 'app/' + f, f.split('/').pop()]) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const MOD = read('shared/light-tone.js'), APP = read('app.js'), HTML = read('desk-companion-prototype.html');
/* 파츠 톤 · baseFlatOf 는 캐릭터 코어(createTone · #437) — 빌드 사본으로 돌린다 */
const CORE = read('vendor/char-core/char-core.iife.js');
if (!MOD || !APP || !HTML || !CORE) { say('  ? 원본 못 찾음 — light-tone.js · app.js · desk-companion-prototype.html · vendor/char-core/char-core.iife.js'); process.exit(2); }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
const near = (a, b) => Math.abs(a - b) < 1e-9;
/* «baseFlat 이 있으면 그 값, 없으면 대체값» 판단을 baseFlatOf 밖에서 다시 쓰는 글 — 대체값이 곳마다 갈라지던 원인 */
const REPEAT_RE = /userData\.baseFlat\s*!=\s*null\)\s*\?/;

/* 가짜 THREE.Color — 재질 함수가 쓰는 만큼(r 하나로 본다) */
class Color { constructor(v) { this.r = v == null ? 0 : (typeof v === 'number' ? (v === 0xffffff ? 1 : v) : 0.5); } copy(c) { this.r = c.r; return this; } multiplyScalar(k) { this.r *= k; return this; } setScalar(k) { this.r = k; return this; } set(v) { this.r = typeof v === 'number' ? v : 0.25; return this; } }
function make(src, M = 0.552, F = 0.3, core = CORE) {
  const fixed = [];
  const charCore = new Function(core + '\nreturn TwCharCore;')();
  const T = new Function('THREE', 'window', 'module', src + '\nreturn window.TwLightTone;')({ Color }, {}, undefined);
  const out = T.createLightTone({ _MAIN_LIGHT_INT: M, _FILL_LIGHT_MUL: F, _fixGlbMatLighting: (m) => fixed.push(m), charCore });
  return { out, fixed };
}
const mat = (o = {}) => Object.assign({ emissive: new Color(0), color: new Color(0.8), userData: undefined, needsUpdate: false }, o);

function behave(src, core = CORE) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  let w = null, err = null;
  try { w = make(src, undefined, undefined, core); } catch (e) { err = e; }
  const NAMES = ['FLAT_EMISSIVE', 'LIGHT_PRESET', 'TONE_FRONT_TOTAL', '_applyItemMatTone', '_applyPartMatTone', '_setDeskMatColor', 'baseFlatOf', 'toneCore'];
  t(!err && w && Object.keys(w.out).sort().join() === NAMES.join() && w.out.toneCore.FLAT_EMISSIVE === w.out.FLAT_EMISSIVE, '만들 때 던지지 않고 내놓는 이름 여덟 · 코어 톤은 같은 FLAT_EMISSIVE' + (err ? ' — ' + String(err.message || err).slice(0, 80) : ''));
  if (!w) return r;
  const { out } = w;
  t(out.LIGHT_PRESET.b === 1.2 && out.LIGHT_PRESET.h === 0.09 && out.LIGHT_PRESET.e === 0.46 && out.TONE_FRONT_TOTAL === 1.05, 'LIGHT_PRESET {b 1.2 · h 0.09 · e 0.46} · TONE_FRONT_TOTAL 1.05');
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

function wire(app, html) {
  const r = [];
  const t = (ok, msg) => r.push([!!ok, msg]);
  const A = strip(app.split('\n').filter((l) => !l.includes('// 옛 전역 이름')).join('\n'));
  t(!/^const (TONE_FRONT_TOTAL|FLAT_EMISSIVE|PART_TEX_FLAT|ITEM_SOLID_FLAT)\b|function _applyPartMatTone\b|function _setDeskMatColor\b/m.test(A), 'app.js 에 옮긴 선언이 안 남았다');
  const mk = (app.match(/const lightToneMod = TwLightTone\.createLightTone\(\{\n([\s\S]*?)\n\}\);/) || [])[1] || '';
  t(mk.split('\n').map((l) => l.trim()).join('|') === '_FILL_LIGHT_MUL: _FILL_LIGHT_MUL,|_MAIN_LIGHT_INT: _MAIN_LIGHT_INT,|_fixGlbMatLighting: (...a)=>_fixGlbMatLighting(...a),|charCore: TwCharCore,', '만드는 줄(가드 없이) · deps 4');
  t(/^const LIGHT_PRESET = lightToneMod\.LIGHT_PRESET;\s+\/\/ 옛 전역 이름/m.test(app), '옛 전역 이름 LIGHT_PRESET 한 줄(animal.js 가 읽는다)');
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
say('── 6. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
const breaks = [
  ['총합 1.05 → 1.10', (m) => m.replace('const TONE_FRONT_TOTAL = 1.05;', 'const TONE_FRONT_TOTAL = 1.10;'), null, null],
  ['0 아래 막기 없앰', (m) => m.replace('const FLAT_EMISSIVE = Math.max(0,', 'const FLAT_EMISSIVE = (0,'), null, null],
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
for (const [name, fm, fa, fh, fc] of breaks) {
  const m2 = fm ? fm(MOD) : MOD, a2 = fa ? fa(APP) : APP, h2 = fh ? fh(HTML) : HTML, c2 = fc ? fc(CORE) : CORE;
  const changed = m2 !== MOD || a2 !== APP || h2 !== HTML || c2 !== CORE;
  let rows; try { rows = (fm || fc ? behave(m2, c2) : []).concat(wire(a2, h2)); } catch (_) { rows = [[false, '던짐']]; }
  chk(changed && rows.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
}
say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass + ' — 재질 톤은 shared/light-tone.js 에서'));
process.exit(fail ? 1 : 0);
