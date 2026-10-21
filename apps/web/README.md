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
| `src/pages/home/` | 첫 화면 — 맨 위 메뉴 · 히어로(🔒 투게더랜드 잠긴 아이콘 · 경고창 · 📰 소식 창 자리) · 캐릭터 만들기(생성기를 브라우저에서만 따로 싣는다) · 소개(기능 탭) · 내려받기 · 바닥 · `<head>` 줄(제목 · 설명 · canonical · hreflang). 다른 페이지가 생기면 메뉴 · 바닥은 `widgets/` 로 옮긴다 |
| `src/widgets/creator/` | 🎨 웹 생성기(#440) — 3D 미리보기 · 고르기 판 · 되돌리기 · 앱으로 가져가기를 묶는다. three 와 몸 모델이 무거워 첫 화면 묶음과 따로 받는다 |
| `src/features/character-maker/` | 얼굴 레이어(프로토타입 시안 그림을 도형 자료로 — `model/catalog.ts`): 👁 눈 폴더(동공 · 하이라이트(빛반사) · 아이라인을 차례로 쌓음 — 폴더를 옮기면 셋이 같이, 층은 폴더 안에서 따로) · 눈썹 · 입 · 볼 · 액세서리(최대 5개) · 상태 규칙(`reduce` — 모르는 그림 · 색 모양은 안 받음 · 대칭: 폴더 · 레이어는 거울, 폴더 안 층은 같은 값 · 오드아이) · 되돌리기 40번 · 자리 계산 한 벌(`model/geometry.ts` — 그리기와 끌기가 같은 행렬) · 얼굴 판 그리기(`drawFace`) · 앞모습 판(`drawFront`) · 얼굴 텍스처 한 벌(코어 `paintFront`) · 평면 얼굴 텍스처 칸(`ui/FaceTexturePanel.tsx` — 고른 것을 끌어 옮김 · 계산은 `model/drag.ts`) |
| `src/features/clone-code/` | 앱으로 가져가기 — 코어 `encodeCloneCode`(앱 «코드 입력하기» 가 읽는 DCC1). 싣는 칸은 앱 생성기와 같다(피부 · 얼굴 · 감은눈 · 상의 · 하의 색 — 파츠 · 책상 없음). 비밀번호 · 코드는 화면에만 |
| `src/entities/character/` | 코어 한 벌(몸 · 얼굴 · 톤 · 앞모습 지도)을 만드는 `loadCharKit` · 3D 미리보기. 빛 · 재질 고치기는 코어 한 벌(`@tw/char-core` 의 `lighting.ts` — 앱 생성기 · 실행 화면과 같은 숫자) |
| `src/shared/i18n/` | 언어(`ko` 기본 · `en` · `ja`) · 주소(`/` · `/en/` · `/ja/`) · 화면 글(`messages.ts` — 언어마다 같은 모양, 빠지면 타입 검사가 잡는다) |
| `src/shared/config/` | 바깥 주소 한 곳(우리 도메인만) |
| `src/shared/lib/html-template/` | 빌드한 `index.html` 틀의 자리표 셋(`%TW_LANG%` · `<!--tw-head-->` · `<!--tw-body-->`)을 채운다 — 하나라도 빠지면 던진다 |
| `scripts/prerender.mjs` | SSR 빌드를 불러 `dist/index.html` · `dist/en/index.html` · `dist/ja/index.html` 을 쓴다 |
| `public/` | 아이콘(앱 것을 복사 — `apps/desktop/app/assets/icon/tw-mini.png` · `apps/desktop/build/icon.iconset/icon_256x256.png`) · 글꼴 라이선스 |

- **색**은 디자인 시스템 원본(`docs/design-system/project/tokens.json`)에서 빌드 때 만든다(`vite.config.ts` 의 `virtual:tw-tokens.css` — 도움말 사이트와 같은 변환기 `scripts/build-design-tokens.js`). 사본을 커밋하지 않는다. 페이지는 `<html data-theme="classic">`.
- **몸 모델 · 피부 그림**은 앱 원본(`apps/desktop/app/parts/base-glb.js` · `skin-data.js`)에서 빌드 때 꺼내 파일로 낸다(`virtual:tw-char-assets` — 사본 커밋 없음). 설치 파일에도 든 공개 자산이라 웹에 둬도 된다(#430 4절).
- **캐릭터 코어**는 `@tw/char-core` 빌드(`packages/char-core/dist`)를 쓴다 — `dev` · `build` · `test` 앞에 코어 빌드가 먼저 돈다(`pre*` 스크립트).
- **글꼴**: 제목은 갈무리11 굵게(`galmuri` · SIL OFL 1.1), 일본어 가나는 DotGothic16(`@fontsource/dotgothic16` 일본어 묶음 · SIL OFL 1.1). 우리 사이트에 같이 올리고 라이선스는 `/licenses/`.

## 지킬 것
- 남이 쓴 값(닉네임 · 캐릭터 이름 · 소식 글)은 JSX 글로만 넣는다 — `dangerouslySetInnerHTML` 은 oxlint(`react/no-danger`)가 막는다. HTML 을 그대로 넣어야 하는 날이 오면 앱의 `safe-html.js` 규칙을 먼저 옮긴다.
- 바깥 주소 · 새 사이트는 사용자 확인 뒤에, 우리 도메인(`*.together-working.com`)으로만 — `src/shared/config/site.ts` 한 곳. 시험이 미리 그린 페이지의 바깥 링크를 본다.
- 유료 · 가챠 · 커미션 자산은 웹에 싣지 않는다(#430 4절).
- 화면 글을 고치면 세 언어 모두. 영어 · 일본어는 원어민 검수 전이다.

## 아직 아닌 것
- **Hosting 연결**: `firebase.json` 의 `home` 칸(사이트 `tw-site` · `dist/` 를 `firebase/web-dist/` 로 옮겨 올림 · CSP 는 우리 주소만)은 있다. 사이트 만들기 · 첫 배포 · 맞춤 도메인 `together-working.com` 연결은 사람이 한다(`firebase/hosting/README.md` «새 사이트 만들기» 1 · 3 ~ 6).
- **캐릭터 만들기**: 파츠 · 동물은 넣지 않는다(사용자 결정 — 꾸미기 파츠는 라이선스 전용 · 웹은 사람만). 얼굴 레이어 그림은 시안 수준이라 디자이너 그림이 오면 `catalog.ts` 표만 바꾼다. 내 계정에 저장은 #441.
- **내려받기 · 로그인 · 라이브러리 · 소식**: 서버 API 가 있어야 한다(#439 · #441). 내려받기 단추는 그때까지 눌리지 않는다.
