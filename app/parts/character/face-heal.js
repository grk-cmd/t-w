/* face-heal.js — 🛡️ 얼굴 자동 복구 — 얼굴이 사라지면 다시 붙이기
   app.js «🛡️ 얼굴 자동 복구 — 얼굴이 사라지면 다시 붙이기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     creatorOpen 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: FACE_WATCH_MS · repairBlankFaces — app.js 는 faceHealMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwFaceHeal — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-face-heal.js */
(function(){

function createFaceHeal(deps){
const CANVAS_SZ = deps.CANVAS_SZ;
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const LS_KEY = deps.LS_KEY;
const Presence = deps.Presence;
const SKIN_COLORS = deps.SKIN_COLORS;
const _blinkEverDrawn = deps._blinkEverDrawn;
const _faceEverDrawn = deps._faceEverDrawn;
const _isBlankDraw = deps._isBlankDraw;
const creatorOpen = deps.creatorOpen;   // 읽는 함수
const loadImg = deps.loadImg;
const loadSkins = deps.loadSkins;
const seats = deps.seats;
const skinCanvasFor = deps.skinCanvasFor;
const skinCanvases = deps.skinCanvases;
const slots = deps.slots;
const toast = deps.toast;
const FACE_WATCH_MS = 4000;        // 점검 주기. 32² 알파 스캔 몇 번이라 비용은 무시할 수준이다.
const FACE_TOAST_GAP_MS = 60000;   // 같은 안내를 도배하지 않는 최소 간격
let _faceRepairBusy = false, _faceRepairToldAt = 0;

/* 피부 캔버스도 같은 이유로 비었을 수 있다(똑같은 캔버스다).
   비었으면 우선 단색으로 즉시 메우고(합성이 투명해지는 것부터 막는다), PNG 는 loadSkins 로 되받는다. */
function _repairSkinCanvases(){
  let bad = 0;
  for(let k=0;k<skinCanvases.length;k++){
    if(!_isBlankDraw(skinCanvases[k])) continue;
    bad++;
    try{ const x=skinCanvases[k].getContext('2d'); x.fillStyle=SKIN_COLORS[k]||SKIN_COLORS[0]; x.fillRect(0,0,CANVAS_SZ,CANVAS_SZ); }catch(_){}
  }
  if(bad){ console.warn('[얼굴복구] 피부 캔버스 '+bad+'장도 비어 있었습니다 — 단색으로 메우고 텍스처를 다시 불러옵니다');
    try{ loadSkins(); }catch(_){} }
  return bad;
}

/* 저장된 dataURL 을 **같은 캔버스 객체 안에** 다시 그린다.
   ★ 새 캔버스를 만들어 갈아 끼우면 안 된다 — slots[i].face 는 좌석 charDef·방 전송기가
     같은 객체로 붙들고 있다. 객체를 바꾸면 그쪽 참조가 옛 빈 캔버스에 남는다. */
async function _redrawInto(cv, dataUrl){
  try{
    if(!cv || typeof cv.getContext!=='function' || typeof dataUrl!=='string') return false;
    const img = await loadImg(dataUrl);
    const x = cv.getContext('2d');
    x.clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
    x.drawImage(img,0,0);
    return !_isBlankDraw(cv);
  }catch(_){ return false; }
}

/* 좌석의 «합성 텍스처»를 제자리에서 다시 그린다.
   ★ 화면에 보이는 것은 def.face 가 아니라 compositeFace(피부+그림) 결과다. def.face 만
     되살리면 데이터만 낫고 화면은 그대로 비어 있다 — 여기까지 해야 눈에 돌아온다.
   ★ 텍스처를 새로 만들지 않고 tex.image 에 덧그린 뒤 needsUpdate 만 세운다.
     mkFaceTex 로 새로 만들면 눈 깜빡임이 붙들고 있는 faceMapOrig/blinkTex 참조와 어긋난다. */
function _refreshSeatFaceTex(def){
  let n = 0;
  const one = (tex, drawCv)=>{
    const cv = tex && tex.image;
    if(!cv || typeof cv.getContext!=='function') return;
    const x = cv.getContext('2d');
    x.clearRect(0,0,CANVAS_SZ,CANVAS_SZ);
    x.drawImage(skinCanvasFor(def.skin||0),0,0);
    try{ x.drawImage(drawCv,0,0); }catch(_){}
    tex.needsUpdate = true; n++;
  };
  seats.forEach(s=>{
    if(!s || s.remote || s.charDef !== def) return;
    one(s.faceMapOrig, def.face);
    one(s.blinkTex,    def.blink);
  });
  return n;
}

/* 합성 텍스처만 따로 날아간 경우도 있다(def.face 는 멀쩡한데 화면만 빈다).
   합성본에는 피부가 깔려 있어 정상이면 절대 투명하지 않다 — 투명하면 그 자체가 증거다. */
function _seatCompositeBlank(def){
  return seats.some(s=> s && !s.remote && s.charDef===def
    && ((s.faceMapOrig && _isBlankDraw(s.faceMapOrig.image))
     || (s.blinkTex    && _isBlankDraw(s.blinkTex.image))));
}

async function repairBlankFaces(){
  if(_faceRepairBusy) return 0;
  try{ if(creatorOpen()) return 0; }catch(_){ return 0; }
  const targets = [];
  for(let i=0;i<CHAR_SLOT_MAX;i++){
    const d = slots[i];
    if(!d || d.animal || d._imgBroken) continue;
    if(!_faceEverDrawn[i] && !_blinkEverDrawn[i]) continue;
    const faceGone  = _faceEverDrawn[i]  && _isBlankDraw(d.face);
    const blinkGone = _blinkEverDrawn[i] && _isBlankDraw(d.blink);
    const compGone  = _seatCompositeBlank(d);
    if(faceGone || blinkGone || compGone) targets.push({i,d,faceGone,blinkGone,compGone});
  }
  if(!targets.length) return 0;

  _faceRepairBusy = true;
  let fixed = 0;
  const log = [];
  try{
    _repairSkinCanvases();
    let prev = null;
    try{ prev = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch(_){ prev = null; }
    for(const t of targets){
      const p = (prev && prev[t.i]) ? prev[t.i] : null;
      const what = [];
      if(t.faceGone){  if(await _redrawInto(t.d.face,  p && p.face))  what.push('얼굴');  else what.push('얼굴✗'); }
      if(t.blinkGone){ if(await _redrawInto(t.d.blink, p && p.blink)) what.push('감은눈'); else what.push('감은눈✗'); }
      if(t.compGone && !what.length) what.push('화면텍스처');
      if(_refreshSeatFaceTex(t.d)) fixed++;
      log.push((t.i+1)+'번('+what.join('·')+')');
    }
  }catch(e){ console.warn('[얼굴복구] 복구 중 오류', e); }
  finally{ _faceRepairBusy = false; }

  /* 원인 추적용 정황을 함께 남긴다 — 이 사안은 «언제·무엇과 함께» 가 전부다.
     실행 시간과 (있으면) 메모리 사용량이 «오래 켜둠 + 메모리 압박» 가설을 확인하거나 뒤집는다. */
  let ctx = '';
  try{
    const upMin = Math.round(performance.now()/60000);
    const m = performance.memory;
    ctx = ' | 실행 '+upMin+'분'
      + (m ? ' | JS힙 '+(m.usedJSHeapSize/1048576).toFixed(0)+'/'+(m.jsHeapSizeLimit/1048576).toFixed(0)+'MB' : '')
      + ' | 방 '+((typeof Presence!=='undefined' && Presence.active()) ? '입장중' : '아님');
  }catch(_){}
  console.warn('[얼굴복구] 🛡️ 빈 얼굴을 발견해 저장본으로 되돌렸습니다 — '+log.join(' · ')+ctx);

  const now = Date.now();
  if(fixed && now - _faceRepairToldAt > FACE_TOAST_GAP_MS){
    _faceRepairToldAt = now;
    try{ toast('얼굴이 잠깐 사라져서 되돌렸어요 — 저장된 그림 그대로예요'); }catch(_){}
  }
  return fixed;
}

return {
  FACE_WATCH_MS,
  repairBlankFaces,
};
}

const api = { createFaceHeal };
if(typeof window !== 'undefined') window.TwFaceHeal = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
