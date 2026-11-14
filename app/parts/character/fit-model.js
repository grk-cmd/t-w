/* fit-model.js — 📐 몸 · 책상 맞춤: 캐릭터를 좌석 키에 맞춰 크기 · 자리를 잡고(fitModel) 책상을 맞춘다(fitDesk)(앱 FSD · app.js 분리 M8)
   app.js FIT 구역을 글 그대로 옮긴 모듈이다. 동작은 옛 글과 같다(creatorPrevMod 를 읽는 함수로 받아 그 부름만 `creatorPrevMod()` 로 달라짐).
   ・책임: fitModel(seat) — 몸을 재어(char-measure) 목표 높이로 정규화 · 동물 40% · 커미션 보정 · 평준화 배율 · 사용자 크기 · 높이(clampCharY) · 발바닥 바닥 맞춤 · 파츠 xf 다시 맞추기 ·
     fitDesk(seat) — 책상 GLB 크기 · 자리 맞춤. 둘 다 좌석(seat) 하나만 만지고 부수효과는 그 좌석의 group · rig · desk 에만 있다.
   ・받는 deps 7 — 값: ANIMAL_RUN_SCALE · COMMISSION_SCALE_CORRECTION · charMeasureMod · clampCharY · seatEqMod · 함수: refreshRiggedPartsXf · 읽는 함수: creatorPrevMod(더 아래에서 만들어진다).
   ・내놓는 것: fitModel · fitDesk — app.js 는 같은 이름 const 로 받는다.
   ⚠️ 측정은 남이 남긴 상태에 기대지 않는다 — 재기 전에 조상부터 직접 세운다(matrixWorld 캐시가 옛 값인 채 재면 간격이 부푼다). 자세한 사연은 character/char-measure.js · room/char-place.js seatDeskHalfWidth.
   검사: checks/sim-fit-model.js */
(function(){

function createFitModel(deps){
const ANIMAL_RUN_SCALE = deps.ANIMAL_RUN_SCALE;
const COMMISSION_SCALE_CORRECTION = deps.COMMISSION_SCALE_CORRECTION;
const charMeasureMod = deps.charMeasureMod;
const clampCharY = deps.clampCharY;
const seatEqMod = deps.seatEqMod;
const refreshRiggedPartsXf = deps.refreshRiggedPartsXf;
const creatorPrevMod = deps.creatorPrevMod;
function fitModel(seat){
  const m=seat.gltfRoot; if(!m) return;
  m.scale.set(1,1,1); m.position.set(0,0,0); m.rotation.set(0,seat.userRot+creatorPrevMod().RIG_TURN,0);
  const sR=seat.rig.position.clone(),sRr=seat.rig.rotation.clone(),sWp=seat.bodyWrap.position.clone(),sG=seat.group.position.clone();
  seat.rig.position.set(0,0,0);seat.rig.rotation.set(0,0,0);seat.bodyWrap.scale.set(1,1,1);seat.bodyWrap.position.set(0,0,0);seat.group.position.set(0,0,0);
  seat.group.updateWorldMatrix(true,true);
  
  const box=charMeasureMod.measureCharBox(m);   // 표준 리그 통합: base·커미션 동일 경로 (리깅 파츠 제외 측정)
  if(!box.isEmpty()){
    const size=new THREE.Vector3(); box.getSize(size);
    // ★ 커미션 캐릭터 크기 보정 — 블렌더에서 기본 캐릭터와 비슷하게 맞춰 내보내도 실제 화면에선
    //   작게 나오는 경우가 있어서(GLB 안의 안 보이는 여분 메쉬/본으로 바운딩박스가 커지는 등 원인 추정)
    //   COMMISSION_SCALE_CORRECTION만큼 추가로 키움. 이 함수가 실제 실행 화면 크기를 결정함.
    const commCorr = (seat.charDef && seat.charDef.isCommission) ? COMMISSION_SCALE_CORRECTION : 1;
    // 🐾 동물은 인간의 60% 크기로 (확정 스펙). 실행 화면 크기는 이 함수가 최종 결정하므로 여기서 보정.
    const animCorr = (seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
    // 🐾 동물은 '측정'이 아니라 '확정값'으로 정규화한다.
    //   buildAnimalBase가 normalizeModel(root, 1.4*ANIMAL_RUN_SCALE)로 몸 높이를 이미 고정해두므로
    //   여기서 다시 잴 필요가 없다. 그런데 실측 로그상 재조립 때마다 이 측정값이 0.56 → 0.6975 → 0.649로
    //   흔들렸고(원인 미상), 1.45/측정값 공식이라 그대로 캐릭터 크기 변동으로 이어졌다
    //   (우클릭 편집을 들어갔다 나올 때마다 크기·위치가 바뀌던 실제 원인).
    //   최초 빌드가 내던 이상적인 값 1.45/1.4 = 1.0357을 항상 재현하도록 상수로 고정한다.
    //   ★ 인간·커미션은 기존 측정 경로 그대로 — 이 분기는 동물만 탄다.
    const ANIM_NORM_H = 1.4 * ANIMAL_RUN_SCALE;   // buildAnimalBase가 맞춰놓는 몸 높이(= 0.56)
    const isAnim = !!(seat.charDef && seat.charDef.animal);
    const baseScale = isAnim
      ? (1.45 / ANIM_NORM_H) * animCorr
      : (size.y>1e-4?1.45/size.y:1)*commCorr*animCorr;
    m.scale.setScalar(baseScale);   // 생성기 미리보기와 동일한 정규화 키
    seat.group.updateWorldMatrix(true,true);
    
    // 표준 리그 통합: 모델 자기 박스로 센터링 (BASE_SCENE 보정·진단로그·z-fix 제거)
    const b2=charMeasureMod.measureCharBox(m); const c=new THREE.Vector3(); b2.getCenter(c);
    // 🐾 동물은 이 재센터링을 건너뛴다.
    //   buildAnimalBase의 normalizeModel이 귀가 붙기 전에 x/z 중앙정렬을 이미 끝내놓기 때문에
    //   결정적(deterministic)이다. 반면 여기서 쓰는 measureCharBox는 재조립마다 결과가 흔들리는데
    //   (실측: 높이 0.56 → 0.7031 → 0.6524), 중심점 c.z도 같이 흔들려서 우클릭 편집을 들어갔다 나올 때마다
    //   캐릭터가 조금씩 '뒤로' 밀려나던 원인이었다. 크기는 확정값으로 막았지만 위치는 여기에 물려 있었음.
    //   ★ 인간·커미션은 기존 동작 그대로 — 아래 분기는 동물만 탄다.
    if(!isAnim){
      m.position.x-=c.x;
      /* 🪑 앞뒤(z) 재센터링은 하지 않는다 — **미리보기가 정답 기준**이기 때문이다.
         [경위] 꾸미기/보관함 미리보기는 캐릭터를 늘 z=0 에 세우고 책상 쪽을 반대로 밀어 간격을 맞춘다
           (_wdDeskGrp.position.z = -CHAR_Z*anim - xf.z). 즉 미리보기에는 이 재센터링 항이 없다.
           그래서 실행 화면에서만 캐릭터가 c.z x bodyWrap.scale 만큼 더 뒤에 서고, 책상 앵커에 매달린
           "책상 위" 파츠가 그만큼 앞에 있는 것처럼 보였다.
         [실측] userZ 0.27 / userScale 0.63 인 캐릭터에서 m.position.z=0.1714 였고
           그 중 userZ/userScale=0.4286, 나머지 -c.z=-0.2572 -> 월드 환산 -0.162.
           제보된 "실행이 더 앞" 의 양이 정확히 이 값이었다.
         ⚠️ 이 값은 **상수가 아니다.** 그래서 눈으로 맞춘 상수로는 때울 수 없고, 항을 없애는 것이
           파츠와 무관해지는 유일한 방법이다.
         ※ 예전 주석: "measureCharBox 는 리깅 파츠만 빼고 재므로 모자/탈 같은 파츠를 달고 뺄 때마다
           c.z 가 달라진다" — 이제 measureCharBox 가 파츠 wrapper 하위를 통째로 빼므로 c.z 자체는
           파츠와 무관하다. 항을 없앤 결정은 그대로 둔다(미리보기가 정답 기준이라는 이유는 유효하다).
         ★ 동물은 원래부터 이 분기를 건너뛰었다(normalizeModel 이 x/z 중앙정렬을 이미 끝내므로).
           즉 동물은 이 변경 전에도 미리보기와 같은 규약이었고, 이제 인간/커미션이 그쪽에 맞춰진 것이다.
         ⚠️ x 도 같은 어긋남을 갖고 있다(미리보기는 -xf.x 만 보상한다). 다만 제보된 증상이 앞뒤라
           z 만 맞춘다. 좌우가 어긋난다는 제보가 오면 같은 이유로 x 도 빼면 되는데, 그때는 캐릭터가
           좌석 슬롯 안에서 좌우로 움직이므로 layoutSeats 와 같이 봐야 한다.
         ⚠️ 되돌리려면 이 줄을 살리면 된다: m.position.z-=c.z; */
    }
    /* 🦶 피봇 보정 — 예전엔 `m.position.y = 0`(피봇=발바닥 전제)이었다. 사람 GLB 는 그 전제가
       깨져 있어 늘 0.048(로컬)만큼 떠 있었다. charFootFix 의 ⚠️ 넷 중 하나 — 나머지 셋은
       fitCreator('edit') · fitCreator('app') · refreshWdPreviewChar. 함께 고칠 것. */
    m.position.y = charMeasureMod.charFootFix(b2);
    
    // ★ 이 아래에서 seat.bodyWrap.scale이 userScale로 곱해지는데(코드 더 아래 참고), m은 bodyWrap의
    //   자식이라 m.position도 그때 같이 곱해져 버림 — 그래서 캐릭터 크기(userScale)를 1이 아니게 설정한
    //   경우 "앞뒤/좌우" 이동값이 실제로는 userScale배만큼 더 크게 적용되던 버그였음(생성기 미리보기는
    //   이 곱셈이 없어서 그만큼 어긋나 보임). 미리 userScale로 나눠서 그 곱셈을 상쇄시킴.
    /* ⚠️ 여기는 **raw seat.userScale** 이다. seatScale(실효값)로 바꾸지 말 것.
       bodyWrap.scale 이 userScale×k 이므로, raw 로 나눠야 이동량의 월드 값이 userX×k 가 되어
       **책상과 같은 배율로** 함께 줄고 커진다. 실효값으로 나누면 k 가 상쇄되어 캐릭터만 커지고
       앞뒤 위치는 제자리에 남아, 평준화한 좌석에서 캐릭터가 책상을 파고든다. */
    const _uz=(seat.userScale&&isFinite(seat.userScale)&&seat.userScale>0)?seat.userScale:1;
    // 🐾 동물은 캐릭터도 책상도 40%인데 이동량(userX/userZ)만 절대값이라, 40% 책상 기준으로는 2.5배
    //   크게 움직여서 "생성기에서 맞춘 앞뒤 위치"와 실행 화면이 어긋났다(생성기는 동물·책상 모두 100%).
    //   책상과 같은 비율로 줄여서 생성기에서 본 그대로가 되게 함. 인간은 곱셈이 1이라 무변화.
    const _animPos = (seat.charDef && seat.charDef.animal) ? ANIMAL_RUN_SCALE : 1;
    m.position.x+=((seat.userX||0)*_animPos)/_uz;
  m.position.z+=((seat.userZ||0)*_animPos)/_uz;   // 🚫 userZ 는 폐기돼 항상 0 — 항만 남겨 둔다(되살릴 때 여기 하나)
  // ★ 미세 보정 — 위 나눗셈 수정 후 책상에 살짝 파고드는 느낌이 있다는 피드백에 따라 살짝 뒤로 밀어줌.
  //   숫자를 더 뒤로 보내려면(desk에서 더 멀어지게) 더 음수로, 덜 보내려면 0에 가깝게 조절.
  // ★ 확인 완료된 값 — 캐릭터/책상 거리 보정. 이 숫자는 실측으로 맞춘 값이라 다른 이유 없이 건드리지 말 것.
  //   ★ 커미션 거리 어긋남 수정: 이 nudge도 m.position이라서 아래 bodyWrap.scale(userScale) 곱셈에 같이
  //     스케일되고 있었음 — 캐릭터 크기(xf.s)가 1이 아니면(커미션은 대개 0.7 등) 실효 nudge가 달라져서
  //     미리보기와 책상-캐릭터 거리가 어긋나던 원인. userScale로 미리 나눠 스케일 불변으로 만듦.
  // ★ 예전엔 -0.25 nudge를 뒤로 밀었는데(카메라 앵글 보정용) 미리보기가 정답 기준으로 확정된
  //   지금은 이게 오히려 실행 화면 캐릭터를 미리보기보다 0.25 뒤로 밀어냄(거리 진단 로그로 확인).
  //   미리보기와 완전히 동일한 좌표계로 두기 위해 nudge를 0으로 무효화.
  const FIT_MODEL_Z_NUDGE = 0;
  m.position.z += FIT_MODEL_Z_NUDGE/_uz;
  // ★ 예전의 y 미세보정(-0.05)은 bodyWrap.scale에 곱해져 미리보기보다 캐릭터가 0.03쯤 가라앉게
  //   만들던 원인([배치진단]으로 확인) — 미리보기가 정답 기준이므로 제거(0).
  m.position.y+=0;
  /* 🧍 캐릭터 높이 — 생성기의 높이 슬라이더(cXform.y → def.xf.y → seat.userY).
     ⚠️ x/z 와 **같은 이유로** _uz 로 미리 나눈다. 아래에서 bodyWrap.scale 이 곱해지므로,
       안 나누면 캐릭터 크기를 1 이 아니게 둔 사람만 높이가 userScale 배로 들려 미리보기와 어긋난다.
       (fitCreator·꾸미기 미리보기는 둘 다 g.position.y 에 절대값을 그대로 넣는다 — 거기에 맞춘다.)
     🐾 **_animPos 를 곱한다.** 예전 주석은 "fitCreator 도 동물에 배율을 안 거니까 여기서도 안 건다"
       였는데, 그게 정확히 제보 2의 원인이었다. 생성기는 동물을 **100% 크기**로 보여주고 실행 화면은
       **40%(ANIMAL_RUN_SCALE)** 로 그린다. 그런데 높이만 두 화면 다 절대값이라, 몸이 2.5배 작은
       실행 화면에서 같은 0.27 이 2.5배 크게 들려 보였다.
       [실측] xf.y=0.27 / xf.s=0.94 인 동물에서 — 생성기 몸높이 1.363 · 들림 0.27 (비율 0.1981),
              실행 몸높이 0.5452 · 들림 0.27 (비율 0.4954). 배율은 정확히 1/0.4 = 2.5 였다.
              _animPos 를 곱하면 실행 들림이 0.108 → 비율 0.1981 로 생성기와 **정확히** 같아진다.
       ⚠️ x/z 는 이미 _animPos 를 곱하고 있었다(바로 위 두 줄). y 만 빠져 있었던 것이다.
       ⚠️ 인간·커미션은 _animPos 가 1 이라 **아무 변화 없다.**
       ⚠️ charLiftWorld 도 **같이** 바꿔야 한다 — 올라타기가 그 값으로 이 들림을 상쇄한다.
         한쪽만 고치면 동물 머리 위에 올라탄 캐릭터가 그 차이만큼 뜬다. */
  m.position.y += clampCharY(seat.userY) * _animPos / _uz;
  /* 🦶 바닥 맞춤 — 발밑에 둔 파츠(욕조·방석 등)가 있으면 그 깊이만큼 들어 올려서
     '가장 아래에 있는 것'이 바닥에 닿게 한다. 발 아래에 아무것도 없으면 0이라 무동작이다.
     ⚠️ 반드시 여기, 크기(scale)와 x/z 가 다 정해진 **뒤**여야 한다. 스케일 전에 재면 깊이가
       정규화 배율만큼 어긋나서 그만큼 바닥을 파고들거나 뜬다. */
  m.position.y += charMeasureMod.measureUnderfootDepth(m);
}
  seat.rig.position.copy(sR);seat.rig.rotation.copy(sRr);
  /* 🪑 평준화 배율은 여기(몸 스케일) 하나로 들어간다 — headAnchor·bodyAnchor 는 bodyWrap 의
     자식이라 저절로 같이 커진다. ⚠️ 위 _uz 는 raw userScale 그대로여야 한다(그 주석 참고). */
  seat.bodyWrap.scale.setScalar(seatEqMod.seatScale(seat));
  seat.bodyWrap.position.copy(sWp);seat.group.position.copy(sG);
  /* ⚠️ 값만 되돌리면 matrixWorld 는 위에서 0 으로 옮겨 잰 그대로 남는다 — 다음 렌더 프레임이
     오기 전까지 이 좌석의 월드 행렬은 **거짓말**이고, 그 사이에 월드 좌표를 재는 코드
     (seatDeskHalfWidth → layoutSeats)가 원점 근처에 있는 것처럼 읽는다.
     fitModel 바로 뒤에 layoutSeats 를 부르는 자리가 여럿이므로(크기 슬라이더·리빌드·평준화)
     여기서 한 번 세워 두고 나간다. 이 함수는 이미 위에서 두 번 부르는 호출이라 비용도 그만큼이다. */
  seat.group.updateWorldMatrix(true,true);
  // ★ 리깅 파츠(귀 등)는 위치를 bindMatrix에 "구워서" 고정하므로, 여기서 모델 스케일(m.scale)이
  //   다시 계산되면 옛 스케일 기준 위치에 남아 머리 위로 붕 뜬다.
  //   fitModel을 부르는 모든 경로(크기 슬라이더·리빌드·파츠 부착 후 재계산 등)에서 반드시 다시 구워야 함.
  //   ※ 화면마다 갱신 경로가 달라서 "내 화면만 어긋나 보이는" 현상의 원인이기도 함.
  refreshRiggedPartsXf(seat);
}
function fitDesk(seat){
  const d=seat.deskGltf; if(!d) return;
  d.scale.set(1,1,1); d.position.set(0,0,0);
  const sG=seat.group.position.clone(); seat.group.position.set(0,0,0); seat.group.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(d);
  if(!box.isEmpty()){
    const size=new THREE.Vector3(); box.getSize(size);
    const s=size.y>1e-4?0.6/size.y:1; d.scale.set(s,s,s);
    seat.group.updateWorldMatrix(true,true);
    const b2=new THREE.Box3().setFromObject(d); const c=new THREE.Vector3(); b2.getCenter(c);
    d.position.x-=c.x; d.position.z-=c.z; d.position.y-=b2.min.y; d.position.z+=0.45;
  }
  seat.group.position.copy(sG); seat.group.updateWorldMatrix(true,true);   // ⚠️ fitModel 끝의 그 이유와 같다
}

return {
  fitModel,
  fitDesk,
};
}

const api = { createFitModel };
if(typeof window !== 'undefined') window.TwFitModel = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
