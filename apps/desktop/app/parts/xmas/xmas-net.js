/* xmas-net.js — 🎄 크리스마스 이벤트 서버 읽기 · 쓰기(provider · 일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-net.js)
   경로 · 권한은 서버 규칙 xmas* 와 함수(firebase/functions/xmas.js)가 정한다 — 여기는 그 모양대로 부르기만.
   ★ 읽기는 필요한 하위 경로만 — 트리는 장식 목록(xmasTrees/{t}/o)만 한 번에, 그림(xmasImg/{t}/{s})은 판이 달라진 자리만 하나씩.
     상시 구독(onValue)은 걸지 않는다(트리를 열 때 · 다시 불러오기를 누를 때만 읽는다).
   ★ 던지지 않는다 — { ok:true, … } / { ok:false, code, msg, err } 로 돌려준다(화면이 실패와 «없음» 을 나눠 그린다).
   firebase-init.js 가 `xmas: TwXmasNet.createXmasNet({ … })` 로 한 번 만든다. classic script(window.TwXmasNet) — firebase-init 보다 먼저 싣는다. */
(function(){
'use strict';

/**
 * @param {{ db:any, ref:Function, get:Function, set:Function, serverTimestamp:Function,
 *           authUid:()=>string|null, callFn:(name:string, data:any)=>Promise<any> }} deps
 */
function createXmasNet(deps){
  const { db, ref, get, set, serverTimestamp } = deps;
  const authUid = deps.authUid;
  const callFn = deps.callFn;

  const fail = (code, err) => ({ ok: false, code, msg: (err && err.message) || '', err });
  async function read(path){
    try { return { ok: true, val: (await get(ref(db, path))).val() }; }
    catch (e) { return fail('read', e); }
  }

  /** 지금 채우는 트리 · 내 자리 — { ok, cur, mine:{t,s}|null } (로그인 안 됐으면 code 'auth') */
  async function where(){
    const uid = authUid();
    if (!uid) return fail('auth');
    const [m, mine] = await Promise.all([read('xmasMeta/cur'), read('xmasMine/' + uid)]);
    if (!m.ok) return m;
    if (!mine.ok) return mine;
    const cur = Number.isInteger(m.val) && m.val >= 1 ? m.val : 1;
    const v = mine.val;
    return { ok: true, cur, mine: (v && Number.isInteger(v.t) && Number.isInteger(v.s)) ? { t: v.t, s: v.s } : null };
  }

  /** 트리 하나의 장식 목록 — { ok, o:{ slot: { k, v, w? } } } */
  async function tree(t){
    if (!Number.isInteger(t) || t < 1) return fail('arg');
    const r = await read('xmasTrees/' + t + '/o');
    return r.ok ? { ok: true, o: (r.val && typeof r.val === 'object') ? r.val : {} } : r;
  }

  /** 그림 한 자리 — { ok, v, d } (없으면 d:null) */
  async function img(t, s){
    const r = await read('xmasImg/' + t + '/' + s);
    if (!r.ok) return r;
    const v = r.val;
    return { ok: true, v: v && Number.isInteger(v.v) ? v.v : null, d: v && typeof v.d === 'string' ? v.d : null };
  }

  /** 장식 걸기 · 바꾸기 — 함수 xmasHang. { kind, img?, word?, preview? } → { ok, tree, slot, moved, changed } */
  async function hang(data){
    try {
      const r = await callFn('xmasHang', data);
      const d = (r && r.data) || {};
      return { ok: true, tree: d.tree, slot: d.slot, moved: !!d.moved, changed: !!d.changed };
    } catch (e) {
      // 함수가 던진 이유(details · code)를 그대로 — 화면이 «다시 눌러 주세요 · 끝났어요» 를 고른다
      const code = String((e && e.code) || '').replace(/^functions\//, '') || 'call';
      return fail(code, e);
    }
  }

  /** 장식 신고 — xmasReports/o-{t}-{s}/{내 uid} 에 한 번(두 번째는 규칙이 막는다 → code 'dup' 로 본다) */
  async function reportOrnament(t, s, note){
    const uid = authUid();
    if (!uid) return fail('auth');
    const val = { ts: serverTimestamp() };
    const n = String(note == null ? '' : note).trim().slice(0, 40);
    if (n) val.note = n;
    try { await set(ref(db, 'xmasReports/o-' + t + '-' + s + '/' + uid), val); return { ok: true }; }
    catch (e) { return fail(/permission/i.test(String(e && (e.code || e.message))) ? 'dup' : 'write', e); }
  }

  return { where, tree, img, hang, reportOrnament };
}

const api = Object.freeze({ createXmasNet });
if (typeof window !== 'undefined') window.TwXmasNet = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
