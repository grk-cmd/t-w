/*
 * 🐞 버그제보 게시판 — 데이터 쪽. Firebase 를 직접 import 하지 않는다(deps 로 받는다 · 검사 sim-bug-board.js).
 *
 * [왜 노드를 나눴나] RTDB 는 목록 안 항목을 골라 숨기지 못한다. 공개/비공개를 한 노드에 두면 화면에서만 가려진다.
 *   bugBoard/list/{id}            누구나(쿼리 limitToLast ≤ 20 만) — 상태 · 분류 · 제목 · 이름 · 시각. **비공개 글은 이름이 «익명»** (제목은 보인다).
 *   bugBoard/pub/{id}             공개 글 · 공지의 제목 · 본문
 *   bugBoard/prv/{authUid}/{id}   비공개 글 — 글쓴이 · 관리자만 읽는다(규칙)
 *   bugBoard/ans/{pub|prv}/{id}   운영자 답변(관리자만 쓴다) · prv 는 글쓴이 · 관리자만 읽는다
 *   bugBoard/rep/{pub|prv}/{id}   글쓴이 답글(글쓴이만 쓴다 · 읽기는 ans 와 같다). ans 와 나눈 것은 옛 앱(0.11.2 이하)이 ans 를 전부
 *                                 «운영자 답변» 으로 그리기 때문 — 옛 앱에는 글쓴이 답글이 안 보일 뿐 잘못 보이지는 않는다.
 *   bugBoard/likes/{id}/{authUid} 👍 — 공개 글만 · 한 사람 1회(규칙이 likeN +1 과 짝을 본다)
 *
 * [userReplyTs] 글쓴이가 마지막으로 답글을 단 시각(서버). lastReplyTs(운영자 답변)보다 뒤면 관리자 목록에 «✍ 글쓴이 답글».
 *   글쓴이의 «새 답변» 배지는 lastReplyTs 만 보므로 자기 답글로는 켜지지 않는다. 규칙이 같은 사람 10초 안 연달아 쓰기를 막는다.
 * [쿼리용 숨은 칸] openTs = 미해결이면 ts(해결되면 지움) · nts = 공지면 ts.
 *   orderByChild 로 그 칸을 고르면 값이 없는 글은 맨 앞(null)으로 몰리므로 limitToLast 가 미해결 · 공지만 집는다.
 *   **규칙이 허용하는 정렬은 ts · openTs · nts · authUid(=내 uid) 넷뿐이다.** 하나 늘리면 규칙도 같이.
 * [code] 글쓴이 사용자 코드 — 답변 알림을 inbox/{코드} 로 보내려고 둔다(authUid 로는 코드를 거꾸로 못 찾는다).
 *   규칙이 userAuth/{code} === auth.uid 를 본다.
 */

export const BUG_PAGE = 8;          // 한 쪽(전체 · 미해결 · 내 글 모두)
export const BUG_MINE_MAX = 20;     // 내 글을 한 번에 받는 수(서버에서 쪽을 못 넘긴다 — 화면이 BUG_PAGE 씩 나눈다 · 새 답변 배지도 이 안에서 센다)
export const BUG_ANON = '익명';     // 비공개 글 목록 줄의 이름 — 옛 앱(실명)과 함께 쓰는 동안 규칙은 이 값을 요구하지 않는다(sim-bug-board 주석)
export const BUG_DAILY_MAX = 5;
export const BUG_TITLE_MAX = 60, BUG_BODY_MAX = 2000, BUG_ENV_MAX = 120, BUG_ANS_MAX = 1000;
export const BUG_NOTICE_MAX = 5;
/* 분류 — 규칙(cat 정규식)과 짝이다. 하나 늘리면 firebase-database-rules.json 의 bugBoard/list/$id .validate 도. */
export const BUG_CATS = [
  ['bug', '오류 · 멈춤'], ['ui', '화면 · 표시'], ['room', '방 · 접속'],
  ['chat', '채팅'], ['myhome', '마이홈'], ['etc', '기타'],
];
/* 상태 — 규칙(status 정규식)과 짝이다. unfixed 는 글쓴이가 «해결 안 됨» 으로 되돌린 글(미해결 목록에 낀다). */
export const BUG_STATUS = { new: '접수', checking: '확인 중', fixed: '수정 완료', norepro: '재현 안 됨', unfixed: '해결 안 됨' };
/* 글쓴이가 답글과 함께 고를 수 있는 상태 — 규칙 rep · list/status 의 글쓴이 갈래와 짝. 버튼 이름은 글쓴이 말투로. */
export const BUG_AUTHOR_STATUS = [['checking', '확인 중'], ['unfixed', '해결 안 됨'], ['fixed', '해결 완료']];
export const KAKAO_RE = /^https:\/\/open\.kakao\.com\//;
export const isOpenStatus = (st) => st === 'new' || st === 'checking' || st === 'unfixed';
const OPEN = isOpenStatus;
/* 관리자 목록 «✍ 글쓴이 답글» — 글쓴이 답글이 운영자의 마지막 답변보다 뒤. */
export const hasAuthorReply = (it) => !!it && (it.userReplyTs || 0) > (it.lastReplyTs || 0);

/* 답변 알림(우편함) 본문. 우편함은 규칙상 누구나 읽고 글쓴이 코드는 공개 목록에 있어서,
   비공개 글의 제목을 넣으면 그 길로 새어 나간다 — 비공개 글은 고정 문구만. 어느 글인지는 함께 보내는 bugId 로 연다. */
export const BUG_PRV_NOTICE_BODY = '비공개 제보예요 — 버그제보 탭의 «내 글» 에서 확인해 주세요';
export function answerNoticeBody(vis, title, hasKakao){
  const head = vis === 'pub' ? String(title || '') : BUG_PRV_NOTICE_BODY;
  return head + (hasKakao ? '\n💬 오픈카톡 연결이 함께 왔어요' : '');
}

export function ymd(t){
  const d = new Date(t);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* 하루 상한 — 웹 관리자 ⚙️ 설정의 bugDailyMax(원격 설정 · 1~100). 없거나 이상하면 BUG_DAILY_MAX. */
export function dailyMaxOf(v){
  return (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100) ? v : BUG_DAILY_MAX;
}
/* 새 글 입력 확인 — 화면과 규칙이 같은 상한을 본다. 문제가 없으면 null. */
export function checkPost(p){
  if(!p) return '내용이 없어요';
  const title = String(p.title || '').trim(), body = String(p.body || '').trim();
  if(!title) return '제목을 적어 주세요';
  if(!body) return '내용을 적어 주세요';
  if(title.length > BUG_TITLE_MAX) return '제목은 ' + BUG_TITLE_MAX + '자까지예요';
  if(body.length > BUG_BODY_MAX) return '내용은 ' + BUG_BODY_MAX + '자까지예요';
  if(p.vis !== 'pub' && p.vis !== 'prv') return '공개 범위를 골라 주세요';
  if(!BUG_CATS.some(c => c[0] === p.cat)) return '분류를 골라 주세요';
  if(p.notice && p.vis !== 'pub') return '공지는 공개 글이어야 해요';
  return null;
}
/* 목록 한 줄(list/{id}) — 누구나 읽는 노드다. 비공개 글은 제목은 싣고 이름은 «익명» 만. 본문은 prv 쪽에만. */
export function listEntry(p, who, now){
  const e = { vis: p.vis, status: 'new', cat: p.cat, name: p.vis === 'prv' ? BUG_ANON : String(who.name || '').slice(0, 20),
              authUid: who.authUid, code: who.code, ts: now, openTs: now,
              title: String(p.title).trim().slice(0, BUG_TITLE_MAX) };
  if(p.notice){ e.notice = true; e.nts = now; delete e.openTs; }   // 공지는 미해결 목록에 안 낀다
  return e;
}
export function contentEntry(p){
  const c = { title: String(p.title).trim().slice(0, BUG_TITLE_MAX), body: String(p.body).trim().slice(0, BUG_BODY_MAX) };
  const env = String(p.env || '').trim().slice(0, BUG_ENV_MAX);
  if(env) c.env = env;
  return c;
}
/* 탭 배지 — 내 글 중 마지막 답변이 내가 마지막으로 본 때보다 뒤인 것. */
export function unseenCount(mine, seen){
  return (mine || []).filter(it => it && (it.lastReplyTs || 0) > ((seen || {})[it.id] || 0)).length;
}
const toArr = (v) => Object.keys(v || {}).map(id => Object.assign({ id }, v[id]));
const byTsDesc = (a, b) => (b.ts || 0) - (a.ts || 0);

/*
 * deps: db, ref, get, update, query, orderByChild, limitToLast, endBefore, equalTo,
 *       runTransaction, push, authUid(), now(), serverTs()(= serverTimestamp — 새 글 ts)
 */
/* 받은 한 쪽(raw) → 화면에 보일 글 · 다음 쪽 커서.
   «꽉 찬 쪽인가» 와 커서는 **거르기 전** 원본으로 센다 — 공지(전체 목록에서 뺌)가 하나만 섞여도
   19개가 되어 [다음] 이 꺼지고 그보다 오래된 글을 못 보던 버그가 있었다.
   미해결(openTs 정렬)은 openTs 없는 글이 맨 앞(null)으로 몰려 끝에 딸려 올 뿐이라, openTs 있는 글 수로 센다. */
export function pageOf(filter, raw){
  const key = filter === 'open' ? 'openTs' : 'ts';
  const keyed = filter === 'mine' ? [] : raw.filter(it => typeof it[key] === 'number');
  let items = raw;
  if(filter === 'open') items = items.filter(it => typeof it.openTs === 'number');
  if(filter === 'all') items = items.filter(it => !it.notice);
  items = items.slice().sort(byTsDesc);
  const full = keyed.length >= BUG_PAGE;
  const next = full ? Math.min(...keyed.map(it => it[key])) : null;
  return { items, next };
}

export function createBugBoard(deps){
  const { db, ref, get, update, query, orderByChild, limitToLast, endBefore, equalTo, runTransaction, push } = deps;
  const now = deps.now || (() => Date.now());
  const uid = () => (deps.authUid && deps.authUid()) || null;
  const L = 'bugBoard/list';

  /* 목록 한 쪽. filter: all · open · mine. before: 이전 쪽의 가장 오래된 값(그보다 앞만).
     ⚠️ mine 은 equalTo 라 쪽을 넘기지 못한다 — 최근 BUG_MINE_MAX 개만. */
  async function listPage(filter, before){
    let q;
    if(filter === 'mine'){
      const me = uid(); if(!me) return { items: [], next: null };
      q = query(ref(db, L), orderByChild('authUid'), equalTo(me), limitToLast(BUG_MINE_MAX));
    }else{
      const key = filter === 'open' ? 'openTs' : 'ts';
      q = (before != null)
        ? query(ref(db, L), orderByChild(key), endBefore(before), limitToLast(BUG_PAGE))
        : query(ref(db, L), orderByChild(key), limitToLast(BUG_PAGE));
    }
    return pageOf(filter, toArr((await get(q)).val()));
  }
  async function notices(){
    const v = (await get(query(ref(db, L), orderByChild('nts'), limitToLast(BUG_NOTICE_MAX)))).val();
    return toArr(v).filter(it => it.notice).sort(byTsDesc);
  }
  async function getItem(id){
    const v = (await get(ref(db, L + '/' + id))).val();
    return v ? Object.assign({ id }, v) : null;
  }
  /* 상세 — 내용 · 답변 · 내 공감 여부. 읽을 권한이 없는 칸은 규칙이 거부하므로 null 로 둔다. */
  async function getPost(id){
    const it = await getItem(id); if(!it) return null;
    const safe = (p) => get(ref(db, p)).then(s => s.val()).catch(() => null);
    const me = uid();
    const [content, aPub, aPrv, liked, rep] = await Promise.all([
      safe(it.vis === 'pub' ? 'bugBoard/pub/' + id : 'bugBoard/prv/' + it.authUid + '/' + id),
      it.vis === 'pub' ? safe('bugBoard/ans/pub/' + id) : Promise.resolve(null),
      safe('bugBoard/ans/prv/' + id),
      (me && it.vis === 'pub') ? safe('bugBoard/likes/' + id + '/' + me) : Promise.resolve(null),
      // 답글을 단 적이 없는 글은 읽지 않는다(대부분의 글)
      it.userReplyTs ? safe('bugBoard/rep/' + it.vis + '/' + id) : Promise.resolve(null),
    ]);
    // 운영자 답변과 글쓴이 답글(byAuthor)을 시간순 한 줄로
    const answers = toArr(aPub).map(a => Object.assign(a, { vis: 'pub' }))
      .concat(toArr(aPrv).map(a => Object.assign(a, { vis: 'prv' })))
      .concat(toArr(rep).map(a => Object.assign(a, { vis: it.vis, byAuthor: true })))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return { item: it, content, answers, liked: !!liked };
  }
  /* 하루 상한 — 게시판을 열 때 한 번 받아 둔다(deps.getDailyMax · 원격 설정). 못 받으면(값 없음 · 연결 없음) BUG_DAILY_MAX. */
  let dailyMax = BUG_DAILY_MAX;
  async function loadDailyMax(){
    try{ dailyMax = dailyMaxOf(deps.getDailyMax ? await deps.getDailyMax() : null); }catch(_){ dailyMax = BUG_DAILY_MAX; }
    return dailyMax;
  }
  /* 오늘 내가 쓴 제보 수 — 앱이 쓰는 users/{code}/bugPostCount/{날짜}. 못 읽으면 0. */
  async function todayCount(code){
    if(!code) return 0;
    try{
      const n = (await get(ref(db, 'users/' + code + '/bugPostCount/' + ymd(now())))).val();
      return typeof n === 'number' ? n : 0;
    }catch(_){ return 0; }
  }
  /* 새 글. who: { name, code, isAdmin }. 하루 dailyMax 건(관리자 제외 · 상한은 원격 설정 bugDailyMax).
     ts · openTs 는 서버 시각(규칙이 === now 를 본다 — PC 시계가 빨라도 써진다). 관리자 글엔 byAdmin(🛡 배지 · 규칙이 관리자만 받는다). */
  async function createPost(p, who){
    const bad = checkPost(p); if(bad) return { ok: false, reason: bad };
    const me = uid(); if(!me || !who || !who.code) return { ok: false, reason: '로그인이 필요해요' };
    if(p.notice && !who.isAdmin) return { ok: false, reason: '공지는 관리자만 쓸 수 있어요' };
    const t = now(), day = ymd(t);
    const cntRef = ref(db, 'users/' + who.code + '/bugPostCount/' + day);
    if(!who.isAdmin){
      const n = (await get(cntRef)).val();
      if(typeof n === 'number' && n >= dailyMax) return { ok: false, reason: '제보는 하루 ' + dailyMax + '건까지예요' };
    }
    const id = push(ref(db, L)).key;
    const w = {};
    const e = listEntry(p, { name: who.name, code: who.code, authUid: me }, deps.serverTs ? deps.serverTs() : t);
    if(who.isAdmin) e.byAdmin = true;
    w[L + '/' + id] = e;
    w[(p.vis === 'pub' ? 'bugBoard/pub/' : 'bugBoard/prv/' + me + '/') + id] = contentEntry(p);
    await update(ref(db), w);
    if(!who.isAdmin){ try{ await runTransaction(cntRef, c => (typeof c === 'number' ? c : 0) + 1); }catch(_){} }
    return { ok: true, id };
  }
  /* 운영자 답변 + 상태 — 한 묶음으로. 알림은 부르는 쪽(sendInbox)이 이어서 보낸다. */
  async function addAnswer(id, a){
    const it = await getItem(id); if(!it) return { ok: false, reason: '글을 찾지 못했어요' };
    const vis = it.vis === 'prv' ? 'prv' : (a.vis === 'prv' ? 'prv' : 'pub');   // 비공개 글은 비공개 답변만
    const text = String(a.text || '').trim().slice(0, BUG_ANS_MAX);
    if(!text) return { ok: false, reason: '답변을 적어 주세요' };
    const kakao = a.kakao ? String(a.kakao).trim() : '';
    if(kakao && (!KAKAO_RE.test(kakao) || kakao.length > 300)) return { ok: false, reason: '오픈카톡 링크는 https://open.kakao.com/ 으로 시작해야 해요' };
    const t = now();
    const rid = push(ref(db, 'bugBoard/ans/' + vis + '/' + id)).key;
    const ans = { text, ts: t }; if(kakao) ans.kakao = kakao;
    const st = BUG_STATUS[a.status] ? a.status : it.status;
    const w = {};
    w['bugBoard/ans/' + vis + '/' + id + '/' + rid] = ans;
    w[L + '/' + id + '/status'] = st;
    w[L + '/' + id + '/lastReplyTs'] = t;
    w[L + '/' + id + '/ansN'] = (it.ansN || 0) + 1;
    w[L + '/' + id + '/openTs'] = (OPEN(st) && !it.notice) ? it.ts : null;
    await update(ref(db), w);
    return { ok: true, item: Object.assign({}, it, { status: st, lastReplyTs: t }), vis, kakao };
  }
  /* 글쓴이 답글 + (고르면) 상태 — 한 묶음으로. 규칙이 «같은 묶음에 userReplyTs === 서버 시각» 을 짝으로 본다.
     상태가 없으면 답글 · userReplyTs 만(화면은 늘 하나를 골라 보낸다 — 규칙도 상태 없는 답글을 받는다). lastReplyTs · ansN 은 운영자 답변 칸이라 건드리지 않는다. */
  async function addReply(id, a){
    const it = await getItem(id); if(!it) return { ok: false, reason: '글을 찾지 못했어요' };
    const me = uid();
    if(!me || it.authUid !== me) return { ok: false, reason: '글쓴이만 답글을 달 수 있어요' };
    if(it.notice) return { ok: false, reason: '공지에는 답글을 달 수 없어요' };
    const text = String((a && a.text) || '').trim().slice(0, BUG_ANS_MAX);
    if(!text) return { ok: false, reason: '답글을 적어 주세요' };
    const st = BUG_AUTHOR_STATUS.some(s => s[0] === (a && a.status)) ? a.status : null;
    const t = deps.serverTs ? deps.serverTs() : now();
    const rid = push(ref(db, 'bugBoard/rep/' + it.vis + '/' + id)).key;
    const reply = { text, ts: t }; if(st) reply.st = st;
    const w = {};
    w['bugBoard/rep/' + it.vis + '/' + id + '/' + rid] = reply;
    w[L + '/' + id + '/userReplyTs'] = t;
    if(st){
      w[L + '/' + id + '/status'] = st;
      w[L + '/' + id + '/openTs'] = OPEN(st) ? it.ts : null;
    }
    try{ await update(ref(db), w); }
    catch(e){
      // 규칙이 거부하는 흔한 경우는 10초 안에 또 누른 것이다
      return { ok: false, reason: /permission|denied/i.test(String((e && e.message) || e)) ? '잠시 뒤에 다시 등록해 주세요' : '등록하지 못했어요 — 네트워크를 확인해 주세요' };
    }
    return { ok: true, item: Object.assign({}, it, st ? { status: st } : {}) };
  }
  /* 👍 — likes/{id}/{나} 와 likeN +1 을 한 묶음으로(규칙이 짝을 본다). 동시에 누르면 한쪽이 거부되니 한 번 더. */
  async function like(id){
    const me = uid(); if(!me) return { ok: false };
    for(let i = 0; i < 2; i++){
      const n = (await get(ref(db, L + '/' + id + '/likeN'))).val();
      const w = {};
      w['bugBoard/likes/' + id + '/' + me] = true;
      w[L + '/' + id + '/likeN'] = (typeof n === 'number' ? n : 0) + 1;
      try{ await update(ref(db), w); return { ok: true, n: w[L + '/' + id + '/likeN'] }; }catch(_){}
    }
    return { ok: false };
  }
  /* 비공개 글 제목 — 목록 줄에 제목이 없는 옛 글만 prv 쪽에서 읽는다(글쓴이 · 관리자만 읽힌다 · 규칙). 못 읽으면 null. */
  async function prvTitle(it){
    if(!it || it.vis !== 'prv') return null;
    if(it.title) return it.title;
    try{ return (await get(ref(db, 'bugBoard/prv/' + it.authUid + '/' + it.id + '/title'))).val(); }catch(_){ return null; }
  }
  async function getSeen(code){
    if(!code) return {};
    try{ return (await get(ref(db, 'users/' + code + '/bugSeen'))).val() || {}; }catch(_){ return {}; }
  }
  async function setSeen(code, id){
    if(!code || !id) return;
    const w = {}; w['users/' + code + '/bugSeen/' + id] = now();
    try{ await update(ref(db), w); }catch(_){}
  }
  async function unseen(code){
    const [{ items }, seen] = await Promise.all([listPage('mine').catch(() => ({ items: [] })), getSeen(code)]);
    return { n: unseenCount(items, seen), ids: items.filter(it => (it.lastReplyTs || 0) > (seen[it.id] || 0)).map(it => it.id) };
  }
  /* 옛 공지(bugReport/current.notice) → 첫 공지글. 관리자가 탭을 처음 열 때 한 번. 공지글이 하나라도 있으면 건너뛴다. */
  async function migrateNotice(who){
    if(!who || !who.isAdmin) return { ok: false };
    if((await notices()).length) return { ok: true, skipped: true };
    const cur = (await get(ref(db, 'bugReport/current'))).val();
    const body = cur && String(cur.notice || '').trim();
    if(!body) return { ok: true, skipped: true };
    return createPost({ vis: 'pub', cat: 'etc', title: '버그 제보 안내', body, notice: true }, who);
  }
  const C = { cats: BUG_CATS, status: BUG_STATUS, page: BUG_PAGE, anon: BUG_ANON, dailyMax: BUG_DAILY_MAX, titleMax: BUG_TITLE_MAX,
              bodyMax: BUG_BODY_MAX, envMax: BUG_ENV_MAX, ansMax: BUG_ANS_MAX, kakaoRe: KAKAO_RE, answerNoticeBody,
              authorStatus: BUG_AUTHOR_STATUS, hasAuthorReply };
  return { C, checkPost, listPage, notices, getItem, getPost, prvTitle, loadDailyMax, dailyMax: () => dailyMax, todayCount, createPost, addAnswer, addReply, like, getSeen, setSeen, unseen, migrateNotice };
}
