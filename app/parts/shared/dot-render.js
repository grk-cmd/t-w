/* dot-render.js — 🕹️ 도트 모드 머티리얼 — 텍스처 Nearest 필터 · PS1 색 양자화 + Bayer 디더 셰이더 켜고 끄기
   책임: 도트 렌더 모드일 때 씬의 머티리얼만 바꾼다(텍스처 필터 · 프래그먼트 셰이더 주입) — 언제 켤지는 부르는 쪽(카메라 · 캔버스 맞춤)이 정한다.
   받는 deps: scene(THREE.Scene). 내보내는 것: applyDotTextureFilter(on) · applyPS1Shader(on).
   app.js «🪑 좌석 배치 · 카메라 · 도트 텍스처 필터» 구역 끝의 도트 필터와 «🕹️ PS1 감성» 구역을 그대로 옮겼다(구역 떼기 C · w1). 동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 0줄.
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ 밖에서 부르는 이름: applyDotTextureFilter · applyPS1Shader — app.js 는 dotRenderMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwDotRender — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-dot-render.js */
(function(){

function createDotRender(deps){
const scene = deps.scene;
/* 도트 렌더 모드일 때 씬의 모든 텍스처를 Nearest 필터로 전환(선명한 도트), 끄면 원래(Linear+mipmap)로 복구.
   매 프레임 호출 안 하고 모드 전환 시 1회만 — _dotFilterState로 중복 적용 방지. */
let _dotFilterState = null;
function applyDotTextureFilter(on){
  if(_dotFilterState === on) return;
  _dotFilterState = on;
  scene.traverse(o=>{
    if(o.isMesh && o.material){
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m=>{
        if(!m) return;
        ['map','emissiveMap','normalMap','roughnessMap','metalnessMap'].forEach(key=>{
          const tex = m[key];
          if(tex){
            if(!tex.userData) tex.userData={};   // 정상 THREE.Texture는 항상 있지만, 예외적인 텍스처 대비 방어코드(크래시 방지)
            if(on){
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
   · 양자화: 채널당 5bit(32단계, RGB555) — 실제 PS1 컬러 뎁스.
   · 디더링: 4×4 Bayer 순서형 패턴 — PS1 특유의 격자 디더. gl_FragCoord(화면 픽셀)로 인덱싱.
   도트 모드를 켤 때만 적용하고, 끄면 원본 셰이더로 복구(needsUpdate로 재컴파일). */
const _PS1_LEVELS = 16.0;   // 채널당 색 단계. 16=PS1 디더가 눈에 보이는 균형점. 32=미세(RGB555), 8=강한 포스터화.
// gl_FragColor를 양자화 직전에 Bayer 디더로 흩뿌린 뒤 단계로 스냅.
const _PS1_FRAG_INJECT = [
  '#include <dithering_fragment>',
  '{',
  '  // 4x4 Bayer 임계값 행렬(0~15 정규화). 화면 픽셀 좌표로 인덱싱해 격자 디더.',
  '  float _bayer[16];',
  '  _bayer[0]=0.0;  _bayer[1]=8.0;  _bayer[2]=2.0;  _bayer[3]=10.0;',
  '  _bayer[4]=12.0; _bayer[5]=4.0;  _bayer[6]=14.0; _bayer[7]=6.0;',
  '  _bayer[8]=3.0;  _bayer[9]=11.0; _bayer[10]=1.0; _bayer[11]=9.0;',
  '  _bayer[12]=15.0;_bayer[13]=7.0; _bayer[14]=13.0;_bayer[15]=5.0;',
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

let _ps1State = null;   // 중복 적용 방지
function applyPS1Shader(on){
  if(_ps1State === on) return;
  _ps1State = on;
  scene.traverse(o=>{
    if(!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m=>{
      if(!m) return;
      if(on){
        if(m.userData && m.userData._ps1Hooked) return;   // 이미 주입됨
        if(!m.userData) m.userData = {};
        m.userData._ps1PrevOBC = m.onBeforeCompile;       // 기존 onBeforeCompile 보존(있으면 체인)
        m.onBeforeCompile = (shader, renderer)=>{
          if(typeof m.userData._ps1PrevOBC === 'function'){ try{ m.userData._ps1PrevOBC(shader, renderer); }catch(_){} }
          // dithering_fragment(three 기본 훅) 자리를 우리 코드로 교체 — 최종 색 확정 직후 지점.
          if(shader.fragmentShader.indexOf('#include <dithering_fragment>') >= 0){
            shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', _PS1_FRAG_INJECT);
          } else {
            // 훅이 없으면(일부 머티리얼) 마지막 } 앞에 삽입 — gl_FragColor는 이미 확정돼 있음.
            shader.fragmentShader = shader.fragmentShader.replace(/}\s*$/, _PS1_FRAG_INJECT.replace('#include <dithering_fragment>','') + '\n}');
          }
        };
        m.userData._ps1Hooked = true;
        m.needsUpdate = true;   // 셰이더 재컴파일 유도
      } else {
        if(m.userData && m.userData._ps1Hooked){
          m.onBeforeCompile = (typeof m.userData._ps1PrevOBC === 'function') ? m.userData._ps1PrevOBC : function(){};
          m.userData._ps1Hooked = false;
          m.needsUpdate = true;
        }
      }
    });
  });
}


return {
  applyDotTextureFilter,
  applyPS1Shader,
};
}

const api = { createDotRender };
if(typeof window !== 'undefined') window.TwDotRender = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
