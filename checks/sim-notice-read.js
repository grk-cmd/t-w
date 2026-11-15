/* ═══ 📢 sim-notice-read.js — 공지 읽기 provider(notice-api.js) · 공지 한 판(notice-feed.js) ═══
   [왜] 소식 · 업데이트 공지 · 런처 배너의 원본이 서버(GET /v2/notices)다. 서버 모양 → 화면 모양 맞춤, 받는 중 · 받음 · 못 받음, 못 받아도 앞서 받은 판 유지,
     혼자 다시 받지 않기(타이머 0), 번호는 사용자가 누른 받기에서만을 실제로 불러서 판정한다(가짜 통로 위).
   ・1절: notice-api — 경로 · 소식 맞춤(대문자 tag → 소문자 · 고정 + 최신 합침) · 업데이트 공지 · 배너(그림 없는 칸 뺌) · 더 있음 · 모양 틀림은 던짐 · 못 읽으면 던짐
   ・2절: notice-feed — 상태 · 처음 받은 소식은 «새 소식» 아님 · 받는 중 또 부르면 끝난 뒤 한 번 더 · 못 받음(번호는 manual 에서만 한 번) · 앞서 받은 판 유지 · onceReady 한 번
   ・3절: 배선 — firebase-init 에 옛 공지 읽기(subscribeAdBanner · subscribeInboxBroadcast)가 없다 · app.js 가 서버 길로 만든다 · html 순서
   ・4절: 일부러 깨 보기
   [실행] 러너 스테이징(평면)에서. */
'use strict';
const fs = require('fs');
let pass = 0, fail = 0;
const say = (s) => console.log(s);
const chk = (ok, msg) => { ok ? pass++ : fail++; say('  ' + (ok ? '✓' : '✗') + ' ' + msg); };
const read = (f) => { try{ return fs.readFileSync(f, 'utf8'); }catch(_){ return null; } };
const pick = (names) => names.map(read).find(Boolean);
const S = {
  API: pick(['notice-api.js', 'parts/launcher/notice-api.js', 'app/parts/launcher/notice-api.js']),
  FEED: pick(['notice-feed.js', 'parts/launcher/notice-feed.js', 'app/parts/launcher/notice-feed.js']),
  FI: pick(['firebase-init.js', 'parts/firebase-init.js', 'app/parts/firebase-init.js']),
  APP: pick(['app.js', 'parts/app.js', 'app/parts/app.js']),
  HTML: pick(['desk-companion-prototype.html', 'app/desk-companion-prototype.html']),
};
for(const k of Object.keys(S)) if(!S[k]){ console.log('  ? 원본 못 찾음 — ' + k); process.exit(2); }
const load = (src, g) => { const w = {}; new Function('window', 'module', src)(w, undefined); return w[g]; };
const tick = () => new Promise((r) => setImmediate(r));
const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const sv = (id, tag, pinned) => ({ id, tag, title: 't' + id, body: 'b', publishedAt: '2026-11-01T00:00:00Z', pinned: !!pinned, version: 3 });
const data = (o) => Object.assign({ updateNotice: null, launcherBanner: [], broadcasts: { pinned: [], latest: [], nextCursor: null } }, o);

async function judge(src){
  const r = []; const t = (ok, m) => r.push([!!ok, m]);
  const A = load(src.API, 'TwNoticeApi'), F = load(src.FEED, 'TwNoticeFeed');
  /* 1. api */
  const paths = [];
  let reply = data({ updateNotice: { id: 'u1', title: 'T', body: 'B', publishedAt: '2026-11-02T00:00:00Z' },
    launcherBanner: [{ imageUrl: 'https://i/a.png', linkUrl: 'https://l' }, { imageUrl: '', linkUrl: 'x' }, { imageUrl: 'https://i/b.png' }],
    broadcasts: { pinned: [sv('p1', 'NOTICE', true)], latest: [sv('n2', 'UPDATE')], nextCursor: 'c' } });
  const api = A.createNoticeApi({ get: async (p) => { paths.push(p); if(reply instanceof Error) throw reply; return reply; } });
  const b = await api.fetchBoard();
  t(paths[0] === '/v2/notices', '경로 = GET /v2/notices');
  t(Object.keys(b.broadcasts).join() === 'p1,n2' && b.broadcasts.p1.tag === 'notice' && b.broadcasts.n2.tag === 'update' && b.broadcasts.p1.pinned === true && b.broadcasts.n2.ts === Date.parse('2026-11-01T00:00:00Z'),
    '소식 — 고정 + 최신 합침 · 대문자 tag → 소문자 · 시각 ms · 고정 표시');
  t(b.updateNotice.title === 'T' && b.updateNotice.ts === Date.parse('2026-11-02T00:00:00Z') && b.banner.length === 2 && b.banner[0].link === 'https://l' && b.banner[1].link === '' && b.hasMore === true,
    '업데이트 공지 · 배너(그림 없는 칸 뺌 · 링크 없으면 빈 글) · 더 있음');
  reply = data({}); t((await api.fetchBoard()).updateNotice === null, '업데이트 공지가 없으면 null');
  reply = { nope: 1 }; let e1 = null; try{ await api.fetchBoard(); }catch(e){ e1 = e; }
  t(e1 && e1.code === 'SHAPE', '모양이 틀리면 던진다(빈 값으로 숨기지 않음)');
  reply = Object.assign(new Error('x'), { code: 'NETWORK' }); let e2 = null; try{ await api.fetchBoard(); }catch(e){ e2 = e; }
  t(e2 && e2.code === 'NETWORK', '못 읽으면 그 오류를 그대로 던진다');
  /* 2. feed */
  let mode = 'ok', n = 0, gate = null; const notes = [];
  const board = (ids, extra) => Object.assign({ updateNotice: { id: 'u', title: 'T', body: 'B', ts: 5 }, banner: [{ img: 'i', link: '' }], broadcasts: Object.fromEntries(ids.map((i) => [i, { tag: 'notice', title: i, body: '', ts: 1, pinned: false, version: 1 }])), hasMore: false }, extra);
  let ids = ['a'];
  const fake = { fetchBoard: async () => { n++; if(gate) await gate; if(mode === 'fail') throw new Error('down'); return board(ids); } };
  const feed = F.createNoticeFeed({ api: fake, notifyError: (c) => { notes.push(c); return true; } });
  const seen = []; feed.onChange((e) => seen.push(e.addedIds.slice()));
  t(feed.status() === 'idle' && !feed.ready(), '처음 상태 idle · 받은 적 없음');
  await feed.refresh(); await tick();
  t(feed.status() === 'ready' && feed.ready() && Object.keys(feed.broadcasts()).join() === 'a' && seen[0].length === 0, '처음 받은 소식은 «새 소식» 이 아니다(addedIds 비어 있음)');
  ids = ['a', 'b']; await feed.refresh();
  t(seen[1].join() === 'b', '다음에 늘어난 소식 id 만 addedIds');
  let release; gate = new Promise((res) => { release = res; });
  const before = n; const p1 = feed.refresh(); feed.refresh(); feed.refresh();
  t(n === before + 1, '받는 중에 또 불러도 요청은 하나');
  gate = null; release(); await p1; await tick(); await tick();
  t(n === before + 2, '끝난 뒤 한 번 더(몰린 부름은 하나로)');
  mode = 'fail'; const keep = feed.broadcasts();
  await feed.refresh(); t(feed.status() === 'error' && notes.length === 0 && feed.broadcasts() === keep && feed.ready(), '자동 받기 실패 — 번호 없이 상태만 · 앞서 받은 판 유지');
  await feed.refresh({ manual: true }); await feed.refresh({ manual: true });
  t(notes.join() === 'E-MH-09', '사용자가 누른 받기 실패 — E-MH-09 한 번(이어지는 동안)');
  const c0 = n; await tick(); await tick();
  t(n === c0, '혼자 다시 받지 않는다(자동 재시도 없음)');
  mode = 'ok'; await feed.refresh(); mode = 'fail'; await feed.refresh({ manual: true });
  t(notes.join() === 'E-MH-09,E-MH-09', '받은 뒤 다시 실패하면 번호를 다시 낸다');
  const f2 = F.createNoticeFeed({ api: { fetchBoard: async () => { throw new Error('x'); } }, notifyError: () => true });
  await f2.refresh(); t(!f2.ready() && f2.status() === 'error', '한 번도 못 받았으면 ready 아님(실패 ≠ 없음)');
  const calls = []; const f3 = F.createNoticeFeed({ api: { fetchBoard: async () => board([]) }, notifyError: () => true });
  f3.onceReady((u) => calls.push(u && u.title)); f3.onceReady(() => { throw new Error('받는 쪽 오류'); });
  await f3.refresh(); await f3.refresh(); t(calls.join() === 'T', 'onceReady — 처음 받았을 때 한 번뿐(받는 쪽이 던져도 안 막힘)');
  const f4 = F.createNoticeFeed({ api: { fetchBoard: async () => board([]) }, notifyError: () => true });
  await f4.refresh(); let imm = 0; f4.onceReady(() => { imm++; }); t(imm === 1, '이미 받았으면 바로 한 번');
  /* 3. 배선 */
  const FI = strip(src.FI), AP = strip(src.APP), H = src.HTML;
  t(!/subscribeAdBanner|subscribeInboxBroadcast|createBroadcastSync/.test(FI), 'firebase-init 에 옛 공지 읽기(배너 구독 · 소식 구독)가 없다');
  t(/const noticeApi = TwNoticeApi\.createNoticeApi\(\{ get: \(path\)=>TwApi\.authed\.get\(path\) \}\);/.test(AP) && /TwNoticeFeed\.createNoticeFeed\(\{ api: noticeApi, notifyError:/.test(AP)
    && /noticeFeed\.onceReady\(_showUpdateNoticeOnce\);/.test(AP) && /whenNetReady\(\(\)=>noticeFeed\.start\(\)\)/.test(AP) && !/getUpdateNotice\(\)/.test(AP.replace(/[\s\S]*/, '')),
    'app.js — 서버 길로 만들고 · 업데이트 공지는 처음 받았을 때 한 번 · 켜는 줄');
  const i = (x) => H.indexOf('<script src="parts/' + x + '"></script>');
  t(i('shared/api-client.js') > 0 && i('launcher/notice-api.js') > i('shared/api-client.js') && i('launcher/notice-feed.js') > i('launcher/notice-api.js') && H.indexOf('<script src="parts/app.js"></script>') > i('launcher/notice-feed.js'),
    'html — api-client → notice-api → notice-feed → app.js');
  t(!/firebase|setInterval|setTimeout/.test(strip(src.API) + strip(src.FEED)), 'provider · 한 판은 Firebase 를 모르고 타이머가 없다');
  return r;
}

(async () => {
  const rows = await judge(S);
  rows.forEach(([ok, m]) => chk(ok, m));
  say('── 4. 일부러 깨 보기 — 하나라도 못 잡으면 빨강');
  const brk = [
    ['고정 소식을 뺌', { API: (s) => s.replace("broadcastsOf(d.broadcasts.pinned, broadcasts) || !", "") }],
    ['tag 를 소문자로 안 바꿈', { API: (s) => s.replace('str(b.tag).toLowerCase()', 'str(b.tag)') }],
    ['모양 틀려도 빈 판', { API: (s) => s.replace("if(!out) throw shapeError();", "if(!out) return { updateNotice: null, banner: [], broadcasts: {}, hasMore: false };") }],
    ['처음 받은 소식도 새 소식', { FEED: (s) => s.replace("const addedIds = everReady ? Object.keys(got.broadcasts)", "const addedIds = true ? Object.keys(got.broadcasts)") }],
    ['자동 받기 실패에도 번호', { FEED: (s) => s.replace("if(!failStreak && manual){", "if(!failStreak){") }],
    ['실패하면 앞서 받은 판을 지움', { FEED: (s) => s.replace("status = STATUS.ERROR;", "status = STATUS.ERROR; board = { updateNotice: null, banner: [], broadcasts: {}, hasMore: false };") }],
    ['받는 중 또 부르면 요청이 겹침', { FEED: (s) => s.replace("if(flying){ again = true; return false; }", "") }],
    ['onceReady 가 매번', { FEED: (s) => s.replace("      off();\n", "") }],
    ['html 순서 틀림', { HTML: (s) => s.replace('<script src="parts/launcher/notice-api.js"></script>', '') }],
    ['옛 소식 구독이 남음', { FI: (s) => s + '\nsubscribeInboxBroadcast(){}' }],
  ];
  for(const [name, f] of brk){
    const k = Object.keys(f)[0]; const s2 = Object.assign({}, S, { [k]: f[k](S[k]) });
    const changed = s2[k] !== S[k]; let rows2; try{ rows2 = await judge(s2); }catch(_){ rows2 = [[false, '던짐']]; }
    chk(changed && rows2.some(([ok]) => !ok), name + (changed ? '' : ' — 바꿀 글을 못 찾음'));
  }
  say(`\n${fail ? '✗' : '✓'} 통과 ${pass} · 실패 ${fail}`);
  process.exit(fail ? 1 : 0);
})();
