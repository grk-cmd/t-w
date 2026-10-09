/* ═══ 💡 sim-creator-flat-view.js — 표정 그리기 «원색 보기» (2026-10-09 신설 · 시안 A) ═══════════════════
   제보: 표정에 흰색 같은 밝은 색을 칠하면 조명 때문에 칠했는지 알기 어렵다.
   ・1절: flatAmbient — 앰비언트 + FLAT_EMISSIVE = 1 (app.js 의 조명 예산 상수로 직접 계산)
   ・2절: 버튼 상태 — 켬/끔 · aria-pressed · 글 표시 · 그리기 단계 밖이면 숨기고 끔
   ・3절: app.js 배선 — 방향광 0 · 흰빛 앰비언트 · 단계 · 열 때 끔 · L 키 · 모듈 없어도 켜짐
   ・4절: html — 버튼 · 표시 · 단축키 안내 · 스크립트 순서
   ・5절: animal.js 배선(동물 생성기) — 같은 모듈 두 번째 인스턴스 · 3 표정 · 4 감은눈 탭에서만 · L 키 ·
     열 때 · 닫을 때 끔 · 방향광 0 · 흰빛 앰비언트 + 미리보기 emissive(0) = 1
   ⚠️ 실제 화면은 2026-10-09 헤드리스 크로미움에서 확인했다(흰 칠 255,251,245 → 원색 보기 255,255,255 ·
     2단계에서만 버튼 · 4단계로 가면 꺼짐 · 페이지 오류 0).
   [실행] creator-flat-view.js · app.js · animal.js · desk-companion-prototype.html 이 있는 폴더에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const need = ['creator-flat-view.js', 'app.js', 'animal.js', 'desk-companion-prototype.html'];
const SRC = {};
for(const f of need){ SRC[f] = read(f); if(SRC[f] == null){ say('  ? 원본 못 찾음 — ' + f); process.exit(2); } }
const win = {};
new Function('window', 'module', SRC['creator-flat-view.js'])(win, undefined);
const M = win.CreatorFlatView;
const APP = SRC['app.js'], HTML = SRC['desk-companion-prototype.html'], ANI = SRC['animal.js'];
/* 절마다 따로 — 옛 코드(모듈 없음)에 대면 멈추지 않고 그 절을 빨강 하나로 센다 */
const sec = (title, fn) => { say(title); try{ fn(); }catch(e){ chk(false, '이 절을 못 돌았다 — ' + e.message); } };

sec('── 1. flatAmbient', () => {
  const num = (re) => { const m = APP.match(re); return m ? Function('return (' + m[1] + ');')() : NaN; };
  const MAIN = num(/const _MAIN_LIGHT_INT = ([0-9.\s*]+);/);
  const FILL = num(/const _FILL_LIGHT_MUL = ([0-9.]+);/);
  const TOTAL = num(/const TONE_FRONT_TOTAL = ([0-9.]+);/);
  const FE = Math.max(0, TOTAL - 0.95 * MAIN - MAIN * FILL);
  chk(FE > 0 && FE < 1, `준비 — app.js 조명 예산에서 FLAT_EMISSIVE = ${FE.toFixed(4)}`);
  chk(Math.abs(M.flatAmbient(FE) + FE - 1) < 1e-9, '앰비언트 + emissive = 1 — 칠한 텍스처 값이 그대로 나온다');
  chk(M.flatAmbient(1.4) === 0 && M.flatAmbient(NaN) === 1 && M.flatAmbient(0) === 1, 'emissive 가 1 을 넘거나 망가진 값이어도 음수 · NaN 을 내지 않는다');
});

sec('── 2. 버튼 상태', () => {
  function el(){
    const cls = new Set(), attrs = {};
    return { style: { display: 'none' }, title: '', classList: { toggle(c, v){ v ? cls.add(c) : cls.delete(c); }, has: (c) => cls.has(c) },
      setAttribute(k, v){ attrs[k] = v; }, getAttribute: (k) => attrs[k] };
  }
  const btn = el(), badge = el(); let calls = [];
  const fv = M.createCreatorFlatView({ btn, badge, onChange: (on) => calls.push(on) });
  chk(!fv.isOn() && btn.getAttribute('aria-pressed') === 'false' && badge.style.display === 'none', '처음은 꺼짐 · 표시 없음');
  fv.show(true);
  chk(btn.style.display === '', '그리기 단계면 버튼이 보인다');
  fv.toggle();
  chk(fv.isOn() && btn.classList.has('on') && btn.getAttribute('aria-pressed') === 'true', '누르면 켜짐 · 눌린 모양 · aria-pressed');
  chk(badge.style.display === 'block', '켜져 있는 동안은 글로 «원색 보기» (색만으로 상태를 말하지 않는다)');
  chk(/원래 조명/.test(btn.title), '켜졌을 때 툴팁은 «원래 조명으로»');
  chk(calls.join() === 'true', '바뀔 때 조명을 다시 맞추라고 한 번 부른다');
  fv.set(true);
  chk(calls.length === 1, '같은 값이면 다시 부르지 않는다');
  fv.show(false);
  chk(!fv.isOn() && btn.style.display === 'none' && badge.style.display === 'none' && calls.join() === 'true,false', '그리기 단계 밖이면 숨기고 끈다(색상 · 책상 화면에 원색이 남지 않게)');
  const bare = M.createCreatorFlatView({});
  bare.toggle(); bare.show(false);
  chk(!bare.isOn(), '요소가 없어도 멈추지 않는다');
});

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const grabIn = (A, name) => { const i = A.indexOf('function ' + name + '('); if(i < 0) return ''; let k = A.indexOf('{', i), d = 0;
  for(; k < A.length; k++){ if(A[k] === '{') d++; else if(A[k] === '}' && --d === 0) return A.slice(i, k + 1); } return ''; };

sec('── 3. app.js 배선', () => {
  const A = strip(APP);
  const grab = (name) => grabIn(A, name);
  const ul = grab('updateCreatorLights');
  chk(/if\(crFlatView && crFlatView\.isOn\(\)\)\{\s*cAmb\.intensity=CreatorFlatView\.flatAmbient\(FLAT_EMISSIVE\); cAmb\.color\.setRGB\(1,1,1\);\s*cKey\.intensity=0; if\(cFill\) cFill\.intensity=0;/.test(ul),
    '원색 보기면 방향광(키 · 필) 0 · 앰비언트는 흰빛으로 남는 몫만');
  chk(ul.indexOf('crFlatView.isOn()') > ul.indexOf('cAmb.color.copy(col)'), '따뜻한 조명색을 칠한 뒤에 덮는다(순서가 바뀌면 다시 노래진다)');
  chk(/const crFlatView = \(typeof CreatorFlatView === 'undefined'\) \? null : CreatorFlatView\.createCreatorFlatView\(/.test(A), '모듈이 없어도 생성기는 켜진다');
  chk(/onChange: \(\)=>updateCreatorLights\(\)/.test(A) && /getElementById\('cpFlat'\)\.addEventListener\('click', \(\)=>crFlatView\.toggle\(\)\)/.test(A), '버튼을 누르면 켬/끔 → 조명을 다시 맞춘다');
  chk(/if\(crFlatView\) crFlatView\.show\(draw\);/.test(grab('gotoStep')), '단계가 바뀌면 그리기 단계(2 · 3)에서만 보인다');
  chk(/creatorOpen=true;\s*if\(crFlatView\) crFlatView\.set\(false\);/.test(A), '생성기를 열 때마다 꺼진 채로 시작');
  chk(/hotkeyLetter\(e\)==='l' && isDrawStep\(\) && crFlatView && !e\.ctrlKey && !e\.metaKey && !e\.altKey/.test(A) && /crFlatView\.toggle\(\);/.test(A), 'L 키 — 그리기 단계에서만 · 조합키 · 글 입력 중엔 무시');
  chk(!/LIGHT_PRESET\.\w+\s*=|TONE_FRONT_TOTAL\s*=[^=]*crFlat/.test(A), '실행 화면 조명 상수는 건드리지 않는다');
});

sec('── 4. html', () => {
  chk(/<button id="cpFlat" type="button" aria-pressed="false" aria-label="조명 끄고 원색 보기"/.test(HTML), '💡 버튼 — 미리보기 안 · 접근성 이름');
  chk(/<div id="cpFlatBadge" style="display:none;">원색 보기 — 칠한 색 그대로<\/div>/.test(HTML), '켜졌을 때 글 표시');
  const css = (HTML.match(/#cpFlat,#anpFlat\{[^}]*\}/) || [''])[0];
  chk(/right:8px;bottom:8px/.test(css), '오른쪽 아래 — ↺(카메라 초기화)의 반대편');
  chk(/<b>L<\/b> 원색 보기/.test(HTML), '단축키 안내 줄에 L');
  const iM = HTML.indexOf('<script src="parts/creator-flat-view.js">'), iA = HTML.indexOf('<script src="parts/app.js">');
  chk(iM > 0 && iM < iA, 'creator-flat-view.js 를 app.js 앞에 싣는다');
  chk(/#cpFlat\.on,#anpFlat\.on\{/.test(HTML) && /#cpFlatBadge,#anpFlatBadge\{/.test(HTML), '동물 생성기 💡 · 표시도 같은 CSS(테마 색 그대로)');
  const iN = HTML.indexOf('<script src="parts/animal.js">');
  chk(iM > 0 && iM < iN, 'creator-flat-view.js 를 animal.js 앞에 싣는다');
});

sec('── 5. animal.js 배선(동물 생성기)', () => {
  const N = strip(ANI);
  chk(/\+'<button id="anpFlat" type="button" aria-pressed="false" aria-label="조명 끄고 원색 보기"[^']*style="display:none;">💡<\/button>'/.test(ANI)
    && /\+'<div id="anpFlatBadge" style="display:none;">원색 보기 — 칠한 색 그대로<\/div>'/.test(ANI), '동물 미리보기 안에 💡 버튼 · 켜졌을 때 글 표시');
  const iBtn = ANI.indexOf('id="anpFlat"'), iCv = ANI.indexOf('id="anpCv"'), iLeft = ANI.indexOf('class="decor-left"');
  chk(iLeft > 0 && iLeft < iBtn && iBtn < iCv, '…미리보기(decor-left) 칸 안');
  chk(/aFlat = \(typeof CreatorFlatView === 'undefined'\) \? null : CreatorFlatView\.createCreatorFlatView\(/.test(N), '같은 모듈의 두 번째 인스턴스 · 모듈이 없어도 동물 생성기는 켜진다');
  chk(/onChange: \(\)=>applyPreviewLights\(\)/.test(N) && /querySelector\('#anpFlat'\)\.addEventListener\('click', \(\)=>aFlat\.toggle\(\)\)/.test(N), '버튼을 누르면 켬/끔 → 미리보기 조명을 다시 맞춘다');
  const gt = (N.match(/window\.__anpGoTab=function\(tab\)\{[\s\S]*?\n  \};/) || [''])[0];
  chk(/paintTab = \(tab==='paint'\) \? 'face' : \(tab==='blink' \? 'blink' : null\);\s*if\(aFlat\) aFlat\.show\(!!paintTab\);/.test(gt), '탭이 바뀌면 3 표정 · 4 감은눈에서만 보이고 벗어나면 꺼진다');
  chk(/if\(aFlat\) aFlat\.set\(false\);/.test(grabIn(N, 'openPreview')), '동물 생성기를 열 때마다 꺼진 채로 시작');
  chk(/if\(aFlat\) aFlat\.set\(false\);/.test(grabIn(N, 'closePreview')), '닫을 때도 끈다');
  const pk = grabIn(N, 'onPanKey');
  const iL = pk.indexOf("k==='l'"), iPaint = pk.indexOf('if(paintTab){'), iTyping = pk.indexOf("t.tagName==='INPUT'");
  chk(/if\(k==='l' && aFlat && !e\.ctrlKey && !e\.metaKey && !e\.altKey\)\{ aFlat\.toggle\(\);/.test(pk) && /const k = hotkeyLetter\(e\);/.test(pk), 'L 키 — hotkeyLetter(한글 상태 맥) · 조합키 무시');
  chk(iTyping > 0 && iTyping < iPaint && iPaint < iL, '…그리기 탭에서만 · 글 입력 중엔 무시');
  const ul = grabIn(N, 'applyPreviewLights');
  chk(/if\(aFlat && aFlat\.isOn\(\)\)\{\s*aAmb\.color\.setRGB\(1,1,1\); aAmb\.intensity=CreatorFlatView\.flatAmbient\(AN_PREVIEW_EMISSIVE\);\s*aKey\.intensity=0;/.test(ul), '원색 보기면 방향광 0 · 앰비언트는 흰빛으로 남는 몫만');
  chk(/aAmb\.color\.setHex\(AN_AMB_COLOR\); aAmb\.intensity=AN_AMB_INT;\s*aKey\.intensity=AN_KEY_INT;/.test(ul), '끄면 원래 조명(상수 그대로)으로');
  // 미리보기 재질 emissive 가 정말 0 인지 — 합이 1 이 되려면 AN_PREVIEW_EMISSIVE 와 같아야 한다
  const fe = +((N.match(/const AN_PREVIEW_EMISSIVE=([0-9.]+);/) || [])[1]);
  const setMats = [grabIn(N, 'ensurePaintTex'), grabIn(N, '_ensureEarTex')];
  chk(fe === 0 && setMats.every(b => /o\.material\.emissive\.set\('#000000'\)/.test(b)), '미리보기 재질(몸 · 귀) emissive 0 = AN_PREVIEW_EMISSIVE');
  chk(Math.abs(M.flatAmbient(fe) + fe - 1) < 1e-9, '앰비언트 + emissive = 1 — 칠한 텍스처 값이 그대로 나온다');
  chk(/aAmb=new THREE\.AmbientLight\(AN_AMB_COLOR,AN_AMB_INT\)/.test(N) && /aKey=new THREE\.DirectionalLight\(AN_KEY_COLOR,AN_KEY_INT\)/.test(N), '미리보기 조명이 상수와 같은 값으로 만들어진다');
  chk(!/aFlat|flatAmbient/.test(grabIn(N, '_animLit')), '실행 화면(_animLit) 조명은 건드리지 않는다');
  chk(/<b>L<\/b> 원색 보기/.test(ANI), '단축키 안내 줄에 L');
});

say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
