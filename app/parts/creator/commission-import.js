/* commission-import.js — 🎨 커미션 캐릭터 코드 입력 — 종족 선택창의 [코드로 등록] 패널
   app.js «커미션 캐릭터 코드 입력» 구역 본문을 그대로 옮긴 모듈이다(C 구역 떼기 · w3).
   빈 칸 [＋] → 종족 선택창에서 연다. 코드 머리글자로 갈라 DCC1(복제 코드)은 importCloneCode 로, DCK1(책상 · 아이템)은 안내만, DCM1(커미션)은 풀어서 그 칸에 등록한다.
   동작은 옮기기 전과 같다.
   ★ 아래 본문은 app.js 에 있던 글 그대로다(들여쓰기도). 바뀐 줄은 6줄 —
     charCodeMod · charsMod · commissionMod · curSlot · slotSaveMod 를 이름() 으로 읽는다(모듈을 만드는 줄보다 뒤에 선언되거나 app.js 가 다시 대입하는 값이라 읽는 함수로 받는다). 대입은 setCurSlot(…).
     받을 이름 · 바꿀 자리는 파서(typescript)로 골랐다 — 주석 · 글자 · 속성 이름은 그대로.
   ★ app.js 함수 5개는 화살표로 받는다(나중에 선언된 함수도 부를 때 찾는다).
   ★ 밖에서 부르는 이름: 없음 — 만들 때 건다.
   ⚠️ document · window · firebaseAPI · localStorage 등 브라우저 · 다른 모듈 전역은 예전처럼 전역 이름으로 쓴다(app.js 앞에 싣는 classic script).
   ⚠️ 전역 이름은 TwCommissionImport — 크로미움 내장 전역과 겹치지 않게 Tw 접두사(#103).
   검사: checks/sim-commission-import.js */
(function(){

function createCommissionImport(deps){
const CANVAS_SZ = deps.CANVAS_SZ;
const charCodeMod = deps.charCodeMod;   // 읽는 함수
const charDef = deps.charDef;
const charsMod = deps.charsMod;   // 읽는 함수
const commissionMod = deps.commissionMod;   // 읽는 함수
const creatorSaveMod = deps.creatorSaveMod;
const curSlot = deps.curSlot;   // 읽는 함수
const openCreator = deps.openCreator;
const racePickerMod = deps.racePickerMod;
const renderLauncher = deps.renderLauncher;
const saveCurSlot = deps.saveCurSlot;
const slotSaveMod = deps.slotSaveMod;   // 읽는 함수
const slots = deps.slots;
const toast = deps.toast;
const setCurSlot = deps.setCurSlot;   // 쓰는 함수
const commImpOverlay=document.getElementById('commImpOverlay');
document.getElementById('raceCommCode').onclick=()=>{
  const panel=document.getElementById('raceCommCodePanel');
  const willOpen = panel.style.display==='none';
  panel.style.display = willOpen ? 'block' : 'none';
  if(willOpen){ document.getElementById('commImpCode').value=''; document.getElementById('commImpPass').value=''; }
};
document.getElementById('commImpCancel').onclick=()=>{ document.getElementById('raceCommCodePanel').style.display='none'; };
/* 이 패널은 빈 칸 [＋] → 종족 선택창에서만 열린다 — 코드 머리글자로 갈라 DCC1(복제 코드)은 importCloneCode 로 그대로 보낸다
   (커미션 코드만 받던 시절엔 복제 코드를 넣으면 «암호가 틀렸다» 로 보였다).
   ⚠️ 복제 코드 등록을 여기서 새로 구현하지 말 것 — 등록 로직이 두 벌이 되면 같은 사고가 난다. */
document.getElementById('commImpGo').onclick=async()=>{
  const code=document.getElementById('commImpCode').value.trim(), pass=document.getElementById('commImpPass').value;
  if(!code||!pass){toast('코드와 비밀번호를 입력해 주세요');return;}
  // 슬롯 공간 확인 (lcCreate 패턴과 동일)
  if(slots.every(s=>s)){toast('캐릭터가 모두 찼습니다');return;}
  const _closeRace=()=>{ document.getElementById('raceCommCodePanel').style.display='none';
                         document.getElementById('raceOverlay').classList.remove('on'); };
  // ① 캐릭터 복제 코드 — [＋]로 확정된 칸(_raceTargetSlot)에 그대로 앉힌다
  if(/^DCC1\./.test(code)){
    if(await charCodeMod().importCloneCode(code, pass, racePickerMod._raceTargetSlot())) _closeRace();
    return;
  }
  // ② 책상·아이템 코드는 생성기 안에서 넣는 것 — 여기서 조용히 실패시키지 말고 어디로 가야 하는지 말한다
  if(/^DCK1\./.test(code)){ toast('책상·아이템 코드예요 — 생성기 안의 [코드로 추가하기]에서 넣어주세요'); return; }
  // ③ 셋 중 어느 것도 아니면 암호 문제가 아니라 코드(파일) 문제다
  if(!/^DCM1\./.test(code)){ toast('코드 형식이 아니에요 — 파일이 잘리지 않았는지 확인해 주세요'); return; }
  if(!(window.crypto&&crypto.subtle)){toast('이 환경에선 복호화를 쓸 수 없어요');return;}
  try{
    const payload=await commissionMod().decryptCommission(code, pass);
    if(payload.t!=='comm') throw new Error('형식 오류');
    // ★ 칸 — [＋]로 정한 칸이 비어 있으면 그 칸, 아니면 첫 빈 칸(importCloneCode 와 같은 규약). 빈 칸이 없으면 덮어쓰지 않고 거부한다.
    let idx = (typeof racePickerMod._raceTargetSlot()==='number' && !slots[racePickerMod._raceTargetSlot()]) ? racePickerMod._raceTargetSlot() : slots.findIndex(s=>!s);
    if(idx<0){ toast('빈 슬롯이 없어요 — 캐릭터를 하나 정리한 뒤 다시 시도해 주세요'); return; }
    // 텍스처를 캔버스로 변환 (charDef와 호환)
    const faceCv=await dataUrlToCanvas(payload.face, CANVAS_SZ);
    const blinkCv=await dataUrlToCanvas(payload.blink, CANVAS_SZ);
    // def 만들기: 기존 charDef 시그니처 그대로 + 커미션 필드들
    const def = charDef(0, faceCv, blinkCv, '#ffffff', '#ffffff');
    def.isCommission = true;             // 잠금된 캐릭터 표시
    def.commName = payload.name || '커미션';
    def.commGlb = payload.glb;           // base64 GLB (베이스 모델)
    def.xf = {s:0.7,y:0,z:0,rot:0,x:0};
    /* 📦 커미션 3D 파일 하나로 디자인 용량을 넘으면 등록하지 않는다(def-size.js). */
    const _rest = Object.assign({}, def); delete _rest.commGlb;
    const _sz = creatorSaveMod._defSizeFile(_rest, DefSize.jsonBytes(payload.glb) + 12);
    if(!_sz.ok){ toast(_sz.message, null, creatorSaveMod.DEF_SIZE_TOAST_MS); return; }
    // 슬롯에 저장 + 영구 저장
    if(charsMod()._charsBoxFull()) return;   // 🧬 보관함 20 문턱
    slots[idx]=def;
    try{ charsMod()._charsOnNew(idx); }catch(_){}
    slotSaveMod().saveSlots();
    setCurSlot(idx);
    saveCurSlot();
    renderLauncher();
    toast('"'+def.commName+'" 캐릭터를 등록했어요');
    document.getElementById('raceCommCodePanel').style.display='none';
    document.getElementById('raceOverlay').classList.remove('on');
    // 바로 생성기 진입 — openCreator가 isCommission 보고 5단계(책상)부터 시작
    openCreator({kind:'slot', edit:true, slot:idx});
  }catch(e){
    /* 형식(DCM1)은 위에서 걸렀다 — 여기 실패는 암호 · 데이터 문제뿐이라 «코드나 비밀번호» 로 뭉뚱그리지 않는다. */
    console.warn('[커미션코드] 등록 실패 — 길이='+code.length+' 머리='+code.slice(0,12), e);
    toast('등록 실패: 비밀번호를 확인해 주세요 (코드 형식은 맞아요)');
  }
};

/* 데이터 URL → CANVAS_SZ×CANVAS_SZ 캔버스 (face/blink 호환) */
function dataUrlToCanvas(dataUrl, sz){
  return new Promise((res,rej)=>{
    const im=new Image();
    im.onload=()=>{
      const cv=document.createElement('canvas'); cv.width=sz; cv.height=sz;
      cv.getContext('2d').drawImage(im,0,0,sz,sz);
      res(cv);
    };
    im.onerror=()=>rej(new Error('image load'));
    const src=TwSafeHtml.safeUrl(dataUrl, 'image');   // 붙여 넣은 코드(남이 만든 것일 수 있다) — 허용된 그림 주소만
    if(!src){ rej(new Error('image load')); return; }
    im.src=src;
  });
}

return {

};
}

const api = { createCommissionImport };
if(typeof window !== 'undefined') window.TwCommissionImport = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
