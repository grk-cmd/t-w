/* dot-render.js — 🕹️ 도트 모드 머티리얼 — 텍스처 Nearest 필터 · PS1 색 양자화 + Bayer 디더 셰이더 켜고 끄기
   책임: 도트 렌더 모드일 때 씬의 머티리얼만 바꾼다(텍스처 필터 · 프래그먼트 셰이더 주입) — 언제 켤지는 부르는 쪽(카메라 · 캔버스 맞춤)이 정한다.
   받는 deps: scene(THREE.Scene) · ps1Dither(shared/ps1-dither.js — 색 단계 · Bayer 표). 내보내는 것: applyDotTextureFilter(on) · applyPS1Shader(on) · sweepIfOn(now).
   ★ 켬은 부를 때마다 씬을 훑고, 이미 걸린 텍스처 · 머티리얼만 건너뛴다 — 켠 뒤 들어온 캐릭터 · 파츠 · 바꿔 낀 텍스처도 받게.
     sweepIfOn 은 프레임 루프가 부른다(켜져 있을 때만 SWEEP_MS 마다 한 번 훑음).
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDotRender — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-dot-render.js */
(function(){

function createDotRender(deps){
const scene = deps.scene;
const ps1Dither = deps.ps1Dither;   // 스티커사진 PS1 필터와 같은 값을 읽는다
const DOT_TEX_KEYS = ['map','emissiveMap','normalMap','roughnessMap','metalnessMap'];   // 필터를 바꿀 텍스처 칸
const SWEEP_MS = 500;   // 켜져 있을 때 새 메쉬 · 바꿔 낀 텍스처를 찾으러 씬을 훑는 간격
/* 도트 렌더 모드일 때 씬의 모든 텍스처를 Nearest 필터로 전환(선명한 도트), 끄면 원래(Linear+mipmap)로 복구.
   ⚠️ 이미 Nearest 인 텍스처는 건드리지 않는다 — needsUpdate 는 텍스처를 GPU 에 다시 올린다. */
let _dotFilterState = null;
function applyDotTextureFilter(on){
  if(!on && _dotFilterState !== true) return;   // 켠 적이 없으면 되돌릴 것도 없다
  _dotFilterState = on;
  scene.traverse(o=>{
    if(o.isMesh && o.material){
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m=>{
        if(!m) return;
        DOT_TEX_KEYS.forEach(key=>{
          const tex = m[key];
          if(tex){
            if(!tex.userData) tex.userData={};   // 정상 THREE.Texture는 항상 있지만, 예외적인 텍스처 대비 방어코드(크래시 방지)
            if(on){
              if(tex.minFilter === THREE.NearestFilter && tex.magFilter === THREE.NearestFilter) return;
              if(tex.userData._origMinFilter===undefined){ tex.userData._origMinFilter=tex.minFilter; tex.userData._origMagFilter=tex.magFilter; }
              tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
            } else if(tex.userData._origMinFilter!==undefined){
              tex.minFilter = tex.userData._origMinFilter; tex.magFilter = tex.userData._origMagFilter; tex.needsUpdate = true;
            }
          }
        });
      });
    }
  });
}

/* ═══════════════ 🕹️ PS1 감성 — 색 양자화 + Bayer 디더링 (도트 모드 전용) ═══════════════
   후처리(EffectComposer)를 쓰지 않고 각 머티리얼 프래그먼트 셰이더 끝에 색 처리 코드를 주입한다.
   → 투명 배경(알파)을 건드리지 않아 이 앱의 오버레이 구조와 충돌하지 않고, GPU에서 처리돼 가볍다.
   · 양자화 단계 · 4×4 Bayer 표는 shared/ps1-dither.js 에서 읽는다(스티커사진 PS1 필터와 한 값).
   · 디더링: gl_FragCoord(화면 픽셀)로 인덱싱. 식은 ps1-dither.js ditherQuantize 를 GLSL 로 옮긴 것 — 바꾸면 둘 다.
   도트 모드를 켤 때만 적용하고, 끄면 원본 셰이더로 복구(needsUpdate로 재컴파일). */
const _PS1_LEVELS = ps1Dither.PS1_LEVELS;
// gl_FragColor를 양자화 직전에 Bayer 디더로 흩뿌린 뒤 단계로 스냅.
const _PS1_FRAG_INJECT = [
  '#include <dithering_fragment>',
  '{',
  '  // 4x4 Bayer 임계값 행렬(0~15 정규화). 화면 픽셀 좌표로 인덱싱해 격자 디더.',
  '  float _bayer[16];',
  ...[0, 4, 8, 12].map(r=>'  ' + ps1Dither.BAYER4.slice(r, r + 4).map((v, i)=>'_bayer[' + (r + i) + ']=' + v.toFixed(1) + ';').join(' ')),
  '  int _bx = int(mod(gl_FragCoord.x, 4.0));',
  '  int _by = int(mod(gl_FragCoord.y, 4.0));',
  '  int _bi = _by*4 + _bx;',
  '  float _thr = 0.0;',
  '  for(int _bk=0;_bk<16;_bk++){ if(_bk==_bi){ _thr = _bayer[_bk]/16.0; } }',
  '  float _levels = ' + _PS1_LEVELS.toFixed(1) + ';',
  '  // 디더 오프셋(±0.5단계)을 더한 뒤 단계로 스냅 → 경계가 격자 패턴으로 흩어짐.',
  '  vec3 _dithered = gl_FragColor.rgb + vec3((_thr - 0.5) / _levels);',
  '  vec3 _snapped = floor(_dithered * _levels + 0.5) / _levels;',
  '  gl_FragColor.rgb = clamp(_snapped, 0.0, 1.0);',
  '}'
].join('\n');

/* 머티리얼 → 우리가 건 훅 { hook, prev }. userData._ps1Hooked 표식만 믿지 않는다:
   ⚠️ m.clone() 은 userData 는 JSON 으로 복사하고 onBeforeCompile 은 안 옮긴다(표식만 따라온 가짜) ·
      색조 셰이더(_ensureHueUniforms)가 나중에 onBeforeCompile 을 덮어쓰기도 한다 → 지금 훅이 우리 것인지로 판정. */
const _ps1Hooks = new WeakMap();
const PS1_CACHE_KEY = 'tw-ps1:';
let _ps1State = null;
function applyPS1Shader(on){
  if(!on && _ps1State !== true) return;   // 켠 적이 없으면 되돌릴 것도 없다
  _ps1State = on;
  scene.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m=>{
      if(!m) return;
      const h = _ps1Hooks.get(m);
      if(on){
        if(h && m.onBeforeCompile === h.hook) return;   // 이미 주입됨
        if(!m.userData) m.userData = {};
        const prev = m.onBeforeCompile;                   // 기존 onBeforeCompile 보존(있으면 체인)
        m.userData._ps1PrevOBC = prev;
        const hook = (shader, renderer)=>{
          if(typeof prev === 'function'){ try{ prev(shader, renderer); }catch(_){} }
          // dithering_fragment(three 기본 훅) 자리를 우리 코드로 교체 — 최종 색 확정 직후 지점.
          if(shader.fragmentShader.indexOf('#include <dithering_fragment>') >= 0){
            shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', _PS1_FRAG_INJECT);
          } else {
            // 훅이 없으면(일부 머티리얼) 마지막 } 앞에 삽입 — gl_FragColor는 이미 확정돼 있음.
            shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, _PS1_FRAG_INJECT.replace('#include <dithering_fragment>','') + '\n}');
          }
        };
        m.onBeforeCompile = hook;
        /* ⚠️ three 는 셰이더를 customProgramCacheKey(기본 = onBeforeCompile 글자)로 나눠 쓴다. 감싼 훅 글자는
           늘 같아서, 키에 원래 훅 글자를 넣지 않으면 염색(색조) 재질과 보통 재질이 한 셰이더를 나눠 써 염색이 빠진다. */
        const prevKey = String(prev || '');
        m.customProgramCacheKey = ()=>PS1_CACHE_KEY + prevKey;
        _ps1Hooks.set(m, { hook, prev });
        m.userData._ps1Hooked = true;
        m.needsUpdate = true;   // 셰이더 재컴파일 유도
      } else if(h){
        // 우리 훅이 아직 걸려 있을 때만 되돌린다 — 그새 색조 셰이더가 덮어썼으면 그것을 지우지 않는다.
        if(m.onBeforeCompile === h.hook){
          m.onBeforeCompile = (typeof h.prev === 'function') ? h.prev : function(){};
          m.needsUpdate = true;
        }
        delete m.customProgramCacheKey;
        _ps1Hooks.delete(m);
        if(m.userData) m.userData._ps1Hooked = false;
      }
    });
  });
}

/* 켜져 있는 동안 SWEEP_MS 마다 한 번 다시 훑는다 — 켠 뒤 들어온 메쉬 · 파츠 · 바꿔 낀 표정 텍스처 · 덮어쓴 셰이더를 받게.
   이미 걸린 것은 건너뛰므로 평소에는 씬을 한 바퀴 도는 비용뿐이다. */
let _lastSweep = -Infinity;
function sweepIfOn(now){
  if(_dotFilterState !== true && _ps1State !== true) return;
  if(now - _lastSweep < SWEEP_MS) return;
  _lastSweep = now;
  if(_dotFilterState === true) applyDotTextureFilter(true);
  if(_ps1State === true) applyPS1Shader(true);
}

return {
  applyDotTextureFilter,
  applyPS1Shader,
  sweepIfOn,
};
}

const api = { createDotRender };
if(typeof window !== 'undefined') window.TwDotRender = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
