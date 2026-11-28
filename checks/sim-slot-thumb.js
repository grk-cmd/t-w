/* 🖼️ sim-slot-thumb.js — 캐릭터 칸 섬네일 고르기 한 규칙(slot-thumb.js) — node checks/run.js slot-thumb
   ・1절: 고르기 — 이 PC 그림 → 서버 섬네일 → (withFace) 얼굴 · 없음 · 빈 def · 허용 안 되는 주소는 건너뜀
   ・2절: 서버에서 받아 앉힌 칸(thumb=null · thumbUrl 만 — B-1128-4)에서도 섬네일이 나온다
   ・3절: 배선 — html 차례 · smoke PRELOAD · 두 화면이 이 규칙만 부름
   ・4절: mutation test — 규칙을 하나씩 깨면 1 · 2절이 빨강 */

const fs = require('fs');
const path = require('path');

const read = (f) => { try{ return fs.readFileSync(path.join(__dirname, f), 'utf8'); }catch(_){ return null; } };
const SRC = read('slot-thumb.js');
const SAFE_SRC = read('safe-html.js');
const HTML = read('desk-companion-prototype.html');
const SMOKE = read('smoke.js');
const SETTINGS = read('settings-panel.js');
const MYINFO = read('my-info.js');
if(!SRC || !SAFE_SRC || !HTML || !SMOKE || !SETTINGS || !MYINFO){ console.log('✗ 원본을 못 찾음 — node checks/run.js slot-thumb 로 돌린다'); process.exit(2); }

let fail = 0;
const chk = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if(!ok) fail++; };
const load = (src) => { const m = { exports: {} }; new Function('module', 'window', src)(m, undefined); return m.exports; };
const safeUrl = load(SAFE_SRC).safeUrl;

const DATA = 'data:image/png;base64,iVBORw0KGgo=';
const URL1 = 'https://firebasestorage.googleapis.com/v0/b/x/o/thumb.png?alt=media';
const FACE = 'https://firebasestorage.googleapis.com/v0/b/x/o/face.png?alt=media';

/* 경우마다 [이름, 판정(api)] — mutation test 에서 같은 표를 다시 돈다 */
const CASES = [
  ['이 PC 그림과 서버 섬네일이 다 있으면 이 PC 그림(방금 고친 모습)', (T) => T.snapshot({ thumb: DATA, thumbUrl: URL1 }, safeUrl) === DATA],
  ['이 PC 그림만 있으면 그것', (T) => T.snapshot({ thumb: DATA }, safeUrl) === DATA],
  ['서버에서 받아 앉힌 칸(thumb=null · thumbUrl 만)도 섬네일이 나온다 — B-1128-4', (T) => T.snapshot({ thumb: null, thumbUrl: URL1, face: DATA }, safeUrl) === URL1],
  ['둘 다 없으면 snapshot 은 null — 얼굴 그림으로 대신하지 않는다(설정은 합성 아이콘을 그린다)', (T) => T.snapshot({ thumb: null, face: DATA, faceUrl: FACE }, safeUrl) === null],
  ['withFace — 섬네일이 없으면 faceUrl → _faceUrl → face 순서', (T) =>
    T.withFace({ faceUrl: FACE, _faceUrl: URL1, face: DATA }, safeUrl) === FACE
    && T.withFace({ _faceUrl: URL1, face: DATA }, safeUrl) === URL1
    && T.withFace({ face: DATA }, safeUrl) === DATA],
  ['withFace — 섬네일이 있으면 얼굴보다 섬네일', (T) => T.withFace({ thumbUrl: URL1, faceUrl: FACE }, safeUrl) === URL1 && T.withFace({ thumb: DATA, thumbUrl: URL1, faceUrl: FACE }, safeUrl) === DATA],
  ['빈 def · null · 빈 문자열 → null(던지지 않는다)', (T) => T.snapshot(null, safeUrl) === null && T.withFace(undefined, safeUrl) === null && T.snapshot({}, safeUrl) === null && T.withFace({ thumb: '', thumbUrl: '' }, safeUrl) === null],
  ['허용 안 되는 주소(javascript: · 글자 아님)는 건너뛰고 다음 것', (T) => T.snapshot({ thumb: 'javascript:alert(1)', thumbUrl: URL1 }, safeUrl) === URL1 && T.snapshot({ thumb: 42, thumbUrl: { a: 1 } }, safeUrl) === null],
  ['safeUrl 을 «image» 로 부른다', (T) => { const kinds = []; T.withFace({ thumb: DATA }, (u, k) => { kinds.push(k); return ''; }); return kinds.length === 5 && kinds.every(k => k === 'image'); }],
];

console.log('── 1 · 2. 고르기');
const T0 = load(SRC);
for(const [name, fn] of CASES){ let ok = false; try{ ok = fn(T0) === true; }catch(e){ ok = false; } chk(ok, name); }
chk(Object.isFrozen(T0) && Object.isFrozen(T0.FIELDS) && T0.FIELDS.join() === 'thumb,thumbUrl', '내놓는 것은 얼려 둔다 · 순서 표 thumb → thumbUrl');

console.log('── 3. 배선');
{
  const at = (s) => HTML.indexOf(s);
  chk(at('parts/shared/slot-thumb.js') > 0 && at('parts/shared/slot-thumb.js') < at('parts/launcher/settings-panel.js') && at('parts/shared/slot-thumb.js') < at('parts/account/my-info.js') && at('parts/shared/slot-thumb.js') < at('parts/app.js"'),
    'html 이 설정 패널 · 내 정보 · app.js 보다 먼저 싣는다');
  chk(/PRELOAD\.push\('slot-thumb\.js'\)/.test(SMOKE), 'smoke PRELOAD 에 있다');
  chk(/TwSafeHtml\.safeUrl\(TwSlotThumb\.snapshot\(d, TwSafeHtml\.safeUrl\), 'image'\)/.test(SETTINGS), '설정 캐릭터 탭이 이 규칙을 부르고 넣는 자리에서 safeUrl 로 씻는다');
  chk(/TwSafeHtml\.safeUrl\(TwSlotThumb\.withFace\(def, TwSafeHtml\.safeUrl\), 'image'\)/.test(MYINFO), '내 정보가 이 규칙을 부르고 넣는 자리에서 safeUrl 로 씻는다');
  chk(!/safeUrl\(d\.thumb\b/.test(SETTINGS) && !/def\.thumbUrl, def\.thumb/.test(MYINFO), '두 화면에 고르는 순서를 다시 쓴 곳이 없다');
}

console.log('── 4. mutation test');
const MUT = [
  ['서버 섬네일을 순서 표에서 빼면', (s) => s.replace("Object.freeze(['thumb', 'thumbUrl'])", "Object.freeze(['thumb'])")],
  ['순서를 서버 먼저로 바꾸면', (s) => s.replace("Object.freeze(['thumb', 'thumbUrl'])", "Object.freeze(['thumbUrl', 'thumb'])")],
  ['snapshot 이 얼굴까지 고르면', (s) => s.replace('function snapshot(def, safeUrl){ return firstSafe(def, FIELDS, safeUrl); }', 'function snapshot(def, safeUrl){ return firstSafe(def, FIELDS.concat(FACE_FIELDS), safeUrl); }')],
  ['withFace 가 얼굴을 안 보면', (s) => s.replace('return firstSafe(def, FIELDS.concat(FACE_FIELDS), safeUrl); }', 'return firstSafe(def, FIELDS, safeUrl); }')],
  ['얼굴 순서를 바꾸면', (s) => s.replace("['faceUrl', '_faceUrl', 'face']", "['face', 'faceUrl', '_faceUrl']")],
  ['safeUrl 로 고르지 않으면', (s) => s.replace("if(safeUrl(def[f], 'image')) return def[f];", 'if(def[f]) return def[f];')],
  ['빈 def 확인을 빼면', (s) => s.replace('if(!def) return null;', '')],
];
for(const [name, mut] of MUT){
  const src = mut(SRC);
  if(src === SRC){ chk(false, name + ' — 바꿀 자리를 못 찾음'); continue; }
  let red = 0;
  try{ const T = load(src); for(const [, fn] of CASES){ let ok = false; try{ ok = fn(T) === true; }catch(_){ ok = false; } if(!ok) red++; } }catch(_){ red = 1; }
  chk(red > 0, name + ' → 빨강 ' + red + '개');
}

console.log(fail ? '\n✗ 빨강 ' + fail : '\n✓ 전부 통과');
process.exit(fail ? 1 : 0);
