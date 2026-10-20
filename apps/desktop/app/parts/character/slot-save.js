/* slot-save.js — 💾 슬롯 저장 · 복원(localStorage)
   app.js «💾 슬롯 저장 · 복원(localStorage)» 구역 본문을 그대로 옮긴 모듈이다(앱 FSD 43번 — docs/APP_FSD_MAP.md).
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 4줄 —
     _blankFaceConfirmed 를 이름() 으로 읽는다(app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setBlankFaceConfirmed(…).
   ★ 저장 · 복원 뒤 할 일은 위층(동기화 · 보관함 · 꾸미기 · 프리미엄 · 설정 화면)을 직접 부르지 않고 알림으로 내보낸다(모듈 순환 끊기 3) —
     onSaved(fn(out, changed)) · onLoaded(fn) · onSeatRelinked(fn(old, cur)) · onSlotsReplaced(fn) 에 위층이 건다. 거는 차례대로 부른다.
     slotsReplaced() 는 동기화 · 보관함이 서버 것으로 칸을 갈아 끼운 뒤 부른다(캐릭터 탭 다시 그리기).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: LS_KEY · _relinkSeatsToSlots · loadSlots · onLoaded · onSaved · onSeatRelinked · onSlotsReplaced · saveSlots · slotToObj · slotsReplaced — app.js 는 slotSaveMod.이름 으로 부른다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwSlotSave — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-slot-save.js */
(function(){

function createSlotSave(deps){
const CHAR_SLOT_MAX = deps.CHAR_SLOT_MAX;
const _blankFaceConfirmed = deps._blankFaceConfirmed;   // 읽는 함수
const _blinkEverDrawn = deps._blinkEverDrawn;
const _faceEverDrawn = deps._faceEverDrawn;
const _isBlankDraw = deps._isBlankDraw;
const charDef = deps.charDef;
const loadImg = deps.loadImg;
const newCanvas = deps.newCanvas;
const seats = deps.seats;
const slots = deps.slots;
const toast = deps.toast;
const setBlankFaceConfirmed = deps.setBlankFaceConfirmed;   // 쓰는 함수
const _savedFns = [], _loadedFns = [], _relinkFns = [], _replacedFns = [];
function onSaved(fn){ _savedFns.push(fn); }
function onLoaded(fn){ _loadedFns.push(fn); }
function onSeatRelinked(fn){ _relinkFns.push(fn); }
function onSlotsReplaced(fn){ _replacedFns.push(fn); }
function slotsReplaced(){ _replacedFns.forEach(fn=>{ try{ fn(); }catch(_){} }); }
/* --- 저장/복원 (localStorage). 로컬 실행·Electron에선 동작, 챗 미리보기 샌드박스에선 무시됨 --- */
const LS_KEY='deskFriends.slots.v1';
/* 캔버스 → dataURL. 이미 dataURL 문자열이면 그대로 통과시킨다(네트워크에서 온 def 등).
   둘 다 아니면 던진다 — saveSlots 가 그 칸을 '직전 저장값 유지'로 처리한다. */
function _slotImgToDataUrl(c, what){
  if(c && typeof c.toDataURL==='function') return c.toDataURL('image/png');
  if(typeof c==='string' && c.startsWith('data:')) return c;
  throw new Error(what+'이(가) 캔버스가 아님: '+Object.prototype.toString.call(c));
}
function slotToObj(d){return d?{skin:d.skin||0,top:d.top,bot:d.bot,xf:d.xf||null,decor:d.decor||null,deskColor:d.deskColor||null,deskItems:d.deskItems||null,deskGlb:d.deskGlb||null,deskCatalogId:d.deskCatalogId||null,deskScale:d.deskScale||null,deskLenX:d.deskLenX||null,deskPos:d.deskPos||null,customItems:d.customItems||null,isCommission:d.isCommission||false,commName:d.commName||null,commGlb:d.commGlb||null,equippedParts:d.equippedParts||null,partXfMemory:d.partXfMemory||null,thumb:d.thumb||null,...(d.thumbUrl?{thumbUrl:d.thumbUrl}:{}),face:_slotImgToDataUrl(d.face,'얼굴'),blink:_slotImgToDataUrl(d.blink,'감은눈'),
  // 🐾 동물 캐릭터 확장 필드 — 구버전은 이 키들을 무시하고 기본 인간으로 폴백
  animal:d.animal||false,animalFace:d.animalFace||0,animalScl:d.animalScl||null,animalEarL:d.animalEarL||null,animalEarR:d.animalEarR||null,animalEarAdj:d.animalEarAdj||null,animalBody:d.animalBody||null,animalEarPaintL:d.animalEarPaintL||null,animalEarPaintR:d.animalEarPaintR||null,animalEarBlinkL:d.animalEarBlinkL||null,animalEarBlinkR:d.animalEarBlinkR||null,animalBlink:d.animalBlink||null,
  // 👂 사람 귀(꾸미기 › 머리 › 귀 — wd-ear.js) — 이 다섯 칸이 빠져 있어서 귀를 고르고 껐다 켜면 사라졌다(제보). loadSlots 와 1:1
  //   ⚠️ thumbUrl 처럼 **있을 때만** 싣는다 — 늘 실으면 귀가 없는 옛 칸까지 첫 저장이 «달라짐» 이 되어 slots ts 가 일제히 오른다
  ...(d.earL?{earL:d.earL}:{}),...(d.earR?{earR:d.earR}:{}),...(d.earAdj?{earAdj:d.earAdj}:{}),
  ...(typeof d.earPicL==='string'&&d.earPicL?{earPicL:d.earPicL}:{}),...(typeof d.earPicR==='string'&&d.earPicR?{earPicR:d.earPicR}:{})}:null;}
/* 🔗 서버에서 받아 slots[] 를 새 객체로 갈아 끼운 뒤 — 책상 위 내 좌석의 charDef 를 같은 칸의 새 객체로 다시 잇는다.
   [왜] 좌석은 옛 객체를 쥔 채 남아, 그 뒤 꾸미기 · 가챠 착용 · 크기 조정이 slots[] 밖의 객체에 저장됐다
     → saveSlots 가 «안 바뀜» 으로 보고 넘어가 재부팅하면 초기화(제보). 화면 모델은 그대로 두고(받은 모습은 다음 실행부터 — 토스트 문구) 저장 대상만 맞춘다.
   oldSlots: 갈아 끼우기 전 slots 사본 · skip: 다른 캐릭터가 됐거나 비워진 칸(그 칸은 잇지 않는다) */
function _relinkSeatsToSlots(oldSlots, skip){
  try{
    seats.forEach(s=>{
      if(!s || s.remote || s.slot==null || (skip && skip.has(s.slot))) return;
      const old = oldSlots[s.slot], cur = slots[s.slot];
      if(!cur || s.charDef !== old || old === cur) return;
      s.charDef = cur;
      _relinkFns.forEach(fn=>fn(old, cur));   // 열린 꾸미기 초안도 새 객체로 저장되게
    });
  }catch(e){ console.warn('[슬롯] 좌석 다시 잇기 실패', e); }
}
/* ⚠️ 예전엔 `slots.map(slotToObj)` 를 통째로 try 하나에 넣고 catch 를 비워 뒀다.
     slotToObj 는 `d.face.toDataURL(...)` 를 가드 없이 부르므로, face 가 캔버스가 아닌 슬롯이
     **하나만** 있어도 map 이 그 자리에서 던지고 **세 칸 전부**가 저장되지 않는다. 그것도 조용히 —
     이 빈 catch 때문에 "작업한 게 껐다 켜면 없다"가 아무 흔적도 안 남겼다.
   그래서 (ㄱ) 칸마다 따로 감싸고 (ㄴ) 실패한 칸은 **직전 저장값을 그대로 살려 두고**
     (ㄷ) 콘솔에 남긴다. 실패한 칸을 null 로 적으면 loadSlots 의 loadImg 가 실패해
     그 캐릭터가 통째로 사라지므로, null 로 덮는 것은 절대 안 된다. */
function saveSlots(){
  let prev = null, prevRaw = null;
  try{ prevRaw = localStorage.getItem(LS_KEY); prev = JSON.parse(prevRaw || 'null'); }catch(_){ prev = null; }
  /* 🛡️ «비운 채 저장» 허가는 **이번 한 번만** 유효하다 — 여기서 바로 소비한다.
     남겨 두면 그 뒤에 우연히 도는 자동 저장(가챠 정리·책상 아이템 등)까지 함께 통과해 버린다. */
  const _allowBlank = _blankFaceConfirmed(); setBlankFaceConfirmed(false);
  const _rescued = [];
  const out = slots.map((d, i)=>{
    /* 🖼️ 부팅 때 이미지 복원에 실패한 칸은 **저장에서 통째로 제외**하고 직전 저장값을 그대로 남긴다.
       여기서 그냥 저장하면 빈 캔버스가 dataURL 로 굳어 localStorage 의 멀쩡한 원본까지
       덮어써진다 — 그게 "껐다 켜도 얼굴이 지워진 채 피부색만" 의 정체다.
       (원인이 일시적이었다면 다음 부팅에서 저절로 정상 복원된다) */
    if(d && d._imgBroken && prev && prev[i] !== undefined){
      console.warn('[슬롯] '+(i+1)+'번 — 이미지 복원 실패 칸이라 저장을 건너뜁니다(원본 보존)');
      return prev[i];
    }
    let o;
    try{ o = slotToObj(d); }
    catch(e){
      console.warn('[슬롯] '+(i+1)+'번 직렬화 실패 — 직전 저장값을 유지합니다', e);
      return (prev && prev[i] !== undefined) ? prev[i] : null;
    }
    /* 🛡️ [런타임 공백 방어] 그림이 있던 칸에 **빈 그림**이 저장되려 하면 그 필드만 직전 저장값으로 되돌린다.
       칸을 통과로 되돌리지 않는 이유 — 파츠·책상·크기 같은 나머지 변경은 정상이므로 그대로 저장돼야 한다.
       _imgBroken(부팅 실패)은 위에서 이미 걸렀다. 여기는 **실행 중에** 캔버스 내용이 사라지는 경우 담당이다. */
    if(o && d){
      const p = (prev && prev[i]) ? prev[i] : null;
      const keep = (key, mem, what)=>{
        if(!_isBlankDraw(d[key])){ mem[i]=true; return; }          // 멀쥰하다 — 그림이 있었다고 기억해 둔다
        if(!mem[i]) return;                                        // 원래부터 빈 칸 — 사용자의 상태 그대로 저장
        if(_allowBlank){ mem[i]=false; return; }                   // 사용자가 «비운 채 저장»을 직접 확인했다
        if(p && typeof p[key]==='string'){ o[key]=p[key]; _rescued.push((i+1)+'번 '+what); }
      };
      keep('face',  _faceEverDrawn,  '얼굴');
      keep('blink', _blinkEverDrawn, '감은눈');
    }
    return o;
  });
  /* ☁️ [2026-09-16 제보 6-b] 저장본이 **실제로 달라졌을 때만** 시각을 찍고 서버 push 를 예약한다.
     saveSlots 는 가챠 정리·책상 아이템 토글 등 수십 군데서 내용 변화 없이도 불린다 — 그때마다
     ts 를 올리면 부팅마다 이 기기가 «최신»이 되어 다른 기기의 편집을 덮는다(핑퐁의 씨앗).
     ★ 문자열 비교다. 칸 하나만 달라도 전체가 다르므로 어느 칸이 바뀌었는지는 볼 필요가 없다.
     ★ 비교 대상은 prevRaw(직전 저장 문자열). 서버에서 받아 적은 직후(_slotsAdoptFromServer)는
       그 문자열이 곧 서버 내용이라, 되받아 저장해도 «달라짐»이 아니어서 ts 가 안 올라간다 —
       받은 것을 도로 올리는 핑퐁이 여기서 막힌다. */
  let _str = null;
  try{ _str = JSON.stringify(out); }catch(_){ _str = null; }
  try{ if(_str !== null) localStorage.setItem(LS_KEY, _str); }
  catch(e){ console.warn('[슬롯] 저장 실패', e); }
  /* 달라졌을 때만 동기화가 시각을 찍고 올리기를 예약한다(slot-sync.js). 보관함(chars.js)은 안 달라진 저장에서도 받는다 —
     기준(h)이 빈 항목을 잡는 데만 쓴다(_charsAfterSave 주석). */
  const _changed = _str !== null && _str !== prevRaw;
  _savedFns.forEach(fn=>{ try{ fn(out, _changed); }catch(_){} });
  if(_rescued.length){
    console.warn('[슬롯] 🛡️ 빈 그림이 저장되려 해서 막았습니다 — '+_rescued.join(' · ')
      +' / 저장된 원본은 그대로입니다. 화면이 비어 보이면 앱을 다시 켜면 원본이 돌아옵니다.');
    try{ toast('얼굴 그림이 비어 보여서 저장을 막았어요 — 원본은 그대로예요. 앱을 다시 켜면 돌아와요'); }catch(_){}
  }
}
/* 🖼️ [얼굴이 사라지는 제보의 수정] 얼굴·감은눈 이미지를 **각각 따로** 복원한다.
     [예전] Promise.all 로 묶어서 하나라도 실패하면 catch 로 빠지며 그 칸을 통째로 버렸다
       (slots[i] 미할당). 그 뒤 아무 saveSlots() 나 한 번 돌면 — 파츠 장착, 슬라이더 조작,
       책상 아이템 토글 등 수십 군데에서 부른다 — 그 칸이 null 로 저장되어 **캐릭터가 영구
       삭제**된다. 실패는 빈 catch 로 삼켜져 흔적도 없었다.
     [지금] (ㄱ) 실패한 그림만 비워 두고 칸 자체는 살린다
            (ㄴ) _imgBroken 표식을 달아 saveSlots 가 그 칸을 **절대 덮어쓰지 않게** 한다
                 → localStorage 에 남아 있는 멀쩡한 원본이 보존되고, 원인이 사라지면 다음
                   부팅에서 저절로 되살아난다
            (ㄷ) 콘솔과 토스트로 알린다 */
async function loadSlots(){let raw;try{raw=localStorage.getItem(LS_KEY);}catch(e){return;}
  if(!raw)return;let arr;try{arr=JSON.parse(raw);}catch(e){return;}
  let _brokenSlots=0;
  for(let i=0;i<CHAR_SLOT_MAX;i++){const o=arr[i];if(!o){continue;}   // 🧍 옛 저장값(3칸)이면 arr[3]·arr[4] 가 없어 그 칸은 null 로 남는다(패딩)
    let f=null,b=null;const _bad=[];
    try{ f=await loadImg(o.face); }catch(e){ _bad.push('얼굴'); console.warn('[슬롯] '+(i+1)+'번 얼굴 이미지 복원 실패', e); }
    try{ b=await loadImg(o.blink); }catch(e){ _bad.push('감은눈'); console.warn('[슬롯] '+(i+1)+'번 감은눈 이미지 복원 실패', e); }
    try{
      const fc=newCanvas();if(f)fc.getContext('2d').drawImage(f,0,0);const bc=newCanvas();if(b)bc.getContext('2d').drawImage(b,0,0);
      /* 🛡️ [기억 심기] saveSlots 의 공백 방어는 이 값이 있어야 켜진다.
         첫 saveSlots 때 자가 학습하게 두면, 부팅 직후~첫 저장 사이에 캔버스가 비는 경우를 놓친다.
         ★ 로드에 실패한 그림은 «비었다»가 아니라 «있는데 못 읽었다»이므로 무조건 true 다 —
           그 칸을 false 로 두면 _imgBroken 표식이 생성기 왕복에서 떨어져 나간 뒤 빈 그림이 그대로 굳는다. */
      _faceEverDrawn[i]  = _bad.includes('얼굴')   ? true : !_isBlankDraw(fc);
      _blinkEverDrawn[i] = _bad.includes('감은눈') ? true : !_isBlankDraw(bc);
      {const _d=charDef(o.skin||0,fc,bc,o.top,o.bot);
        if(_bad.length){
          _d._imgBroken=_bad.slice();_brokenSlots++;
          console.warn('[슬롯] '+(i+1)+'번 — '+_bad.join('·')+' 이미지를 못 불러왔습니다. '
            +'얼굴이 피부색만 보일 수 있고, 원본을 지키기 위해 이 칸은 저장에서 제외합니다.');
        }if(o.xf)_d.xf=o.xf;if(o.decor)_d.decor=o.decor;if(o.deskColor)_d.deskColor=o.deskColor;if(o.deskItems)_d.deskItems=o.deskItems;if(o.deskGlb)_d.deskGlb=o.deskGlb;if(o.deskCatalogId)_d.deskCatalogId=o.deskCatalogId;if(o.deskScale)_d.deskScale=o.deskScale;if(o.deskLenX)_d.deskLenX=o.deskLenX;if(o.deskPos)_d.deskPos=o.deskPos;if(o.customItems)_d.customItems=o.customItems;
        if(o.isCommission){_d.isCommission=true;_d.commName=o.commName||'커미션';_d.commGlb=o.commGlb||null;}
        if(o.equippedParts)_d.equippedParts=o.equippedParts;
        if(o.partXfMemory)_d.partXfMemory=o.partXfMemory;
        if(o.thumb)_d.thumb=o.thumb;if(o.thumbUrl)_d.thumbUrl=o.thumbUrl;
        // 👂 사람 귀 복원 — slotToObj 와 1:1
        if(o.earL)_d.earL=o.earL;if(o.earR)_d.earR=o.earR;if(o.earAdj)_d.earAdj=o.earAdj;if(o.earPicL)_d.earPicL=o.earPicL;if(o.earPicR)_d.earPicR=o.earPicR;
        // 🐾 동물 확장 복원
        if(o.animal){ _d.animal=true; _d.animalFace=o.animalFace||0; _d.animalScl=o.animalScl||null;
          _d.animalEarL=o.animalEarL||null; _d.animalEarR=o.animalEarR||null; _d.animalEarAdj=o.animalEarAdj||null;
          _d.animalBody=o.animalBody||null; _d.animalEarPaintL=o.animalEarPaintL||null; _d.animalEarPaintR=o.animalEarPaintR||null;
          // 🐾 감은눈 귀 — 옛 저장본엔 없다. 그때는 귀가 한 장이라 두 상태에 같은 그림을 썼으므로 표정 귀로 채운다.
          _d.animalEarBlinkL=o.animalEarBlinkL||o.animalEarPaintL||null; _d.animalEarBlinkR=o.animalEarBlinkR||o.animalEarPaintR||null;
          _d.animalBlink=o.animalBlink||null; }
        slots[i]=_d;}}catch(e){ console.warn('[슬롯] '+(i+1)+'번 복원 실패', e); }}
  if(_brokenSlots){ try{ toast('얼굴 이미지를 못 불러온 캐릭터가 있어요 — 저장된 원본은 그대로 지켜뒀어요'); }catch(_){} }
  /* 🪑 [제보 2] 저장값에 남아 있던 전용 책상·아이템을 여기서 접는다. 복원(32179)은 예전부터
     deskCatalogId 를 조건 없이 그대로 싣는다 — 라이선스 검사가 없던 세 입구 중 하나다.
     ★ 부팅 순서상 카탈로그가 아직 안 왔으면 물러나고, 그때는 도착 콜백이 다시 부른다. 접는 일은 premium-assets.js 가 onLoaded 로 받는다. */
  _loadedFns.forEach(fn=>{ try{ fn(); }catch(e){ console.warn('[라이선스] 슬롯 복원 후 정리 실패', e); } });
}

return {
  LS_KEY,
  _relinkSeatsToSlots,
  loadSlots,
  onLoaded,
  onSaved,
  onSeatRelinked,
  onSlotsReplaced,
  saveSlots,
  slotToObj,
  slotsReplaced,
};
}

const api = { createSlotSave };
if(typeof window !== 'undefined') window.TwSlotSave = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
