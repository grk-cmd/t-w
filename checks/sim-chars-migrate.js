/* ═══ 🧬 sim-chars-migrate.js — 이관 slots → chars (회원가입 설계 §5-N-2 · 2026-09-21 · 개정 33 신규) ═══════════
   [무엇을 지키나] 5칸 저장본의 마리들에게 cid 를 붙이는 두 순수 함수 + 열쇠.
     «같은 마리가 cid 둘을 받는 것»(이관 첫 부팅에 5마리 → 10마리)과 «짝 못 지은 마리가 사라지는 것»(3-7 의 모양)을 동시에 막는다.
   ・1절: 열쇠 `_charsKeys` — 로컬 표현(dataURL)과 서버 표현(Storage URL)의 같은 마리가 같은 K1 · 치장만 고치면 K1 같고 K2 다름 ·
          그림이 다르면 K1 다름 · 해시 없는 옛 URL 은 K1 안 맞고 K2 로 맞음 · 캔버스 얼굴은 해시가 안 나온다
   ・2절: `_charsFromServerSlots` — 첫 이관 5 → 5 · 같은 문자열 두 칸 → cid 둘 · slotsPrev 의 다른 1마리 → 6번째(책상 밖) ·
          두 번째 기기(같은 slots) → 새 cid 0 · 이관 창 되돌이(옛 클라이언트가 치장 고침 → upd · 새 마리 → add) · 묘비와 짝
   ・3절: `_charsFromLocalSlots` + 병합 — 안 고친 기기 = push·pull·trash 0 · 고친 칸만 이김(K2) · 3-7 재현(오프라인 1마리 → 6마리) ·
          고친 기기 = 같은 cid 로 이기고 진 쪽은 trash · 한 번도 못 올린 기기(seen 부트스트랩) = 아무것도 안 잃음 · 옛 URL 도 중복 0 · 1:1
   ・4절: 정적 — 조율 블록 밖에서는 아무도 안 부른다 · 병합 블록 뒤에 있다(sim-chars-merge 의 떼어 오기 범위를 안 건드린다) · 콘솔 출구
   ・5절: 조율(개정 34) — 스위치 꺼짐 = 쓰기 0 · 두 기기 동시 → 한 기기만 · 되돌이 · 계정별 기록 · 쓰기 실패 뒤 10분 재선점 · 미리보기는 읽기만
   ・7절: 이 기기 쪽 첫 채택(개정 35) — 계획(안 고친 기기 0 · 실기기 재현 4/3 · 3-7 · 고침 · 바꿔 앉힘 · 내림 · 미래 시각) · 조율(스위치 · 실패하면 무변경 · 보관함은 서버 표현 · 두 번째는 무동작)
   ・6절: firebase-init 통로 일곱(개정 36 loadCharsMetaTs) · 선점 트랜잭션 · chars 는 update(+ charsMeta/ts 같은 update) · 휴지통은 한 줄씩 · why 두 값 · 규칙 claimAt · ts
   ・9절: 섬네일 URL(개정 37) — thumbUrl 은 열쇠에서 빠진다 · _slotToServerObj 가 섬네일을 올리되 못 올려도 push 를 안 접는다 · slotToObj 는 있을 때만 · loadSlots 가 옮겨 적는다
   ・8절: 평상시 동기화(개정 36) — 스위치 꺼짐·채택 전 = 훅 전부 무동작(★ 채택 전에 보관함 키를 만들면 첫 채택이 건너뛰어진다) ·
          saveSlots 는 cid 로 맞대어 고친 마리만 dirty · 당기기로 칸이 밀려도 dirty 아님 · 새 마리 · 20 문턱 · 휴지통 이동 ·
          ts 같으면 본문 안 받음 · 올림 · 바꿔 앉힘(기준 다시 잡기) · 내림 · 양쪽 고침 → 진 쪽 휴지통 · 실패하면 무변경 · 도중 바뀜 · 배선(정적)
   ・10절: 휴지통(개정 49) — 보관함 줄 → 묘비만(동기화 뒤 deleted 한 줄) · 복원본 cid 고정 · 보일 줄 고르기(기한 · 옮김 최근 한 줄 · 복원됨 접기 ·
          연동 교체는 원본을 다시 고쳐도 남음 · 복원본 있으면 접힘) · 복원(서버 먼저 · 같은 cid / 하나 더 · 두 번·다른 PC 한 개 · 20 막힘 · 실패 무변경)
   [실행] app.js 가 있는 폴더에서. 판정 줄은 맨 끝. */
'use strict';
const fs = require('fs');
if(!fs.existsSync('app.js')) process.exit(2);
const SRC = fs.readFileSync('app.js', 'utf8');

let pass = 0, fail = 0, huhs = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const huh = (msg) => { huhs++; say('  ? ' + msg); };
const done = () => { say(`\n판정: 초록 ${pass} · 빨강 ${fail} · 검사못함 ${huhs}`); process.exit(fail ? 1 : (huhs ? 2 : 0)); };

/* ── 본문 떼어 오기 ── */
const a = SRC.indexOf('const CHARS_KEY_SCALARS');
const b = SRC.indexOf('try{ window._charsFromServerSlots');
if(a < 0 || b < 0){ chk(false, 'app.js 에 이관 블록(_charsFromServerSlots)이 없다'); done(); }
const body = SRC.slice(a, b);
const ma = SRC.indexOf('const CHARS_SKEW_TOL_MS'), mb = SRC.indexOf('try{ window._charsMerge');
const qa = SRC.indexOf('function _quickHash(str){');
const fa = SRC.indexOf('const SLOT_IMG_FIELDS = [');
if(ma < 0 || mb < 0 || qa < 0 || fa < 0){ huh('병합 블록 · _quickHash · SLOT_IMG_FIELDS 중 못 찾은 것이 있다'); done(); }
const fnEnd = (src, i) => { let d = 0; for(let j = src.indexOf('{', i); j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}' && --d === 0) return j + 1; } return -1; };
const quick = SRC.slice(qa, fnEnd(SRC, qa));
const fields = SRC.slice(fa, SRC.indexOf('];', fa) + 2);
const merge = SRC.slice(ma, mb);
const NOW = 1_800_000_000_000;
const api = new Function('SLOTS_TS_SKEW_TOL_MS', '_slotsNow', 'CHAR_SLOT_MAX',
  quick + '\n' + fields + '\n' + merge + '\n' + body +
  '\nreturn { _quickHash, _charsMerge, _charsNewId, _charsKeys, _charsImgKey, _charsFromServerSlots, _charsFromLocalSlots };')(5*60*1000, () => NOW, 5);
const K = api._charsKeys, SV = api._charsFromServerSlots, LO = api._charsFromLocalSlots, M = api._charsMerge;
const keys = (o) => Object.keys(o).sort().join(',');
const n = (o) => Object.keys(o).length;

/* ── 픽스처 — 로컬 표현(dataURL)과 서버 표현(URL) ── */
const img = (tag) => 'data:image/png;base64,' + Buffer.from('png-' + tag).toString('base64');
const url = (key, dataUrl) => 'https://firebasestorage.googleapis.com/v0/b/tw.appspot.com/o/users%2Fu1%2Froomface_' + key + '_' + api._quickHash(dataUrl) + '.png?alt=media&token=abc';
const loc = (t, extra) => Object.assign({ skin: 1, top: '#a' + t, bot: '#b' + t, xf: { s: 1, y: 0 }, equippedParts: null,
  face: img('face' + t), blink: img('blink' + t), animal: false, animalFace: 0, thumb: null }, extra || {});
const toSrv = (o) => { const out = Object.assign({}, o); delete out.thumb;
  for(const [f, k] of [['face','face'],['blink','blink']]){ out[f + 'Url'] = url(k, o[f]); delete out[f]; } return out; };
const srvJs = (o) => JSON.stringify(toSrv(o));
const slotsOf = (arr, ts) => { const s = {}; arr.forEach((o, i) => { if(o) s[String(i)] = typeof o === 'string' ? o : srvJs(o); }); return { ts, v: 1, s }; };
const chars5 = [1, 2, 3, 4, 5].map(i => loc(i));

/* ── 1. 열쇠 ── */
say('── 1. _charsKeys — 표현이 달라도 같은 마리는 같은 열쇠');
{
  const L = K(chars5[0]), S = K(srvJs(chars5[0]));
  chk(!!L && !!L.k1 && L.k1 === S.k1, '★ 로컬(dataURL) ↔ 서버(Storage URL) 의 같은 마리 → K1 같다');
  chk(L.k2 === S.k2, '  그림 말고는 같으니 K2 도 같다');
  chk(K(chars5[1]).k1 !== L.k1, '  다른 마리(그림이 다름) → K1 다르다');
  const dressed = K(Object.assign({}, chars5[0], { xf: { s: 1.2, y: 3 }, equippedParts: { hat: { id: 'h1', pic: img('pic') } } }));
  chk(dressed.k1 === L.k1 && dressed.k2 !== L.k2, '  치장(xf · 파츠)만 고침 → K1 같고 K2 다르다 — «같은 마리를 고친 것»');
  const old = JSON.parse(srvJs(chars5[0])); old.faceUrl = 'https://firebasestorage.googleapis.com/v0/b/tw.appspot.com/o/roomFaces%2Fu1%2Fface.png?alt=media';
  const O = K(JSON.stringify(old));
  chk(O.k1 !== L.k1 && O.k2 === L.k2, '  해시 없는 옛 URL → K1 은 안 맞고 K2 로 맞는다');
  chk(api._charsImgKey({ toDataURL(){ return 'x'; } }) === null, '  캔버스 얼굴은 해시가 안 나온다(LS_KEY 원본을 넣어야 하는 이유)');
  chk(K('{깨짐') === null && K(null) === null, '  깨진 JSON · null → null (던지지 않는다)');
  const zero = K(Object.assign({}, chars5[0], { skin: 0, animal: false })), undef = K(Object.assign({}, chars5[0], { skin: undefined, animal: undefined }));
  chk(zero.k1 === undef.k1, '  0 · false · 없음 은 K1 에서 같은 값(slotToObj 의 ||0 · ||false)');
}

/* ── 2. 서버 이관 ── */
say('── 2. _charsFromServerSlots — 서버에서 한 번 · 이관 창 되돌이');
const T0 = 1000;
const first = SV(slotsOf(chars5, T0), null, {});
{
  chk(n(first.add) === 5 && n(first.upd) === 0, '① 첫 이관: slots 5 → chars 5 (add 5 · upd 0)');
  chk(first.deskCids.every(c => c && first.add[c]) && new Set(first.deskCids).size === 5, '  책상 5칸이 서로 다른 cid 를 가리킨다');
  chk(Object.values(first.add).every(e => e.mtime === T0 && e.v === 1 && typeof e.def === 'string'), '  mtime = slots.ts · def 는 slots.s 문자열 그대로(규칙 검증이 같다)');
  chk(Object.keys(first.add).every(c => /^c[a-z0-9]{6,24}$/.test(c)), '  cid 가 규칙 모양');
  const dup = SV(slotsOf([chars5[0], chars5[0]], T0), null, {});
  chk(n(dup.add) === 2 && dup.deskCids[0] !== dup.deskCids[1], '  같은 캐릭터를 두 칸에 둔 사람 → cid 둘(1:1)');
}
{
  const prev = slotsOf([chars5[0], chars5[1], chars5[2], chars5[3], loc(9)], 900);
  const r = SV(slotsOf(chars5, T0), prev, {});
  const extra = Object.keys(r.add).filter(c => r.deskCids.indexOf(c) < 0);
  chk(n(r.add) === 6 && extra.length === 1 && r.add[extra[0]].mtime === 900, '② slotsPrev 에만 있는 1마리 → 6번째 · 책상 밖 · mtime = prev.ts');
}
const chars = Object.assign({}, first.add);
{
  const second = SV(slotsOf(chars5, T0), null, chars);
  chk(n(second.add) === 0 && n(second.upd) === 0, '★ ③ 두 번째 기기(같은 slots) → 새 cid 0 · 고칠 것 0');
  chk(second.deskCids.join() === first.deskCids.join(), '  책상 칸이 같은 cid 로 이어진다');
}
{
  const edited = chars5.slice(); edited[2] = Object.assign({}, chars5[2], { xf: { s: 1.5, y: 0 } }); edited[4] = null;
  const r = SV(slotsOf(edited.concat(), 2000), null, chars);
  chk(n(r.upd) === 1 && r.upd[first.deskCids[2]] && r.upd[first.deskCids[2]].mtime === 2000, '④ 되돌이: 옛 클라이언트가 3번 칸 치장을 고침 → 같은 cid 에 upd(mtime = 새 slots.ts)');
  chk(n(r.add) === 0 && r.deskCids[4] === null, '  빠진 칸은 아무것도 안 한다(묘비를 만들지 않는다 — 옛 클라이언트의 5칸은 소유 목록이 아니다)');
  const withNew = chars5.slice(0, 4).concat([loc(7)]);
  const r2 = SV(slotsOf(withNew, 2000), null, chars);
  chk(n(r2.add) === 1 && n(r2.upd) === 0, '  옛 클라이언트가 새 마리를 만듦 → add 1');
  const stale = SV(slotsOf(chars5.map((o, i) => i === 2 ? Object.assign({}, o, { xf: { s: 9 } }) : o), 500), null, chars);
  chk(n(stale.upd) === 0, '  slots.ts 가 항목보다 옛것이면 고치지 않는다');
}
{
  const c3 = first.deskCids[2];
  const withTomb = Object.assign({}, chars, { [c3]: { del: 1500, keys: K(srvJs(chars5[2])) } });
  const later = SV(slotsOf(chars5, 2000), null, withTomb);
  chk(later.upd[c3] && n(later.add) === 0, '⑤ 묘비와 짝: slots 가 더 나중이면 같은 cid 로 되살린다(병합의 «산 vs 묘비» 와 같은 규칙) · 새 cid 0');
  const earlier = SV(slotsOf(chars5, 1200), null, withTomb);
  chk(!earlier.upd[c3] && n(earlier.add) === 0, '  묘비가 더 나중이면 안 되살린다 · 새 cid 로도 안 만든다');
}

/* ── 3. 이 기기 5칸 → 병합까지 ── */
say('── 3. _charsFromLocalSlots + 병합 — 아무도 안 잃고 · 같은 마리는 하나');
const serverChars = chars, sDesk = first.deskCids;
{
  const r = LO(chars5, T0, serverChars, sDesk);
  chk(r.fresh.length === 0 && r.deskCids.join() === sDesk.join(), '★ 안 고친 기기: 새 cid 0 · 책상 칸 = 서버 칸');
  const m = M(r.local, serverChars, { now: NOW });
  chk(n(m.push) === 0 && n(m.pull) === 0 && m.trash.length === 0, '  병합: push 0 · pull 0 · trash 0 (이관 한 번에 휴지통이 안 찬다)');
}
{
  const offline = [loc(8), null, null, null, null];
  const r = LO(offline, 3000, serverChars, sDesk);
  const m = M(r.local, serverChars, { now: NOW });
  chk(r.fresh.length === 1 && n(m.merged) === 6 && n(m.push) === 1 && n(m.pull) === 5 && m.trash.length === 0, '★ 3-7 재현: 오프라인 1마리 기기 → 6마리 · 그 1마리 push · 5마리 pull · trash 0');
}
{
  const edited = chars5.map((o, i) => i === 0 ? Object.assign({}, o, { xf: { s: 2 } }) : o);
  const r = LO(edited, 3000, serverChars, sDesk);
  const m = M(r.local, serverChars, { now: NOW });
  chk(r.fresh.length === 0 && n(m.push) === 1 && m.push[sDesk[0]] && m.trash.length === 1 && m.trash[0].why === 'overwritten',
    '  고친 기기: 같은 cid 로 이긴다 · 새 cid 0 · 진 서버 본은 trash(overwritten)');
  chk(r.local[sDesk[1]].mtime === T0 && r.local[sDesk[0]].mtime === 3000, '★ 안 고친 칸은 서버 시각 · 고친 칸만 localTs — 5칸 시각이 통째 하나여도 K2 가 칸을 가른다');
  const stale = LO(chars5.map((o, i) => i === 0 ? Object.assign({}, o, { xf: { s: 0.5 } }) : o), 500, serverChars, sDesk);
  const ms = M(stale.local, serverChars, { now: NOW });
  chk(n(ms.push) === 0 && ms.pull[sDesk[0]] && ms.trash.length === 1, '  안 고친 기기인데 칸 내용이 서버와 다름(다른 기기가 고침) → 서버가 이겨 pull · 옛 모습은 trash');
}
{
  const mine = [11, 12, 13].map(i => loc(i));
  const r = LO(mine, 700, serverChars, sDesk);                       // seen 부트스트랩으로 «안 고친 기기» 처럼 보이지만 한 번도 못 올렸다
  const m = M(r.local, serverChars, { now: NOW });
  chk(r.fresh.length === 3 && n(m.merged) === 8 && n(m.push) === 3, '★ 한 번도 못 올린 기기(clean 으로 보임): 짝 없는 3마리를 버리지 않는다 → 8마리');
}
{
  const oldSrv = {};
  for(const cid in serverChars){ const o = JSON.parse(serverChars[cid].def); o.faceUrl = o.faceUrl.replace(/_h2[0-9a-z]+\.png/, '.png'); o.blinkUrl = o.blinkUrl.replace(/_h2[0-9a-z]+\.png/, '.png'); oldSrv[cid] = { def: JSON.stringify(o), mtime: T0, v: 1 }; }
  const r = LO(chars5, T0, oldSrv, sDesk);
  chk(r.fresh.length === 0 && r.deskCids.join() === sDesk.join(), '  옛 이름 URL(해시 없음) 서버 + 안 고친 기기 → K2 로 전부 짝 · 중복 0');
}
{
  const twin = SV(slotsOf([chars5[0]], T0), null, {});
  const r = LO([chars5[0], chars5[0]], 3000, twin.add, twin.deskCids);
  chk(r.fresh.length === 1 && r.deskCids[0] === twin.deskCids[0] && r.deskCids[1] !== r.deskCids[0], '  1:1 — 같은 마리 두 칸 · 서버 한 마리 → 하나는 짝(같은 칸 번호 먼저) · 하나는 새 cid');
  const prefer = LO([null, chars5[0]], 3000, Object.assign({}, twin.add, SV(slotsOf([null, chars5[0]], T0), null, twin.add).add), [null, null]);
  chk(Object.keys(prefer.local).length === 1, '  열쇠가 같은 후보가 여럿이어도 한 칸에는 한 마리');
}
{
  const before = JSON.stringify(serverChars), ld = JSON.stringify(chars5);
  LO(chars5, 3000, serverChars, sDesk); SV(slotsOf(chars5, 2000), null, serverChars);
  chk(JSON.stringify(serverChars) === before && JSON.stringify(chars5) === ld, '  입력 불변(서버 chars · 로컬 def)');
}

/* ── 4. 정적 ── */
say('── 4. 자리 · 배선');
const oa = SRC.indexOf('const CHARS_SYNC_ENABLED'), ob = SRC.indexOf('try{ window.charsMigrateDryRun');
const orch = (oa >= 0 && ob > oa) ? SRC.slice(oa, ob) : '';
const rest = SRC.replace(body, '').replace(orch, '').replace(/try\{ window\._charsFromServerSlots[^\n]*\n/, '');
chk(!/_charsFrom(Server|Local)Slots\(/.test(rest), '이관 조율 블록 밖에서는 아무도 안 부른다(설계 §10-4 — 부팅·저장·동기화 어디서도)');
chk(mb < a, '  병합 블록(sim-chars-merge 가 떼어 가는 범위) 뒤에 있다');
chk(!/_charsMerge\(/.test(body), '  이관 블록(순수 함수)이 병합을 직접 부르지 않는다 — 부르는 것은 조율 블록');
chk(/window\._charsFromServerSlots = _charsFromServerSlots/.test(SRC) && /window\._charsFromLocalSlots = _charsFromLocalSlots/.test(SRC), '  콘솔 출구 둘');
chk(!/localStorage|firebaseAPI/.test(body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')), '  순수 — 본문(주석 뺀)에 localStorage · firebaseAPI 가 없다');


/* ── 7. 이 기기 쪽 첫 채택 (개정 35) ── */
async function sec7(){
  say('── 7. _charsPlanLocalAdopt · _charsLocalAdopt — 보관함은 서버 표현 · 책상만 그림 · 실패하면 아무것도 안 바꿈');
  if(!/function _charsPlanLocalAdopt\(/.test(orch) || !/async function _charsLocalAdopt\(/.test(orch)){ chk(false, '첫 채택 함수 둘이 조율 블록 안에 없다'); return; }
  const lsx = {}, stubDb = { chars: {}, meta: null, slots: null, writes: [], trash: [] };
  const calls = { up: 0, down: 0, load: 0 };
  let failUp = -1, failDown = false;
  const api = {
    async loadCharsRemote(){ return { chars: JSON.parse(JSON.stringify(stubDb.chars)), meta: stubDb.meta }; },
    async loadSlotsRemote(){ return JSON.parse(JSON.stringify(stubDb.slots)); },
    async saveCharsEntries(uid, e){ stubDb.writes.push(e); Object.assign(stubDb.chars, JSON.parse(JSON.stringify(e))); return true; },
    async appendCharsTrash(uid, l){ stubDb.trash.push(...l); return l.length; },
    async loadCharsTrashLatest(uid, cids){ if(api.failTrash) return null; const o = {}; for(const c of cids){ const hit = stubDb.trash.filter(t => t.cid === c).sort((a, b) => b.mtime - a.mtime)[0]; if(hit) o[c] = hit.def; } return o; },
  };
  const slotsMem = new Array(5).fill(1);
  const mk7 = (enabled, localTs) => new Function('window', 'firebaseAPI', 'localStorage', 'MY_USER_ID_KEY', 'LS_KEY', '_slotsTs', '_slotsNow', 'CHAR_SLOT_MAX', 'SLOTS_TS_SKEW_TOL_MS', 'console',
      '_roomFaceCacheLoad', '_roomFaceCacheSave', '_slotGlbCacheLoad', '_slotGlbCacheSave', '_slotToServerObj', '_slotFromServerObj', 'SLOT_JSON_MAX',
      '_slotsBackupSave', '_slotsFilledCount', 'slots', '_faceEverDrawn', '_blinkEverDrawn', 'loadSlots',
      quick + '\n' + fields + '\n' + merge + '\n' + body + '\n' + orch.replace(/const CHARS_SYNC_ENABLED = (?:true|false);/, 'const CHARS_SYNC_ENABLED = ' + (enabled ? 'true' : 'false') + ';') +
      '\nreturn { _charsPlanLocalAdopt, _charsLocalAdopt };')(
      { firebaseAPI: api }, api,
      { getItem: k => (k in lsx ? lsx[k] : null), setItem: (k, v) => { lsx[k] = String(v); } },
      'tw.myUserId', 'deskFriends.slots.v1', localTs || 0, () => 9000, 5, 5*60*1000, { log(){}, table(){}, warn(){} },
      () => ({}), () => {}, () => ({}), () => {},
      async (uid, o) => { calls.up++; if(calls.up === failUp) return null; return toSrv(o); },
      async (so) => { calls.down++; if(failDown) throw new Error('x'); const o = Object.assign({}, so); o.face = 'data:dl'; o.blink = 'data:dl'; delete o.faceUrl; delete o.blinkUrl; return o; },
      150000, () => true, () => 0, slotsMem, [], [], async () => { calls.load++; });
  /* 계획 — 순수 */
  const P = mk7(false)._charsPlanLocalAdopt;
  const sc = first.add, sd = first.deskCids;
  { const p = P(chars5, T0, sc, sd, { now: NOW });
    chk(Object.keys(p.box).length === 5 && Object.values(p.box).every(e => typeof e.def === 'string') && !p.upload.length && !p.reseat.length && !p.trashServer.length && !p.trashLocal.length,
      '★ 안 고친 기기: 보관함 5 전부 서버 표현(문자열) · 올릴 것·바꿔 앉힐 것·휴지통 0'); }
  { const real = SV(slotsOf([chars5[0], chars5[1], chars5[2], chars5[3]], T0), null, {});
    const p = P([chars5[0], chars5[1], chars5[2]], T0, real.add, [real.deskCids[0], real.deskCids[1], real.deskCids[2], null, null], { now: NOW });
    chk(Object.keys(p.box).length === 4 && p.deskCids.filter(Boolean).length === 3 && !p.upload.length && !p.reseat.length,
      '  실기기 재현(서버 4 · 이 기기 3 · 전부 K1 같음) → 보관함 4 · 책상 3 · 넷째는 보관함에만(책상에 억지로 안 올림)'); }
  { const p = P([loc(8), null, null, null, null], 3000, sc, sd, { now: NOW });
    chk(Object.keys(p.box).length === 6 && p.upload.length === 1 && p.upload[0].slot === 0 && p.box[p.upload[0].cid].dirty === true, '★ 3-7 재현: 보관함 6 · 1번 칸 올릴 것(dirty)'); }
  { const ed = chars5.map((o, i) => i === 0 ? Object.assign({}, o, { xf: { s: 2 } }) : o);
    const p = P(ed, 3000, sc, sd, { now: NOW });
    chk(p.upload.length === 1 && p.trashServer.length === 1 && p.trashServer[0].why === 'overwritten' && !p.trashLocal.length, '  이 기기가 고침 → 그 칸만 올림 · 진 서버 본은 그대로 휴지통(서버 표현)'); }
  { const ed = chars5.map((o, i) => i === 0 ? Object.assign({}, o, { xf: { s: 0.5 } }) : o);
    const p = P(ed, 500, sc, sd, { now: NOW });
    chk(p.reseat.length === 1 && p.reseat[0].slot === 0 && p.trashLocal.length === 1 && p.trashLocal[0].slot === 0 && !p.upload.length,
      '★ 다른 기기가 고침(서버가 나중) → 1번 칸 바꿔 앉힘 · 이 기기의 옛 모습은 올려서 휴지통(trashLocal)'); }
  { const tc = sd[1], bare = Object.assign({}, sc, { [tc]: { del: 2000 } });
    const pb = P(chars5, T0, bare, sd, { now: NOW });
    chk(!pb.unseat.length && pb.fresh.length === 1, '  (열쇠 없는 묘비면 되살아난다 — 그래서 조율이 휴지통으로 열쇠를 단다 · 아래 줄)');
    const sct = Object.assign({}, sc, { [tc]: { del: 2000, keys: K(sc[tc].def) } });
    const p = P(chars5, T0, sct, sd, { now: NOW });
    chk(p.unseat.length === 1 && p.unseat[0] === 1 && p.deskCids[1] === null && p.box[tc].del === 2000 && p.trashLocal.length === 1 && p.trashLocal[0].why === 'deleted',
      '  다른 기기가 지움(묘비가 나중) → 2번 칸 내림 · 보관함엔 묘비 · 이 기기 것은 휴지통(deleted)'); }
  { const fut = Object.assign({}, sc); const c0 = sd[0]; fut[c0] = Object.assign({}, sc[c0], { mtime: NOW + 3600e3 });
    const p = P(chars5, T0, fut, sd, { now: NOW });
    chk(p.pushServer[c0] && p.pushServer[c0].mtime === NOW && !p.upload.length, '  서버 미래 시각 → 지금으로 정정해 올릴 것(pushServer) · 칸을 올리진 않는다'); }
  /* 조율 — 스텁 */
  stubDb.chars = JSON.parse(JSON.stringify(sc)); stubDb.meta = { migratedAt: 1 }; stubDb.slots = slotsOf(chars5, T0);
  lsx['deskFriends.slots.v1'] = JSON.stringify([loc(8)].concat(chars5.slice(1)));
  const off = await mk7(false, 3000)._charsLocalAdopt('u1');
  chk(!off.ok && !stubDb.writes.length && !('deskFriends.chars.v1' in lsx), '① 스위치 꺼짐 → 서버·로컬 쓰기 0');
  failUp = 1;
  const f1 = await mk7(true, 3000)._charsLocalAdopt('u1');
  chk(!f1.ok && !stubDb.writes.length && !('deskFriends.chars.v1' in lsx) && !('deskFriends.chars.desk' in lsx), '★ ② 칸 하나 못 올림 → 서버·로컬 아무것도 안 바뀜(다음에 처음부터)');
  failUp = -1; calls.up = 0;
  const ok = await mk7(true, 3000)._charsLocalAdopt('u1');
  const box = JSON.parse(lsx['deskFriends.chars.v1'] || '{}'), desk = JSON.parse(lsx['deskFriends.chars.desk'] || '[]');
  chk(ok.ok && ok.did === '첫 채택' && Object.keys(box).length === 6 && Object.values(box).every(e => typeof e.def === 'string' && !e.dirty), '★ ③ 성공: 보관함 6 · 전부 서버 표현(올린 것도 문자열로 · dirty 없음)');
  chk(desk.filter(Boolean).length === 5 && desk.every(c => !c || box[c]), '  책상 표 5칸 · 전부 보관함의 cid');
  chk(!/data:image/.test(lsx['deskFriends.chars.v1']), '★ 보관함 로컬 사본에 그림(dataURL)이 없다 — localStorage 한도');
  chk(stubDb.writes.length === 1 && Object.keys(stubDb.writes[0]).length === 1 && calls.load === 0, '  서버 쓰기 1번(새 마리 1) · 칸이 안 바뀌었으니 다시 읽기 없음');
  const again = await mk7(true, 3000)._charsLocalAdopt('u1');
  chk(again.did === '이미 채택함' && stubDb.writes.length === 1, '  두 번째 → 이미 채택함 · 쓰기 없음');
  delete lsx['deskFriends.chars.v1']; delete lsx['deskFriends.chars.desk']; stubDb.writes = []; calls.load = 0;
  lsx['deskFriends.slots.v1'] = JSON.stringify(chars5.map((o, i) => i === 0 ? Object.assign({}, o, { xf: { s: 0.5 } }) : o));
  failDown = true;
  const f2 = await mk7(true, 500)._charsLocalAdopt('u1');
  chk(!f2.ok && !stubDb.writes.length && !('deskFriends.chars.v1' in lsx), '  바꿔 앉힐 칸의 그림을 못 받음 → 아무것도 안 바뀜');
  failDown = false;
  const r2 = await mk7(true, 500)._charsLocalAdopt('u1');
  const s0 = JSON.parse(lsx['deskFriends.slots.v1'])[0];
  chk(r2.ok && r2.reseat === 1 && s0.face === 'data:dl' && calls.load === 1 && stubDb.trash.some(t => t.why === 'overwritten'), '★ ④ 바꿔 앉힘: 1번 칸이 서버 본으로 · 다시 읽기 1번 · 옛 모습은 휴지통');
  /* ⑤ 다른 기기에서 지운 마리 — 휴지통의 마지막 모습으로 알아보고 칸에서 내린다 */
  { delete lsx['deskFriends.chars.v1']; delete lsx['deskFriends.chars.desk']; stubDb.writes = []; stubDb.trash = []; calls.load = 0;
    const tc = sd[2]; stubDb.chars = JSON.parse(JSON.stringify(sc)); stubDb.chars[tc] = { del: 2000 };
    stubDb.trash.push({ cid: tc, def: sc[tc].def, mtime: T0, why: 'deleted' });
    lsx['deskFriends.slots.v1'] = JSON.stringify(chars5);
    api.failTrash = true;
    const w = await mk7(true, T0)._charsLocalAdopt('u1');
    chk(!w.ok && !('deskFriends.chars.v1' in lsx), '  휴지통을 못 읽으면 채택을 미룬다(되살림보다 기다림)');
    api.failTrash = false;
    const r5 = await mk7(true, T0)._charsLocalAdopt('u1');
    const bx = JSON.parse(lsx['deskFriends.chars.v1']), dk = JSON.parse(lsx['deskFriends.chars.desk']), sl5 = JSON.parse(lsx['deskFriends.slots.v1']);
    chk(r5.ok && r5.unseat === 1 && dk[2] === null && sl5[2] === null && bx[tc].del === 2000 && Object.keys(bx).length === 5 && !stubDb.writes.some(e => Object.keys(e).length),
      '★ ⑤ 다른 기기에서 지운 마리 → 3번 칸 내림 · 보관함엔 묘비 · 새 cid 로 안 되살림 · 서버 chars 쓰기 0'); }
  const lsrc = orch.slice(orch.indexOf('async function _charsLocalAdopt('), orch.indexOf('/* ── 🧬 평상시 동기화'));
  const iSave = lsrc.indexOf('saveCharsEntries'), iLocal = lsrc.indexOf('localStorage.setItem(LS_KEY'), iBox = lsrc.indexOf('localStorage.setItem(CHARS_BOX_KEY');
  chk(iSave > 0 && iLocal > iSave && iBox > iLocal, '  순서: 서버 쓰기 → 책상 칸 → 보관함 표(보관함 키 = 채택 완료 표시라 맨 끝)');
  chk(/_slotsBackupSave\(/.test(lsrc), '  책상 칸을 바꿀 땐 통째 교체와 같은 백업을 지난다');
}

/* ── 8. 평상시 동기화 (개정 36) ── */
async function sec8(){
  say('── 8. 평상시 동기화 — 훅은 채택 뒤에만 · 고친 마리만 올림 · ts 같으면 안 받음 · 실패하면 아무것도 안 바꿈');
  const need = ['_charsActive', '_charsAfterSave', '_charsOnNew', '_charsTrashMove', '_charsBoxFull', '_charsPlanSync', '_charsSync', '_charsBoot', '_charsRemapDesk', '_charsDeleteWords'];
  const miss = need.filter(n => !new RegExp('function ' + n + '\\(').test(orch));
  if(miss.length){ chk(false, '평상시 동기화 함수가 조율 블록 안에 없다: ' + miss.join(' · ')); return; }
  /* 개정 49 휴지통 — 없으면 10 이 빨강 하나로 알리고, 나머지 8 은 그대로 돈다(떼어 온 본문에 없는 이름을 return 에 넣으면 통째로 죽는다). */
  const need10 = ['_charsBoxTrash', '_charsBoxTrashMany', '_charsRestoreCid', '_charsTrashView', '_charsRestore'];
  const has10 = need10.filter(n => new RegExp('function ' + n + '\\(').test(orch));
  const BOX = 'deskFriends.chars.v1', DESK = 'deskFriends.chars.desk', PEND = 'deskFriends.chars.trashPend', LSK = 'deskFriends.slots.v1';
  const mk8 = (enabled, st) => {
    const ls = st.ls, db = st.db;
    const api = {
      async loadCharsMetaTs(){ st.calls.ts++; return st.failTs ? null : db.ts; },
      async loadCharsRemote(){ st.calls.body++; if(st.onBody) st.onBody(); return st.failBody ? null : { chars: JSON.parse(JSON.stringify(db.chars)), meta: { migratedAt: 1 } }; },
      async saveCharsEntries(uid, e){ if(st.failSave) return false; db.writes.push(JSON.parse(JSON.stringify(e))); Object.assign(db.chars, JSON.parse(JSON.stringify(e))); db.ts += 10; return db.ts; },
      async appendCharsTrash(uid, l){ db.trash.push(...l); return l.length; },
    };
    const toasts = [];
    const f = new Function('window', 'firebaseAPI', 'localStorage', 'MY_USER_ID_KEY', 'LS_KEY', '_slotsTs', '_slotsNow', 'CHAR_SLOT_MAX', 'SLOTS_TS_SKEW_TOL_MS', 'console',
      '_roomFaceCacheLoad', '_roomFaceCacheSave', '_slotGlbCacheLoad', '_slotGlbCacheSave', '_slotToServerObj', '_slotFromServerObj', 'SLOT_JSON_MAX',
      '_slotsBackupSave', '_slotsFilledCount', 'slots', '_faceEverDrawn', '_blinkEverDrawn', 'loadSlots', 'saveSlots', 'toast', 'creatorOpen', 'setTimeout', 'clearTimeout',
      quick + '\n' + fields + '\n' + merge + '\n' + body + '\n' + orch.replace(/const CHARS_SYNC_ENABLED = (?:true|false);/, 'const CHARS_SYNC_ENABLED = ' + (enabled ? 'true' : 'false') + ';') +
      '\nreturn { ' + need.concat(has10).join(', ') + ', gen: () => _charsGen, bump: () => { _charsGen++; } };');
    const o = f({ firebaseAPI: api }, api,
      { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
      'tw.myUserId', LSK, 0, () => st.now, 5, 5*60*1000, { log(){}, table(){}, warn(){} },
      () => ({}), () => {}, () => ({}), () => {},
      async (uid, x) => { st.calls.up++; return st.failUp ? null : toSrv(x); },
      async (so) => { st.calls.down++; if(st.failDown) throw new Error('x'); const x = Object.assign({}, so); x.face = 'data:dl' + so.faceUrl.length; x.blink = 'data:dl'; delete x.faceUrl; delete x.blinkUrl; return x; },
      150000, () => true, () => 0, new Array(5).fill(1), [], [], async () => { st.calls.load++; }, () => { st.calls.save++; },
      (m) => toasts.push(m), !!st.creatorOpen, (fn) => { st.calls.timer++; return 1; }, () => {});
    o.toasts = toasts;
    return o;
  };
  const fresh = () => ({ ls: {}, db: { chars: {}, ts: 100, writes: [], trash: [] }, calls: { ts: 0, body: 0, up: 0, down: 0, load: 0, save: 0, timer: 0 }, now: 5000 });
  const three = chars5.slice(0, 3);
  const cids = ['caaaaaa1', 'cbbbbbb2', 'cccccc03'];
  const adopted = (st) => {                                             // 첫 채택을 마친 기기 — 서버와 같다
    const box = {}; three.forEach((o, i) => { box[cids[i]] = { def: srvJs(o), mtime: 1000 + i }; st.db.chars[cids[i]] = { def: srvJs(o), mtime: 1000 + i, v: 1 }; });
    st.ls[BOX] = JSON.stringify(box); st.ls[DESK] = JSON.stringify([cids[0], cids[1], cids[2], null, null]);
    st.ls[LSK] = JSON.stringify(three.concat([null, null]));
    st.ls['deskFriends.chars.metaTs:u1'] = String(st.db.ts); st.ls['tw.myUserId'] = 'u1';
  };
  const box = (st) => JSON.parse(st.ls[BOX] || 'null'), desk = (st) => JSON.parse(st.ls[DESK] || 'null');
  const out3 = (arr) => arr.concat(new Array(5 - arr.length).fill(null));

  /* ① 스위치 꺼짐 */
  { const st = fresh(); adopted(st); const b0 = st.ls[BOX]; const o = mk8(false, st);
    o._charsAfterSave(out3([Object.assign({}, three[0], { xf: { s: 9 } })].concat(three.slice(1))));
    const r = await o._charsSync('save');
    chk(!o._charsActive() && o._charsOnNew(3) === null && o._charsTrashMove(0) === false && o._charsBoxFull() === false && st.ls[BOX] === b0 && !r.ok && st.calls.ts === 0,
      '① 스위치 꺼짐 → 훅 전부 무동작 · 보관함 그대로 · 서버 읽기 0');
    chk(o._charsDeleteWords().btn === '캐릭터 삭제' && o._charsDeleteWords().done === '삭제했어요', '  꺼짐 → 런처 문구는 옛것(«캐릭터 삭제» · 휴지통이 없는 동안 «휴지통» 이라 적지 않는다)'); }
  /* ② 켜졌지만 채택 전 */
  { const st = fresh(); st.ls[LSK] = JSON.stringify(out3(three)); const o = mk8(true, st);
    o._charsAfterSave(out3(three)); o._charsOnNew(3); o._charsTrashMove(0); o._charsRemapDesk();
    chk(!(BOX in st.ls) && !(DESK in st.ls) && !(PEND in st.ls) && o._charsBoxFull() === false,
      '★ ② 켜졌지만 첫 채택 전 → 보관함·책상 표·휴지통 줄 키를 안 만든다(만들면 첫 채택이 «이미 채택함» 으로 건너뛰어진다)'); }
  /* ③ 칸 고침 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    const b1 = box(st);
    chk(cids.every(c => b1[c].h && !b1[c].dirty && typeof b1[c].def === 'string') && st.calls.timer === 0, '★ ③ 첫 저장(기준 없음) → 기준만 잡고 고침으로 치지 않는다 · 올림 예약 0(받은 것을 도로 올리는 핑퐁 방지)');
    const g0 = o.gen();
    const ed = out3([three[0], Object.assign({}, three[1], { xf: { s: 2 } }), three[2]]);
    st.now = 6000; o._charsAfterSave(ed);
    const b2 = box(st);
    chk(b2[cids[1]].dirty && b2[cids[1]].def === null && b2[cids[1]].mtime === 6000 && !b2[cids[0]].dirty && !b2[cids[2]].dirty && o.gen() === g0 + 1 && st.calls.timer === 1,
      '  2번 칸만 고침 → 그 cid 만 dirty(서버 표현 버림 · mtime 지금) · 나머지 그대로 · 올림 예약');
    o._charsAfterSave(ed);
    chk(box(st)[cids[1]].mtime === 6000 && st.calls.timer === 1, '  같은 내용으로 또 저장 → 아무 일 없음');
    chk(box(st)[cids[1]].base === 1001 && box(st)[cids[1]].k && box(st)[cids[1]].k.k1, '  dirty 에 base(고치기 시작한 서버 시각) · 열쇠(k) — 휴지통 판정 · 백업 되돌리기 짝짓기용');
    const b3 = box(st); delete b3[cids[0]].h; st.ls[BOX] = JSON.stringify(b3);
    o._charsAfterSave(out3([Object.assign({}, three[0], { xf: { s: 8 } }), ed[1], ed[2]]), false);
    chk(box(st)[cids[0]].h && !box(st)[cids[0]].dirty && box(st)[cids[1]].mtime === 6000, '  저장본이 안 달라진 저장(changed=false) → 기준 빈 항목만 기준을 잡고 나머지는 안 본다'); }
  /* ③-b 백업 되돌리기 뒤 다시 짝짓기 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    st.now = 6000; const ed = out3([three[0], Object.assign({}, three[1], { xf: { s: 2 } }), three[2]]);
    st.ls[LSK] = JSON.stringify(ed); o._charsAfterSave(ed);
    st.ls[LSK] = JSON.stringify(out3([three[2], Object.assign({}, three[1], { xf: { s: 3 } }), three[0]]));   // 되돌린 5칸 — 순서도 바뀜
    o._charsRemapDesk();
    const d = desk(st), b = box(st);
    chk(d[0] === cids[2] && d[1] === cids[1] && d[2] === cids[0] && Object.keys(b).length === 3, '★ ③-b 백업 되돌리기 → 열쇠로 다시 짝짓기(순서가 바뀌어도 · 못 올린 dirty 마리도 열쇠로) · 새 cid 0');
    chk(b[cids[1]].dirty && !b[cids[0]].dirty && !b[cids[2]].dirty, '  내용이 다른 칸만 dirty(되돌린 것이 최신)'); }
  /* ④ 휴지통 이동 · 당기기 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    st.now = 7000; const moved = o._charsTrashMove(0);
    const b = box(st), d = desk(st), pend = JSON.parse(st.ls[PEND] || '[]');
    chk(moved && b[cids[0]].del >= 7000 && b[cids[0]].pend && d[0] === cids[1] && d[1] === cids[2] && d[2] === null,
      '★ ④ 휴지통 이동 → 묘비(올릴 것 표시) · 책상 표가 칸과 같이 당겨진다');
    chk(pend.length === 0, '  올린 적 있는 마리 → 따로 남기는 휴지통 줄 없음(병합이 서버의 마지막 모습을 deleted 로 보낸다)');
    o._charsAfterSave(out3([three[1], three[2]]));
    chk(!box(st)[cids[1]].dirty && !box(st)[cids[2]].dirty, '★ 당기기로 칸이 밀려도 «고침» 이 아니다(칸 번호가 아니라 cid 로 맞댄다)');
    chk(o._charsDeleteWords().btn === '휴지통 이동' && /3일/.test(o._charsDeleteWords().ask), '  켜짐(채택 뒤) → 문구 «휴지통 이동» · 되묻기에 3일');
    const r = await o._charsSync('save');
    const w = st.db.writes[0] || {};
    chk(r.ok && w[cids[0]] && typeof w[cids[0]].del === 'number' && st.db.trash.length === 1 && st.db.trash[0].why === 'deleted' && !(PEND in st.ls) && !box(st)[cids[0]].pend,
      '  동기화 → 묘비 올림 · 휴지통 한 줄(deleted) · 대기 줄·표시 지움'); }
  /* ⑤ 새 마리 · 20 문턱 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    const nc = o._charsOnNew(3);
    const b = box(st);
    chk(nc && b[nc].dirty && b[nc].def === null && desk(st)[3] === nc && st.calls.timer === 1, '★ ⑤ 새 마리 → 새 cid · dirty · 책상 표 4번 칸');
    const full = box(st); for(let i = 0; i < 16; i++) full['cz' + String(i).padStart(6, '0')] = { def: '{}', mtime: 1 };
    full['cyyyyyy1'] = { del: 5 };
    st.ls[BOX] = JSON.stringify(full);
    /* ★ 개정 48(사용자 결정 «보관함 (n/20)») — 20 은 **보관함(슬롯 밖)만** 센다. 슬롯 캐릭터·묘비는 안 센다. */
    chk(o._charsBoxFull() === false, '  슬롯 캐릭터는 보관함 20 에 안 센다(슬롯 밖 16 + 슬롯 4 → 안 막는다) — 개정 48');
    const f2 = box(st); for(let i = 16; i < 20; i++) f2['cz' + String(i).padStart(6, '0')] = { def: '{}', mtime: 1 };
    st.ls[BOX] = JSON.stringify(f2);
    chk(o._charsBoxFull() === true && /가득/.test(o.toasts.join()) && /\(20\/20\)/.test(o.toasts.join()) && !/마리/.test(o.toasts.join()), '  보관함(슬롯 밖) 20 → 막는다 · «보관함이 가득 찼어요 (20/20)»(묘비는 안 센다 · «마리» 없음)');
    delete full['cz000000']; st.ls[BOX] = JSON.stringify(full);
    chk(o._charsBoxFull() === false, '  19 → 안 막는다'); }
  /* ⑥ 받기 — ts 같으면 본문 안 받음 · 올림 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    const r0 = await o._charsSync('tick');
    chk(r0.did === '할 일 없음' && st.calls.ts === 1 && st.calls.body === 0, '★ ⑥ 올릴 것 없고 charsMeta.ts 같음 → 본문을 안 받는다(ts 한 값 읽기)');
    o._charsAfterSave(out3(three));
    st.now = 6000; const ed = out3([three[0], Object.assign({}, three[1], { xf: { s: 2 } }), three[2]]);
    st.ls[LSK] = JSON.stringify(ed); o._charsAfterSave(ed);
    const r1 = await o._charsSync('save');
    const b = box(st);
    chk(r1.ok && st.db.writes.length === 1 && Object.keys(st.db.writes[0]).join() === cids[1] && st.db.writes[0][cids[1]].mtime === 6000 && st.calls.up === 1,
      '  2번 칸 고침 → 그 마리만 올림(mtime 6000)');
    chk(!b[cids[1]].dirty && typeof b[cids[1]].def === 'string' && b[cids[1]].h && st.ls['deskFriends.chars.metaTs:u1'] === String(st.db.ts) && !st.db.trash.length,
      '  올린 뒤 보관함은 서버 표현 · 기준 그대로 · 알고 있는 ts = 쓴 ts(다음 판은 본문 안 받음) · 휴지통 0(서버 옛 모습은 내가 전에 올린 것)'); }
  /* ⑦ 다른 기기가 고침 → 바꿔 앉힘 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    const other = Object.assign({}, three[2], { xf: { s: 3 } });
    st.db.chars[cids[2]] = { def: srvJs(other), mtime: 8000, v: 1 }; st.db.ts = 200;
    const r = await o._charsSync('tick');
    const sl = JSON.parse(st.ls[LSK]), b = box(st);
    chk(r.ok && r.reseat === 1 && /^data:dl/.test(sl[2].face) && b[cids[2]].mtime === 8000 && b[cids[2]].h == null && st.calls.load === 1 && st.calls.save === 1,
      '★ ⑦ 다른 기기가 3번 칸 마리를 고침 → 바꿔 앉힘 · 기준(h)은 비워 두고 다시 읽은 뒤 saveSlots 가 새로 잡는다');
    chk(!st.db.writes.length && !st.db.trash.length, '  이 기기는 안 고쳤으니 올림 0 · 휴지통 0'); }
  /* ⑧ 다른 기기가 휴지통 이동 → 내림 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    st.db.chars[cids[0]] = { del: 9000 }; st.db.ts = 300;
    const r = await o._charsSync('tick');
    chk(r.ok && r.unseat === 1 && JSON.parse(st.ls[LSK])[0] === null && desk(st)[0] === null && box(st)[cids[0]].del === 9000, '★ ⑧ 다른 기기가 1번 칸 마리를 휴지통으로 → 칸에서 내림 · 보관함엔 묘비');
    chk(!st.db.trash.length && !st.db.writes.length, '  이 기기가 안 고쳤으면 휴지통 줄을 또 남기지 않는다(지운 기기가 남겼다)'); }
  /* ⑭ 못 올린 고침을 휴지통으로 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    st.now = 6000; const ed = out3([three[0], Object.assign({}, three[1], { xf: { s: 4 } }), three[2]]);
    st.ls[LSK] = JSON.stringify(ed); o._charsAfterSave(ed);
    st.now = 6100; o._charsTrashMove(1);
    const pend = JSON.parse(st.ls[PEND] || '[]');
    chk(pend.length === 1 && pend[0].raw && pend[0].mtime === 6000, '★ ⑭ 못 올린 고침(dirty)을 휴지통으로 → 그 모습을 그림째 대기 줄에(병합은 모르는 모습)');
    st.ls[LSK] = JSON.stringify(out3([three[0], three[2]]));
    const r = await o._charsSync('save');
    const rows = st.db.trash.filter(t => t.cid === cids[1]);
    chk(r.ok && rows.length === 2 && rows.every(t => t.why === 'deleted') && rows.some(t => t.mtime === 6000) && rows.some(t => t.mtime === 1001),
      '  동기화 → 휴지통 두 줄(deleted · 고친 모습 6000 + 서버의 마지막 모습 1001) · 묘비 올림'); }
  /* ⑨ 양쪽이 고침 → 나중 것이 이기고 진 쪽은 휴지통 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    st.now = 6000; const ed = out3([Object.assign({}, three[0], { xf: { s: 5 } }), three[1], three[2]]);
    st.ls[LSK] = JSON.stringify(ed); o._charsAfterSave(ed);
    st.db.chars[cids[0]] = { def: srvJs(Object.assign({}, three[0], { xf: { s: 6 } })), mtime: 6500, v: 1 }; st.db.ts = 400;
    const r = await o._charsSync('save');
    chk(r.ok && r.reseat === 1 && !st.db.writes.length && st.db.trash.length === 1 && st.db.trash[0].why === 'overwritten' && st.db.trash[0].cid === cids[0] && st.calls.up === 1,
      '★ ⑨ 양쪽이 같은 마리를 고침 · 서버가 나중 → 서버 것으로 앉히고 이 기기 것은 올려서 휴지통(overwritten · 10일)'); }
  /* ⑩ 실패하면 아무것도 안 바꾼다 */
  for(const [what, set] of [['칸을 못 올림', st => { st.failUp = true; }], ['서버 쓰기 실패', st => { st.failSave = true; }], ['그림을 못 받음', st => { st.failDown = true; st.db.chars[cids[2]] = { def: srvJs(Object.assign({}, three[2], { xf: { s: 7 } })), mtime: 8000, v: 1 }; st.db.ts = 500; }]]){
    const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    st.now = 6000; const ed = out3([three[0], Object.assign({}, three[1], { xf: { s: 2 } }), three[2]]);
    st.ls[LSK] = JSON.stringify(ed); o._charsAfterSave(ed);
    set(st);
    const snap = JSON.stringify([st.ls[BOX], st.ls[DESK], st.ls[LSK], st.ls['deskFriends.chars.metaTs:u1']]);
    const r = await o._charsSync('save');
    chk(!r.ok && snap === JSON.stringify([st.ls[BOX], st.ls[DESK], st.ls[LSK], st.ls['deskFriends.chars.metaTs:u1']]) && !st.db.writes.length && !st.db.trash.length,
      '★ ⑩ ' + what + ' → 보관함·책상 표·칸·ts 그대로 · 서버 쓰기 0(dirty 가 남아 다음 판에 다시)');
  }
  /* ⑪ 도중에 칸이 또 바뀜 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    o._charsAfterSave(out3(three));
    st.db.chars[cids[2]] = { def: srvJs(Object.assign({}, three[2], { xf: { s: 3 } })), mtime: 8000, v: 1 }; st.db.ts = 600;
    st.onBody = () => { o.bump(); };
    const lsk0 = st.ls[LSK];
    const r = await o._charsSync('tick');
    chk(r.did === '도중 바뀜 — 다시' && st.ls[LSK] === lsk0 && st.ls['deskFriends.chars.metaTs:u1'] === '0' && st.calls.timer >= 1,
      '  ⑪ 받는 도중 칸이 또 바뀜 → 로컬은 안 쓰고 ts 를 잊어 다음 판에 본문부터 다시'); }
  /* ⑫ 생성기가 열려 있으면 */
  { const st = fresh(); adopted(st); st.creatorOpen = true; st.db.ts = 700; const o = mk8(true, st);
    const r = await o._charsSync('tick');
    chk(r.ok && st.calls.body === 0 && /생성기/.test(r.did), '  ⑫ 생성기가 열려 있으면 받지 않는다(옛 슬롯 동기화 ⑤ 와 같다)'); }
  /* ⑬ 부팅 박자 */
  { const st = fresh(); adopted(st); const o = mk8(true, st);
    const r = await o._charsBoot('tick');
    chk(r.did === '할 일 없음' && st.calls.body === 0, '  ⑬ 30분 박자 · 채택 뒤 → 서버 이관 판정 없이 ts 한 값만(본문 0)'); }

  /* ── 10. 휴지통 (개정 49 · 시안 E · 보관함 줄 [휴지통 이동]) ── */
  say('── 10. 휴지통 — 보관함 줄 → 묘비 · 보일 줄 고르기(기한 · 옮김은 cid 마다 최근 한 줄 · 연동 교체는 복원본으로만 접기) · 복원(서버 먼저 · 20 문턱 · 한 번만)');
  if(has10.length !== need10.length) chk(false, '휴지통 함수가 조율 블록 안에 없다: ' + need10.filter(n => has10.indexOf(n) < 0).join(' · '));
  else await (async () => {
    const DAY = 24*60*60*1000, extra = 'cdddddd4';
    const withBoxOnly = (st) => {                                        // 채택 뒤 + 슬롯 밖(보관함) 한 개
      adopted(st);
      const b = box(st); b[extra] = { def: srvJs(chars5[3]), mtime: 1003 }; st.ls[BOX] = JSON.stringify(b);
      st.db.chars[extra] = { def: srvJs(chars5[3]), mtime: 1003, v: 1 };
    };
    /* ⑮ 보관함 줄 → 휴지통 */
    { const st = fresh(); withBoxOnly(st); const o = mk8(true, st);
      const b0 = st.ls[BOX];
      const onDesk = o._charsBoxTrash(cids[0]);
      chk(!onDesk.ok && onDesk.why === 'ondesk' && st.ls[BOX] === b0, '  슬롯 캐릭터는 보관함 줄 휴지통으로 못 간다(런처 톱니 몫) · 아무것도 안 바꿈');
      st.now = 9000; const r = o._charsBoxTrash(extra);
      const e = box(st)[extra];
      chk(r.ok && e && e.del === 9000 && e.pend === true && JSON.stringify(desk(st)) === JSON.stringify([cids[0], cids[1], cids[2], null, null]) && !(PEND in st.ls),
        '★ ⑮ 보관함 줄 [휴지통 이동] → 묘비(올릴 것 표시)만 · 슬롯 표 그대로 · 대기 줄 없음(보관함 항목은 이미 서버 표현)');
      const s2 = await o._charsSync('box-trash');
      chk(s2.ok && typeof st.db.chars[extra].del === 'number' && st.db.trash.length === 1 && st.db.trash[0].cid === extra && st.db.trash[0].why === 'deleted' && typeof st.db.trash[0].def === 'string' && !box(st)[extra].pend,
        '  동기화 → 묘비 올림 · 서버의 마지막 모습이 휴지통 한 줄(deleted · 3일)'); }
    { const st = fresh(); withBoxOnly(st); const b0 = st.ls[BOX]; const o = mk8(false, st);
      const r = o._charsBoxTrash(extra);
      chk(!r.ok && r.why === 'off' && st.ls[BOX] === b0, '  스위치 꺼짐 → 아무것도 안 바꿈'); }
    /* ⑮-2 D2 한꺼번에 (개정 51) */
    { const st = fresh(); withBoxOnly(st); const o = mk8(true, st);
      const b = box(st); b.ceeeeee5 = { def: srvJs(chars5[4]), mtime: 1004 }; st.ls[BOX] = JSON.stringify(b);
      st.db.chars.ceeeeee5 = { def: srvJs(chars5[4]), mtime: 1004, v: 1 };
      st.now = 9000; const r = o._charsBoxTrashMany([extra, 'ceeeeee5', cids[0], 'cnothere']);
      const bb = box(st);
      chk(r.ok && r.n === 2 && r.fail === 2 && bb[extra].pend && bb.ceeeeee5.pend && !bb[cids[0]].del && JSON.stringify(desk(st)) === JSON.stringify([cids[0], cids[1], cids[2], null, null]),
        '★ ⑮-2 D2 한꺼번에 → 보관함 항목만 묘비 · 슬롯 캐릭터 · 없는 것은 건너뛰고 센다');
      const s2 = await o._charsSync('box-trash');
      chk(s2.ok && st.db.trash.length === 2 && st.db.trash.every(t => t.why === 'deleted'), '  동기화 → 휴지통 두 줄(deleted)'); }
    /* ⑯ 복원본 cid */
    { const st = fresh(); const o = mk8(true, st);
      const a = o._charsRestoreCid('cabcdef1', 5000), b = o._charsRestoreCid('cabcdef1', 5000), c = o._charsRestoreCid('cabcdef1', 5001);
      chk(a === b && a !== c && /^c[a-z0-9]{6,24}$/.test(a) && a !== 'cabcdef1', '★ ⑯ 복원본 cid 는 «원본 cid + 그 모습의 시각» 에서 늘 같은 값 · 규칙의 cid 모양 · 원본과 다름'); }
    /* ⑰ 보일 줄 고르기 */
    { const st = fresh(); const o = mk8(true, st);
      const now = 20*DAY, T = (why, at, def) => ({ def: def || '{}', why, at });
      const rc = o._charsRestoreCid('coverwr2', 300);
      const trash = {
        cexpire1: { 100: T('deleted', now - 3*DAY) },
        cexpire2: { 100: T('overwritten', now - 10*DAY - 1) },
        ckeep002: { 100: T('overwritten', now - 9*DAY) },
        cdouble3: { 100: T('deleted', now - 2*DAY, 'old'), 200: T('deleted', now - DAY, 'new') },
        crevive4: { 100: T('deleted', now - DAY) },
        coverwr1: { 100: T('overwritten', now - DAY) },
        coverwr2: { 300: T('overwritten', now - DAY) },
        cbadwhy5: { 100: { def: '{}', why: 'overflow', at: now } },
      };
      const bx = { crevive4: { def: '{}', mtime: now - DAY + 5 }, coverwr1: { def: '{}', mtime: now }, [rc]: { del: now } };
      const rows = o._charsTrashView(trash, bx, now);
      const ids = rows.map(r => r.cid + ':' + r.mtime).join(',');
      chk(!rows.some(r => /cexpire/.test(r.cid)), '★ ⑰ 기한 지난 줄은 안 보인다(옮김 3일 · 연동 교체 10일 — 청소 함수가 아직 없어도 약속대로)');
      chk(rows.some(r => r.cid === 'ckeep002' && r.until === now + DAY), '  남은 줄은 사라지는 날(at + 기한)을 들고 온다');
      chk(rows.filter(r => r.cid === 'cdouble3').length === 1 && rows.find(r => r.cid === 'cdouble3').def === 'new', '  옮김은 cid 마다 가장 최근 한 줄만');
      chk(!rows.some(r => r.cid === 'crevive4'), '  옮김 줄은 그 캐릭터가 보관함에 살아 있고 그 줄보다 나중이면 숨김(복원됨)');
      chk(rows.some(r => r.cid === 'coverwr1'), '★ 연동 교체 줄은 원본을 그 뒤에 다시 고쳐도 남는다(옛 기준이면 여기서 사라졌다)');
      chk(!rows.some(r => r.cid === 'coverwr2'), '  연동 교체 줄은 복원본 cid 가 보관함에 있으면(묘비여도) 숨김');
      chk(!rows.some(r => r.cid === 'cbadwhy5') && rows.every((r, k) => k === 0 || rows[k - 1].at >= r.at), '  why 두 값만 · 최근 것부터 — ' + ids);
      chk(JSON.stringify(trash.cdouble3[100]) === JSON.stringify(T('deleted', now - 2*DAY, 'old')) && !('cexpire1' in bx), '  순수 — 입력 불변'); }
    /* ⑱ 복원 */
    { const st = fresh(); withBoxOnly(st); const o = mk8(true, st);
      st.db.chars[extra] = { del: 9000 }; const b = box(st); b[extra] = { del: 9000 }; st.ls[BOX] = JSON.stringify(b);
      st.now = 9500;
      const row = { cid: extra, mtime: 1003, def: srvJs(chars5[3]), why: 'deleted', at: 9600 };
      const r = await o._charsRestore(row);
      const e = box(st)[extra];
      chk(r.ok && r.cid === extra && st.db.writes.length === 1 && st.db.writes[0][extra] && st.db.writes[0][extra].def === row.def && st.db.writes[0][extra].mtime === 9601 && e && e.def === row.def && e.mtime === 9601,
        '★ ⑱ 옮김 복원 → 같은 cid 로 서버에 먼저 · 시각은 그 줄보다 나중(접기 기준) · 그 뒤 보관함에');
      chk(desk(st).indexOf(extra) < 0 && o._charsTrashView({ [extra]: { 1003: { def: row.def, why: 'deleted', at: 9600 } } }, box(st), 9700).length === 0, '  슬롯이 아니라 보관함으로 · 복원한 줄은 휴지통에서 접힌다'); }
    { const st = fresh(); withBoxOnly(st); const o = mk8(true, st);
      const row = { cid: cids[0], mtime: 900, def: srvJs(chars5[4]), why: 'overwritten', at: 1500 };
      const rc = o._charsRestoreCid(cids[0], 900);
      const r1 = await o._charsRestore(row);
      chk(r1.ok && r1.cid === rc && st.db.chars[rc] && st.db.chars[rc].def === row.def && st.db.chars[cids[0]].def === srvJs(three[0]) && box(st)[cids[0]].def === srvJs(three[0]),
        '★ 연동 교체 복원 → 복원본 cid 로 하나 더 · 지금 모습(원본 cid)은 그대로(맞바꾸지 않는다)');
      const w1 = st.db.writes.length; const r2 = await o._charsRestore(row);
      chk(r2.ok && r2.already && st.db.writes.length === w1, '★ 두 번 눌러도 하나만 — 이미 있으면 쓰지 않는다');
      const st2 = fresh(); withBoxOnly(st2); const o2 = mk8(true, st2);
      const r3 = await o2._charsRestore(row);
      chk(r3.ok && r3.cid === rc, '  다른 PC 에서 눌러도 같은 cid(서버에서 한 캐릭터로 합쳐진다)'); }
    { const st = fresh(); adopted(st); const o = mk8(true, st);
      const b = box(st); for(let k = 0; k < 20; k++) b['cfull' + String(k).padStart(3, '0')] = { def: '{}', mtime: k }; st.ls[BOX] = JSON.stringify(b);
      const b0 = st.ls[BOX];
      const r = await o._charsRestore({ cid: 'cgone001', mtime: 1, def: '{}', why: 'deleted', at: 1 });
      chk(!r.ok && r.why === 'full' && !st.db.writes.length && st.ls[BOX] === b0, '★ 보관함 20(슬롯 밖) → 복원 막힘 · 쓰기 0'); }
    { const st = fresh(); withBoxOnly(st); st.failSave = true; const o = mk8(true, st);
      const b0 = st.ls[BOX];
      const r = await o._charsRestore({ cid: 'cgone001', mtime: 1, def: '{}', why: 'deleted', at: 1 });
      chk(!r.ok && r.why === 'save' && st.ls[BOX] === b0, '  서버에 못 쓰면 로컬 보관함도 그대로(올라가지 않는 항목을 만들지 않는다)'); }
    { const st = fresh(); withBoxOnly(st); const b0 = st.ls[BOX]; const o = mk8(false, st);
      const r = await o._charsRestore({ cid: 'cgone001', mtime: 1, def: '{}', why: 'deleted', at: 1 });
      chk(!r.ok && r.why === 'off' && st.ls[BOX] === b0 && !st.db.writes.length, '  스위치 꺼짐 → 아무것도 안 함'); }
  })().catch(e => chk(false, '10절 예외: ' + (e && e.stack || e)));

  /* 배선 — 정적 */
  const fnSrc = (sig) => { const i = SRC.indexOf(sig); return i < 0 ? '' : SRC.slice(i, fnEnd(SRC, i)); };
  const ss = fnSrc('function saveSlots(){');
  chk((ss.match(/_charsAfterSave\(/g) || []).length === 1 && /_charsAfterSave\(out, _str !== null && _str !== prevRaw\)/.test(ss) && ss.indexOf('_charsAfterSave(') > ss.indexOf('localStorage.setItem(LS_KEY'),
    '★ saveSlots — LS_KEY 에 쓴 뒤 _charsAfterSave(out, 달라졌나) 한 곳(부르는 스무 자리에 훅을 달지 않는다)');
  const dd = fnSrc('function doDeleteCurSlot(){');
  chk(dd.indexOf('_charsTrashMove(curSlot)') > 0 && dd.indexOf('_charsTrashMove(curSlot)') < dd.indexOf('slots[i]=slots[i+1]') && /_toTrash \? '휴지통으로 옮겼어요' : '삭제했어요'/.test(dd),
    '  휴지통 이동은 당기기 전에(칸 번호가 바뀌기 전) · 토스트도 스위치를 따른다');
  const cr = SRC.slice(SRC.indexOf("let target = creatorMode.edit ? creatorMode.slot"), SRC.indexOf('/* --- 런처 미리보기 렌더러 --- */'));
  chk(/if\(!creatorMode\.edit && typeof _charsBoxFull==='function' && _charsBoxFull\(\)\) return;/.test(cr) && /if\(!creatorMode\.edit\)\{ try\{ if\(typeof _charsOnNew==='function'\) _charsOnNew\(target\);/.test(cr) && cr.indexOf('_charsOnNew(target)') < cr.indexOf('saveSlots()'),
    '  생성기 완료 — 새로 만들 때만 문턱·새 cid(수정은 saveSlots 훅이 잡는다) · saveSlots 앞');
  const cm = SRC.slice(SRC.indexOf('// 슬롯에 저장 + 영구 저장'), SRC.indexOf('// 슬롯에 저장 + 영구 저장') + 400);
  chk(/_charsBoxFull\(\)\) return;/.test(cm) && cm.indexOf('_charsOnNew(idx)') > cm.indexOf('slots[idx]=def') && cm.indexOf('_charsOnNew(idx)') < cm.indexOf('saveSlots()'), '  커미션 등록 — 문턱 · 새 cid');
  const ic = fnSrc('async function importCloneCode(');
  chk(/_charsBoxFull\(\)\) return false;/.test(ic) && ic.indexOf('_charsOnNew(target)') > ic.indexOf('slots[target]=def') && ic.indexOf('_charsOnNew(target)') < ic.indexOf('saveSlots()'), '  복제 코드 — 문턱 · 새 cid');
  const le = SRC.slice(SRC.indexOf("document.getElementById('lcEmpty').onclick"), SRC.indexOf("document.getElementById('lcEmpty').onclick") + 400);
  chk(le.indexOf('_charsBoxFull()') > 0 && le.indexOf('_charsBoxFull()') < le.indexOf('openRacePicker'), '  빈 칸 [＋] — 종족 고르기 전에 문턱');
  const sy = fnSrc('async function syncSlotsToServer(');
  const gate = sy.indexOf('_charsActive()'), firstAdopt = sy.indexOf('_slotsAdoptFromServer'), firstConf = sy.indexOf('_slotsConflictNote');
  const gateBody = gate > 0 ? sy.slice(gate, sy.indexOf('return;\n    }', gate)) : '';
  chk(gate > 0 && gate < firstAdopt && gate < firstConf && /_slotsPushToServer\(uid\)/.test(gateBody) && !/_slotsAdoptFromServer|_slotsConflictNote|loadSlotsRemote/.test(gateBody),
    '★ 옛 slots 동기화 — 채택 뒤엔 첫머리에서 올리기만 하고 돌아간다(받기·④ 대화상자 전에)');
  const rb = fnSrc('async function restoreSlotsBackup(');
  chk(rb.indexOf('_charsRemapDesk()') > rb.indexOf('await loadSlots()'), '  백업 되돌리기 — 다시 읽은 뒤 열쇠로 보관함과 다시 짝짓기');
  const aki = SRC.indexOf('const ACCOUNT_LOCAL_KEYS = ()=>['), ak = aki < 0 ? '' : SRC.slice(aki, SRC.indexOf('\n];', aki));
  chk(["'deskFriends.chars.v1'", "'deskFriends.chars.desk'", "'deskFriends.chars.trashPend'"].every(k => ak.indexOf(k) > 0), '  로그아웃 목록에 보관함 · 책상 표 · 휴지통 대기 줄(설계 §9-5)');
  chk(/call\(typeof _charsSync === 'function' \? _charsSync : null, 'logout'\)/.test(fnSrc('async function _acctFlushToServer(')), '  로그아웃 flush 가 먼저 올린다');
  const after = SRC.slice(SRC.indexOf('try{ window.charsMigrateDryRun'), SRC.indexOf('try{ window.charsMigrateDryRun') + 600);
  chk(/if\(CHARS_SYNC_ENABLED\)\{\s*setTimeout\(\(\)=>\{ try\{ _charsBoot\('boot'\)/.test(after) && /setInterval\(\(\)=>\{ try\{ _charsBoot\('tick'\)/.test(after),
    '★ 부팅·30분 배선은 스위치 안에서만 건다(꺼져 있으면 부팅에서 아무것도 안 부른다)');
  chk(/_charsDeleteWords\(\)\.ask/.test(SRC) && /d\.textContent=w\.btn/.test(SRC), '  런처 톱니 문구·되묻기는 열 때마다 _charsDeleteWords 를 읽는다');
}

/* ── 9. 보관함 섬네일 (개정 37) ── */
async function sec9(){
  say('── 9. 섬네일 URL — 보관함이 슬롯 섬네일을 그린다 · 못 올려도 push 는 안 접는다 · 열쇠는 안 본다');
  { const a = K(chars5[0]), b = K(JSON.stringify(Object.assign(JSON.parse(srvJs(chars5[0])), { thumbUrl: 'https://x/thumb_h2abc.png' })));
    chk(a.k1 === b.k1 && a.k2 === b.k2, '★ thumbUrl 이 붙어도 K1·K2 가 같다(안 그러면 섬네일 붙은 판과 안 붙은 판을 «다른 모습» 으로 보고 첫 채택에서 올림·휴지통이 생긴다)'); }
  const i = SRC.indexOf('async function _slotToServerObj(');
  if(i < 0){ chk(false, '_slotToServerObj 가 없다'); return; }
  const fsrc = SRC.slice(i, fnEnd(SRC, i));
  const mkTo = (failKey) => new Function('SLOT_IMG_FIELDS', '_storageFaceUrlOne', '_storageGlbUrlOne', fsrc + '\nreturn _slotToServerObj;')(
    [['face','face'], ['blink','blink']],
    async (uid, st, key, v) => (key === failKey ? null : 'https://fb/' + key + '_' + v.length + '.png'),
    async () => 'https://fb/glb');
  const base = { skin: 1, face: 'data:image/png;base64,AAAA', blink: 'data:image/png;base64,BBBB' };
  const r1 = await mkTo(null)('u1', Object.assign({ thumb: 'data:image/png;base64,TTTTTT' }, base), {}, {});
  chk(r1 && /^https:\/\/fb\/thumb_/.test(r1.thumbUrl) && !('thumb' in r1) && !/data:/.test(JSON.stringify(r1)), '★ 섬네일(dataURL) → thumbUrl 로 실리고 dataURL 은 한 바이트도 없다');
  const r2 = await mkTo('thumb')('u1', Object.assign({ thumb: 'data:image/png;base64,TTTTTT', thumbUrl: 'https://fb/old.png' }, base), {}, {});
  chk(r2 && r2.thumbUrl === 'https://fb/old.png' && r2.faceUrl, '★ 섬네일만 못 올림 → push 는 접지 않는다 · 받아 둔 URL 을 그대로');
  const r3 = await mkTo('thumb')('u1', Object.assign({ thumb: 'data:image/png;base64,TTTTTT' }, base), {}, {});
  chk(r3 && !('thumbUrl' in r3), '  받아 둔 URL 도 없으면 thumbUrl 없이(보관함은 얼굴로 대신 그린다)');
  const r4 = await mkTo(null)('u1', Object.assign({ thumbUrl: 'https://fb/keep.png' }, base), {}, {});
  chk(r4 && r4.thumbUrl === 'https://fb/keep.png', '  새로 찍은 섬네일이 없으면(받아 앉힌 칸) 받아 둔 URL 을 그대로 싣는다');
  const r5 = await mkTo('face')('u1', Object.assign({ thumb: 'data:image/png;base64,TTTTTT' }, base), {}, {});
  chk(r5 === null, '  얼굴을 못 올리면 예전처럼 null(push 를 접는다) — 섬네일 규칙이 얼굴 규칙을 무르게 하지 않는다');
  const s2o = SRC.slice(SRC.indexOf('function slotToObj(d){'), SRC.indexOf('function slotToObj(d){') + 1600);
  chk(/thumb:d\.thumb\|\|null,\.\.\.\(d\.thumbUrl\?\{thumbUrl:d\.thumbUrl\}:\{\}\),/.test(s2o), '★ slotToObj 는 thumbUrl 이 **있을 때만** 싣는다(늘 실으면 모든 기기의 첫 저장이 «달라짐» 이 되어 옛 slots ts 가 일제히 오르고 ④ 가 뜬다)');
  chk(/if\(o\.thumb\)_d\.thumb=o\.thumb;if\(o\.thumbUrl\)_d\.thumbUrl=o\.thumbUrl;/.test(SRC), '  loadSlots 가 thumbUrl 을 칸에 옮겨 적는다(빠지면 다음 저장에서 조용히 떨어진다 — 27355 주석)');
}

/* ── 5. 조율 — 서버 이관을 스텁 서버로 돌린다 ── */
say('── 5. _charsServerMigrate — 한 기기만 · 끊겨도 다시 · 되돌이 · 스위치');
if(!orch){ chk(false, '이관 조율 블록(const CHARS_SYNC_ENABLED ~ window.charsMigrateDryRun)이 없다'); }
else{
  /* ★ 개정 48 — 스위치를 켰다(보관함 이동 · 슬롯에 올리기). 판정은 «한 줄 상수로 있다» 로 바꾸고, 꺼짐/켜짐 두 판을 아래 런타임이 둘 다 돌린다(치환은 둘 다 받는다). */
  chk(/const CHARS_SYNC_ENABLED = true;/.test(orch), '★ CHARS_SYNC_ENABLED = true — 개정 48 에서 켰다(규칙 게시 뒤 배포) · 꺼짐 판은 아래 런타임이 치환으로 계속 본다');
  chk(!/\b(_charsServerMigrate|_charsLocalAdopt|_charsPlanLocalAdopt|charsMigrateDryRun)\(/.test(SRC.replace(orch, '')), '★ 부팅·동기화 어디서도 조율 함수를 부르지 않는다(콘솔 출구만 · 개정 35 첫 채택 포함)');
  chk(!/getMyUserId\(/.test(orch), '  uid 를 getMyUserId 로 얻지 않는다(«없으면 만든다» 가 아직 거기 있다 · 설계 §6-①)');
  const dry = orch.slice(orch.indexOf('async function charsMigrateDryRun'));
  chk(dry.length > 50 && !/saveCharsEntries|claimCharsMigration|finishCharsMigration|appendCharsTrash|saveSlotsRemote|localStorage\.setItem|_charsLocalAdopt\(/.test(dry), '★ 미리보기는 읽기만 — 쓰는 통로 · localStorage 쓰기가 본문에 없다');
  /* 스텁 서버 — firebase-init 의 통로와 같은 모양. 트랜잭션은 한 번에 하나(자바스크립트 한 줄기라 그대로 원자적). */
  const mk = () => {
    const db = { chars: {}, meta: null, slots: null, prev: null, writes: 0 };
    let clock = 5000;
    const api = {
      async loadCharsRemote(){ return { chars: JSON.parse(JSON.stringify(db.chars)), meta: db.meta ? Object.assign({}, db.meta) : null }; },
      async loadSlotsRemote(){ return db.slots ? JSON.parse(JSON.stringify(db.slots)) : { s: {}, ts: 0 }; },
      async loadSlotsPrevRemote(){ return db.prev; },
      async claimCharsMigration(uid, stale){
        const cur = db.meta;
        if(cur == null){ db.meta = { migratedFrom: 'slots', migratedAt: 0, claimAt: clock, v: 1 }; return { claimed: true, meta: db.meta }; }
        if(!cur.migratedAt && clock - (cur.claimAt || 0) > stale){ db.meta = Object.assign({}, cur, { claimAt: clock }); return { claimed: true, meta: db.meta }; }
        return { claimed: false, meta: cur };
      },
      async finishCharsMigration(uid, at){ db.meta = Object.assign({}, db.meta, { migratedAt: at }); return true; },
      async saveCharsEntries(uid, e){ if(api.failSave) return false; db.writes++; Object.assign(db.chars, JSON.parse(JSON.stringify(e))); return true; },
    };
    return { db, api, tick(ms){ clock += ms; } };
  };
  const ls = {};
  const run = (stub, enabled, slotsTs) => new Function('window', 'firebaseAPI', 'localStorage', 'MY_USER_ID_KEY', 'LS_KEY', '_slotsTs', '_slotsNow', 'CHAR_SLOT_MAX', 'SLOTS_TS_SKEW_TOL_MS', 'console',
      quick + '\n' + fields + '\n' + merge + '\n' + body + '\n' + orch.replace(/const CHARS_SYNC_ENABLED = (?:true|false);/, 'const CHARS_SYNC_ENABLED = ' + (enabled ? 'true' : 'false') + ';') +
      '\nreturn { _charsServerMigrate, charsMigrateDryRun };')(
      { firebaseAPI: stub.api }, stub.api,
      { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); } },
      'tw.myUserId', 'deskFriends.slots.v1', slotsTs || 0, () => 9000, 5, 5*60*1000, { log(){}, table(){}, warn(){} });
  (async () => {
    const S = mk(); S.db.slots = slotsOf(chars5, T0); S.db.prev = slotsOf([chars5[0], loc(9)], 900);
    const off = await run(S, false)._charsServerMigrate('u1');
    chk(!off.ok && S.db.writes === 0 && S.db.meta === null, '① 스위치가 꺼져 있으면 선점도 쓰기도 없다');
    const A = run(S, true), B = run(S, true);
    const [ra, rb] = await Promise.all([A._charsServerMigrate('u1'), B._charsServerMigrate('u1')]);
    const n = Object.keys(S.db.chars).length;
    chk(n === 6 && [ra.did, rb.did].sort().join('|') === '다른 기기가 진행 중이거나 끝냄|첫 이관', '★ ② 두 기기가 동시에 → 한 기기만 이관 · chars 6(slots 5 + slotsPrev 에만 있던 1) · 중복 0');
    chk(S.db.meta.migratedAt === 9000 && S.db.meta.claimAt === 5000, '  도장: migratedAt = 끝난 시각 · claimAt = 잡은 시각');
    const again = await run(S, true)._charsServerMigrate('u1');
    chk(again.did === '할 일 없음' && S.db.writes === 1, '  세 번째 기기 · slots 안 바뀜 → 할 일 없음(slots 본문도 짝짓기도 안 함)');
    const edited = chars5.slice(); edited[1] = Object.assign({}, chars5[1], { xf: { s: 3 } }); edited[4] = loc(6);
    S.db.slots = slotsOf(edited, 12000);
    const back = await run(S, true)._charsServerMigrate('u1');
    chk(back.did === '되돌이' && back.upd === 1 && back.add === 1 && Object.keys(S.db.chars).length === 7, '★ ③ 되돌이: 옛 클라이언트가 한 칸 고치고 한 마리 새로 → upd 1 · add 1 · 7마리');
    const twice = await run(S, true)._charsServerMigrate('u1');
    chk(twice.did === '할 일 없음', '  같은 되돌이를 이 기기에서 두 번 하지 않는다(계정별 기록)');
    delete ls['deskFriends.chars.slotsImported:u1'];
    const idem = await run(S, true)._charsServerMigrate('u1');
    chk(idem.ok && idem.add === 0 && idem.upd === 0 && Object.keys(S.db.chars).length === 7, '  기록이 없어도(다른 기기) 다시 돌면 add 0 · upd 0 — 짝짓기가 같은 문자열을 먼저 본다');

    const C = mk(); C.db.slots = slotsOf(chars5, T0); C.api.failSave = true;
    const crash = await run(C, true)._charsServerMigrate('u1');
    chk(!crash.ok && C.db.meta && C.db.meta.migratedAt === 0, '④ 쓰기 실패 → 선점은 «진행 중» 으로 남는다(도장 없음)');
    C.api.failSave = false;
    const early = await run(C, true)._charsServerMigrate('u1');
    C.tick(11*60*1000);
    const late = await run(C, true)._charsServerMigrate('u1');
    chk(early.did === '다른 기기가 진행 중이거나 끝냄' && late.did === '첫 이관' && Object.keys(C.db.chars).length === 5, '★  10분 안엔 기다리고 · 지나면 다른 기기가 다시 잡아 끝낸다 · 5마리');

    const D = mk(); D.db.slots = slotsOf(chars5, T0);
    ls['tw.myUserId'] = 'u1'; ls['deskFriends.slots.v1'] = JSON.stringify([chars5[0], loc(8), null, null, null]);
    const rep = await run(D, false, 3000).charsMigrateDryRun();
    chk(rep.ok && D.db.writes === 0 && D.db.meta === null, '⑤ 미리보기: 아무것도 안 쓴다(선점도 없음)');
    chk(rep.서버.더할것 === 5 && rep.이기기.새cid === 1 && rep.이기기.합친뒤 === 6, '  서버 5 더할 것 · 이 기기 새 cid 1 · 합친 뒤 6');
    chk(rep.그림URL.전체 === 10 && rep.그림URL.해시꺼냄 === 10, '  그림 URL 10개 중 해시 10개(실기기에서 이 두 수가 다르면 K2 가 받고 있다)');
    chk(rep.칸별[0].짝 === 'K1' && rep.칸별[0].내용 === '같음' && rep.칸별[1].짝 === '새 cid' && rep.칸별[2].짝 === '빈 칸', '  칸별 표: K1·같음 / 새 cid / 빈 칸');
    say('── 6. firebase-init 통로 · 규칙');
    if(fs.existsSync('firebase-init.js')){
      const FI = fs.readFileSync('firebase-init.js', 'utf8');
      const has = n => new RegExp('async ' + n + '\\(').test(FI);
      chk(['loadCharsRemote', 'claimCharsMigration', 'finishCharsMigration', 'saveCharsEntries', 'appendCharsTrash', 'loadCharsTrashLatest'].every(has), '통로 여섯이 있다(개정 35 휴지통 마지막 모습)');
      const cl = FI.slice(FI.indexOf('async claimCharsMigration('), FI.indexOf('async finishCharsMigration('));
      chk(/runTransaction\(ref\(db, `users\/\$\{uid\}\/charsMeta`\)/.test(cl) && /migratedAt: 0/.test(cl) && /return undefined/.test(cl), '★ 선점은 charsMeta 트랜잭션 · 진행 중 = migratedAt 0 · 이미 있으면 손대지 않는다');
      const sv = FI.slice(FI.indexOf('async saveCharsEntries('), FI.indexOf('async appendCharsTrash('));
      chk(/update\(ref\(db, `users\/\$\{uid\}`\), patch\)/.test(sv) && /patch\['chars\/' \+ cid\]/.test(sv) && !/\bset\(ref\(db, `users\/\$\{uid\}(\/chars)?`\)/.test(sv), '★ chars 는 update(합집합 · 경로 키 chars/{cid}) — 통째 set 이면 안 건드린 cid 가 지워진다');
      chk(/patch\['charsMeta\/ts'\] = ts/.test(sv) && /return ts;/.test(sv), '★ 개정 36: 같은 update 안에서 charsMeta/ts 를 찍고 그 값을 돌려준다(따로 쓰면 둘째 실패 때 다른 기기가 영영 못 받는다)');
      const ta = FI.indexOf('async loadCharsTrashAll('), taB = ta < 0 ? '' : FI.slice(ta, FI.indexOf('async appendCharsTrash(', ta));
      chk(ta > 0 && /get\(ref\(db, `users\/\$\{uid\}\/trash`\)\)/.test(taB) && /return null;/.test(taB) && /'deleted' && t\.why !== 'overwritten'/.test(taB) && !/\b(set|update|remove|push)\(/.test(taB),
        '★ 개정 49 통로 loadCharsTrashAll — 휴지통 전체를 읽기만 · why 두 값만 · 실패는 null(비어 있음과 구분)');
      chk(has('loadCharsMetaTs') && /charsMeta\/ts`/.test(FI.slice(FI.indexOf('async loadCharsMetaTs('), FI.indexOf('async loadCharsRemote('))), '  통로 일곱째 loadCharsMetaTs — ts 한 값만 읽는다');
      const tr = FI.slice(FI.indexOf('async appendCharsTrash('), FI.indexOf('async appendCharsTrash(') + 1200);
      chk(/for\(const t of/.test(tr) && /set\(ref\(db, `users\/\$\{uid\}\/trash\/\$\{t\.cid\}\//.test(tr), '  휴지통은 한 줄씩 set(잎 규칙 «없을 때만» — 한 번에 update 하면 한 줄 때문에 전부 거부)');
      chk(!/'overflow'\s*\?/.test(tr) && /'deleted'\) \? 'deleted' : 'overwritten'/.test(tr), '  why 는 두 값만(overflow 는 설계 §9-7 답 뒤)');
    } else huh('firebase-init.js 없음 — 6절 통로 검사못함');
    if(fs.existsSync('firebase-database-rules.json')){
      let R = null; try{ R = JSON.parse(fs.readFileSync('firebase-database-rules.json', 'utf8')); }catch(_){}
      const m = R && R.rules && R.rules.users && R.rules.users.$userId && R.rules.users.$userId.charsMeta;
      chk(!!m && m.claimAt && /isNumber/.test(m.claimAt['.validate']) && m.$other && m.$other['.validate'] === false, '  규칙 charsMeta 에 claimAt(숫자) · $other 거부 그대로');
      chk(!!m && m.ts && /isNumber/.test(m.ts['.validate']), '  규칙 charsMeta 에 ts(숫자 · 개정 36) — 없으면 $other 거부에 걸려 chars 쓰기까지 통째 거부된다');
      const tw = R && R.rules.users.$userId.trash;
      chk(!!tw && /'overwritten'/.test(JSON.stringify(tw)) && /'deleted'/.test(JSON.stringify(tw)) && !/overflow/.test(JSON.stringify(tw)), '  규칙 휴지통 why 두 값 그대로(설계 개정 5 — overflow 철회)');
    } else huh('firebase-database-rules.json 없음');
    await sec7();
    await sec8();
    await sec9();
    done();
  })().catch(e => { chk(false, '5절 실행 중 예외: ' + (e && e.message)); done(); });
}
if(!orch) done();
