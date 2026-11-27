/*
 * 카탈로그 항목별 «장착 사용자 수» — users/{userCode}/slots 쓰기마다 그 사람이 장착한 카탈로그 id 집합의 차이만 센다.
 *   metrics/parts/equipped/parts/{id} = 사람 수   (catalog/parts · catalog/gachaParts 둘 다 — def 만 봐서는 어느 통인지 모른다)
 *   metrics/parts/equipped/desks/{id} = 사람 수   (catalog/desks)
 *   metrics/parts/equipped/items/{id} = 사람 수   (catalog/items)
 * 한 사람이 슬롯 여러 칸에 같은 것을 끼워도 1명이다. 보유(가챠)가 아니라 지금 슬롯 def 에 끼워진 것만 센다.
 *
 * def(slots/s/{i} 의 JSON 문자열 · app.js _slotToServerObj 가 만든 서버 표현)에서 보는 칸:
 *   equippedParts[cat]  — 항목 하나({id,…} 또는 id 문자열), 배열(🔗 stackable), 또는 {0:…,1:…} 숫자 키 맵(app.js entriesForCat 과 같게 푼다)
 *   deskCatalogId       — 카탈로그 책상. 없고 직접 넣은 책상(deskGlb · deskGlbUrl)도 없으면 기본 책상(__default_desk__ — catalog/desks 에 있다)
 *   deskItems 의 키     — 책상 아이템. customItems 에 GLB 째 실린 것(코드로 추가한 로컬 아이템)은 카탈로그가 아니라 뺀다
 * 코드로 추가한 커미션 파츠(id 'c…')는 def 에 GLB 표시가 없어 거르지 못한다 — 숫자는 쌓이지만 카탈로그에 없는 id 라 화면에 안 나온다.
 * 라이선스로 잠겨 빠진 것(deskLicenseHold · deskItemsLicenseHold)은 지금 화면에 없으므로 세지 않는다.
 * firebase-admin 은 무거워서 쓸 때 처음 읽는다(index.js 맨 위 ⚠️). increment 는 검사에서 바꿔 끼우려고 받는다.
 */
'use strict';
const METRICS_EQUIPPED = 'metrics/parts/equipped';
const KINDS = Object.freeze(['parts', 'desks', 'items']);
const DEFAULT_DESK_ID = '__default_desk__';   // app.js DEFAULT_DESK_OVERRIDE_ID 와 같게
// RTDB 키로 쓸 수 있고 카탈로그 id 로 그럴듯한 것만 — 이상한 값이 경로를 만들지 못하게
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const isObj = (v) => !!v && typeof v === 'object';
const emptySets = () => ({ parts: new Set(), desks: new Set(), items: new Set() });

function partIds(eq){
  const out = [];
  if (!isObj(eq)) return out;
  for (const cat in eq){
    const e = eq[cat];
    let list;
    if (Array.isArray(e)) list = e;
    else if (isObj(e) && !e.id) list = Object.keys(e).filter(k => /^\d+$/.test(k)).map(k => e[k]);
    else list = [e];
    for (const it of list){
      const id = isObj(it) ? it.id : it;
      if (typeof id === 'string' && ID_RE.test(id)) out.push(id);
    }
  }
  return out;
}

/** def 객체 하나 → 종류별 카탈로그 id 집합(sets 에 더한다). */
function addDefIds(def, sets){
  if (!isObj(def) || Array.isArray(def)) return sets;
  for (const id of partIds(def.equippedParts)) sets.parts.add(id);
  const desk = def.deskCatalogId;
  if (typeof desk === 'string' && desk){
    if (ID_RE.test(desk)) sets.desks.add(desk);
  } else if (!def.deskGlb && !def.deskGlbUrl){
    sets.desks.add(DEFAULT_DESK_ID);
  }
  if (isObj(def.deskItems)){
    const custom = isObj(def.customItems) ? def.customItems : {};
    for (const id in def.deskItems){
      if (!def.deskItems[id] || custom[id] || !ID_RE.test(id)) continue;
      sets.items.add(id);
    }
  }
  return sets;
}

/** slots 노드 값({ ts, v, s }) → 사람 한 명의 종류별 id 집합. s 는 RTDB 가 배열로 돌려줄 수도 있다. 깨진 칸은 건너뛴다. */
function slotsEquipSets(slots){
  const sets = emptySets();
  const s = isObj(slots) ? slots.s : null;
  if (!isObj(s)) return sets;
  for (const k of Object.keys(s)){
    const raw = s[k];
    if (typeof raw !== 'string' || !raw) continue;
    let def;
    try { def = JSON.parse(raw); } catch (_) { continue; }
    addDefIds(def, sets);
  }
  return sets;
}

/** 전후 집합의 차이 → 경로별 ±1. 바뀐 게 없으면 빈 객체. */
function equipDiffUpdates(before, after, increment){
  const inc = increment || ((n) => require('firebase-admin/database').ServerValue.increment(n));
  const out = {};
  for (const kind of KINDS){
    const b = before[kind], a = after[kind];
    for (const id of a) if (!b.has(id)) out[METRICS_EQUIPPED + '/' + kind + '/' + id] = inc(1);
    for (const id of b) if (!a.has(id)) out[METRICS_EQUIPPED + '/' + kind + '/' + id] = inc(-1);
  }
  return out;
}

// 한 번의 루트 update — 여러 항목의 증감이 같이 되거나 같이 안 된다. 슬롯을 지우면(after 없음) 전부 -1.
async function runPartEquip(db, event, increment){
  const val = (snap) => (snap && typeof snap.val === 'function') ? snap.val() : null;
  const before = slotsEquipSets(val(event && event.data && event.data.before));
  const after = slotsEquipSets(val(event && event.data && event.data.after));
  const updates = equipDiffUpdates(before, after, increment);
  if (!Object.keys(updates).length) return null;
  await db.ref().update(updates);
  return updates;
}

/** 백필 — 사람마다의 slots 값 목록 → 종류별 { id: 사람 수 }. */
function equipTotals(slotsList){
  const totals = { parts: {}, desks: {}, items: {} };
  for (const slots of slotsList){
    const sets = slotsEquipSets(slots);
    for (const kind of KINDS) for (const id of sets[kind]) totals[kind][id] = (totals[kind][id] || 0) + 1;
  }
  return totals;
}

module.exports = {
  METRICS_EQUIPPED, KINDS, DEFAULT_DESK_ID, ID_RE,
  addDefIds, slotsEquipSets, equipDiffUpdates, runPartEquip, equipTotals,
};
