/* ═══ 📦 캐릭터 디자인(def) 용량 상한 — 방으로 보내는 def 한 벌을 500KB 안으로 ═══════════════════════════
   [왜] def 는 방에 들어온 모든 사람에게 통째로 간다. 코드로 넣은 3D 파일(커미션 · 책상 · 아이템)은 base64 로
     def 안에 박혀서, 큰 GLB 하나가 그대로 방 데이터가 된다. 새 방 서버는 한 번에 1MB 까지만 받는다.
   [언제 막나] 디자인을 «키우는» 순간(코드로 추가 · 아이템 켜기 · 책상 고르기 · 커미션 등록)과 [완료] 저장.
     보내는 순간에는 막지 않는다 — 이미 넘은 옛 캐릭터도 그대로 들어가고, 더 키우는 것만 막는다.
   ★ 재는 대상은 app.js 의 serializeDefForNetwork 결과(= 실제로 나가는 것)의 JSON UTF-8 바이트다. */
(function(){
'use strict';

const DEF_MAX_BYTES = 500 * 1024;

/* JSON 문자열의 UTF-8 바이트 — 이름 같은 한글은 3바이트라 length 로 세면 모자란다. */
function utf8Bytes(str){
  if(typeof str !== 'string') return 0;
  let n = 0;
  for(let i = 0; i < str.length; i++){
    const c = str.charCodeAt(i);
    if(c < 0x80) n += 1;
    else if(c < 0x800) n += 2;
    else if(c >= 0xD800 && c <= 0xDBFF){ n += 4; i++; }   // 짝 글자(이모지 등)
    else n += 3;
  }
  return n;
}
function jsonBytes(v){
  try{ return utf8Bytes(JSON.stringify(v == null ? null : v)); }catch(_){ return 0; }
}
function defBytes(wire){ return wire ? jsonBytes(wire) : 0; }

/* 넘었다고 말할 때는 올려서(500.3KB 를 «500/500» 이라 하지 않게), 남은 용량은 내려서. */
function kbUp(b){ return Math.ceil(Math.max(0, b) / 1024); }
function kbDown(b){ return Math.floor(Math.max(0, b) / 1024); }

const LABELS = {
  commGlb: '캐릭터 3D',
  deskGlb: '책상 3D',
  face: '얼굴 그림',
  blink: '감은눈 그림',
  equippedParts: '꾸미기 파츠',
  deskItems: '책상 아이템 배치',
  animalBody: '동물 몸 그림',
  animalBlink: '동물 감은눈 그림',
  animalEarPaintL: '왼쪽 귀 그림',
  animalEarPaintR: '오른쪽 귀 그림',
  animalEarBlinkL: '왼쪽 귀 감은눈',
  animalEarBlinkR: '오른쪽 귀 감은눈',
};
const ETC_LABEL = '기타 설정';

/* 직렬화된 def → 부분별 바이트(큰 것부터). 아이템은 하나하나 따로 센다.
   names: { deskGlb: '책상 이름' } 처럼 def 안에 없는 이름을 덧붙일 때. */
function breakdown(wire, names){
  const out = [];
  if(!wire || typeof wire !== 'object') return out;
  const nm = names || {};
  let etc = 0;
  for(const k of Object.keys(wire)){
    const v = wire[k];
    if(k === 'customItems' && v && typeof v === 'object'){
      for(const id of Object.keys(v)){
        const it = v[id];
        out.push({ key: 'customItems.' + id, label: '아이템', name: (it && it.name) ? String(it.name) : '', bytes: jsonBytes(it) + utf8Bytes(id) + 3 });
      }
      continue;
    }
    const b = jsonBytes(v) + utf8Bytes(k) + 3;   // "키": 값, 의 몫까지
    if(LABELS[k]){
      let name = '';
      if(k === 'commGlb') name = wire.commName || nm.commGlb || '';
      else if(nm[k]) name = nm[k];
      out.push({ key: k, label: LABELS[k], name: String(name || ''), bytes: b });
    } else etc += b;
  }
  if(etc) out.push({ key: '_etc', label: ETC_LABEL, name: '', bytes: etc });
  out.sort((a, b) => b.bytes - a.bytes);
  return out;
}

function partText(p){
  if(!p) return '';
  return p.label + (p.name ? ' ‘' + p.name + '’' : '') + ' ' + kbUp(p.bytes) + 'KB';
}
/* «디자인 용량 초과 (612/500KB) — 가장 큰 것: 책상 3D ‘desk.glb’ 410KB» */
function overMessage(total, parts, max){
  const m = max || DEF_MAX_BYTES;
  const top = parts && parts[0];
  return '디자인 용량 초과 (' + kbUp(total) + '/' + kbDown(m) + 'KB)' + (top ? ' — 가장 큰 것: ' + partText(top) : '');
}
/* «파일이 너무 커요 (410KB · 남은 용량 120KB)» */
function fileMessage(fileBytes, remain){
  return '파일이 너무 커요 (' + kbUp(fileBytes) + 'KB · 남은 용량 ' + kbDown(remain) + 'KB)';
}

/* 키우는 변경 · 저장 — before(바꾸기 전 직렬화) → after(바꾼 뒤). 넘었어도 줄거나 같으면 통과(옛 캐릭터).
   돌려주는 값: { ok, bytes, before, parts, message } */
function checkGrowth(beforeWire, afterWire, names, max){
  const m = max || DEF_MAX_BYTES;
  const before = defBytes(beforeWire), after = defBytes(afterWire);
  if(after <= m || after <= before) return { ok: true, bytes: after, before };
  const parts = breakdown(afterWire, names);
  return { ok: false, bytes: after, before, parts, message: overMessage(after, parts, m) };
}

/* 파일 하나를 넣기 전 — 그 파일만으로 남은 자리를 넘으면 막는다.
   restWire: 이 파일이 들어갈 자리를 비운 def(책상을 바꾸면 옛 책상은 빼고 잰다). addBytes: 들어갈 몫. */
function checkFile(restWire, addBytes, max){
  const m = max || DEF_MAX_BYTES;
  const rest = defBytes(restWire);
  const remain = Math.max(0, m - rest);
  if(addBytes <= remain) return { ok: true, remain };
  return { ok: false, remain, message: fileMessage(addBytes, remain) };
}

const api = { DEF_MAX_BYTES, utf8Bytes, jsonBytes, defBytes, kbUp, kbDown, breakdown, partText, overMessage, fileMessage, checkGrowth, checkFile };
if(typeof window !== 'undefined') window.DefSize = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
