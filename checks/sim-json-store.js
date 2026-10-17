/* ═══ 💾 sim-json-store.js — localStorage JSON 칸 읽기 · 쓰기 한 곳 (shared/json-store.js) ═══
   ・1절: load — 키 없음 · 빈 글 · 해석 성공 · 해석 실패 · 저장소 못 엶 → {ok, list, err, bytes} · 던지지 않는다
   ・2절: save — 성공(bytes) · 용량 초과 · JSON 못 만듦 · 저장소 못 엶 → {ok, err, bytes} · 던지지 않는다
   ・3절: 부르는 쪽 동작 고정 — 사람 책상 프리셋(desk-preset-store.js — 5칸 맞추기) · 동물 프리셋(animal.js — 객체 그대로)
   ・4절: 실패 알림 — 이유 한 마디 · 진단 줄 · 저장 실패면 성공 안내 대신 번호(E-CHAR-01 · 04) · 읽기 실패 번호(02 · 05) · 표에 번호가 있다
   ・5절: 배선 — html 이 책상 프리셋 저장 · animal.js · app.js 보다 먼저 · 두 곳이 localStorage 를 직접 안 만진다 · smoke PRELOAD
   [실행] node checks/run.js sim-json-store */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (...c) => { for(const f of c){ try{ return fs.readFileSync(f, 'utf8'); }catch(_){} } return null; };
const SRC = {
  js: read('json-store.js', 'app/parts/shared/json-store.js', '../app/parts/shared/json-store.js'),
  desk: read('desk-preset-store.js', 'app/parts/creator/desk-preset-store.js', '../app/parts/creator/desk-preset-store.js'),
  animal: read('animal.js', 'app/parts/character/animal.js', '../app/parts/character/animal.js'),
  app: read('app.js', 'app/parts/app.js', '../app/parts/app.js'),
  html: read('desk-companion-prototype.html', 'app/desk-companion-prototype.html', '../app/desk-companion-prototype.html'),
  smoke: read('smoke.js', 'checks/smoke.js'),
  deskui: read('desk-preset.js', 'app/parts/creator/desk-preset.js', '../app/parts/creator/desk-preset.js'),
  codes: read('error-codes.js', 'app/parts/shared/error-codes.js', '../app/parts/shared/error-codes.js'),
};
for(const k of Object.keys(SRC)) if(SRC[k] == null){ say('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src, name) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const J = load(SRC.js);

function fakeStorage(quota){
  const m = new Map();
  return {
    m,
    getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => {
      const s = String(v);
      if(quota != null && (k.length + s.length) * 2 > quota){ const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, s);
    },
  };
}
const KEY = 'tw.deskPresets';

say('── 1. load');
{
  const st = fakeStorage();
  const S = J.createJsonStore({ storage: () => st });
  let r = S.load(KEY, []);
  chk(r.ok === true && Array.isArray(r.list) && r.list.length === 0 && r.err === null, '키 없음 → ok · fallback');
  st.m.set(KEY, '');
  r = S.load(KEY, []);
  chk(r.ok === true && r.list.length === 0, '빈 글 → ok · fallback(예전 «|| \'[]\'» 와 같게)');
  st.m.set(KEY, '[1,null,{"a":2}]');
  r = S.load(KEY, []);
  chk(r.ok === true && r.list.length === 3 && r.list[2].a === 2 && r.bytes === (KEY.length + 16) * 2, '해석 성공 → 값 그대로 · 크기 = (키 + 글) × 2');
  st.m.set(KEY, '[{"a":1},');
  const fb = [];
  r = S.load(KEY, fb);
  chk(r.ok === false && r.list === fb && r.err && r.err.name === 'SyntaxError' && r.bytes > 0, '해석 실패 → ok:false · fallback · SyntaxError · 읽은 크기');
  r = J.createJsonStore({ storage: () => { throw new Error('denied'); } }).load(KEY, {});
  chk(r.ok === false && r.err.message === 'denied', '저장소를 못 열면 ok:false · fallback');
  r = J.createJsonStore({}).load(KEY, []);
  chk(r.ok === false && Array.isArray(r.list), '저장소가 아예 없어도 던지지 않는다');
}

say('── 2. save');
{
  const st = fakeStorage(200);
  const S = J.createJsonStore({ storage: () => st });
  let r = S.save(KEY, [null, { a: 1 }]);
  chk(r.ok === true && st.m.get(KEY) === '[null,{"a":1}]' && r.bytes === (KEY.length + 14) * 2, '성공 → JSON 으로 쓴다 · 크기');
  r = S.save(KEY, ['x'.repeat(200)]);
  chk(r.ok === false && r.err.name === 'QuotaExceededError' && st.m.get(KEY) === '[null,{"a":1}]', '용량 초과 → ok:false · 저장분 그대로');
  const cyc = {}; cyc.self = cyc;
  r = S.save(KEY, cyc);
  chk(r.ok === false && r.err.name === 'TypeError' && r.bytes === 0, 'JSON 못 만듦 → ok:false · TypeError');
  let threw = false; try{ r = J.createJsonStore({ storage: () => { throw new Error('denied'); } }).save(KEY, []); }catch(_){ threw = true; }
  chk(!threw && r.ok === false, '저장소를 못 열어도 던지지 않는다');
}

say('── 3. 부르는 쪽 동작 고정');
{
  const st = fakeStorage();
  const S = J.createJsonStore({ storage: () => st });
  const D = new Function('window', 'module', 'console', SRC.desk + '\nreturn window.TwDeskPresetStore;')({}, undefined, { warn(){} }).createDeskPresetStore({ jsonStore: S, notifyError: () => true });
  const nulls5 = (a) => Array.isArray(a) && a.length === 5 && a.every(x => x === null);
  chk(nulls5(D.loadDeskPresets()), '사람: 키 없음 → 빈 5칸');
  st.m.set(KEY, '[{"ts":1},{"ts":2}]');
  const a = D.loadDeskPresets();
  chk(a.length === 5 && a[0].ts === 1 && a[1].ts === 2 && a[2] === null, '사람: 2칸 저장분 → 앞 2칸 + 빈 3칸');
  st.m.set(KEY, JSON.stringify([1, 2, 3, 4, 5, 6, 7]));
  chk(D.loadDeskPresets().join() === '1,2,3,4,5', '사람: 7칸 → 앞 5칸만');
  st.m.set(KEY, '{"a":1}');
  chk(nulls5(D.loadDeskPresets()), '사람: 배열이 아니면 빈 5칸');
  st.m.set(KEY, '[{"ts":1},');
  chk(nulls5(D.loadDeskPresets()), '사람: 해석 실패 → 빈 5칸(예전과 같게)');
  st.m.delete(KEY);
  const r = D.saveDeskPresets([1, 2, 3, 4, 5, 6]);
  chk(st.m.get(KEY) === '[1,2,3,4,5]' && r && r.ok === true, '사람: 저장은 앞 5칸만 · 결과를 돌려준다');

  const grab = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return null; let d = 0, j = src.indexOf('{', i); for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
  const AK = 'tw.animalPresets';
  const al = grab(SRC.animal, '_loadPresets'), as = grab(SRC.animal, '_savePresets');
  chk(!!al && !!as, 'animal.js 에 _loadPresets · _savePresets 가 있다');
  const an = new Function('TwJsonStore', 'ANP_PRESET_KEY', 'TwErrorCodes', 'console', al + '\n' + as + '\nreturn { _loadPresets, _savePresets };')(Object.assign({}, J, S), AK, { notify: () => true }, { warn(){} });
  let o = an._loadPresets();
  chk(o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length === 0, '동물: 키 없음 → {}');
  const o2 = an._loadPresets(); o.p1 = 1;
  chk(o2.p1 === undefined, '동물: 부를 때마다 새 {} (고쳐 써도 다음 읽기에 안 샘)');
  an._savePresets({ p2: { face: 1 } });
  chk(an._loadPresets().p2.face === 1, '동물: 저장 → 다시 읽기');
  st.m.set(AK, '{"p1":');
  chk(Object.keys(an._loadPresets()).length === 0, '동물: 해석 실패 → {}(예전과 같게)');
}

say('── 4. 실패 알림');
{
  const grabFn = (src, name) => { const i = src.indexOf('function ' + name + '('); if(i < 0) return null; let d = 0, j = src.indexOf('{', i); for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
  const q = new Error('quota'); q.name = 'QuotaExceededError';
  chk(J.failReason(q) === '저장 공간이 부족해요' && J.failReason({ name: 'NS_ERROR_DOM_QUOTA_REACHED' }) === '저장 공간이 부족해요', '용량 초과 → «저장 공간이 부족해요»');
  chk(J.failReason(new TypeError('c')) === 'TypeError' && J.failReason(null) === '알 수 없는 오류' && J.failReason('x'.repeat(99)).length === 40, '그 밖 → 오류 이름 · 빈 오류 · 긴 글 40자');
  chk(J.saveFailText(q) === '프리셋을 저장하지 못했어요 — 저장 공간이 부족해요', '저장 실패 문구');
  chk(J.diagLine('save', KEY, { err: q, bytes: 9 }, 3) === '[프리셋] save 실패 key=tw.deskPresets bytes=9 err=QuotaExceededError slot=3' && J.diagLine('load', KEY, {}).endsWith('err=- slot=-'), '콘솔 진단 한 줄');
  const notes = [], toasts = [], warns = [];
  const EC = { notify: (code, err, text) => { notes.push([code, text]); return true; } };
  const CON = { warn: (l) => warns.push(l) };
  /* 사람 — 책상 프리셋 저장(읽기 실패 번호) · 칸 화면 _saveNotice(저장 실패 번호) */
  const st = fakeStorage(60);
  const S = J.createJsonStore({ storage: () => st });
  const D = new Function('window', 'module', 'console', SRC.desk + '\nreturn window.TwDeskPresetStore;')({}, undefined, CON).createDeskPresetStore({ jsonStore: S, notifyError: EC.notify });
  st.m.set(KEY, '[{');
  D.loadDeskPresets();
  chk(notes.length === 1 && notes[0][0] === 'E-CHAR-02' && /load 실패/.test(warns[0] || ''), '사람: 읽기 실패 → E-CHAR-02 · 진단 줄');
  notes.length = 0;
  const sn = grabFn(SRC.deskui, '_saveNotice');
  chk(!!sn, 'desk-preset.js 에 _saveNotice 가 있다');
  const notice = new Function('deskPresetStoreMod', 'toast', 'notifyError', 'console', sn + '\nreturn _saveNotice;')(D, (m) => toasts.push(m), EC.notify, CON);
  st.m.delete(KEY);
  notice(D.saveDeskPresets(['x'.repeat(80)]), 2, '프리셋 2번에 저장했어요');
  chk(toasts.length === 0 && notes.length === 1 && notes[0][0] === 'E-CHAR-01' && notes[0][1] === '프리셋을 저장하지 못했어요 — 저장 공간이 부족해요', '사람: 저장 실패 → 성공 안내 없이 E-CHAR-01 · 이유');
  notes.length = 0;
  notice(D.saveDeskPresets([1]), 1, '프리셋 1번에 저장했어요');
  chk(toasts.join() === '프리셋 1번에 저장했어요' && notes.length === 0, '사람: 저장 성공 → 안내만');
  chk(/notifyError\('E-CHAR-03', err\)/.test(SRC.deskui), '사람: 프리셋 책상 모델 실패 → E-CHAR-03');
  /* 동물 */
  toasts.length = 0; notes.length = 0;
  const AK = 'tw.animalPresets';
  const fns = ['_loadPresets', '_savePresets', '_presetSaveNotice'].map((n) => grabFn(SRC.animal, n));
  chk(fns.every(Boolean), 'animal.js 에 _loadPresets · _savePresets · _presetSaveNotice 가 있다');
  const S2 = Object.assign({}, J, J.createJsonStore({ storage: () => st }));
  const an = new Function('TwJsonStore', 'ANP_PRESET_KEY', 'TwErrorCodes', 'console', 'toast', fns.join('\n') + '\nreturn { _loadPresets, _savePresets, _presetSaveNotice };')(S2, AK, EC, CON, (m) => toasts.push(m));
  st.m.set(AK, '{"p');
  an._loadPresets();
  chk(notes.length === 1 && notes[0][0] === 'E-CHAR-05', '동물: 읽기 실패 → E-CHAR-05');
  notes.length = 0; st.m.delete(AK);
  an._presetSaveNotice(an._savePresets({ p1: 'x'.repeat(80) }), 1, '프리셋 1에 저장했어요');
  chk(toasts.length === 0 && notes.length === 1 && notes[0][0] === 'E-CHAR-04', '동물: 저장 실패 → 성공 안내 없이 E-CHAR-04');
  const E = load(SRC.codes);
  chk(['E-CHAR-01', 'E-CHAR-02', 'E-CHAR-03', 'E-CHAR-04', 'E-CHAR-05'].every((c) => E.info(c)), '번호 다섯이 에러코드 표에 있다');
  /* 깨 보기 — 저장 결과를 안 보고 늘 성공 안내를 띄우면 */
  const broke = sn.replace('if(res.ok){ toast(okMsg); return; }', 'toast(okMsg); return;');
  toasts.length = 0; notes.length = 0;
  new Function('deskPresetStoreMod', 'toast', 'notifyError', 'console', broke + '\nreturn _saveNotice;')(D, (m) => toasts.push(m), EC.notify, CON)({ ok: false, err: q }, 1, '저장했어요');
  chk(broke !== sn && toasts.length === 1 && notes.length === 0, '  깨 보기: 실패에도 성공 안내를 띄우면 → 위 판정이 빨강(안내 1 · 번호 0)');
}

say('── 5. 배선');
{
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
  const h = SRC.html, iJ = h.indexOf('<script src="parts/shared/json-store.js"></script>');
  const iD = h.indexOf('<script src="parts/creator/desk-preset-store.js"></script>'), iA = h.indexOf('<script src="parts/character/animal.js"></script>'), iP = h.indexOf('<script src="parts/app.js"></script>');
  chk(iJ > 0 && iJ < iD && iJ < iA && iJ < iP, 'html — json-store.js 를 책상 프리셋 저장 · animal.js · app.js 보다 먼저');
  chk(!/localStorage/.test(strip(SRC.desk)), 'desk-preset-store.js 는 localStorage 를 직접 안 만진다');
  const ap = (SRC.animal.match(/function _loadPresets[^\n]*\n[^\n]*/) || [''])[0];
  chk(ap && !/localStorage/.test(ap), 'animal.js 프리셋 읽기 · 쓰기는 localStorage 를 직접 안 만진다');
  chk(/createDeskPresetStore\(\{\n  jsonStore: TwJsonStore,\n  notifyError: \(\.\.\.a\)=>TwErrorCodes\.notify\(\.\.\.a\),\n\}\);/.test(SRC.app), 'app.js — 책상 프리셋 저장에 jsonStore · notifyError 를 deps 로');
  chk(/PRELOAD\.push\('json-store\.js'\);/.test(SRC.smoke), 'smoke PRELOAD 에 json-store.js');
  /* 깨 보기 — 저장소가 직접 localStorage 를 다시 쓰면 위 판정이 잡는다 */
  const broke = SRC.desk.replace('jsonStore.load(PRESET_KEY, [])', "({ ok: true, list: JSON.parse(localStorage.getItem(PRESET_KEY)||'[]') })");
  chk(broke !== SRC.desk && /localStorage/.test(strip(broke)), '  깨 보기: 책상 프리셋 저장이 localStorage 를 직접 읽으면 → 빨강');
}

say('\n' + (fail ? '✗ 통과 ' + pass + ' · 실패 ' + fail : '전부 통과 ✅ ' + pass));
process.exit(fail ? 1 : 0);
