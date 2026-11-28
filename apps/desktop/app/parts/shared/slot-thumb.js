/* slot-thumb.js — 🖼️ 캐릭터 칸 섬네일로 무엇을 보일지 정하는 한 규칙(순수 함수 · DOM · 저장 없음) (검사 sim-slot-thumb.js)
   [왜 한 곳인가] 설정 › 캐릭터 탭은 이 PC 에서 찍은 그림(def.thumb)만, 내 정보는 서버 주소(def.thumbUrl)부터 봤다.
     서버에서 받아 앉힌 칸은 thumb 이 비고 thumbUrl 만 있어(slot-codec.js _slotFromServerObj), 껐다 켜면 설정 쪽만 대체 그림으로 돌아갔다(B-1128-4).
   순서: 이 PC 에서 찍은 그림(thumb — 방금 고친 모습) → 서버 섬네일(thumbUrl). 둘 다 없으면 null — 부르는 쪽이 얼굴 그림 · 합성 그림으로 대신한다.
   받은 safeUrl(u, 'image')(shared/safe-html.js)이 받아 주는 칸만 고르고, 그 칸의 값을 그대로 돌려준다 —
   화면에 넣는 쪽이 넣는 자리에서 한 번 더 safeUrl 로 씻는다(sim-safe-html 이 넣는 자리를 본다).
   내보냄: window.TwSlotThumb = { FIELDS, FACE_FIELDS, snapshot, withFace }. 쓰는 모듈(settings-panel.js · my-info.js)보다 먼저 싣는 classic script — safe-html.js 처럼 전역 이름으로 바로 쓴다. */
(function(){

const FIELDS = Object.freeze(['thumb', 'thumbUrl']);                 // 캐릭터 전체 모습
const FACE_FIELDS = Object.freeze(['faceUrl', '_faceUrl', 'face']);  // 섬네일이 없을 때 대신 보일 얼굴 그림

function firstSafe(def, fields, safeUrl){
  if(!def) return null;
  for(const f of fields){
    if(safeUrl(def[f], 'image')) return def[f];
  }
  return null;
}

/** 캐릭터 전체 모습 섬네일 칸의 값 — 없으면 null
 *  @param {object|null} def  @param {(u: unknown, kind: 'image') => string} safeUrl */
function snapshot(def, safeUrl){ return firstSafe(def, FIELDS, safeUrl); }

/** 섬네일이 없으면 얼굴 그림까지 — 그것도 없으면 null */
function withFace(def, safeUrl){ return firstSafe(def, FIELDS.concat(FACE_FIELDS), safeUrl); }

const api = Object.freeze({ FIELDS, FACE_FIELDS, snapshot, withFace });
if(typeof window !== 'undefined') window.TwSlotThumb = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
