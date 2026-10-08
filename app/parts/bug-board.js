/*
 * 🐞 버그제보 게시판 — 데이터 쪽. Firebase 를 직접 import 하지 않는다(deps 로 받는다 · 검사 sim-bug-board.js).
 *
 * [왜 노드를 나눴나] RTDB 는 목록 안 항목을 골라 숨기지 못한다. 공개/비공개를 한 노드에 두면 화면에서만 가려진다.
 *   bugBoard/list/{id}            누구나(쿼리 limitToLast ≤ 20 만) — 상태 · 분류 · 이름 · 시각. **비공개 글은 제목이 없다.**
 *   bugBoard/pub/{id}             공개 글 · 공지의 제목 · 본문
 *   bugBoard/prv/{authUid}/{id}   비공개 글 — 글쓴이 · 관리자만 읽는다(규칙)
 *   bugBoard/ans/{pub|prv}/{id}   운영자 답변(관리자만 쓴다) · prv 는 글쓴이 · 관리자만 읽는다
 *   bugBoard/likes/{id}/{authUid} 👍 — 공개 글만 · 한 사람 1회(규칙이 likeN +1 과 짝을 본다)
 *
 * [쿼리용 숨은 칸] openTs = 미해결이면 ts(해결되면 지움) · nts = 공지면 ts.
 *   orderByChild 로 그 칸을 고르면 값이 없는 글은 맨 앞(null)으로 몰리므로 limitToLast 가 미해결 · 공지만 집는다.
 *   **규칙이 허용하는 정렬은 ts · openTs · nts · authUid(=내 uid) 넷뿐이다.** 하나 늘리면 규칙도 같이.
 * [code] 글쓴이 사용자 코드 — 답변 알림을 inbox/{코드} 로 보내려고 둔다(authUid 로는 코드를 거꾸로 못 찾는다).
 *   규칙이 userAuth/{code} === auth.uid 를 본다.
 */

export const BUG_PAGE = 20;
export const BUG_DAILY_MAX = 5;
export const BUG_TITLE_MAX = 60, BUG_BODY_MAX = 2000, BUG_ENV_MAX = 120, BUG_ANS_MAX = 1000;
export const BUG_NOTICE_MAX = 5;
/* 분류 — 규칙(cat 정규식)과 짝이다. 하나 늘리면 firebase-database-rules.json 의 bugBoard/list/$id .validate 도. */
export const BUG_CATS = [
  ['bug', '오류 · 멈춤'], ['ui', '화면 · 표시'], ['room', '방 · 접속'],
  ['chat', '채팅'], ['myhome', '마이홈'], ['etc', '기타'],
];
export const BUG_STATUS = { new: '접수', checking: '확인 중', fixed: '수정 완료', norepro: '재현 안 됨' };
export const KAKAO_RE = /^https:\/\/open\.kakao\.com\//;
const OPEN = (st) => st === 'new' || st === 'checking';

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
/* 목록 한 줄(list/{id}) — 비공개 글에는 title 을 **절대 넣지 않는다**(누구나 읽는 노드다). 규칙도 vis 가 pub 일 때만 받는다. */
export function listEntry(p, who, now){
  const e = { vis: p.vis, status: 'new', cat: p.cat, name: String(who.name || '').slice(0, 20),
              authUid: who.authUid, code: who.code, ts: now, openTs: now };
  if(p.vis === 'pub') e.title = String(p.title).trim().slice(0, BUG_TITLE_MAX);
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
 *       runTransaction, push, authUid(), now()
 */
export function createBugBoard(deps){
  const { db, ref, get, update, query, orderByChild, limitToLast, endBefore, equalTo, runTransaction, push } = deps;
  const now = deps.now || (() => Date.now());
  const uid = () => (deps.authUid && deps.authUid()) || null;
  const L = 'bugBoard/list';

  /* 목록 한 쪽. filter: all · open · mine. before: 이전 쪽의 가장 오래된 값(그보다 앞만).
     ⚠️ mine 은 equalTo 라 쪽을 넘기지 못한다 — 최근 20개만. */
  async function listPage(filter, before){
    let q;
    if(filter === 'mine'){
      const me = uid(); if(!me) return { items: [], next: null };
      q = query(ref(db, L), orderByChild('authUid'), equalTo(me), limitToLast(BUG_PAGE));
    }else{
      const key = filter === 'open' ? 'openTs' : 'ts';
      q = (before != null)
        ? query(ref(db, L), orderByChild(key), endBefore(before), limitToLast(BUG_PAGE))
        : query(ref(db, L), orderByChild(key), limitToLast(BUG_PAGE));
    }
    let items = toArr((await get(q)).val());
    if(filter === 'open') items = items.filter(it => typeof it.openTs === 'number');
    if(filter === 'all') items = items.filter(it => !it.notice);
    items.sort(byTsDesc);
    const full = filter !== 'mine' && items.length >= BUG_PAGE;
    const last = items[items.length - 1];
    return { items, next: full && last ? (filter === 'open' ? last.openTs : last.ts) : null };
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
    const [content, aPub, aPrv, liked] = await Promise.all([
      safe(it.vis === 'pub' ? 'bugBoard/pub/' + id : 'bugBoard/prv/' + it.authUid + '/' + id),
      it.vis === 'pub' ? safe('bugBoard/ans/pub/' + id) : Promise.resolve(null),
      safe('bugBoard/ans/prv/' + id),
      (me && it.vis === 'pub') ? safe('bugBoard/likes/' + id + '/' + me) : Promise.resolve(null),
    ]);
    const answers = toArr(aPub).map(a => Object.assign(a, { vis: 'pub' }))
      .concat(toArr(aPrv).map(a => Object.assign(a, { vis: 'prv' })))
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return { item: it, content, answers, liked: !!liked };
  }
  /* 새 글. who: { name, code, isAdmin }. 하루 BUG_DAILY_MAX 건(관리자 제외). */
  async function createPost(p, who){
    const bad = checkPost(p); if(bad) return { ok: false, reason: bad };
    const me = uid(); if(!me || !who || !who.code) return { ok: false, reason: '로그인이 필요해요' };
    if(p.notice && !who.isAdmin) return { ok: false, reason: '공지는 관리자만 쓸 수 있어요' };
    const t = now(), day = ymd(t);
    const cntRef = ref(db, 'users/' + who.code + '/bugPostCount/' + day);
    if(!who.isAdmin){
      const n = (await get(cntRef)).val();
      if(typeof n === 'number' && n >= BUG_DAILY_MAX) return { ok: false, reason: '제보는 하루 ' + BUG_DAILY_MAX + '건까지예요' };
    }
    const id = push(ref(db, L)).key;
    const w = {};
    w[L + '/' + id] = listEntry(p, { name: who.name, code: who.code, authUid: me }, t);
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
  /* 비공개 글 제목 — 글쓴이 · 관리자만 읽힌다(규칙). 못 읽으면 null. */
  async function prvTitle(it){
    if(!it || it.vis !== 'prv') return null;
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
  const C = { cats: BUG_CATS, status: BUG_STATUS, page: BUG_PAGE, dailyMax: BUG_DAILY_MAX, titleMax: BUG_TITLE_MAX,
              bodyMax: BUG_BODY_MAX, envMax: BUG_ENV_MAX, ansMax: BUG_ANS_MAX, kakaoRe: KAKAO_RE, answerNoticeBody };
  return { C, checkPost, listPage, notices, getItem, getPost, prvTitle, createPost, addAnswer, like, getSeen, setSeen, unseen, migrateNotice };
}
