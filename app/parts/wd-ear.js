/* ═══ 🐾 꾸미기 › 머리 › 귀 — 탭 화면 · 조정할 귀 줄 · 기즈모 ══════════════════════════════════
   시안 2 확정본. 귀는 파츠가 아니라 기본 제공이라 PART_CATS 에 넣지 않고 **가상 탭**으로 끼운다
   (책상 탭 WD_DESK_TAB 과 같은 이유 — 파츠 등록 UI · 상한 계산 · catEquippedIds 가 귀를 파츠로 세면 안 된다).
   app.js 보다 먼저 로드되고, app.js 가 createWdEar(deps) 로 필요한 것만 넘긴다.

   [저장] 꾸미기 창의 규약대로 초안(draft)에만 쓰고, 저장(_commitWdDraftNow)에서 캐릭터 def 로 옮긴다.
     def.earL · def.earR = ANIMAL_EAR_TYPES 의 key(없으면 필드 없음) · def.earAdj = {L,R} 조정값 ·
     def.earPicL · def.earPicR = 귀 그림(Storage URL — 올리기 전 잠깐은 dataURL, 방으로는 안 나간다).
   [그리기] 꾸미기의 ✎ 그리기 줄을 그대로 쓴다(app.js _wdPic). 대상이 «한 파츠» 가 아니라 «좌·우 귀 둘» 이라
     picTarget() 이 두 대상을 넘기고, 대칭은 human-ear.js mirrorUv 로 반대쪽 귀에 같은 획을 긋는다.
     귀 바탕색 줄은 없다 — 흰색으로 시작하고 색은 그리기로만(2026-10-08 결정).
   [동물] 동물 캐릭터는 생성기에서 귀를 정하므로 이 탭을 숨긴다. */
(function(){
'use strict';

const WD_EAR_TAB = '__ear__';
const EAR_ICON = { cat:'🐱', bear:'🐻', rabbit:'🐰', puppy:'🐶', fold:'🐱' };
const SIDE_LABEL = { L:'왼쪽 귀', R:'오른쪽 귀' };
const EAR_SCALE_MIN = 0.3, EAR_SCALE_MAX = 2.5;

function createWdEar(deps){
  const HE = deps.humanEar, H = deps.HumanEar;
  const doc = deps.doc;
  let side = 'L';
  let link = null;            // 좌우 같이 — null 이면 처음 그릴 때 def 에서 정한다(양쪽이 같으면 켬)

  const available = (def)=>!!def && !def.animal;
  const isActive = ()=>deps.getTab() === WD_EAR_TAB;
  const typeOf = (def, s)=>HE.readDef(def)[s];

  function adjOf(def, s){
    if(!def.earAdj || typeof def.earAdj !== 'object') def.earAdj = {};
    if(!def.earAdj[s]) def.earAdj[s] = H.newAdj();
    return def.earAdj[s];
  }
  function previewWrap(s){
    const root = deps.getPreviewRoot();
    return root ? HE.findWrap(root, s) : null;
  }

  /* 한쪽(또는 양쪽) 귀를 바꾼다 — 초안에 쓰고 미리보기에 바로 붙인다. 귀가 바뀌면 조정할 쪽도 그리로 옮긴다. */
  function pick(sides, type){
    const def = deps.getDraft(); if(!def) return;
    sides.forEach(s=>{
      /* 귀 종류가 바뀌면 그 쪽 그림은 버린다 — 종류마다 UV 배치가 달라서 옛 그림이 엉뚱한 자리에 묻는다 */
      if((def['ear' + s] || null) !== (type || null)) delete def['earPic' + s];
      if(type) def['ear' + s] = type; else delete def['ear' + s];
    });
    const root = deps.getPreviewRoot();
    if(root) sides.forEach(s=>{
      const want = def['ear' + s] || null;
      HE.attachSide(root, s, want, adjOf(def, s), {
        material:deps.material,
        isStale:()=>{ const d = deps.getDraft(); return !d || (d['ear' + s] || null) !== want; },
        onAttach:(w)=>{ if(deps.decorate) deps.decorate(w); if(isActive() && side === s) syncGizmo(); },
      });
    });
    if(type && sides.indexOf(side) < 0) side = sides[0];
    if(!type && !typeOf(def, side)){ const o = side === 'L' ? 'R' : 'L'; if(typeOf(def, o)) side = o; }
    deps.rerender();
  }

  function _card(label, icon, on, onclick, none){
    const c = doc.createElement('div');
    c.className = 'wd-card' + (none ? ' none-card' : '') + (on ? ' on' : '');
    if(none) c.textContent = label;
    else {
      const i = doc.createElement('span'); i.textContent = icon;
      const n = doc.createElement('span'); n.className = 'nm'; n.textContent = label;
      c.appendChild(i); c.appendChild(n);
    }
    c.onclick = onclick;
    return c;
  }
  function _grid(cur, onPick){
    const g = doc.createElement('div'); g.className = 'wd-grid';
    g.appendChild(_card('없음', '', !cur, ()=>onPick(null), true));
    (deps.earTypes() || []).forEach(t=>{
      if(!t || !t.key) return;
      g.appendChild(_card(t.label || t.key, EAR_ICON[t.key] || '🐾', cur === t.key, ()=>onPick(t.key)));
    });
    return g;
  }
  function _sub(text){
    const d = doc.createElement('div'); d.className = 'wd-ear-sub'; d.textContent = text; return d;
  }

  function render(wrap){
    const def = deps.getDraft();
    if(!def){ wrap.innerHTML = '<div class="wd-empty"><span class="ic">🐾</span>캐릭터를 먼저 실행해 주세요.</div>'; return; }
    const st = HE.readDef(def);
    if(link === null) link = (st.L === st.R);
    const sec = doc.createElement('div'); sec.className = 'wd-cat';
    const head = doc.createElement('div'); head.className = 'wd-cat-head';
    const h3 = doc.createElement('h3'); h3.textContent = '🐾 귀';
    const lab = doc.createElement('label'); lab.className = 'wd-ear-link';
    const cb = doc.createElement('input'); cb.type = 'checkbox'; cb.checked = !!link;
    cb.onchange = ()=>{ link = cb.checked; deps.rerender(); };
    lab.appendChild(cb); lab.appendChild(doc.createTextNode(' 좌우 같이'));
    head.appendChild(h3); head.appendChild(lab); sec.appendChild(head);
    if(link){
      // 양쪽이 다르면 어느 칸도 켜지 않는다 — 고르는 순간 양쪽이 같아진다
      sec.appendChild(_grid(st.L === st.R ? st.L : undefined, t=>pick(['L', 'R'], t)));
    } else {
      sec.appendChild(_sub('◀ ' + SIDE_LABEL.L));
      sec.appendChild(_grid(st.L, t=>pick(['L'], t)));
      sec.appendChild(_sub(SIDE_LABEL.R + ' ▶'));
      sec.appendChild(_grid(st.R, t=>pick(['R'], t)));
    }
    const tip = doc.createElement('div'); tip.className = 'wd-ear-tip';
    tip.textContent = '미리보기 아래에서 조정할 귀를 고르고 핸들로 옮겨요. 미리보기에서 귀를 눌러도 돼요.';
    sec.appendChild(tip);
    wrap.appendChild(sec);
  }

  /* ── 조정할 귀 줄 ─────────────────────────────────────────────── */
  function _row(){ return doc.getElementById('wdEarAdjRow'); }
  /* 줄이 보이고 있었으면 true — 호출자가 미리보기 크기 · 구도를 되돌린다 */
  function hideRow(){
    const r = _row(); if(!r) return false;
    const was = r.style.display !== 'none';
    r.style.display = 'none'; r.innerHTML = '';
    return was;
  }
  function _btn(text, title, on, onclick, off, mini){
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'wd-gizmo-btn' + (mini ? ' wd-ear-mini' : '') + (on ? ' on' : ''); b.textContent = text; b.title = title;
    if(off) b.disabled = true;
    b.onclick = onclick;
    return b;
  }
  function _renderRow(def){
    const r = _row(); if(!r) return;
    r.innerHTML = '';
    const st = HE.readDef(def);
    const cap = doc.createElement('span'); cap.className = 'wd-ear-adj-cap'; cap.textContent = '조정할 귀';
    r.appendChild(cap);
    r.appendChild(_btn('◀ 왼쪽', SIDE_LABEL.L, side === 'L', ()=>setSide('L'), !st.L));
    r.appendChild(_btn('오른쪽 ▶', SIDE_LABEL.R, side === 'R', ()=>setSide('R'), !st.R));
    r.appendChild(_btn('⇆', '반대쪽에 대칭 복사', false, mirror, !(st.L && st.R), true));
    r.appendChild(_btn('↺', '이 귀만 처음으로', false, reset, false, true));
    r.style.display = 'flex';
  }

  /* 귀 탭일 때 기즈모 바 · 조정할 귀 줄을 맞추고, 조정할 쪽 귀에 핸들을 붙인다.
     귀가 하나도 없으면 둘 다 숨긴다(붙일 대상이 없다). */
  function syncGizmo(){
    const bar = doc.getElementById('wdGizmoBar');
    const def = deps.getDraft();
    const gz = deps.getGizmo();
    const st = def ? HE.readDef(def) : { L:null, R:null };
    if(!st[side] && st[side === 'L' ? 'R' : 'L']) side = side === 'L' ? 'R' : 'L';
    if(!def || !st[side]){
      if(bar) bar.style.display = 'none';
      hideRow();
      if(gz) gz.detach();
      return;
    }
    if(bar) bar.style.display = 'flex';
    _renderRow(def);
    const w = previewWrap(side);
    // 그리는 동안은 핸들을 안 붙인다 — 좌클릭의 임자가 붓이다(enterWdPicMode 가 뗀 것을 되붙이지 않게)
    if(gz && deps.isDrawing && deps.isDrawing()){ gz.detach(); return; }
    if(gz){
      if(w){ gz.attach(w); deps.setGizmoMode(); }
      else gz.detach();   // 아직 파싱 중 — 붙으면 onAttach 가 다시 부른다
    }
    // 귀는 늦게 붙는다 — 붙은 뒤에 연필(그리기) 버튼을 다시 맞춘다
    if(deps.onSynced) deps.onSynced();
  }

  function setSide(s){
    const def = deps.getDraft(); if(!def || !typeOf(def, s)) return;
    side = s; syncGizmo();
  }
  function reset(){
    const def = deps.getDraft(); if(!def) return;
    adjOf(def, side); def.earAdj[side] = H.newAdj();
    HE.applyAdj(previewWrap(side), def.earAdj[side]);
    deps.toast(SIDE_LABEL[side] + ' 조정을 처음으로 돌렸어요');
  }
  function mirror(){
    const def = deps.getDraft(); if(!def) return;
    const to = side === 'L' ? 'R' : 'L';
    if(!typeOf(def, to)){ deps.toast('반대쪽에 귀가 없어요'); return; }
    adjOf(def, to); def.earAdj[to] = H.mirrorAdj(adjOf(def, side));
    HE.applyAdj(previewWrap(to), def.earAdj[to]);
    deps.toast(SIDE_LABEL[side] + ' 설정을 반대쪽에 대칭 복사했어요');
  }

  /* 기즈모가 귀를 움직였다 → 조정값으로 되읽어 초안에 쓴다 */
  function onGizmoChange(){
    const def = deps.getDraft(), w = previewWrap(side);
    if(!def || !w) return;
    adjOf(def, side); def.earAdj[side] = HE.readAdj(w);
  }
  /* 크기 －/＋ — 축별 비율은 그대로 두고 전체만 키운다 */
  function scaleStep(dir, big){
    const def = deps.getDraft(); if(!def || !typeOf(def, side)) return false;
    const a = adjOf(def, side), s = H.earScale(a);
    const cur = (a.sc != null) ? a.sc : 1;
    const next = Math.min(EAR_SCALE_MAX, Math.max(EAR_SCALE_MIN, +(cur + dir * (big ? 0.06 : 0.02)).toFixed(2)));
    const k = next / (cur || 1);
    def.earAdj[side] = Object.assign({}, a, { sc:next, scx:s.x * k, scy:s.y * k, scz:s.z * k });
    HE.applyAdj(previewWrap(side), def.earAdj[side]);
    return true;
  }

  /* 미리보기에서 귀를 눌렀다 — 그쪽을 조정 대상으로. 맞혔으면 true. */
  function pickAt(raycaster){
    const root = deps.getPreviewRoot(); if(!root) return false;
    const targets = [];
    ['L', 'R'].forEach(s=>{ const w = HE.findWrap(root, s); if(w) w.traverse(o=>{ if(o.isMesh) targets.push({ o, s }); }); });
    if(!targets.length) return false;
    const hits = raycaster.intersectObjects(targets.map(t=>t.o), false);
    if(!hits.length) return false;
    const t = targets.find(x=>x.o === hits[0].object);
    if(t && t.s !== side) setSide(t.s);
    return !!t;
  }

  /* 미리보기에 귀가 (늦게) 붙었다 — 그게 지금 미리보기면 핸들을 다시 붙인다 */
  function onEarAttached(root){
    if(isActive() && root && root === deps.getPreviewRoot()) syncGizmo();
  }

  /* 🖍️ 그리기 대상 — 귀 탭에서 미리보기에 붙어 있는 귀들. 대칭은 양쪽이 같은 종류일 때만(정점 짝이 맞아야 한다).
     귀가 없으면 null(연필이 안 뜬다). */
  function picTarget(){
    if(!isActive()) return null;
    const def = deps.getDraft(); if(!def) return null;
    const st = HE.readDef(def);
    const tgts = [];
    ['L', 'R'].forEach(s=>{
      const w = st[s] ? previewWrap(s) : null;
      if(w && w.userData.picMeshes && w.userData.picMeshes.length) tgts.push({ side:s, wrapper:w });
    });
    if(!tgts.length) return null;
    return { ear:true, targets:tgts, symOk:tgts.length === 2 && st.L === st.R };
  }
  /* 그림 저장 — 그리기 «완료» 가 부른다. v 가 없으면(다 지웠다) 필드를 지운다. */
  function setPic(s, v){
    const def = deps.getDraft(); if(!def) return;
    if(v) def['earPic' + s] = v; else delete def['earPic' + s];
  }

  /* 초안 만들 때 — 조정값은 깊은 복사(초안에서 고친 것이 저장 전에 캐릭터로 새지 않게) */
  function copyIntoDraft(draft, def){
    if(def.earAdj) draft.earAdj = JSON.parse(JSON.stringify(def.earAdj));
    else delete draft.earAdj;
  }
  /* 저장 — 초안의 귀를 def 로 옮긴다. 바뀌었으면 true(호출자가 좌석 귀를 다시 붙인다).
     귀가 없는 쪽의 조정값은 남기지 않는다 — 방에 실리는 바이트를 줄인다. */
  function commit(def, draft){
    const snap = (d)=>JSON.stringify([d.earL || null, d.earR || null, d.earAdj || null, d.earPicL || null, d.earPicR || null]);
    const before = snap(def);
    const st = HE.readDef(draft);
    ['L', 'R'].forEach(s=>{
      if(st[s]) def['ear' + s] = st[s]; else delete def['ear' + s];
      const pic = st[s] && typeof draft['earPic' + s] === 'string' ? draft['earPic' + s] : null;
      if(pic) def['earPic' + s] = pic; else delete def['earPic' + s];
    });
    const adj = {};
    ['L', 'R'].forEach(s=>{ if(st[s]) adj[s] = st.adj[s]; });
    if(adj.L || adj.R) def.earAdj = adj; else delete def.earAdj;
    return before !== snap(def);
  }

  return { TAB:WD_EAR_TAB, available, isActive, render, syncGizmo, hideRow, setSide, reset, mirror,
           onGizmoChange, scaleStep, pickAt, onEarAttached, copyIntoDraft, commit, picTarget, setPic,
           side:()=>side, link:()=>link };
}

const api = { WD_EAR_TAB, createWdEar };
if(typeof window !== 'undefined') window.WdEar = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
