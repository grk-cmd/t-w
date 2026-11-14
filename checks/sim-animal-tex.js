/* 🐾 sim-animal-tex.js — 동물 좌석 그림 텍스처(_texFromDataURL)를 실제 three r128 위에서 — node checks/run.js animal-tex
   animal.js 의 _texFromDataURL 본문을 떼어 진짜 THREE.CanvasTexture 로 돌린다.
   ・1절: r128 Texture 에는 userData 가 없다(이 검사가 지키는 함정의 전제)
   ・2절: 만들 때 던지지 않고 · 원본 주소 · 바탕색을 텍스처에 남긴다(face-heal.js 가 다시 그릴 때 읽는다) · 주소 없음 · 허용 안 된 주소
   ・3절: 깨 보기 — 없는 userData 에 바로 쓰면 던진다(동물 조립이 멈추고 사람 모델로 대신 그려지던 것) */
'use strict';
const fs = require('fs');
const path = require('path');
let fail = 0;
const chk = (ok, msg) => { console.log('  ' + (ok ? '✓' : '✗') + ' ' + msg); if(!ok) fail++; };
const read = (f) => { for(const c of [f, 'parts/' + f, 'app/parts/' + f, f.split('/').pop()]) if(fs.existsSync(c)) return fs.readFileSync(c, 'utf8'); return null; };
const SRC = read('character/animal.js');
const threePath = ['vendor/three/three.min.js', 'app/vendor/three/three.min.js', 'three.min.js'].find(p => fs.existsSync(p));
if(!SRC || !threePath){ console.log('  ? 원본 못 찾음 — animal.js · three.min.js'); process.exit(2); }
const THREE = require(path.resolve(threePath));

/* 서명부터 중괄호를 세어 함수 전체를 뗀다(문자열 · 정규식은 이 함수 안에 중괄호가 없어 세기만 한다) */
function fnSrc(src, sig){
  const at = src.indexOf(sig); if(at < 0) return null;
  let depth = 0;
  for(let k = src.indexOf('{', at); k < src.length; k++){
    if(src[k] === '{') depth++;
    else if(src[k] === '}'){ depth--; if(depth === 0) return src.slice(at, k + 1); }
  }
  return null;
}
const FN = fnSrc(SRC, 'function _texFromDataURL(url, fallbackFill){');
if(!FN){ console.log('✗ animal.js 에서 _texFromDataURL 을 못 뗐다 — 서명이 바뀌었는지 확인할 것'); process.exit(1); }

/* 가짜 브라우저 — 캔버스 · 그림은 아무 일도 안 한다(텍스처를 만드는 길만 본다) */
const fakeCanvas = () => ({ width: 0, height: 0, getContext: () => ({ fillRect(){}, drawImage(){}, set fillStyle(_){} }) });
const env = {
  document: { createElement: () => fakeCanvas() },
  Image: function(){ this.src = ''; },
  TwSafeHtml: { safeUrl: (u) => (typeof u === 'string' && /^(data:image\/|https:\/\/)/.test(u)) ? u : null },
  TwImgRetry: { retryUrl: () => null, laterRetryMs: () => null },
};
function make(fnText){
  return new Function('THREE', 'document', 'Image', 'TwSafeHtml', 'TwImgRetry', 'P_SZ', 'console', fnText + '\nreturn _texFromDataURL;')(
    THREE, env.document, env.Image, env.TwSafeHtml, env.TwImgRetry, 512, { warn(){} });
}
const run = (fnText, url, fill) => { try{ return { t: make(fnText)(url, fill) }; }catch(e){ return { err: String(e.message || e) }; } };

console.log('=== 1. 전제 — three r' + THREE.REVISION + ' ===');
chk(!('userData' in new THREE.CanvasTexture(fakeCanvas())), 'CanvasTexture 에 userData 가 처음부터 없다');

console.log('\n=== 2. 지금 코드 ===');
{
  const a = run(FN, 'https://example.com/body.png', '#abcdef');
  chk(!a.err, '만들 때 던지지 않는다' + (a.err ? ' — ' + a.err : ''));
  chk(!!a.t && a.t.userData && a.t.userData.twSrc === 'https://example.com/body.png' && a.t.userData.twFill === '#abcdef', '  원본 주소 · 바탕색을 텍스처에 남긴다(face-heal.js 가 읽는다)');
  const b = run(FN, null);
  chk(!b.err && b.t.userData.twSrc === null && b.t.userData.twFill === '#ffffff', '주소 없음 → 원본 null · 바탕색 흰색');
  const c = run(FN, 'javascript:alert(1)', '#000');
  chk(!c.err && c.t.userData.twSrc === null, '허용 안 된 주소는 남기지 않는다');
}

console.log('\n=== 3. 깨 보기 ===');
{
  const broken = FN.replace(/t\.userData=Object\.assign\([^;]*\);/, "t.userData.twSrc=src||null; t.userData.twFill=fallbackFill||'#ffffff';");
  chk(broken !== FN, '  바꿀 줄을 찾았다');
  const r = run(broken, 'https://example.com/body.png');
  chk(!!r.err, '  없는 userData 에 바로 쓰면 던진다 → 빨강(그때 동물이 사람 모델로 보였다)');
}

if(fail){ console.log('✗ 실패 ' + fail + '건'); process.exit(1); }
console.log('전부 통과 ✅');
