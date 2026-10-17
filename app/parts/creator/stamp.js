/* stamp.js — 🖼 생성기 이미지 도장: 미리보기 위에 띄운 그림을 옮기고 · 키우고 · 돌린 뒤 얼굴 그림 층에 곡면을 따라 찍는다
   app.js «이미지 도장» 조각을 그대로 옮긴 모듈이다(C 구역 떼기 w4). 동작은 옮기기 전과 같다(바뀐 줄은 입구 가드 넷 · 옛 이야기형 주석 줄이기).
   ・책임: 도장 모드 켜기 · 끄기(setStampMode · clearStampState · cancelStamp) · 그림 불러오기(loadStampFromFile) · 배치 초기화(resetStampPlacement) ·
     찍기(commitStamp — 화면 격자 N×N 을 얼굴에 쏘아 UV 를 얻고 삼각형마다 픽셀로 래스터 · 대칭이면 거울 자리도) · 띄운 그림 손잡이(bindStampOverlay).
   ・받는 deps 10 — 값 CANVAS_SZ · crState(stampMode · stampImg · stampPlace · stampDirty · cBase · cCam · symmetry · crStep …) ·
     paintStrokeMod(같은 광선 _pray · _pndc) · partPaintMod(리깅 맞히기 _picIntersect · 감아 칠하기 _stampWrapFill · UV 배율) ·
     함수 6(_crDropEraser · actC · blit · isDrawStep · pushHistory · toast).
   ・내놓는 것: setStampMode · clearStampState · cancelStamp · loadStampFromFile · resetStampPlacement · commitStamp · bindStampOverlay — app.js 는 crStampMod.이름.
   ・입구 전제: 미리보기 캔버스(#creatorPreview)와 도장 요소(#stampOverlay · #stampOverlayImg · 버튼)가 화면에 있어야 한다 — 없으면 아무것도 안 한다.
   ⚠️ character/animal.js aCommitStamp 에 찍기 코드가 한 벌 더 있다 — 한쪽을 고치면 다른 쪽도(묶기는 IMPROVEMENT_BACKLOG).
   ⚠️ document · FileReader · Image · addEventListener 는 전역 이름 그대로. 전역 이름은 TwCrStamp(Tw 접두사 #103).
   검사: checks/sim-cr-stamp.js */
(function(){

function createCrStamp(deps){
const CANVAS_SZ = deps.CANVAS_SZ;
const _crDropEraser = deps._crDropEraser;
const actC = deps.actC;
const blit = deps.blit;
const crState = deps.crState;
const isDrawStep = deps.isDrawStep;
const paintStrokeMod = deps.paintStrokeMod;
const partPaintMod = deps.partPaintMod;
const pushHistory = deps.pushHistory;
const toast = deps.toast;
/* 도장 상수 */
const STAMP_FIRST_W = 0.4;                  // 처음 불러온 도장 너비 = 미리보기 짧은 변 × 이 값
const STAMP_GRID = 28;                      // 찍을 때 화면 격자 N×N(촘촘할수록 굽은 면을 잘 따라간다 · 레이 (N+1)²)
const STAMP_SKIP_RATIO = 0.9, STAMP_WARN_RATIO = 0.2;   // 얼굴 밖 격자점 비율 — 이 이상이면 안 찍음 / 넘으면 «잘렸어요»
const STAMP_SEAM_CAP = 0.35, STAMP_SEAM_MUL = 3, STAMP_SEAM_BASE = 0.03;   // 이음새 허용 = min(CAP, 3D 거리 × UV 배율 × MUL + BASE)
const STAMP_ROT_SNAP_DEG = 15;              // Shift 회전 단위
const STAMP_MIN_PX = 20;                    // 모서리로 줄일 때 최소 크기(px)
/* === 이미지 도장 (절충안: 떠 있는 미리보기 → Z 또는 ✓로 확정 박기) =================
   흐름:
   1) 이미지 불러오면 캔버스 위에 떠 있는 오버레이로 표시. 4코너 핸들로 비례 크기, 회전 손잡이로 회전, 본체 드래그로 이동.
   2) Z 또는 ✓ 박기 → 현재 위치/크기/회전 그대로 face에 박힘. 곡면 왜곡은 격자 raycast로 자연스럽게.
   3) ESC 또는 ✕ 취소 → 박지 않고 빠져나옴.
   대칭 ON이면 박을 때 거울 위치에도 동시 박힘.
=========================================================================== */
function stampOverlayEl(){return document.getElementById('stampOverlay');}
function refreshStampOverlay(){
  const ov=stampOverlayEl(); if(!ov||!crState.stampMode||!crState.stampImg){if(ov)ov.style.display='none';return;}
  // 오버레이의 부모는 .decor-left지만 stampPlace.cx/cy는 캔버스 기준 좌표 → 캔버스의 부모 내 오프셋을 더해야 일치
  const cv=document.getElementById('creatorPreview');
  const ox=cv.offsetLeft, oy=cv.offsetTop;
  ov.style.display='block';
  ov.style.left=(ox+crState.stampPlace.cx-crState.stampPlace.w/2)+'px';
  ov.style.top=(oy+crState.stampPlace.cy-crState.stampPlace.h/2)+'px';
  ov.style.width=crState.stampPlace.w+'px';
  ov.style.height=crState.stampPlace.h+'px';
  ov.style.transform=`rotate(${crState.stampPlace.rot}rad)`;
}
function setStampMode(on){
  crState.stampMode=on;
  const sb=document.getElementById('stampBtn'); if(sb)sb.classList.toggle('on',on);
  const sp=document.getElementById('stampPanel'); if(sp)sp.style.display=on?'flex':'none';
  if(on){ _crDropEraser();
    // 이전에 불러둔 이미지가 있으면 버튼 다시 노출 (모드 OFF→ON 복귀 시 이미지 유지)
    if(crState.stampImg){
      const sa=document.getElementById('stampApply'); if(sa)sa.style.display='inline-block';
      const sc=document.getElementById('stampCancel'); if(sc)sc.style.display='inline-block';
      const sr=document.getElementById('stampReset'); if(sr)sr.style.display='inline-block';
    }
  }
  refreshStampOverlay();
  const cv=document.getElementById('creatorPreview'); if(cv)cv.style.cursor=isDrawStep()?'crosshair':'default';
}
/* 도장 UI 상태만 초기화(패널 닫기 등) — 생성기를 닫을 때 사용.
   ★ 이미지·위치/크기/회전(stampImg/stampPlace/stampDirty)은 일부러 안 지움 — 다음에 새 캐릭터를
   만들거나 다른 캐릭터를 수정할 때도 방금 불러온 도장 이미지와 그 배치를 그대로 기억해뒀다가
   바로 다시 쓸 수 있게 하기 위함(요청사항). 완전히 새로 지우고 싶으면 도장 패널의 "취소" 버튼 사용. */
function clearStampState(){
  crState.stampMode=false;
  const sa=document.getElementById('stampApply'); if(sa)sa.style.display='none';
  const sc=document.getElementById('stampCancel'); if(sc)sc.style.display='none';
  const sr=document.getElementById('stampReset'); if(sr)sr.style.display='none';
  const sb=document.getElementById('stampBtn'); if(sb)sb.classList.remove('on');
  const sp=document.getElementById('stampPanel'); if(sp)sp.style.display='none';
  const ov=document.getElementById('stampOverlay'); if(ov)ov.style.display='none';
}
function loadStampFromFile(file){
  if(!file||!file.type||!file.type.startsWith('image/'))return;
  /* 입구 전제 — 생성기 화면(미리보기 · 띄운 그림 · 버튼)이 있어야 한다. 예전엔 생성기 흐름이 말없이 보장했다(없으면 onload 에서 던졌다). */
  if(!document.getElementById('creatorPreview')||!document.getElementById('stampOverlayImg')||!document.getElementById('stampApply')||!document.getElementById('stampCancel')) return;
  const r=new FileReader();
  r.onload=ev=>{ const im=new Image(); im.onload=()=>{ crState.stampImg=im;
    const th=document.getElementById('stampThumb'); if(th){ th.src=ev.target.result; th.style.display='inline-block'; }
    document.getElementById('stampOverlayImg').src=ev.target.result;
    document.getElementById('stampApply').style.display='inline-block';
    document.getElementById('stampCancel').style.display='inline-block';
    { const sr=document.getElementById('stampReset'); if(sr) sr.style.display='inline-block'; }
    // 사용자가 이전에 변형(크기/회전)을 만진 상태(stampDirty)면 그대로 유지 → 이미지만 교체. 늘어남 OK(b안).
    if(!crState.stampDirty){
      const cv=document.getElementById('creatorPreview'), r2=cv.getBoundingClientRect();
      crState.stampPlace.aspect = im.naturalWidth/Math.max(1,im.naturalHeight);
      const baseW = Math.min(r2.width, r2.height) * STAMP_FIRST_W;
      crState.stampPlace.w = baseW; crState.stampPlace.h = baseW / crState.stampPlace.aspect;
      crState.stampPlace.cx = r2.width/2; crState.stampPlace.cy = r2.height/2; crState.stampPlace.rot=0;
    } else {
      // 새 이미지의 aspect만 갱신 (코너 핸들 Shift 비례 복귀 시 새 이미지의 원본 비율 기준)
      crState.stampPlace.aspect = im.naturalWidth/Math.max(1,im.naturalHeight);
    }
    if(!crState.stampMode) setStampMode(true);
    refreshStampOverlay();
  }; im.src=ev.target.result; };
  r.readAsDataURL(file);
}
/* 도장 변형 초기화 — resetStampPlacement() 는 크기 · 회전만(위치 유지 · 띄운 그림의 ↺ 손잡이),
   (true) 는 위치까지 화면 가운데로(패널의 [↺ 초기화] — 도장이 미리보기 밖으로 나가면 손잡이도 같이 나가 누를 수 없어서). */
function resetStampPlacement(alsoPos){
  if(!crState.stampImg) return;
  if(!document.getElementById('creatorPreview')) return;   // 입구 전제 — 미리보기 캔버스
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  crState.stampPlace.aspect = crState.stampImg.naturalWidth/Math.max(1,crState.stampImg.naturalHeight);
  const baseW = Math.min(r.width, r.height) * STAMP_FIRST_W;
  crState.stampPlace.w = baseW; crState.stampPlace.h = baseW / crState.stampPlace.aspect;
  crState.stampPlace.rot = 0;
  // ★ 값은 loadStampFromFile 의 첫 배치와 같아야 한다 — "처음 불러온 상태"가 이 버튼의 약속이다.
  if(alsoPos){ crState.stampPlace.cx = r.width/2; crState.stampPlace.cy = r.height/2; }
  crState.stampDirty = false;   // 초기화했으니 dirty 해제 → 다음 이미지 로드 시 또 디폴트로
  refreshStampOverlay();
}

/* face 위에 떠 있는 이미지를 격자로 잘라 그려서 곡면 왜곡 표현
   - 미리보기 캔버스(픽셀) 좌표의 사각형 4꼭짓점을 raycast → face UV 4점
   - 격자(N×N)로 세분화하여 작은 quad마다 이미지 일부를 affine 매핑으로 그림
   - face에 안 닿는 격자 점은 폐기 (구멍이 생길 수 있지만 자연스러움) */
function commitStamp(){
  if(!crState.stampImg||!crState.cBase||!crState.cBase.face)return;
  if(!document.getElementById('creatorPreview')) return;   // 입구 전제 — 미리보기 캔버스
  const cv=document.getElementById('creatorPreview'), r=cv.getBoundingClientRect();
  // 도장 오버레이의 4꼭짓점(미리보기 픽셀)
  const cx=crState.stampPlace.cx, cy=crState.stampPlace.cy, w=crState.stampPlace.w, h=crState.stampPlace.h, rot=crState.stampPlace.rot;
  const cs=Math.cos(rot), sn=Math.sin(rot);
  function localToScreen(lx,ly){ // (-0.5..0.5)*w,h → 화면 픽셀
    return {x: cx + lx*cs - ly*sn, y: cy + lx*sn + ly*cs};
  }
  // N×N 격자
  /* 격자 28 — 굽은 면(턱 밑)을 따라가고 진짜 이음새에서 버려지는 칸이 작다(레이 841회, 대칭이면 두 배). 이음새는 3D 거리 대비로 판정(_uvFar). */
  const N=STAMP_GRID;
  /* 얼굴은 리깅이라 기본 레이캐스트는 바인드 포즈를 맞힌다 — 지금 자세로 맞히는 _picIntersect(앞면만)를 쓴다. */
  function _stampFaceHit(){
    const c=partPaintMod._picIntersect(paintStrokeMod._pray.ray, [crState.cBase.face]);
    if(!c||!c.uv) return null;
    return {x:c.uv.x, y:c.uv.y, p:c.point.clone()};
  }
  // 각 격자 점의 face UV(있으면) 계산
  const uvs=[]; // [j*(N+1)+i] = {uv:{x,y}} or null
  const _wrapRays=[];   // 빗나간 칸의 광선 — 감아 칠하기용
  for(let j=0;j<=N;j++){
    for(let i=0;i<=N;i++){
      const lx=(i/N-0.5)*w, ly=(j/N-0.5)*h;
      const sp=localToScreen(lx,ly);
      // 화면 좌표 → NDC (캔버스 픽셀 크기는 r.width/r.height 사용)
      paintStrokeMod._pndc.x=(sp.x/r.width)*2-1; paintStrokeMod._pndc.y=-(sp.y/r.height)*2+1;
      paintStrokeMod._pray.setFromCamera(paintStrokeMod._pndc,crState.cCam);
      const _h=_stampFaceHit();
      uvs.push(_h);
      if(!_h) _wrapRays[uvs.length-1]={o:paintStrokeMod._pray.ray.origin.clone(), d:paintStrokeMod._pray.ray.direction.clone()};
    }
  }
  // 감아 칠하기 — 턱 밑처럼 정면에서 못 맞힌 칸을 이웃에서부터 이어 채운다(part-paint _stampWrapFill)
  const _wrapCtr=partPaintMod._stampWrapCenter(crState.cBase.face);
  const _wrapN=partPaintMod._stampWrapFill(uvs, N, _wrapRays, [crState.cBase.face], _wrapCtr);
  if(_wrapN) console.log('[도장] 감아 칠한 격자점', _wrapN);
  pushHistory();
  // 가장자리 폐기 셀의 UV를 인접 유효 셀에서 *바깥으로 외삽*해서 채움 — 도장이 얼굴을 더 꽉 채우게
  // 외삽한 UV가 0..1 약간 벗어나는 범위(-0.05..1.05)까지는 클램프해서 살리고, 그 밖은 폐기.
  /* 얼굴에 안 맞은 격자점을 이웃에서 바깥으로 추정해 채운다(가장자리 톱니 방지) — 방향당 EXTRA_MAX 칸까지만, 0~1 을 벗어나면 멈춘다
     (잘린 값이 텍스처 가장자리에 뭉쳐 배경 있는 PNG 에 띠 자국이 생긴다). */
  const EXTRA_MAX = 2;   // ★ 한 방향으로 추정해 채울 최대 칸 수
  function extrapolateUVs(arr, N){
    function tryExtra(i,j,uv){
      // 잘라내야 할 만큼 벗어난 값 = 이미 메시 밖 → 뭉개짐의 원인이라 채우지 않는다.
      if(uv.x<0||uv.x>1||uv.y<0||uv.y>1) return false;
      arr[j*(N+1)+i]={x:uv.x,y:uv.y}; return true;
    }
    // 행별 좌→우 / 우→좌 외삽
    for(let j=0;j<=N;j++){
      let i1=-1,i2=-1;
      for(let i=0;i<=N;i++){ if(arr[j*(N+1)+i]){ if(i1<0)i1=i; else if(i2<0){i2=i;break;} } }
      if(i1>=0&&i2>=0){
        const u1=arr[j*(N+1)+i1], u2=arr[j*(N+1)+i2], dx=(u2.x-u1.x)/(i2-i1), dy=(u2.y-u1.y)/(i2-i1);
        for(let i=i1-1;i>=0&&i>i1-1-EXTRA_MAX;i--){ if(!tryExtra(i,j,{x:u1.x+dx*(i-i1),y:u1.y+dy*(i-i1)})) break; }
      }
      let k1=-1,k2=-1;
      for(let i=N;i>=0;i--){ if(arr[j*(N+1)+i]){ if(k1<0)k1=i; else if(k2<0){k2=i;break;} } }
      if(k1>=0&&k2>=0){
        const u1=arr[j*(N+1)+k1], u2=arr[j*(N+1)+k2], dx=(u1.x-u2.x)/(k1-k2), dy=(u1.y-u2.y)/(k1-k2);
        for(let i=k1+1;i<=N&&i<k1+1+EXTRA_MAX;i++){ if(!tryExtra(i,j,{x:u1.x+dx*(i-k1),y:u1.y+dy*(i-k1)})) break; }
      }
    }
    // 열별 상→하 / 하→상 외삽 (행 외삽 후 남은 코너·전체 결손 행 처리)
    for(let i=0;i<=N;i++){
      let j1=-1,j2=-1;
      for(let j=0;j<=N;j++){ if(arr[j*(N+1)+i]){ if(j1<0)j1=j; else if(j2<0){j2=j;break;} } }
      if(j1>=0&&j2>=0){
        const u1=arr[j1*(N+1)+i], u2=arr[j2*(N+1)+i], dx=(u2.x-u1.x)/(j2-j1), dy=(u2.y-u1.y)/(j2-j1);
        for(let j=j1-1;j>=0&&j>j1-1-EXTRA_MAX;j--){ if(!tryExtra(i,j,{x:u1.x+dx*(j-j1),y:u1.y+dy*(j-j1)})) break; }
      }
      let m1=-1,m2=-1;
      for(let j=N;j>=0;j--){ if(arr[j*(N+1)+i]){ if(m1<0)m1=j; else if(m2<0){m2=j;break;} } }
      if(m1>=0&&m2>=0){
        const u1=arr[m1*(N+1)+i], u2=arr[m2*(N+1)+i], dx=(u1.x-u2.x)/(m1-m2), dy=(u1.y-u2.y)/(m1-m2);
        for(let j=m1+1;j<=N&&j<m1+1+EXTRA_MAX;j++){ if(!tryExtra(i,j,{x:u1.x+dx*(j-m1),y:u1.y+dy*(j-m1)})) break; }
      }
    }
  }
  extrapolateUVs(uvs, N);
  /* 얼굴 밖 격자점 비율 — 거의 다(90%) 놓쳤으면 찍지 않고, 20% 넘게 놓쳤으면 잘렸다고 알린다(화면에선 잘 올린 것처럼 보여 원인을 모른다). */
  {
    let miss=0; for(let k=0;k<uvs.length;k++) if(!uvs[k]) miss++;
    const ratio = miss / Math.max(1, uvs.length);
    if(ratio > 0.02) console.log('[도장] 얼굴 밖 격자점', miss, '/', uvs.length, '(', Math.round(ratio*100), '% )');
    if(ratio >= STAMP_SKIP_RATIO){
      toast('도장이 캐릭터 밖에 있어요 — 얼굴 위로 옮겨주세요');
      return;   // 거의 다 놓쳤으면 찍지 않는다(엉뚱한 자국만 남는 걸 방지)
    }
    if(ratio > STAMP_WARN_RATIO) toast('도장 일부가 얼굴을 벗어나 잘렸어요 ('+Math.round((1-ratio)*100)+'%만 찍힘)');
  }
  const dstCtx=actC().getContext('2d');
  /* 도장은 오프스크린에 다 조립한 뒤 얼굴 캔버스에 source-over 로 딱 한 번 얹는다 — 삼각형마다 바로 그리면 겹친 띠에서 알파가 두 번 쌓여
     격자 · 빗금 자국이 생긴다. 거울(대칭) 도장도 같은 오프스크린에. */
  const stampOff=document.createElement('canvas');
  stampOff.width=CANVAS_SZ; stampOff.height=CANVAS_SZ;
  const ctx=stampOff.getContext('2d');
  ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';   // 부드러운 보간으로 셀 경계 시인성 ↓
  const imgW=crState.stampImg.naturalWidth, imgH=crState.stampImg.naturalHeight;
  // 셀별로 삼각형 2개씩 그려서 매핑. 누락 셀은 폐기. 클립 영역을 셀 중심에서 외측으로 살짝 부풀려 인접 셀과 겹치게 → 흰선 제거.
  /* 실루엣 가장자리를 스치는 광선은 옆면 · 이음새에 맞아 UV 가 텍스처 반대편으로 벌어질 수 있다 — 그런 삼각형은 버린다(늘어난 그림이 엉뚱한 부위에 겹쳐 찍힘). */
  const UV_EDGE_MAX = 0.15;
  /* 이음새 판정 — 둘 다 맞힌 점이면 위 STAMP_SEAM_*, 외삽한 점이면 UV_EDGE_MAX. 비스듬한 턱 밑은 통과, 진짜 이음새는 걸린다. */
  const _uvK = partPaintMod._wdPicUvScale(crState.cBase.face);
  function _uvFar(p,q){
    const dx=p.x-q.x, dy=p.y-q.y, uvD=Math.sqrt(dx*dx+dy*dy);
    if(p.p && q.p){ const allow=Math.min(STAMP_SEAM_CAP, p.p.distanceTo(q.p)*_uvK*STAMP_SEAM_MUL + STAMP_SEAM_BASE); return uvD > allow; }
    return uvD > UV_EDGE_MAX;
  }
  /* 삼각형을 픽셀 단위로 직접 래스터화한다 — clip 경계의 안티앨리어싱이 이음매(진한 · 밝은 빗금)를 만들어 합성 모드로는 못 고친다.
     목적지 픽셀마다 무게중심 좌표로 원본을 이중선형 샘플링해 «덮어쓴다». 경계는 EPS(0.5px)만큼 넓혀 이웃 삼각형이 같은 픽셀을 덮는다. */
  const _sc=document.createElement('canvas'); _sc.width=imgW; _sc.height=imgH;
  _sc.getContext('2d').drawImage(crState.stampImg,0,0);
  const srcD=_sc.getContext('2d').getImageData(0,0,imgW,imgH).data;
  const dstImg=ctx.createImageData(CANVAS_SZ,CANVAS_SZ), dstD=dstImg.data;
  function sampleSrc(u,v,o){
    let x=Math.min(imgW-1,Math.max(0,u-0.5)), y=Math.min(imgH-1,Math.max(0,v-0.5));
    const x0=Math.floor(x), y0=Math.floor(y);
    const x1=Math.min(imgW-1,x0+1), y1=Math.min(imgH-1,y0+1);
    const fx=x-x0, fy=y-y0;
    for(let k=0;k<4;k++){
      const p00=srcD[(y0*imgW+x0)*4+k], p10=srcD[(y0*imgW+x1)*4+k];
      const p01=srcD[(y1*imgW+x0)*4+k], p11=srcD[(y1*imgW+x1)*4+k];
      dstD[o+k] = (p00*(1-fx)+p10*fx)*(1-fy) + (p01*(1-fx)+p11*fx)*fy;
    }
  }
  function drawTri(s0,s1,s2,d0,d1,d2){
    if(_uvFar(d0,d1)||_uvFar(d1,d2)||_uvFar(d0,d2)) return;   // UV 점프 셀(이음새/옆면 랩) = 안 찍음
    const ax=d0.x*CANVAS_SZ, ay=d0.y*CANVAS_SZ, bx=d1.x*CANVAS_SZ, by=d1.y*CANVAS_SZ;
    const cx2=d2.x*CANVAS_SZ, cy2=d2.y*CANVAS_SZ;
    const area=(bx-ax)*(cy2-ay)-(cx2-ax)*(by-ay);
    if(Math.abs(area)<1e-6) return;
    const inv=1/area, EPS=0.5/Math.max(1e-6,Math.sqrt(Math.abs(area)));
    const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx2)-1)), x1=Math.min(CANVAS_SZ-1,Math.ceil(Math.max(ax,bx,cx2)+1));
    const y0=Math.max(0,Math.floor(Math.min(ay,by,cy2)-1)), y1=Math.min(CANVAS_SZ-1,Math.ceil(Math.max(ay,by,cy2)+1));
    for(let y=y0;y<=y1;y++){
      const py=y+0.5;
      for(let x=x0;x<=x1;x++){
        const px=x+0.5;
        const w1=((px-ax)*(cy2-ay)-(cx2-ax)*(py-ay))*inv;
        const w2=((bx-ax)*(py-ay)-(px-ax)*(by-ay))*inv;
        const w0=1-w1-w2;
        if(w0<-EPS||w1<-EPS||w2<-EPS) continue;
        sampleSrc(w0*s0.x+w1*s1.x+w2*s2.x, w0*s0.y+w1*s1.y+w2*s2.y, (y*CANVAS_SZ+x)*4);
      }
    }
  }
  for(let j=0;j<N;j++){
    for(let i=0;i<N;i++){
      const a=uvs[j*(N+1)+i], b=uvs[j*(N+1)+(i+1)], c=uvs[(j+1)*(N+1)+i], d=uvs[(j+1)*(N+1)+(i+1)];
      // 셀의 4 src 점(이미지 좌표)
      const su0={x:(i/N)*imgW,    y:(j/N)*imgH};
      const su1={x:((i+1)/N)*imgW,y:(j/N)*imgH};
      const su2={x:(i/N)*imgW,    y:((j+1)/N)*imgH};
      const su3={x:((i+1)/N)*imgW,y:((j+1)/N)*imgH};
      if(a&&b&&c) drawTri(su0,su1,su2,a,b,c);
      if(b&&c&&d) drawTri(su1,su2,su3,b,c,d);
    }
  }
  // 대칭: 미리보기에서 cx를 중심선 기준으로 거울 반사한 위치에 동일 동작
  // ★ 단, 도장이 중앙 부근이면 미러본이 원본과 겹쳐 "반전 이중상"이 되므로 생략 —
  //   감은눈처럼 얼굴 전체를 덮는 이미지를 중앙에 찍는 경우가 여기 해당.
  //   한쪽으로 치우친 도장(볼터치 등)은 기존대로 반대쪽에 짝으로 찍힘.
  if(crState.symmetry && Math.abs(crState.stampPlace.cx - r.width/2) >= crState.stampPlace.w*0.5){
    const savedCx=crState.stampPlace.cx, savedRot=crState.stampPlace.rot;
    crState.stampPlace.cx = r.width - savedCx;
    crState.stampPlace.rot = -savedRot;
    // 거울 도장: 이미지를 좌우 반전한 뒤 같은 방식으로
    const off=document.createElement('canvas'); off.width=imgW; off.height=imgH;
    const octx=off.getContext('2d'); octx.translate(imgW,0); octx.scale(-1,1); octx.drawImage(crState.stampImg,0,0);
    const savedImg=crState.stampImg; crState.stampImg=off;
    // 격자 raycast 다시
    const uvs2=[], _wrapRays2=[];
    const cs2=Math.cos(crState.stampPlace.rot), sn2=Math.sin(crState.stampPlace.rot);
    for(let j=0;j<=N;j++){ for(let i=0;i<=N;i++){
      const lx=(i/N-0.5)*crState.stampPlace.w, ly=(j/N-0.5)*crState.stampPlace.h;
      const sx=crState.stampPlace.cx+lx*cs2-ly*sn2, sy=crState.stampPlace.cy+lx*sn2+ly*cs2;
      paintStrokeMod._pndc.x=(sx/r.width)*2-1; paintStrokeMod._pndc.y=-(sy/r.height)*2+1;
      paintStrokeMod._pray.setFromCamera(paintStrokeMod._pndc,crState.cCam);
      const _h2=_stampFaceHit();
      uvs2.push(_h2);   // 원본 도장과 같은 판정(앞면 · 3D 위치 포함)
      if(!_h2) _wrapRays2[uvs2.length-1]={o:paintStrokeMod._pray.ray.origin.clone(), d:paintStrokeMod._pray.ray.direction.clone()};
    }}
    partPaintMod._stampWrapFill(uvs2, N, _wrapRays2, [crState.cBase.face], _wrapCtr);   // 거울 도장도 같이 감는다
    extrapolateUVs(uvs2, N);
    for(let j=0;j<N;j++){ for(let i=0;i<N;i++){
      const a=uvs2[j*(N+1)+i], b=uvs2[j*(N+1)+(i+1)], c=uvs2[(j+1)*(N+1)+i], d=uvs2[(j+1)*(N+1)+(i+1)];
      const su0={x:(i/N)*imgW,y:(j/N)*imgH}, su1={x:((i+1)/N)*imgW,y:(j/N)*imgH};
      const su2={x:(i/N)*imgW,y:((j+1)/N)*imgH}, su3={x:((i+1)/N)*imgW,y:((j+1)/N)*imgH};
      if(a&&b&&c) drawTri(su0,su1,su2,a,b,c);
      if(b&&c&&d) drawTri(su1,su2,su3,b,c,d);
    }}
    crState.stampImg=savedImg; crState.stampPlace.cx=savedCx; crState.stampPlace.rot=savedRot;
  }
  // ★ 조립 끝 — 얼굴 캔버스에 source-over로 딱 한 번 얹는다. 여기서만 알파가 합성되므로
  //   반투명 PNG도 원본 그대로의 농도로 찍힌다.
  ctx.putImageData(dstImg,0,0);        // 래스터 결과 → 오프스크린
  dstCtx.save();
  dstCtx.globalCompositeOperation='source-over';
  dstCtx.imageSmoothingEnabled=true;
  dstCtx.drawImage(stampOff,0,0);      // 얼굴 캔버스에 딱 한 번 합성 (여기서만 알파 합성)
  dstCtx.restore();
  if(crState.crStep===3)crState.blinkEdited=true;
  blit();
  // 모드·이미지·위치 모두 유지 → 같은 이미지로 다른 위치에 연속 찍기 가능. 종료는 ESC/✕/다른 도구 선택/단계 이동으로.
}
function cancelStamp(){ setStampMode(false); }

/* 오버레이 조작: 이미지 본체 드래그=이동, 코너=비례 크기, 회전 손잡이=회전 */
function bindStampOverlay(){
  const ov=document.getElementById('stampOverlay');
  const img=document.getElementById('stampOverlayImg');
  const cv=document.getElementById('creatorPreview');
  if(!ov||!img||!cv) return;   // 입구 전제 — 띄운 그림 · 미리보기 캔버스가 없으면 손잡이를 달지 않는다
  let drag=null;   // {type:'move'|'tl'|'tr'|'bl'|'br'|'rot', startX,startY, ...}
  function pos(e){const r=cv.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  img.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
    const p=pos(e); drag={type:'move',sx:p.x,sy:p.y,ox:crState.stampPlace.cx,oy:crState.stampPlace.cy};
    img.setPointerCapture(e.pointerId);
  });
  ['tl','tr','bl','br'].forEach(corner=>{
    const h=ov.querySelector('.stamp-h-'+corner);
    h.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
      const p=pos(e);
      // 대각 반대편 코너를 고정점으로 잡음. 회전을 고려해 *로컬* 좌표에서 계산
      // sx = corner의 로컬 x 부호 (-0.5 = 왼쪽 코너, +0.5 = 오른쪽), sy도 같은 식
      const sx=(corner==='tl'||corner==='bl')?-0.5:0.5;
      const sy=(corner==='tl'||corner==='tr')?-0.5:0.5;
      // 화면(부모) 좌표계에서 고정점(대각 반대편 코너)의 위치를 계산
      const cs=Math.cos(crState.stampPlace.rot), sn=Math.sin(crState.stampPlace.rot);
      const fxL=-sx*crState.stampPlace.w, fyL=-sy*crState.stampPlace.h;   // 고정점의 로컬 좌표
      const fixedX=crState.stampPlace.cx + fxL*cs - fyL*sn;
      const fixedY=crState.stampPlace.cy + fxL*sn + fyL*cs;
      drag={type:corner, sx, sy, fixedX, fixedY, oAspect: crState.stampPlace.aspect||(crState.stampPlace.w/Math.max(1,crState.stampPlace.h))};
      h.setPointerCapture(e.pointerId);
    });
  });
  const rh=ov.querySelector('.stamp-h-rot');
  rh.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();
    const p=pos(e); const ang=Math.atan2(p.y-crState.stampPlace.cy,p.x-crState.stampPlace.cx);
    drag={type:'rot',startAng:ang,oRot:crState.stampPlace.rot};
    rh.setPointerCapture(e.pointerId);
  });
  // 회전 손잡이 옆 ↺: 크기/회전 디폴트로(위치 유지). stampDirty 해제하여 다음 이미지 로드 시에도 디폴트로 들어옴.
  const rs=ov.querySelector('.stamp-h-reset');
  if(rs){ rs.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();});
    rs.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();resetStampPlacement();}); }
  function onMove(e){ if(!drag)return; const p=pos(e);
    if(drag.type==='move'){
      crState.stampPlace.cx=drag.ox+(p.x-drag.sx); crState.stampPlace.cy=drag.oy+(p.y-drag.sy);
      // Shift = 캔버스 가로 중앙선으로 자동 스냅, y만 따라감
      if(e.shiftKey){ const cv=document.getElementById('creatorPreview'); crState.stampPlace.cx=cv.getBoundingClientRect().width/2; }
    }
    else if(drag.type==='rot'){ const ang=Math.atan2(p.y-crState.stampPlace.cy,p.x-crState.stampPlace.cx);
      let r=drag.oRot+(ang-drag.startAng);
      if(e.shiftKey){ const step=STAMP_ROT_SNAP_DEG*Math.PI/180; r=Math.round(r/step)*step; }   // 15도 스냅
      crState.stampPlace.rot=r;
      crState.stampDirty=true;
    }
    else { // 코너 자유변형: 대각 반대편 코너(fixedX/fixedY)를 고정점으로 잡고 마우스 위치가 새 코너
      // 마우스 위치를 *고정점 기준 로컬 좌표*로 변환(회전 역적용)해서 폭/높이 추출
      const cs=Math.cos(-crState.stampPlace.rot), sn=Math.sin(-crState.stampPlace.rot);
      const dx=p.x-drag.fixedX, dy=p.y-drag.fixedY;
      const localX=dx*cs - dy*sn;   // 고정점→마우스 방향의 로컬 x (드래그 코너의 부호와 같은 방향이어야 양수)
      const localY=dx*sn + dy*cs;
      // 드래그 코너의 부호(sx,sy = ±0.5). 반대편 부호로 곱해 폭/높이의 절댓값 추출
      let newW=Math.abs(localX), newH=Math.abs(localY);
      newW=Math.max(STAMP_MIN_PX,newW); newH=Math.max(STAMP_MIN_PX,newH);
      // Shift: 비례 고정 (큰 변화량 쪽 비율 따라 양 축 같이)
      if(e.shiftKey){
        const ar=drag.oAspect;
        // newW/newH 중 ar에서 더 멀어진 쪽을 우선 — 사용자 의도에 가까움
        if(newW/newH > ar) newH=newW/ar; else newW=newH*ar;
      }
      crState.stampPlace.w=newW; crState.stampPlace.h=newH;
      // 새 중심: 고정점에서 *드래그 코너 방향*으로 (w/2, h/2)만큼 떨어진 곳의 반대 = 고정점에서 중심까지 (sx*w, sy*h) 만큼 (로컬)에 회전 적용
      const cs2=Math.cos(crState.stampPlace.rot), sn2=Math.sin(crState.stampPlace.rot);
      const cxL=drag.sx*newW, cyL=drag.sy*newH;
      crState.stampPlace.cx=drag.fixedX + cxL*cs2 - cyL*sn2;
      crState.stampPlace.cy=drag.fixedY + cxL*sn2 + cyL*cs2;
      crState.stampDirty=true;
    }
    refreshStampOverlay();
  }
  function onUp(){ drag=null; }
  addEventListener('pointermove',onMove);
  addEventListener('pointerup',onUp);
  addEventListener('pointercancel',onUp);
}


return {
  bindStampOverlay,
  cancelStamp,
  clearStampState,
  commitStamp,
  loadStampFromFile,
  resetStampPlacement,
  setStampMode,
};
}

const api = { createCrStamp };
if(typeof window !== 'undefined') window.TwCrStamp = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
