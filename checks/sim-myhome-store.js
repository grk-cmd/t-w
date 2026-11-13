/* ═══ 🏠 sim-myhome-store.js — 마이홈 상태 주인 (0.13 앱 묶음 D2-2) ═══
   [왜] 마이홈 페이지의 원본이 서버가 됐다. 판(page.version) 하나를 페이지 PATCH · 디자인 PUT 이 같이 올려서 겹쳐 보내면 409 가 나고,
     늦게 온 답이 새 집 · 새 계정 화면을 덮는다. 진짜 모듈을 가짜 서버 길 위에서 돌려 순서를 본다.
   ・1절: 받기 — 받기 전 · 구경 중 · 미리보기 중 고치기 잠금(요청 0) · 받은 값 · 판 없는 답 = 못 받음(E-MH-20) · 공통 code 는 공통 번호
   ・2절: 저장 — 바뀐 칸만 · 바뀐 칸 없으면 요청 0 · 보내는 중 고침 → 끝난 뒤 한 번(판 이어 감) · 서버가 글을 씻어도 다시 보내지 않음 · 늘 판을 싣는다
   ・3절: 스티커 — w · h 정수 · 가득 참 · 지움 · 순서 · 올리는 사이 지움 · 얼린 page()
   ・4절: 디자인 · 배경 — PUT design(프리셋 3칸) · 바깥 배경 · 초기화는 PATCH 의 테마 지우기
   ・5절: 409 · 실패 — 글 칸만 얹어 한 번 더(Q1) · 두 번째 409 는 받은 값 + 알림 · 디자인 409 · 실패 한 번 · 혼자 다시 안 보냄 · flush
   ・6절: 올리기 — 실패면 예전 값(E-MH-24) · 같은 칸 busy
   ・7절: 구경 · 계정 — gen · 없는 사람 · 집 실패(E-MH-21) · reset 뒤 답 버림 · 주인 바뀜은 조용히
   ・8절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0, quiet = false;
const say = (s) => { if(!quiet) console.log(s); };
const chk = (ok, msg) => { if(quiet){ if(!ok) fail++; return; } ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const P = (f, dir) => [f, 'parts/' + dir + '/' + f, 'app/parts/' + dir + '/' + f, 'apps/desktop/app/parts/' + dir + '/' + f];
const S = {
  ST: pick(P('myhome-store.js', 'myhome')), API: pick(P('myhome-api.js', 'myhome')), AE: pick(P('api-errors.js', 'shared')), RU: pick(P('myhome-sticker-rules.js', 'myhome')),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html', 'apps/desktop/app/desk-companion-prototype.html']),
  SMOKE: pick(['smoke.js', 'checks/smoke.js']),
};
for(const k of Object.keys(S)) if(!S[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const loadMod = (src) => { const m = { exports: {} }; new Function('window', 'module', src)(undefined, m); return m.exports; };
const flush = async () => { for(let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };
const apiErr = (status, code) => Object.assign(new Error(code || String(status)), { status, code: code || '', kind: status >= 500 || status === 0 ? 'unavailable' : (status === 401 || status === 403) ? 'auth' : 'request' });
const clone = (v) => JSON.parse(JSON.stringify(v));
const stk = (img, o) => Object.assign({ img: 'https://s/' + img + '.png', x: 1, y: 2, w: 100, h: 50, size: 1 }, o || {});

function mk(srv0, opt){
  const log = [], waits = [];
  const srv = Object.assign({ page: { avatar: null, bio: 'b', postTitle: 't', post: 'p', bgm: null, bg: null, stickers: {}, theme: null, themePresets: [null, null, null], themePresetCur: 0 },
    pageVersion: 5, desktop: { bg: null, hideFolders: false, folderPos: {} }, desktopVersion: 2, auto: true }, srv0 || {});
  const answer = (fn) => new Promise((res, rej) => {
    const go = () => { try{ const v = fn(); if(v instanceof Error) rej(v); else res(v); }catch(e){ rej(e); } };
    if(srv.auto) go(); else waits.push(go);
  });
  const lib = loadMod(S.API);
  const home = () => ({ page: clone(srv.page), pageVersion: srv.pageVersion, desktop: clone(srv.desktop), desktopVersion: srv.desktopVersion });
  const api = {
    fetchMine: () => { log.push('GET mine'); return answer(() => (srv.mineErr ? srv.mineErr : home())); },
    fetchOf: (c) => { log.push('GET of ' + c); return answer(() => (srv.ofErr && srv.ofErr[c]) || { page: Object.assign(clone(srv.page), { bio: 'of ' + c }), desktop: clone(srv.desktop) }); },
    patchPage: (v, f) => { log.push('PATCH v' + v + ' ' + JSON.stringify(Object.keys(f))); srv.sent = srv.sent || []; srv.sent.push(clone(f));
      return answer(() => { if(srv.patchErr) return srv.patchErr.shift ? (srv.patchErr.length ? srv.patchErr.shift() : srv.version2(f)) : srv.patchErr; return srv.version2(f); }); },
    putDesign: (v, d) => { log.push('PUT design v' + v + ' ' + JSON.stringify(Object.keys(d))); srv.designs = srv.designs || []; srv.designs.push(clone(d));
      return answer(() => (srv.designErr ? srv.designErr : ++srv.pageVersion)); },
    uploadImage: (d) => { log.push('POST image'); return answer(() => (srv.upErr ? srv.upErr : 'https://img/up' + log.length + '.png')); },
    reset: () => { log.push('api reset'); },
  };
  srv.version2 = (f) => {
    for(const k of Object.keys(f)){ if(k === 'clearTheme') srv.page.theme = null; else srv.page[k] = k === 'stickers' ? f[k] : f[k]; }
    return ++srv.pageVersion;
  };
  const st = loadMod(S.ST).createMyHomeStore({ api, lib, errs: loadMod(S.AE), apiErrors: { notify: (e) => log.push('common ' + (e && e.code)) },
    notifyError: (c) => log.push('error ' + c), toast: (m) => log.push('toast ' + m), previewOn: () => !!(opt && opt.preview), rules: loadMod(S.RU) });
  const release = async (n) => { for(let i = 0; i < (n || 1); i++){ const go = waits.shift(); if(go) go(); await flush(); } };
  return { st, log, srv, release, waits };
}
const count = (log, re) => log.filter((l) => re.test(l)).length;
const ready = async (e) => { const p = e.st.pullMine(); if(!e.srv.auto){ await e.release(); } await p; return e; };
const tick = flush;

async function judge(withBreak){
  const brk = withBreak || {};
  say('── 1. 받기');
  {
    const e = mk();
    chk(await e.st.setField('bio', 'x') === 'locked' && e.log.length === 0 && !e.st.canEdit(), '받기 전엔 고치기가 잠김(요청 0)');
    chk(await e.st.pullMine() && e.st.mine().load === 'ready' && e.st.page().bio === 'b' && e.st.mine().pageVersion === 5 && e.st.canEdit(), '받으면 ready · 페이지 · 판');
    chk(Object.isFrozen(e.st.page()) && Object.isFrozen(e.st.page().stickers), '내놓는 page() 는 얼려 있다(화면이 직접 못 고침)');
    const d = e.st.page(); try{ d.bio = 'zzz'; }catch(_){} chk(e.st.page().bio === 'b', '  직접 고쳐도 값은 그대로');
    const pv = mk(null, { preview: true }); await pv.st.pullMine();
    chk(await pv.st.setField('bio', 'x') === 'locked' && count(pv.log, /^PATCH/) === 0, '미리보기 중 고치기 잠김');
    const nov = mk({ pageVersion: undefined }); await nov.st.pullMine();
    chk(nov.st.mine().load === 'failed' && nov.log.includes('error E-MH-20'), '판 없는 답 = 못 받음(E-MH-20) — 판 없이 쓰지 않는다');
    const down = mk({ mineErr: apiErr(503, 'X') });
    chk(!(await down.st.pullMine()) && down.st.mine().load === 'failed' && down.log.includes('error E-MH-20') && await down.st.setField('bio', 'x') === 'locked', '못 받음 → failed · E-MH-20 · 고치기 잠금');
    const prem = mk({ mineErr: apiErr(403, 'PREMIUM_REQUIRED') }); await prem.st.pullMine();
    chk(prem.log.includes('common PREMIUM_REQUIRED') && !prem.log.includes('error E-MH-20'), '공통 code 는 공통 번호');
    const hold = mk({ auto: false }); const p1 = hold.st.pullMine(), p2 = hold.st.pullMine();
    chk(p1 === p2 && count(hold.log, /^GET mine$/) === 1, '받는 중 또 받기 → 같은 약속');
    chk(await hold.st.setField('bio', 'x') === 'locked' && hold.log.includes('toast ' + hold.st.MSG.loading), '받는 중 고치려 하면 «불러오는 중이에요»');
    await hold.release();
    const ens = await ready(mk()); const n0 = ens.log.length;
    chk(await ens.st.ensureMine() === true && ens.log.length === n0 && ens.st.avatar() === null, 'ensureMine: ready 면 요청 0');
  }

  say('── 2. 저장');
  {
    const e = await ready(mk());
    await e.st.setField('bio', 'b');
    chk(count(e.log, /^PATCH/) === 0, '바뀐 칸이 없으면 요청 0');
    await e.st.setField('bio', 'new');
    chk(e.log.includes('PATCH v5 ["bio"]') && e.st.mine().pageVersion === 6 && e.srv.sent[0].bio === 'new', '바뀐 칸만 + 판 5 를 싣는다 → 응답 판 6');
    await e.st.setField('bio', 'new');
    chk(count(e.log, /^PATCH/) === 1, '보낸 글과 같으면 다시 안 보냄(서버가 씻어도 비교는 보낸 글)');
    e.srv.page.bio = 'cleaned'; await e.st.setField('bio', 'new');
    chk(count(e.log, /^PATCH/) === 1, '  서버 값이 달라져도 보낸 글과 견준다');
    await e.st.setFields({ bio: 'n2', post: 'p2', postTitle: 'tt' });
    chk(e.srv.sent[1].bio === 'n2' && e.srv.sent[1].post === 'p2' && e.srv.sent[1].postTitle === 'tt' && count(e.log, /^PATCH/) === 2, '글 칸 셋은 한 번에');
    await e.st.setField('bgm', { url: 'https://y/1', title: 'a' }); await e.st.setField('bgm', null);
    chk(e.srv.sent[3].bgm === null && Object.keys(e.srv.sent[3]).join() === 'bgm', 'BGM 지우기는 null 만');
    const h = mk({ auto: false }); await ready(h);
    const a = h.st.setField('bio', '1'), b = h.st.setField('post', '2');
    chk(count(h.log, /^PATCH/) === 1 && h.st.mine().saving, '보내는 중 또 고침 → 아직 요청 1(겹치지 않음)');
    const c = h.st.setField('postTitle', '3');
    await h.release();
    chk(count(h.log, /^PATCH/) === 2 && h.log.filter((l) => /^PATCH/.test(l))[1] === 'PATCH v6 ["postTitle","post"]'.replace('["postTitle","post"]', JSON.stringify(Object.keys(h.srv.sent[1]))), '앞 저장이 끝나면 그 사이 바뀐 칸을 모아 새 판으로 한 번');
    await h.release(); await Promise.all([a, b, c]);
    chk(h.srv.sent[1].post === '2' && h.srv.sent[1].postTitle === '3' && !h.st.mine().saving && h.st.mine().pageVersion === 7, '  둘 다 실림 · 판 7');
  }

  say('── 3. 스티커');
  {
    const e = await ready(mk());
    const r = await e.st.addSticker('data:image/png;base64,AA', { link: 'https://l.k', x: 60, y: 60, w: 99.6, h: 50.2, size: 1 });
    const sid = r.sid, sv = e.srv.sent[0].stickers[sid];
    chk(r.status === 'ok' && count(e.log, /^POST image$/) === 1 && sv && /^https:\/\/img\/up\d+\.png$/.test(sv.img) && Number.isInteger(sv.w) && Number.isInteger(sv.h) && sv.w === 100 && sv.h === 50, '붙이기: 올린 뒤 주소로 PATCH · w · h 정수');
    chk(!JSON.stringify(e.srv.sent).includes('data:'), '  본문에 data: 없음');
    const big = await e.st.editSticker(sid, { w: 9999.4, h: 7.7 });
    chk(e.srv.sent[1].stickers[sid].w === 400 && e.srv.sent[1].stickers[sid].h === 8, '  w 는 400 안 · 정수');
    for(let i = 0; i < 4; i++) await e.st.addSticker('data:x', { x: i, y: i, w: 10, h: 10 });
    const n = count(e.log, /^POST image$/);
    chk((await e.st.addSticker('data:x', { w: 1, h: 1 })).status === 'full' && count(e.log, /^POST image$/) === n, '5장이면 요청 없이 full');
    chk(Object.keys(e.st.page().stickers).length === 5, '  5장');
    await e.st.editSticker(sid, { locked: true, rot: 15, link: '' });
    const s2 = e.srv.sent[e.srv.sent.length - 1].stickers[sid];
    chk(s2.locked === true && s2.rot === 15 && !('link' in s2), '고치기: 잠금 · 회전 · 링크 지우면 칸 없음');
    chk(await e.st.editSticker('nope', { x: 1 }) === 'gone', '없는 sid → gone');
    const ids = Object.keys(e.st.page().stickers);
    const zs0 = ids.map((i) => e.st.page().stickers[i].z);
    await e.st.moveSticker(sid, 1);
    const zs1 = ids.map((i) => e.st.page().stickers[i].z);
    chk(JSON.stringify(zs0) !== JSON.stringify(zs1), '▲ 순서가 바뀐다(z 다시 매김)');
    await e.st.removeSticker(sid);
    chk(!(sid in e.st.page().stickers) && !(sid in e.srv.sent[e.srv.sent.length - 1].stickers), '지우기');
  }
  {
    const e = mk({ auto: false }); await ready(e);
    const p = e.st.addSticker('data:x', { w: 1, h: 1 });
    chk(e.st.mine().uploading, '올리는 중 표시');
    const again = await e.st.addSticker('data:y', { w: 1, h: 1 });
    chk(again.status === 'busy' && count(e.log, /^POST image$/) === 1, '올리는 중 또 붙이기 → busy');
    await e.release(2); const rr = await p;
    chk(rr.status === 'ok' && count(e.log, /^PATCH/) === 1, '올리기 끝 → 저장 한 번');
  }
  {
    const e = mk({ auto: false }); await ready(e);
    const p = e.st.addSticker('data:x', { w: 1, h: 1 });
    e.st.reset(); await e.release(2);
    chk((await p).status === 'stale' && count(e.log, /^PATCH/) === 0, '올리는 중 계정을 놓으면 버린다(요청 0)');
  }

  say('── 4. 디자인 · 배경');
  {
    const e = await ready(mk());
    const presets = [{ name: 'a', theme: { tab: '#111' }, bg: { color: '#222' } }, null, null];
    await e.st.setDesign({ theme: { tab: '#111' }, presets, presetCur: 0 });
    chk(e.log.includes('PUT design v5 ["theme","presets","presetCur"]') && !('bg' in e.srv.designs[0]) && e.st.mine().pageVersion === 6, '디자인 PUT — 바깥 배경은 안 바뀌었으면 안 싣는다 · 판 이어감');
    chk(e.st.page().themePresets.length === 3 && e.st.page().theme.tab === '#111', '  화면에 먼저 얹음');
    await e.st.setDesign({ theme: { tab: '#111' }, presets, presetCur: 0 });
    chk(count(e.log, /^PUT design/) === 1, '바뀐 게 없으면 요청 0');
    await e.st.setDesign({ theme: { tab: '#111' }, presets, presetCur: 0, bg: { color: '#333' } });
    chk(e.srv.designs[1].bg.color === '#333', '바깥 배경이 바뀌면 싣는다');
    await e.st.setField('bg', { color: '#444' });
    chk(e.log[e.log.length - 1] === 'PATCH v7 ["bg"]' || /^PATCH v\d ."bg".$/.test(e.log[e.log.length - 1]), '배경 메뉴 색 = PATCH bg');
    await e.st.resetBg();
    const last = e.srv.sent[e.srv.sent.length - 1];
    chk(last.bg === null && last.clearTheme === true && e.st.page().theme === null && e.st.page().bg === null, '초기화 = PATCH bg null + 테마 지우기');
    chk(e.st.page().themePresets && e.st.page().themePresets[0].name === 'a', '  프리셋은 그대로');
    chk(count(e.log, /^PUT design/) === 2, '  디자인 PUT 은 안 부름(프리미엄 아니어도 됨)');
    const ds = mk({ auto: false }); await ready(ds);
    const a = ds.st.setDesign({ theme: { tab: '#1' }, presets: [null, null, null], presetCur: 0 });
    const b = ds.st.setField('bio', 'zz');
    await ds.release(); await ds.release(); await Promise.all([a, b]);
    const ord = ds.log.filter((l) => /^(PUT|PATCH)/.test(l));
    chk(ord.length === 2 && /^PUT design v5/.test(ord[0]) && /^PATCH v6/.test(ord[1]), '디자인 먼저 · 페이지가 그 응답 판으로 차례로');
    const nodata = await ready(mk());
    chk(await nodata.st.setDesign({ theme: {}, presets: [null, null, null], presetCur: 0, bg: { img: 'data:image/png;base64,AA' } }) === 'invalid' && count(nodata.log, /^PUT/) === 0, 'data: 그림은 저장하지 않는다');
  }

  say('── 5. 409 · 실패');
  {
    const e = await ready(mk());
    e.srv.patchErr = [apiErr(409, 'CONCURRENT_UPDATE')];
    e.srv.page.stickers = { s1: stk('x') }; e.srv.pageVersion = 9;
    await e.st.setFields({ bio: 'mine', post: 'mypost' });
    const l = e.log.filter((x) => /^(PATCH|GET)/.test(x));
    chk(JSON.stringify(l) === JSON.stringify(['GET mine', 'PATCH v5 ["bio","post"]', 'GET mine', 'PATCH v9 ["bio","post"]']), '글 409 → GET 1 + 내가 고친 글 칸만 새 판(9)에 얹어 한 번 더: ' + l.join(' | '));
    chk(e.st.page().bio === 'mine' && e.st.page().stickers.s1 && !e.log.some((x) => x.startsWith('toast')) && e.st.mine().load === 'ready', '  받은 스티커는 그대로 · 알림 없음');
    const e2 = await ready(mk());
    e2.srv.patchErr = [apiErr(409, 'CONCURRENT_UPDATE')];
    e2.srv.pageVersion = 7;
    await e2.st.setFields({ bio: 'mine', bgm: { url: 'https://y/2', title: '' } });
    chk(e2.srv.sent.length === 2 && e2.srv.sent[1].bio === 'mine' && !('bgm' in e2.srv.sent[1]) && e2.log.includes('toast ' + e2.st.MSG.merged), '글 외 칸(BGM)은 버리고 알림');
    const e3 = await ready(mk());
    e3.srv.patchErr = [apiErr(409, 'CONCURRENT_UPDATE'), apiErr(409, 'CONCURRENT_UPDATE')];
    await e3.st.setField('bio', 'mine');
    chk(count(e3.log, /^PATCH/) === 2 && e3.st.page().bio === 'b' && e3.log.includes('toast ' + e3.st.MSG.merged) && e3.st.mine().load === 'ready', '두 번째도 409 → 받은 값 + 알림(더 안 보냄)');
    const e4 = await ready(mk({ designErr: apiErr(409, 'CONCURRENT_UPDATE') }));
    await e4.st.setDesign({ theme: { tab: '#1' }, presets: [null, null, null], presetCur: 1 });
    chk(count(e4.log, /^GET/) === 2 && e4.st.page().theme === null && e4.log.includes('toast ' + e4.st.MSG.merged), '디자인 409 → 받은 값으로 + 알림(내 고침 버림)');
    const e6 = mk(); await e6.st.pullMine();
    e6.srv.designErr = apiErr(409, 'CONCURRENT_UPDATE');
    e6.st.setDesign({ theme: { tab: '#1' }, presets: [null, null, null], presetCur: 1 });
    await e6.st.setField('bio', 'mine6');
    await flush();
    chk(e6.srv.sent && e6.srv.sent.length >= 1 && e6.srv.sent[0].bio === 'mine6' && e6.st.page().bio === 'mine6' && e6.st.page().theme === null, '디자인 + 글 고침 → 디자인 409 → 글은 새 판에 얹혀 PATCH · 디자인은 버림');
    const r2 = await ready(mk());
    r2.srv.patchErr = [apiErr(409, 'CONCURRENT_UPDATE')];
    const p2 = r2.st.setFields({ bio: 'keepme', bgm: { url: 'https://y/3', title: '' } });
    r2.srv.mineErr = apiErr(503, 'X'); await p2; r2.srv.mineErr = undefined;
    chk(r2.st.mine().load === 'failed' && await r2.st.setField('post', 'z') === 'locked', '409 뒤 다시 받기 실패 → 잠김');
    const nget = count(r2.log, /^GET/);
    r2.srv.sent = r2.srv.sent || [];
    chk(await r2.st.pullMine() === true && count(r2.log, /^GET/) === nget + 1 && r2.st.mine().load === 'ready' && r2.st.page().bio === 'keepme', '  다시 시도 = GET 1 · 풀림 · 글 칸은 남음');
    await flush(); chk(r2.st.page().bgm === null && !r2.srv.sent.slice(1).some((f) => 'bgm' in f), '  글 외 칸(BGM)은 받은 값 · 새 판에 싣지 않는다');
    const up = mk({ auto: false }); await ready(up);
    const pa = up.st.setAvatar('data:image/png;base64,AA');
    const pull = up.st.pullMine();   // 올리는 중 받기 시작(READY 라 GET 이 간다)
    await up.release(1); await up.release(1); await pa; await pull; await up.release(2);
    chk(up.srv.sent && up.srv.sent.some((f) => 'avatar' in f), '받는 사이 올리기가 끝나도 저장이 걸린다');
    const rb = mk({ auto: false }); await ready(rb);
    const pb = rb.st.setField('bio', 'a1');
    const dd = rb.st.setDesign({ theme: {}, presets: [{ name: 'P', theme: {}, bg: null }, null, null], presetCur: 1 });
    const rr = rb.st.resetBg();
    await rb.release(4); await Promise.all([pb, dd, rr]); await flush();
    chk(rb.srv.designs && rb.srv.designs.some((d) => d.presets[0] && d.presets[0].name === 'P'), '초기화가 기다리던 프리셋 고침을 지우지 않는다');
    const keep = await ready(mk());
    await keep.st.setDesign({ theme: { a: '#1' }, presets: [{ name: 'Q', theme: {}, bg: null }, null, null], presetCur: 0 });
    await keep.st.setDesign({ theme: { a: '#2' } });
    chk(keep.srv.designs[1].presets[0].name === 'Q', 'setDesign 에 프리셋을 안 넘기면 지금 값을 쓴다');
    const cu = mk({ auto: false }); await ready(cu);
    cu.srv.patchErr = [apiErr(409, 'CONCURRENT_UPDATE')];
    const up2 = cu.st.setAvatar('data:image/png;base64,AA');   // 올리는 중에
    const cp = cu.st.setField('bio', 'mine');
    cu.waits.reverse();   // PATCH 답이 먼저
    await cu.release();   // PATCH 409 → 다시 받기 시작
    const ens = cu.st.ensureMine();
    chk(count(cu.log, /^GET/) === 2, '409 다시 받는 중 ensureMine 은 GET 을 더하지 않는다');
    await cu.release(8); await up2; await ens; await cp; await flush();
    chk(cu.st.page().avatar && /^https:\/\/img\//.test(cu.st.page().avatar) && cu.srv.sent.some((f) => 'avatar' in f), '  다시 받는 사이 끝난 사진 올리기는 받은 값에 밀리지 않고 저장된다');
    chk(cu.st.mine().load === 'ready', '(409 와 올리기 겹침) 끝나면 ready');
    const gd = await ready(mk({ patchErr: apiErr(400, 'MYHOME_INVALID_BGM') }));
    await gd.st.setField('bgm', { url: 'x', title: '' });
    chk(gd.log.includes('toast 유튜브 링크를 인식하지 못했어요') && count(gd.log, /^error/) === 0, '안내 code(GUIDE)는 앱 문구 토스트 · 번호 없음');
    const lock = mk({ auto: false }); await ready(lock);
    lock.srv.patchErr = [apiErr(409, 'CONCURRENT_UPDATE')];
    const pp = lock.st.setField('bio', 'x'); await lock.release();
    chk(lock.st.mine().load === 'loading' && await lock.st.setField('post', 'y') === 'locked', '409 뒤 다시 받는 동안 고치기 잠김');
    await lock.release(3); await pp;
  }
  {
    const e = await ready(mk({ patchErr: apiErr(503, 'X') }));
    await e.st.setField('bio', 'a'); await e.st.setField('bio', 'c');
    chk(count(e.log, /^error E-MH-22$/) === 1 && count(e.log, /^PATCH/) === 2 && e.st.page().bio === 'c', '실패 → 화면 그대로 · 번호 한 번(이어지는 실패) · 다음 고침에 보냄(혼자 안 보냄)');
    e.srv.patchErr = null; await e.st.setField('post', 'c');
    chk(e.srv.sent[2].bio === 'c' && e.srv.sent[2].post === 'c', '  성공하면 못 올린 칸도 같이');
    await e.st.setField('bio', 'zz'); e.srv.patchErr = apiErr(503, 'X'); await e.st.setField('bio', 'zzz');
    chk(count(e.log, /^error E-MH-22$/) === 2, '  성공하면 풀려서 다음 실패에 번호 다시');
    const f = await ready(mk({ patchErr: apiErr(503, 'X') }));
    await f.st.setField('bio', 'q'); f.srv.patchErr = null; const n = count(f.log, /^PATCH/);
    await f.st.flush();
    chk(count(f.log, /^PATCH/) === n + 1 && f.srv.sent[0].bio === 'q', 'flush: 못 올린 고침 한 번');
    const g = await ready(mk({ designErr: apiErr(403, 'PREMIUM_REQUIRED') }));
    await g.st.setDesign({ theme: { a: '#1' }, presets: [null, null, null], presetCur: 0 });
    chk(g.log.includes('common PREMIUM_REQUIRED') && !g.log.includes('error E-MH-23'), '디자인 PREMIUM_REQUIRED = 공통 번호');
    const h = await ready(mk({ designErr: apiErr(400, 'MYHOME_INVALID_THEME') }));
    await h.st.setDesign({ theme: { a: 'x' }, presets: [null, null, null], presetCur: 0 });
    chk(h.log.includes('error E-MH-23'), '디자인 거절 = E-MH-23');
  }
  {
    const e = await ready(mk({ patchErr: apiErr(503, 'X') }));
    await e.st.setField('bio', 'a');
    const n = count(e.log, /^GET/);
    chk(await e.st.pullMine() === true && count(e.log, /^GET/) === n, '못 올린 고침이 있으면 받기 요청 0(받은 값이 덮지 않게)');
  }

  say('── 6. 올리기');
  {
    const e = await ready(mk({ upErr: apiErr(503, 'X') }));
    const r = await e.st.setAvatar('data:image/png;base64,AA');
    chk(r === 'uploadFailed' && e.st.page().avatar === null && e.log.includes('error E-MH-24') && count(e.log, /^PATCH/) === 0, '사진 올리기 실패 → 예전 사진으로 · E-MH-24 · 저장 0');
    const ok = await ready(mk());
    chk(await ok.st.setAvatar('data:image/png;base64,AA') === 'ok' && /^https:\/\/img\/up\d+\.png$/.test(ok.srv.sent[0].avatar) && !JSON.stringify(ok.srv.sent).includes('data:'), '사진 성공 → 주소만 PATCH');
    const h = mk({ auto: false }); await ready(h);
    const p = h.st.setAvatar('data:image/png;base64,AA');
    chk(h.st.page().avatar === 'data:image/png;base64,AA' && count(h.log, /^PATCH/) === 0, '고르자마자 미리 그린다(저장엔 안 실음)');
    chk(await h.st.setAvatar('data:image/png;base64,BB') === 'busy', '올리는 중 같은 칸 또 → busy');
    const other = h.st.setField('bio', 'zz');
    await h.release(3); await p; await other;
    chk(h.srv.sent.length >= 1 && h.srv.sent.every((s) => !JSON.stringify(s).includes('data:')), '올리는 중 다른 칸 고침은 줄에 서서 간다 · data: 없음');
    const up = await ready(mk());
    const u = await up.st.upload('design:bg', 'data:x');
    chk(u.status === 'ok' && /^https:\/\/img\/up\d+\.png$/.test(u.url) && count(up.log, /^PATCH|^PUT/) === 0, 'upload — 주소만 돌려주고 저장은 안 함(스튜디오가 이어서 setDesign)');
    const bad = await ready(mk({ upErr: apiErr(400, 'IMAGE_UPLOAD') }));
    chk((await bad.st.upload('bg', 'x')).status === 'uploadFailed' && bad.log.includes('error E-MH-24'), '  올리기 실패 번호');
    const own = await ready(mk({ upErr: apiErr(409, 'OWNER_CHANGED') }));
    chk((await own.st.upload('bg', 'x')).status === 'uploadFailed' && count(own.log, /^error/) === 0, '  주인 바뀜은 조용히');
  }

  say('── 7. 구경 · 계정');
  {
    const e = await ready(mk({ auto: false }));
    e.srv.auto = true;
    const mineBefore = e.st.page().bio;
    chk(await e.st.openView('A') === 'ok' && e.st.viewing() === 'A' && e.st.page().bio === 'of A' && !e.st.canEdit(), '구경 시작 → 그 집 페이지 · 고치기 잠김');
    chk(e.st.mine().page.bio === mineBefore, '  내 홈은 그대로(사본 없음)');
    e.st.closeView();
    chk(e.st.viewing() === null && e.st.page().bio === mineBefore && e.st.canEdit(), '돌아오기 → 내 홈 · 고치기 열림');
    const miss = mk({ ofErr: { Z: apiErr(404, 'USER_NOT_FOUND') } }); await miss.st.pullMine();
    chk(await miss.st.openView('Z') === 'missing' && count(miss.log, /^error/) === 0 && miss.st.viewing() === null, '없는 사람 → 안내만(번호 없음) · 보던 집 그대로');
    const bad = mk({ ofErr: { Q: apiErr(503, 'X') } }); await bad.st.pullMine(); await bad.st.openView('A');
    chk(await bad.st.openView('Q') === 'failed' && bad.log.includes('error E-MH-21') && bad.st.viewing() === 'A', '못 받음 → E-MH-21 · 지금 보던 집(A) 그대로');
    const h = mk({ auto: false }); await ready(h);
    const a = h.st.openView('A'), b = h.st.openView('B');
    await h.release(2);
    chk(await a === 'stale' && await b === 'ok' && h.st.viewing() === 'B', '집을 빨리 옮김 → 늦게 온 앞 집 답은 버린다');
    h.st.closeView(); const c = h.st.openView('C'); h.st.closeView(); await h.release();
    chk(await c === 'stale' && h.st.viewing() === null, '닫는 중 온 답은 아무것도 그리지 않는다');
    const n = mk({ ofErr: {} }); await n.st.pullMine(); await n.st.openView('A', ' 친구 ');
    chk(n.st.viewName() === '친구', '이름 힌트(앞뒤 공백 뗌)'); n.st.setViewName('새이름'); chk(n.st.viewName() === '새이름', '  구경 중 이름 갱신');
  }
  {
    const e = mk({ auto: false }); const p = e.st.pullMine(); e.st.reset(); await e.release(); await p;
    chk(e.st.mine().load === 'idle' && e.st.page().bio === '' && e.log.includes('api reset'), 'reset 뒤 늦은 받기 답은 버린다 · provider 도 비운다');
    const s = await ready(mk({ auto: false })); s.srv.auto = false;
    const w = s.st.setField('bio', 'x'); s.st.reset(); await s.release();
    chk(await w === 'stale', 'reset 뒤 저장 답은 상태를 안 고친다');
    const own = await ready(mk({ patchErr: apiErr(409, 'OWNER_CHANGED') }));
    await own.st.setField('bio', 'x');
    chk(count(own.log, /^error/) === 0, '주인 바뀜(OWNER_CHANGED)은 조용히 버림');
  }

  say('── 8. 배선');
  {
    const html = S.HTML, smoke = S.SMOKE;
    const iApi = html.indexOf('<script src="parts/myhome/myhome-api.js">'), iSt = html.indexOf('<script src="parts/myhome/myhome-store.js">'), iApp = html.indexOf('<script src="parts/app.js">');
    chk(iApi > 0 && iSt > iApi && iSt < iApp, 'html: myhome-store.js 를 myhome-api.js 뒤 · app.js 앞에');
    chk(/PRELOAD\.push\('myhome-store\.js'\)/.test(smoke), 'smoke PRELOAD 에 있다');
    const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
    const code = strip(S.ST);
    chk(!/firebaseAPI|localStorage|setInterval/.test(code) && !/setTimeout/.test(code), 'Firebase · 로컬 저장 · 타이머 없음');
  }
  void brk;
}

(async () => {
  await judge();
  /* 깨 보기 — 모듈 글을 일부러 틀려 빨강이 나는지 */
  say('── 9. 일부러 깨 보기');
  const base = { pass, fail };
  const breaks = [
    ['canEdit 를 빼면(미리보기에서 열림)', (s) => s.replace('mineSt.load === LOAD.READY && !viewSt.owner && !previewOn()', 'mineSt.load === LOAD.READY'), (s) => s.replace("if(viewSt.owner || previewOn()) return 'locked';", '')],
    ['gen 비교를 빼면(앞 집 답이 이김)', (s) => s.split('vg !== viewSt.gen').join('false')],
    ['again 모으기를 빼면(저장이 겹침)', (s) => s.replace('if(saving) return saveP;', '')],
    ['409 에서 글 칸을 안 얹으면', (s) => s.replace('const keepText = !textRetry;', 'const keepText = false;')],
    ['409 다시 받는 사이 끝난 올리기를 안 남기면', (s) => s.replace('Object.assign(texts, late);', '')],
    ['저장 중 받기를 막지 않으면', (s) => s.replace('if(saving) return saveP.then(() => mineSt.load === LOAD.READY);', '')],
    ['스티커 w · h 를 정수로 안 만들면', (s) => s.replace('s.w = Math.max(1, Math.min(400, Math.round(Number(s.w) || 1)));', 's.w = Number(s.w);')],
  ];
  const origLoad = S.ST;
  for(const [name, ...fns] of breaks){
    let src = origLoad;
    for(const fn of fns) src = fn(src);
    if(src === origLoad){ chk(false, name + ' — 깰 자리를 못 찾음'); continue; }
    S.ST = src; quiet = true; const f0 = fail;
    try{ await Promise.race([judge(), new Promise((_, rej) => setTimeout(() => rej(new Error('멈춤')), 4000))]); }catch(_){ fail++; }
    const reds = fail - f0; quiet = false; fail = f0;
    chk(reds > 0, name + ' → 빨강 ' + reds);
  }
  S.ST = origLoad;
  console.log('\n판정: ' + (fail ? '✗ 빨강 ' + fail : '통과') + ' (' + pass + ' ✓)');
  process.exit(fail ? 1 : 0);
})();
