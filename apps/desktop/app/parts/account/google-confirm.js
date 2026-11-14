/* google-confirm.js — 🔑 구글을 계정에 처음 붙이기 전에 묻기
   처음 보는 구글 계정으로 로그인하면 그 구글이 **지금 이 PC 의 계정(친구 코드)** 에 묶인다. 구글을 여러 개 쓰는 사람이
   다른 구글을 고르면 빈 계정에 묶여 «데이터가 사라졌다» 가 된다. 그래서 묶기 · 붙이기 전에 가린 주소와 이 PC 친구 코드를 보이고 묻는다.
   · ask(email, mode, code?) — 'bind'(로그인 — 처음 보는 구글을 이 PC 계정에 묶기) · 'signup'(구글로 가입 — 제목만 다르다) · 'link'(로그인된 계정에 구글 붙이기) → 'yes' | 'other' | 'cancel'
     code 를 안 주면 이 PC 친구 코드(가입 중에는 아직 저장 전이라 새 아이디를 넘긴다)
   · pickForLink() — 구글 창 → 묻기 → [다른 구글 고르기]면 창을 다시 연다 → { ok, idToken } | { ok:false, canceled } | { ok:false, reason }
   · 🔁 구글 바꾸기(내 정보) — pickCurrent(from): 지금 구글을 한 번 골라 본인 확인 · pickForChange(from): 새 구글 → 'change' 로 묻기([취소] · [바꾸기] · 같은 구글이면 same)
   · maskEmail · tokenEmail — 순수 함수(DOM 없음)
   ★ 창은 desk-companion-prototype.html 의 #gConfirmOverlay. 기본 버튼은 [다른 계정으로 로그인](잘못 묶는 쪽이 되돌리기 어렵다).
   검사: checks/sim-google-confirm.js */
(function(){

/* mi***@gmail.com — 앞 두 글자(짧으면 한 글자)만 남긴다. 화면을 찍어 제보해도 주소가 다 보이지 않게. */
function maskEmail(e){
  const s = String(e || '').trim();
  const at = s.lastIndexOf('@');
  if(at < 1) return s ? '***' : '';
  const local = s.slice(0, at), domain = s.slice(at + 1);
  const keep = local.length <= 2 ? 1 : 2;
  return local.slice(0, keep) + '***@' + domain;
}
/* 구글 ID 토큰(JWT) 가운데 칸의 email — 붙이기(link) 전에 «어느 주소를 붙이나» 를 보이는 데만 쓴다(믿을 신원으로 쓰지 않는다). */
function tokenEmail(idToken){
  try{
    const part = String(idToken || '').split('.')[1];
    if(!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(Array.prototype.map.call(atob(b64 + '==='.slice((b64.length + 3) % 4)),
      c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    const v = JSON.parse(json).email;
    return typeof v === 'string' && v ? v : null;
  }catch(_){ return null; }
}

const TEXT = {
  bind: { title: '처음 보는 구글 계정이에요', lead: ' — 투게더워킹에 처음 로그인하는 구글 계정이에요.',
          card: '이 구글 계정에 연결하면 다음부터 이 계정으로 로그인해요.',
          warn: '⚠ 예전에 다른 구글 계정으로 쓰셨다면, 그 계정으로 로그인해야 예전 마이홈 · 친구 · 라이선스가 보여요.',
          fresh: '처음 시작하는 거라면 [이 계정에 연결]을 눌러 주세요.', other: '다른 계정으로 로그인' },
  link: { title: '이 구글 계정을 연결할까요?', lead: ' — 이 계정에 연결할 구글 계정이에요.',
          card: '연결하면 다음부터 이 구글로도 로그인해요.',
          warn: '⚠ 쓰려던 구글 계정이 맞는지 확인해 주세요. 다른 구글이면 [다른 구글 고르기]를 눌러 주세요.',
          fresh: '', other: '다른 구글 고르기' },
};
TEXT.signup = Object.assign({}, TEXT.bind, { title: '이 구글 계정으로 가입할까요?' });
/* 🔁 구글 바꾸기 — 카드 · 경고의 {from} 자리에 지금 구글(가린 주소)이 들어간다 */
TEXT.change = { title: '구글 계정을 바꿀까요?', lead: ' — 새로 연결할 구글 계정이에요.',
  card: '지금 구글 {from} 대신 이 구글로 로그인해요. 마이홈 · 친구 · 라이선스는 그대로예요.',
  warn: '⚠ 바꾸면 지금 구글({from})로는 더 이상 로그인되지 않아요.',
  fresh: '', other: '취소', yes: '바꾸기' };   // 시안대로 [취소] · [바꾸기] — [취소]도 기본 포커스(잘못 바꾸지 않게)
const sameEmail = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** @param {{ friendCode: () => (string|null), signInWithGoogle: () => Promise<any> }} deps */
function createGoogleConfirm(deps){
  const friendCode = deps.friendCode;
  const signInWithGoogle = deps.signInWithGoogle;
  let open = null;   // 열린 창의 닫기(겹쳐 부르면 앞의 것을 취소로 닫는다)

  function ask(email, mode, code, from){
    const t = TEXT[mode] || TEXT.bind;
    const say = v => String(v || '').replace('{from}', maskEmail(from));
    return new Promise(resolve=>{
      const $ = id => document.getElementById(id);
      const ov = $('gConfirmOverlay');
      if(!ov){ resolve('cancel'); return; }
      if(open) open('cancel');
      const set = (id, s) => { const el = $(id); if(el){ el.textContent = s; el.style.display = s ? '' : 'none'; } };
      set('gcTitle', t.title);
      set('gcMail', maskEmail(email) || '(주소 모름)');
      set('gcLead', t.lead);
      set('gcCode', code || friendCode() || '—');
      set('gcCard', say(t.card));
      set('gcWarn', say(t.warn));
      set('gcFresh', t.fresh);
      set('gcOther', t.other);
      set('gcYes', t.yes || '이 계정에 연결');
      const yes = $('gcYes'), other = $('gcOther'), x = $('gcClose');
      const onKey = e => { if(e.key === 'Escape'){ e.stopPropagation(); finish('cancel'); } };
      const finish = (v)=>{
        if(open !== finish) return;
        open = null;
        ov.style.display = 'none';
        document.removeEventListener('keydown', onKey, true);
        resolve(v);
      };
      open = finish;
      if(yes) yes.onclick = () => finish('yes');
      if(other) other.onclick = () => finish('other');
      if(x) x.onclick = () => finish('cancel');
      document.addEventListener('keydown', onKey, true);
      ov.style.display = 'flex';
      setTimeout(()=>{ if(other) other.focus(); }, 0);
    });
  }

  async function pickForLink(){
    for(;;){
      let g = null; try{ g = await signInWithGoogle(); }catch(_){}
      if(!g || !g.ok) return { ok:false, canceled: !!(g && (g.canceled || !g.reason)), reason: (g && g.reason) || '' };
      const a = await ask(tokenEmail(g.idToken), 'link');
      if(a === 'yes') return { ok:true, idToken: g.idToken };
      if(a === 'cancel') return { ok:false, canceled:true, reason:'' };
    }
  }

  /* 지금 연결된 구글(from)을 한 번 골라 본인 확인 — 다른 구글을 고르면 바꾸지 않는다(서버 reauth 가 한 번 더 본다) */
  async function pickCurrent(from){
    let g = null; try{ g = await signInWithGoogle(); }catch(_){}
    if(!g || !g.ok) return { ok:false, canceled: !!(g && (g.canceled || !g.reason)), reason: (g && g.reason) || '' };
    if(!sameEmail(tokenEmail(g.idToken), from)) return { ok:false, reason:'지금 연결된 구글(' + maskEmail(from) + ')을 골라 주세요' };
    return { ok:true, idToken: g.idToken };
  }
  async function pickForChange(from){
    for(;;){
      let g = null; try{ g = await signInWithGoogle(); }catch(_){}
      if(!g || !g.ok) return { ok:false, canceled: !!(g && (g.canceled || !g.reason)), reason: (g && g.reason) || '' };
      const email = tokenEmail(g.idToken);
      if(sameEmail(email, from)) return { ok:false, same:true, reason:'이미 연결된 구글 계정이에요' };
      const a = await ask(email, 'change', null, from);
      if(a === 'yes') return { ok:true, idToken: g.idToken, email };
      return { ok:false, canceled:true, reason:'' };   // [취소] · ✕ · ESC
    }
  }

  return { ask, pickForLink, pickCurrent, pickForChange, maskEmail, sameEmail };
}

const api = { createGoogleConfirm, maskEmail, tokenEmail };
if(typeof window !== 'undefined') window.TwGoogleConfirm = api;
if(typeof module !== 'undefined' && module.exports) module.exports = api;
})();
