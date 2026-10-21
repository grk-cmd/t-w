# apps/web — 메인 홈페이지(together-working.com)

에픽 #430 의 «web 1»(#438). React + Vite + TS(strict) · FSD(`apps/admin` 과 같은 틀). 루트 npm workspaces 의 한 칸(`@tw/web`)이라
의존성은 루트 `package-lock.json` 에 있다 — 캐릭터 코어(`@tw/char-core`)를 같은 lock 으로 받기 위해서다.

## 명령 (저장소 루트에서)
```bash
npm install --ignore-scripts         # 처음 한 번(루트 postinstall 의 앱 의존성이 필요 없으면)
npm -w @tw/web run dev               # 개발 서버 → http://localhost:5173/ (미리 그리지 않은 빈 #root 에 그린다)
npm -w @tw/web test                  # vitest
npm -w @tw/web run lint              # oxlint + steiger(FSD 층 규칙)
npm -w @tw/web run format            # prettier
npm -w @tw/web run build             # tsc → 화면 → 언어마다 미리 그리기 → dist/
```
CI «메인 홈페이지 시험 · 빌드» 가 lint · format · test · build 를 돈다.

## 구조
| 자리 | 내용 |
|---|---|
| `src/app/` | `App`(언어 공급 + 페이지) · `entry-client.tsx`(미리 그린 HTML 에 이어 붙이기 — 언어는 `<html lang>`) · `entry-server.tsx`(빌드 때 언어마다 그리기) · `styles/` |
| `src/pages/home/` | 첫 화면 — 맨 위 메뉴 · 히어로 · 캐릭터 만들기 자리 · 소개(기능 탭) · 내려받기 · 바닥 · `<head>` 줄(제목 · 설명 · canonical · hreflang). 다른 페이지가 생기면 메뉴 · 바닥은 `widgets/` 로 옮긴다 |
| `src/shared/i18n/` | 언어(`ko` 기본 · `en` · `ja`) · 주소(`/` · `/en/` · `/ja/`) · 화면 글(`messages.ts` — 언어마다 같은 모양, 빠지면 타입 검사가 잡는다) |
| `src/shared/config/` | 바깥 주소 한 곳(우리 도메인만) |
| `src/shared/lib/html-template/` | 빌드한 `index.html` 틀의 자리표 셋(`%TW_LANG%` · `<!--tw-head-->` · `<!--tw-body-->`)을 채운다 — 하나라도 빠지면 던진다 |
| `scripts/prerender.mjs` | SSR 빌드를 불러 `dist/index.html` · `dist/en/index.html` · `dist/ja/index.html` 을 쓴다 |
| `public/` | 아이콘(앱 것을 복사 — `apps/desktop/app/assets/icon/tw-mini.png` · `apps/desktop/build/icon.iconset/icon_256x256.png`) · 글꼴 라이선스 |

- **색**은 디자인 시스템 원본(`docs/design-system/project/tokens.json`)에서 빌드 때 만든다(`vite.config.ts` 의 `virtual:tw-tokens.css` — 도움말 사이트와 같은 변환기 `scripts/build-design-tokens.js`). 사본을 커밋하지 않는다. 페이지는 `<html data-theme="classic">`.
- **글꼴**: 제목은 갈무리11 굵게(`galmuri` · SIL OFL 1.1), 일본어 가나는 DotGothic16(`@fontsource/dotgothic16` 일본어 묶음 · SIL OFL 1.1). 우리 사이트에 같이 올리고 라이선스는 `/licenses/`.

## 지킬 것
- 남이 쓴 값(닉네임 · 캐릭터 이름 · 소식 글)은 JSX 글로만 넣는다 — `dangerouslySetInnerHTML` 은 oxlint(`react/no-danger`)가 막는다. HTML 을 그대로 넣어야 하는 날이 오면 앱의 `safe-html.js` 규칙을 먼저 옮긴다.
- 바깥 주소 · 새 사이트는 사용자 확인 뒤에, 우리 도메인(`*.together-working.com`)으로만 — `src/shared/config/site.ts` 한 곳. 시험이 미리 그린 페이지의 바깥 링크를 본다.
- 유료 · 가챠 · 커미션 자산은 웹에 싣지 않는다(#430 4절).
- 화면 글을 고치면 세 언어 모두. 영어 · 일본어는 원어민 검수 전이다.

## 아직 아닌 것
- **Hosting 연결**: 새 Firebase Hosting 사이트 · `firebase.json` 칸 · 맞춤 도메인 `together-working.com` 은 사이트를 만든 뒤 따로(`firebase/hosting/README.md` «새 사이트 만들기»). 그때 `build` 결과(`dist/`)를 올릴 자리 · 머리(CSP 등)를 정한다.
- **캐릭터 만들기**: 3D 생성기는 #440(코어 `@tw/char-core` ESM). 지금은 안내 자리만.
- **내려받기 · 로그인 · 라이브러리 · 소식**: 서버 API 가 있어야 한다(#439 · #441). 내려받기 단추는 그때까지 눌리지 않는다.
