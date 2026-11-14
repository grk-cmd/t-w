# account/ — 🪪 계정 · 로그인 · 초대 · 라이선스

## google-confirm.js — 🔑 구글을 계정에 처음 붙이기 전에 묻기

- **책임**: 처음 보는 구글 계정이 이 PC 의 계정(친구 코드)에 묶이기 전에, 가린 주소(`mi***@gmail.com`)와 친구 코드를 보이고 묻는다. 구글을 여러 개 쓰는 사람이 다른 구글을 골라 빈 계정에 묶이는 실수(«데이터가 사라졌다»)를 막는다.
- **만드는 법**: app.js 가 초대 게이트 · 계정보다 먼저 `const googleConfirmMod = TwGoogleConfirm.createGoogleConfirm({ friendCode, signInWithGoogle })` · 두 모듈에 deps `googleConfirmMod` 로 넘긴다.
- **내놓는 것**
  - `ask(email, mode, code?)` → `'yes' | 'other' | 'cancel'` — `bind`(로그인) · `signup`(구글로 가입 — 제목만 «이 구글 계정으로 가입할까요?» · 새 아이디를 넘긴다) · `link`(로그인된 계정에 구글 붙이기). 로그인 · 가입은 `firebaseAPI.authSignInWithGoogle(idToken, userCode, ask)` 의 세 번째 인자로 넘겨, **처음 보는 구글을 묶기 직전에만** 불린다(이미 연결된 구글 · 묶을 코드가 없을 때는 안 묻는다). 아니면 `{ declined }` — 막 생긴 구글 로그인 계정은 지운다.
  - `pickForLink()` — 구글 창 → 묻기 → [다른 구글 고르기]면 다시 → `{ ok, idToken }`. 내 정보 [연결하기] · 가입 완료 [구글도 연결하기].
  - `maskEmail` · `tokenEmail` — 순수 함수.
- **함정**
  - 기본 포커스는 [다른 계정으로 로그인] — 잘못 묶은 쪽이 되돌리기 어렵다.
  - 창(`#gConfirmOverlay`)은 게이트 · 가입 완료 위(`--z-gate-confirm`) · 바탕화면 실행 화면 클릭 통과 목록(`UI_HIT_SEL`)에 있어야 눌린다.
  - `tokenEmail` 은 보여 주기만 한다 — 신원은 서버(Firebase Auth)가 정한다.
- **검사**: `sim-google-confirm.js`(창 · 순수 함수 · 연결) · `sim-google-login.js` §3-3(묻고 · 아니면 안 묶음)
