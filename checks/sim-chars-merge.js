/* ═══ 🧬 sim-chars-merge.js — 캐릭터 단위 병합 (회원가입 설계 §2-4 · 2026-09-20 · 개정 32 신규) ═══════════
   [무엇을 지키나] 5칸 통째 교체(3-7)를 대신할 규칙 — users/{uid}/chars/{cid} 한 마리씩 **합집합**.
     같은 cid 는 mtime 큰 쪽, 삭제는 묘비, 진 쪽 산 마리는 trash 에 남긴다. 값을 지우는 갈래가 없다.
   ・1절: app.js 의 `_charsMerge` 본문을 떼어 와 그대로 돌린다(스텁 없음 — 순수 함수) —
          ① 설계 §2-4 표 다섯 줄(한쪽만 · 같음 · 산 vs 산 · 산 vs 묘비 양방향)
          ② 3-7 재현: A 5마리 · 오프라인 B 1마리 → 6마리, 아무도 안 잃음, trash 0
          ③ 3-7 되감기: A 가 1마리 지움(묘비) → B 에서 그 마리가 내려가고 def 가 trash 에
          ④ 미래 mtime: 서버가 미래면 지금으로 찍어 올린다 · 정상 범위는 안 건드린다
          ⑤ 값을 지우는 갈래가 없다(merged 의 cid 수 = 합집합 · 묘비는 묘비로 남는다)
          ⑥ 들어온 것을 안 바꾼다(입력 객체 불변 · 결과의 push/pull 은 merged 의 것과 같은 참조)
   ・2절: 규칙 파일 — chars · trash · charsMeta 블록 · def 검증이 slots 와 같다 · trash 는 붙이기만(.write 가 잎에서 !data.exists() && newData.exists()) ·
          slots · slotsPrev 가 **아직** 있다(이관 창 · 설계 §5 N·N+1).
   [실행] app.js 가 있는 폴더에서. 규칙 파일이 없으면 2절은 검사못함. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
if(!fs.existsSync('app.js')) process.exit(2);
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };

/* ── 본문 떼어 오기 ── */
const a = SRC.indexOf('const CHARS_SKEW_TOL_MS');
const b = SRC.indexOf('try{ window._charsMerge');
if(a < 0 || b < 0){ say('  ✗ app.js 에 _charsMerge 블록이 없다'); say(`\n판정: 초록 0 · 빨강 1 · 검사못함 0`); process.exit(1); }
const body = SRC.slice(a, b);
const NOW = 1_800_000_000_000;
const api = new Function('SLOTS_TS_SKEW_TOL_MS', '_slotsNow', body + '\nreturn { _charsMerge, _charsNewId, _charsEntryTime, _charsIsTomb };')(5*60*1000, () => NOW);
const M = api._charsMerge;
const live = (d, t) => ({ def: d, mtime: t });
const tomb = (t) => ({ del: t });
const keys = (o) => Object.keys(o).sort().join(',');

/* ── 1. 실행 ── */
say('── 1. _charsMerge — 설계 §2-4 표');
{ // ① 한쪽에만
  const r = M({ c1: live('A', 10) }, { c2: live('B', 20), c3: tomb(30) }, { now: NOW });
  chk(keys(r.merged) === 'c1,c2,c3', '① 합집합 — 세 cid 전부 merged 에');
  chk(keys(r.push) === 'c1' && keys(r.pull) === 'c2,c3', '  로컬에만 → push · 서버에만 → pull (묘비도 건너간다)');
  chk(r.trash.length === 0 && r.fixed.length === 0, '  trash 0 · fixed 0');
}
{ // ① 같음
  const r = M({ c1: live('A', 10) }, { c1: live('A', 10) }, { now: NOW });
  chk(keys(r.push) === '' && keys(r.pull) === '' && r.trash.length === 0, '① mtime 같으면 할 일 없음');
}
{ // ① 산 vs 산
  const r1 = M({ c1: live('A2', 20) }, { c1: live('A1', 10) }, { now: NOW });
  chk(r1.merged.c1.def === 'A2' && keys(r1.push) === 'c1' && keys(r1.pull) === '', '① 산 vs 산 — 로컬이 새로우면 올린다');
  chk(r1.trash.length === 1 && r1.trash[0].def === 'A1' && r1.trash[0].why === 'overwritten' && r1.trash[0].mtime === 10, '  진 서버 def 가 trash 에 (why=overwritten · 진 mtime)');
  const r2 = M({ c1: live('A1', 10) }, { c1: live('A2', 20) }, { now: NOW });
  chk(r2.merged.c1.def === 'A2' && keys(r2.pull) === 'c1' && r2.trash.length === 1 && r2.trash[0].def === 'A1', '  서버가 새로우면 받고, 진 로컬 def 가 trash 에');
}
{ // ① 산 vs 묘비
  const r1 = M({ c1: live('A', 10) }, { c1: tomb(20) }, { now: NOW });
  chk(api._charsIsTomb(r1.merged.c1) && keys(r1.pull) === 'c1' && r1.trash.length === 1 && r1.trash[0].why === 'deleted', '① 묘비가 새로우면 내린다 — def 는 trash(why=deleted)');
  const r2 = M({ c1: live('A', 30) }, { c1: tomb(20) }, { now: NOW });
  chk(r2.merged.c1.def === 'A' && keys(r2.push) === 'c1' && r2.trash.length === 0, '  산 것이 묘비보다 나중이면 묘비를 걷고 올린다 (되살림 · trash 없음)');
  const r3 = M({ c1: tomb(20) }, { c1: live('A', 10) }, { now: NOW });
  chk(api._charsIsTomb(r3.merged.c1) && keys(r3.push) === 'c1' && r3.trash[0] && r3.trash[0].why === 'deleted', '  로컬 묘비가 서버 산 마리보다 새로우면 묘비를 올리고 서버 def 는 trash');
}
{ // ② 3-7 재현
  const A = {}; for(let i = 1; i <= 5; i++) A['c' + i] = live('a' + i, 100 + i);      // 서버 = A 의 5마리
  const B = { c9: live('b', 50) };                                                       // 회사 PC · 오프라인 · 1마리 · ts 는 더 작기까지
  const r = M(B, A, { now: NOW });
  chk(keys(r.merged) === 'c1,c2,c3,c4,c5,c9', '② 3-7 재현 — 5 + 1 = 6마리, 아무도 안 잃는다');
  chk(keys(r.push) === 'c9' && keys(r.pull) === 'c1,c2,c3,c4,c5' && r.trash.length === 0, '  B 의 1마리는 올라가고 A 의 5마리는 내려온다 · trash 0');
  const back = M(A, Object.assign({}, A, r.push), { now: NOW });
  chk(keys(back.pull) === 'c9' && keys(back.push) === '' && back.trash.length === 0, '  A 가 다음 판에 받으면 c9 하나만 내려온다 — 5칸은 그대로');
}
{ // ③ 3-7 되감기
  const S = { c1: live('a1', 101), c2: live('a2', 102), c3: tomb(200) };     // A 가 c3 을 지웠다(묘비)
  const B = { c1: live('a1', 101), c2: live('a2', 102), c3: live('a3', 103) };
  const r = M(B, S, { now: NOW });
  chk(api._charsIsTomb(r.merged.c3) && keys(r.pull) === 'c3' && keys(r.push) === '', '③ 되감기 — B 에서 c3 이 내려가고 나머지는 조용');
  chk(r.trash.length === 1 && r.trash[0].cid === 'c3' && r.trash[0].def === 'a3' && r.trash[0].why === 'deleted', '  지워진 def 가 trash 에 남는다');
}
{ // ④ 미래 mtime
  const r = M({ c1: live('A', 10) }, { c1: live('F', NOW + 60*60*1000) }, { now: NOW });
  chk(r.fixed.length === 1 && r.merged.c1.mtime === NOW && keys(r.push) === 'c1' && keys(r.pull) === 'c1', '④ 서버 mtime 이 한 시간 미래 → 지금으로 찍어 올린다(push) · 로컬도 그 값으로(pull)');
  chk(r.trash.length === 1 && r.trash[0].def === 'A', '  그 판에 진 로컬 def 는 trash 에');
  const ok = M({ c1: live('A', 10) }, { c1: live('B', NOW + 60*1000) }, { now: NOW });
  chk(ok.fixed.length === 0 && ok.merged.c1.mtime === NOW + 60*1000, '  1분 앞은 허용 폭(5분) 안 — 안 건드린다');
  const t = M({}, { c1: tomb(NOW + 60*60*1000) }, { now: NOW });
  chk(t.fixed.length === 1 && api._charsIsTomb(t.merged.c1) && t.merged.c1.del === NOW, '  미래 묘비도 지금으로 찍는다(묘비는 묘비로)');
}
{ // ⑤ 지우는 갈래 없음
  const L = { c1: live('a', 1), c2: tomb(2) }, S = { c2: tomb(3), c3: live('c', 4), c4: tomb(5) };
  const r = M(L, S, { now: NOW });
  chk(keys(r.merged) === 'c1,c2,c3,c4', '⑤ merged 의 cid = 합집합 — 빠지는 것이 없다');
  chk(api._charsIsTomb(r.merged.c2) && r.merged.c2.del === 3 && api._charsIsTomb(r.merged.c4), '  묘비 vs 묘비는 새 것 · 묘비는 묘비로 남는다');
  chk(!/delete |remove|\.del\s*=\s*undefined/.test(body.replace(/\/\*[\s\S]*?\*\//g, '')), '  본문에 지우는 갈래가 없다(delete/remove 없음 · 주석 제외)');
}
{ // ⑥ 불변
  const L = { c1: live('A', 10) }, S = { c1: live('B', 20) };
  const LJ = JSON.stringify(L), SJ = JSON.stringify(S);
  const r = M(L, S, { now: NOW });
  chk(JSON.stringify(L) === LJ && JSON.stringify(S) === SJ, '⑥ 입력을 안 바꾼다');
  chk(r.pull.c1 === r.merged.c1, '  pull 의 것과 merged 의 것이 같은 참조');
  chk(/^c[a-z0-9]{6,24}$/.test(api._charsNewId()) && api._charsNewId() !== api._charsNewId(), '  _charsNewId — 규칙의 cid 모양(c + [a-z0-9]{6,24}) · 매번 다르다');
  chk(/window\._charsMerge = _charsMerge/.test(SRC), '  콘솔 출구 window._charsMerge');
  { // 개정 34: 부르는 자리는 이관 조율 블록(미리보기) 하나뿐 — 그 밖에서는 0. 블록이 없던 판(개정 32·33)이면 블록 밖 = 전체.
    const oa = SRC.indexOf('const CHARS_SYNC_ENABLED'), ob = SRC.indexOf('try{ window.charsMigrateDryRun');
    const orch = (oa >= 0 && ob > oa) ? SRC.slice(oa, ob) : '';
    const outside = SRC.replace(body, '').replace(orch, '').replace(/window\._charsMerge = _charsMerge/, '');
    chk(!/_charsMerge\(/.test(outside), '  이관 조율 블록 밖에서는 아무도 안 부른다(부팅·저장·동기화 어디서도 — 설계 §10-4 · 개정 34)');
  }
}

/* ── 2. 규칙 ── */
say('── 2. 규칙 파일 — chars · trash · charsMeta (이관 창: slots 는 아직 있다)');
if(fs.existsSync('firebase-database-rules.json')){
  let R = null; try{ R = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')); }catch(_){}
  const u = R && R.rules && R.rules.users && R.rules.users.$userId;
  if(!u){ chk(false, '규칙 파일에 users/$userId 가 없다'); }
  else{
    const own = "!root.child('userAuth/'+$userId).exists() || root.child('userAuth/'+$userId).val() === auth.uid";
    const c = u.chars, t = u.trash, m = u.charsMeta;
    chk(!!c && c['.write'] === own, '★ chars 블록 · .write 가 slots 와 같은 소유 식');
    chk(!!c && c.$cid && /c\[a-z0-9\]\{6,24\}/.test(c.$cid['.validate']) && /hasChild\('def'\) \|\| newData\.hasChild\('del'\)/.test(c.$cid['.validate']), '  cid 모양 · def 또는 del 이 있어야 한다');
    const slotDef = u.slots && u.slots.s && u.slots.s.$i && u.slots.s.$i['.validate'];
    chk(!!c && c.$cid && slotDef && slotDef.indexOf(c.$cid.def['.validate']) >= 0, '  def 검증이 slots.s.$i 와 같다(≤150000 · base64 금지)');
    chk(!!c && c.$cid && c.$cid.$other && c.$cid.$other['.validate'] === false, '  $other 거부');
    chk(!!t && !t['.write'] && t.$cid && t.$cid.$mtime && /!data\.exists\(\) && newData\.exists\(\)/.test(t.$cid.$mtime['.write']), '★ trash 는 붙이기만 — .write 가 **잎**에 있고(부모에 두면 내려와서 삭제를 막지 못한다) !data.exists() && newData.exists()');
    chk(!!t && t.$cid && t.$cid.$mtime && /overwritten/.test(t.$cid.$mtime.why['.validate']) && /deleted/.test(t.$cid.$mtime.why['.validate']), '  why 는 overwritten | deleted');
    chk(!!m && m['.write'] === own && m.migratedFrom && /'slots'/.test(m.migratedFrom['.validate']) && m.$other && m.$other['.validate'] === false, '  charsMeta — migratedFrom=slots · $other 거부');
    chk(!!u.slots && !!u.slotsPrev, '★ slots · slotsPrev 가 아직 있다 — 이관 창(N · N+1). N+2 에서 내린다(설계 §5)');
  }
} else huh('firebase-database-rules.json 없음 — 2절 검사못함');

say(`\n판정: 초록 ${pass} · 빨강 ${fail} · 검사못함 ${huhs}`);
process.exit(fail ? 1 : 0);
