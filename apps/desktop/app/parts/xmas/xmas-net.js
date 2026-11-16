/* xmas-net.js — 🎄 크리스마스 이벤트 서버 읽기 · 쓰기(provider · 일회성 — 다음 업데이트에서 걷는다 · 이슈 #963) (검사 sim-xmas-net.js)
   경로 · 권한은 서버 규칙 xmas* 와 함수(firebase/functions/xmas.js)가 정한다 — 여기는 그 모양대로 부르기만.
   ★ 읽기는 필요한 하위 경로만 — 트리는 장식 목록(xmasTrees/{t}/o)만 한 번에, 그림(xmasImg/{t}/{s})은 판이 달라진 자리만 하나씩.
     상시 구독(onValue)은 걸지 않는다(트리를 열 때 · 다시 불러오기를 누를 때만 읽는다).
   ★ 편지는 내 칸(xmasLetters · xmasReturned · xmasGot/{내 uid})만 — 남의 편지를 읽는 길은 없다(짝 짓기는 함수).
   ★ 던지지 않는다 — { ok:true, … } / { ok:false, code, msg, err } 로 돌려준다(화면이 실패와 «없음» 을 나눠 그린다).
   firebase-init.js 가 `xmas: TwXmasNet.createXmasNet({ … })` 로 한 번 만든다. classic script(window.TwXmasNet) — firebase-init 보다 먼저 싣는다. */
(function(){
'use strict';

/**
 * @param {{ db:any, ref:Function, get:Function, set:Function, serverTimestamp:Function,
 *           authUid:()=>string|null, anonymous:()=>boolean, callFn:(name:string, data:any)=>Promise<any> }} deps
 */
function createXmasNet(deps){
  const { db, ref, get, set, serverTimestamp } = deps;
  const authUid = deps.authUid;
  const anonymous = deps.anonymous;   // 가입이 끝나지 않은 세션 — 규칙이 쓰기를 막는다(편지 · 신고)
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

  /** 쓰기를 할 수 있는 내 uid — 로그인 안 됐거나 가입이 덜 끝났으면 null(규칙이 막으니 묻지 않는다) */
  const writerUid = () => { const uid = authUid(); return uid && !anonymous() ? uid : null; };
  const denied = (e) => /permission/i.test(String(e && (e.code || e.message)));

  /** 신고 한 번 — key 칸의 내 이름 칸에(두 번째는 규칙이 막는다 → code 'dup') */
  async function report(key, note){
    const uid = writerUid();
    if (!uid) return fail('auth');
    const val = { ts: serverTimestamp() };
    const n = String(note == null ? '' : note).trim().slice(0, 40);
    if (n) val.note = n;
    try { await set(ref(db, 'xmasReports/' + key + '/' + uid), val); return { ok: true }; }
    catch (e) { return fail(denied(e) ? 'dup' : 'write', e); }
  }
  /** 장식 신고 — xmasReports/o-{t}-{s}/{내 uid} */
  const reportOrnament = (t, s, note) => report('o-' + t + '-' + s, note);
  /** 받은 편지 신고 — xmasReports/g-{내 uid}-{n}/{내 uid}(받은 사람만 · 관리자가 보낸 사람을 찾는다) */
  const reportLetter = (n, note) => { const uid = authUid(); return uid ? report('g-' + uid + '-' + n, note) : Promise.resolve(fail('auth')); };

  /* ── ✉️ 편지 ── */
  /** 내 편지함 · 반송된 편지 — { ok, letters, returned }(xmasLetters/{uid} · xmasReturned/{uid} 두 칸만 — 다섯 통이라 작다) */
  async function myLetters(){
    const uid = authUid();
    if (!uid) return fail('auth');
    const [l, r] = await Promise.all([read('xmasLetters/' + uid), read('xmasReturned/' + uid)]);
    if (!l.ok) return l;
    if (!r.ok) return r;
    return { ok: true, letters: l.val, returned: r.val };
  }
  /** 편지 맡기기 · 고치기 — { text, song? } 를 칸 lid 에(마감 뒤 · 가입 전은 규칙이 막는다 → code 'closed' · 'auth') */
  async function saveLetter(lid, text, song){
    const uid = writerUid();
    if (!uid) return fail('auth');
    const val = { text, ts: serverTimestamp() };
    if (song) val.song = song.title ? { id: song.id, title: song.title } : { id: song.id };
    try { await set(ref(db, 'xmasLetters/' + uid + '/' + lid), val); return { ok: true }; }
    catch (e) { return fail(denied(e) ? 'closed' : 'write', e); }
  }
  /** 편지 거두기 — 칸을 비운다 */
  async function removeLetter(lid){
    const uid = writerUid();
    if (!uid) return fail('auth');
    try { await set(ref(db, 'xmasLetters/' + uid + '/' + lid), null); return { ok: true }; }
    catch (e) { return fail(denied(e) ? 'closed' : 'write', e); }
  }
  /** 반송 표시 치우기(다시 썼거나 지웠을 때) — 본인은 지우기만 할 수 있다 */
  async function clearReturned(lid){
    const uid = authUid();
    if (!uid) return fail('auth');
    try { await set(ref(db, 'xmasReturned/' + uid + '/' + lid), null); return { ok: true }; }
    catch (e) { return fail('write', e); }
  }
  /** 받은 편지 — { ok, got }(xmasGot/{uid} · 많아야 다섯 통) */
  async function got(){
    const uid = authUid();
    if (!uid) return fail('auth');
    const r = await read('xmasGot/' + uid);
    return r.ok ? { ok: true, got: r.val } : r;
  }

  return { me: () => authUid(), where, tree, img, hang, reportOrnament, reportLetter, myLetters, saveLetter, removeLetter, clearReturned, got };
}

const api = Object.freeze({ createXmasNet });
if (typeof window !== 'undefined') window.TwXmasNet = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
