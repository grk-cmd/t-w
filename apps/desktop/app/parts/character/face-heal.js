/* face-heal.js — 🛡️ 얼굴 자동 복구 — 얼굴이 사라지면 다시 붙이기
   app.js «🛡️ 얼굴 자동 복구 — 얼굴이 사라지면 다시 붙이기» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 1줄 —
     creatorOpen 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: FACE_WATCH_MS · repairBlankFaces · repairSeatTextures · reportGlReset — app.js 는 faceHealMod.이름 으로 부른다.
   ★ repairSeatTextures — 남의 좌석(사람) · 동물 좌석(내 것 포함)의 빈 그림을 이미 받아 둔 원본으로 같은 캔버스에 다시 그린다.
     repairBlankFaces 는 내 사람 칸(slots · 저장본)만 고친다 — 남의 좌석은 저장본이 없고 동물은 문자열 원본에서 텍스처를 만든다.
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
const diagNote = deps.diagNote;          // 진단 기록 — 설치본은 콘솔을 못 본다
const loadImgCors = deps.loadImgCors;    // 남의 그림(주소) 받기 — crossOrigin · 크기 0 거름(room-sync.js 와 같은 함수)
const FACE_WATCH_MS = 4000;        // 점검 주기. 비용은 좌석 수에 비례 — 알파 스캔이 내 칸마다 몇 장 · 남의 좌석마다 합성본 2장 · 동물 좌석은 몸 2장 + 귀마다 2장.
const FACE_TOAST_GAP_MS = 60000;   // 같은 안내를 도배하지 않는 최소 간격
let _faceRepairBusy = false, _faceRepairToldAt = 0;

/* 피부 캔버스도 비었을 수 있다(그래픽 리셋 때 같은 캔버스다). 비었으면 단색으로 바로 메우고 PNG 는 loadSkins 로 되받는다.
   ⚠️ 되받기를 기다린 뒤 돌아온다 — loadSkins 는 skinCanvases[i] 를 새 캔버스로 바꾸므로, 먼저 좌석을 다시 그리면 단색이 남는다. */
async function _repairSkinCanvases(){
  let bad = 0;
  for(let k=0;k<skinCanvases.length;k++){
    if(!_isBlankDraw(skinCanvases[k])) continue;
    bad++;
    try{ const x=skinCanvases[k].getContext('2d'); x.fillStyle=SKIN_COLORS[k]||SKIN_COLORS[0]; x.fillRect(0,0,CANVAS_SZ,CANVAS_SZ); }catch(_){}
  }
  if(bad){ console.warn('[얼굴복구] 피부 캔버스 '+bad+'장도 비어 있었습니다 — 단색으로 메우고 텍스처를 다시 불러옵니다');
    try{ await loadSkins(); }catch(_){} }
  return bad;
}
/* 빈 피부 캔버스 번호 — 합성본은 그림(눈 · 입 선)이 남아 «전부 투명» 이 아니라서 _seatCompositeBlank 가 못 잡는다 */
function _blankSkinIdx(){
  const out = new Set();
  for(let k=0;k<skinCanvases.length;k++) if(_isBlankDraw(skinCanvases[k])) out.add(k);
  return out;
}
const _skinIdxOf = (d) => skinCanvases[d.skin||0] ? (d.skin||0) : 0;   // skinCanvasFor 와 같은 물러남

/* 저장된 dataURL 을 **같은 캔버스 객체 안에** 다시 그린다.
   ★ 새 캔버스를 만들어 갈아 끼우면 안 된다 — slots[i].face 는 좌석 charDef·방 전송기가
     같은 객체로 붙들고 있다. 객체를 바꾸면 그쪽 참조가 옛 빈 캔버스에 남는다. */
async function _redrawInto(cv, dataUrl, load){
  try{
    if(!cv || typeof cv.getContext!=='function' || typeof dataUrl!=='string') return false;
    const img = await (load || loadImg)(dataUrl);
    const x = cv.getContext('2d');
    x.clearRect(0,0,cv.width||CANVAS_SZ,cv.height||CANVAS_SZ);   // 남의 얼굴 캔버스는 그림 원래 크기다(room-sync _roomFaceUrlToCanvas)
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
  seats.forEach(s=>{
    if(!s || s.remote || s.charDef !== def) return;
    n += _refreshFaceTexOf(s, def);
  });
  return n;
}
/* 좌석 하나의 합성 텍스처 두 장(표정 · 감은눈)을 다시 합성한다 — 내 칸 · 남의 좌석 공용 */
function _refreshFaceTexOf(s, def){
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
  one(s.faceMapOrig, def.face);
  one(s.blinkTex,    def.blink);
  return n;
}

/* 합성 텍스처만 따로 날아간 경우도 있다(def.face 는 멀쩡한데 화면만 빈다).
   합성본에는 피부가 깔려 있어 정상이면 절대 투명하지 않다 — 투명하면 그 자체가 증거다. */
function _seatCompositeBlank(def){
  return seats.some(s=> s && !s.remote && s.charDef===def && _compBlankOf(s));
}
const _compBlankOf = (s)=> (s.faceMapOrig && _isBlankDraw(s.faceMapOrig.image))
                        || (s.blinkTex    && _isBlankDraw(s.blinkTex.image));

/* ── 남의 좌석 · 동물 좌석 ─────────────────────────────────────────────
   ★ 판정은 위와 같은 «합성 텍스처가 투명» 하나다 — 피부가 깔린 합성본 · 흰 바탕을 먼저 칠하는 동물 텍스처는
     정상이면 절대 투명하지 않으니 투명하면 그 자체가 그래픽 리셋의 증거다(얼굴을 안 그린 친구도 거짓으로 잡히지 않는다).
   ★ 새로 받지 않는다 — 다시 그리는 원본은 방 동기화가 남긴 주소(faceUrl · blinkUrl)와 동물 텍스처가 기억한 원본(userData.twSrc)뿐.
     이미 한 번 받은 그림이라 캐시에서 온다. 원본이 없으면 기록만 한다(«재료 없음»). */
let _seatRepairBusy = false;
/* 동물 좌석의 텍스처 전부 — 몸(표정 · 감은눈) + 귀(animal.js 가 몸 재질에 단 등록표) */
function _animalTexOf(s){
  const out = [s.faceMapOrig, s.blinkTex];
  const ears = s.faceMat && s.faceMat.userData && s.faceMat.userData.animalEars;
  (ears || []).forEach(e=>{ if(e){ out.push(e.fT, e.bT); } });
  return out.filter((t, i, a)=> t && t.image && a.indexOf(t) === i);
}
/* 동물 텍스처 하나를 처음 만들던 그대로(바탕색 → 원본) 다시 그린다. 그렸으면 true · 원본이 없으면 'none' */
async function _redrawAnimalTex(tex){
  const cv = tex.image, u = tex.userData || {};
  if(!cv || !cv.getContext) return false;
  const x = cv.getContext('2d');
  x.fillStyle = u.twFill || '#ffffff'; x.fillRect(0,0,cv.width,cv.height);
  tex.needsUpdate = true;
  if(!u.twSrc) return 'none';
  try{ const img = await loadImgCors(u.twSrc); x.drawImage(img,0,0,cv.width,cv.height); tex.needsUpdate = true; return true; }
  catch(_){ return false; }
}
/* 빈 그림이 있는 좌석 — 남의 사람 좌석(합성 텍스처) · 동물 좌석(내 것 포함) */
function _blankSeats(){
  const out = [];
  seats.forEach(s=>{
    const d = s && s.charDef;
    if(!d) return;
    if(d.animal){ const bad = _animalTexOf(s).filter(t=>_isBlankDraw(t.image)); if(bad.length) out.push({ s, d, animal:true, bad }); }
    else if(s.remote && _compBlankOf(s)) out.push({ s, d, animal:false });
  });
  return out;
}
async function repairSeatTextures(){
  if(_seatRepairBusy) return 0;
  if(_faceRepairBusy) return 0;   // 내 칸 복구가 피부를 단색으로 칠하고 PNG 를 기다리는 중 — 지금 합성하면 단색 피부로 굳는다(_repairSkinCanvases 주석)
  if(_blankSkinIdx().size) return 0;   // 피부부터 — repairBlankFaces 가 먼저 메운다(합성 재료가 비면 피부 없는 얼굴이 굳는다)
  const targets = _blankSeats();
  if(!targets.length) return 0;
  _seatRepairBusy = true;
  let fixed = 0;
  const log = [];
  try{
    for(const t of targets){
      const no = seats.indexOf(t.s) + 1, what = [];
      if(t.animal){
        let any = false;
        for(const tex of t.bad){ const r = await _redrawAnimalTex(tex); if(r) any = true; what.push(r === true ? '그림' : r === 'none' ? '바탕만' : '그림✗'); }
        if(any) fixed++;
      } else {
        const d = t.d;
        const fu = TwSafeHtml.safeUrl(d.faceUrl,'image'), bu = TwSafeHtml.safeUrl(d.blinkUrl,'image');   // 남이 보낸 주소 — 허용된 그림 주소만
        if(_isBlankDraw(d.face)  && fu) what.push(await _redrawInto(d.face,  fu, loadImgCors) ? '얼굴' : '얼굴✗');
        if(_isBlankDraw(d.blink) && bu) what.push(await _redrawInto(d.blink, bu, loadImgCors) ? '감은눈' : '감은눈✗');
        if(!what.length && _isBlankDraw(d.face)) what.push('재료 없음');
        /* 받는 사이에 피부가 비었을 수 있다 — 지금 합성하면 단색 피부로 굳는다. 합성본은 투명하게 두어 다음 차례에 다시 잡히게 한다 */
        if(_faceRepairBusy || _blankSkinIdx().size){ what.push('합성 다음 차례'); log.push(no + '번(남 ' + what.join('·') + ')'); continue; }
        if(_refreshFaceTexOf(t.s, d)) fixed++;
        what.push('화면텍스처');
      }
      log.push(no + '번(' + (t.s.remote ? '남' : '나') + (t.animal ? '·동물' : '') + ' ' + what.join('·') + ')');
    }
  }catch(e){ console.warn('[얼굴복구] 좌석 텍스처 복구 중 오류', e); }
  finally{ _seatRepairBusy = false; }
  const line = '[얼굴복구] 빈 좌석 그림을 다시 그림 — ' + log.join(' · ');
  console.warn(line);
  try{ diagNote(line); }catch(_){}
  return fixed;
}
/* 🧯 그래픽 연결이 돌아온 직후 — 좌석 그림이 얼마나 비었는지 한 줄 남기고 바로 고친다(다음 4초 점검을 기다리지 않음) */
function reportGlReset(){
  const remote = seats.filter(s=>s && s.remote).length;
  const blank = _blankSeats();
  const face = blank.filter(t=>!t.animal).length, animal = blank.filter(t=>t.animal).length;
  const line = '[WebGL] 복구 뒤 좌석 점검 — 좌석 ' + seats.length + ' · 남의 좌석 ' + remote
    + ' · 빈 얼굴(남) ' + face + ' · 빈 동물 그림 ' + animal + ' · 빈 피부 ' + _blankSkinIdx().size;
  try{ diagNote(line); }catch(_){}
  if(blank.length) repairSeatTextures();
  return line;
}

async function repairBlankFaces(){
  if(_faceRepairBusy) return 0;
  try{ if(creatorOpen()) return 0; }catch(_){ return 0; }
  const skinBad = _blankSkinIdx();
  const targets = [];
  for(let i=0;i<CHAR_SLOT_MAX;i++){
    const d = slots[i];
    if(!d || d.animal || d._imgBroken) continue;
    const skinGone  = skinBad.has(_skinIdxOf(d));
    if(!skinGone && !_faceEverDrawn[i] && !_blinkEverDrawn[i]) continue;
    const faceGone  = _faceEverDrawn[i]  && _isBlankDraw(d.face);
    const blinkGone = _blinkEverDrawn[i] && _isBlankDraw(d.blink);
    const compGone  = _seatCompositeBlank(d);
    if(faceGone || blinkGone || compGone || skinGone) targets.push({i,d,faceGone,blinkGone,compGone,skinGone});
  }
  if(!targets.length){
    if(skinBad.size){ _faceRepairBusy = true; try{ await _repairSkinCanvases(); }finally{ _faceRepairBusy = false; } }   // 쓰는 칸이 없어도 다음에 고를 때 투명하지 않게
    return 0;
  }

  _faceRepairBusy = true;
  let fixed = 0;
  const log = [];
  try{
    await _repairSkinCanvases();
    let prev = null;
    try{ prev = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }catch(_){ prev = null; }
    for(const t of targets){
      const p = (prev && prev[t.i]) ? prev[t.i] : null;
      const what = [];
      if(t.faceGone){  if(await _redrawInto(t.d.face,  p && p.face))  what.push('얼굴');  else what.push('얼굴✗'); }
      if(t.blinkGone){ if(await _redrawInto(t.d.blink, p && p.blink)) what.push('감은눈'); else what.push('감은눈✗'); }
      if(t.skinGone) what.push('피부');
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
  repairSeatTextures,
  reportGlReset,
};
}

const api = { createFaceHeal };
if(typeof window !== 'undefined') window.TwFaceHeal = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
