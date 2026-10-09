# Together Working 디자인 시스템

앱(Electron) · 웹 관리자 · 안내 페이지의 화면을 만들 때 따르는 **원칙 · 토큰 · 부품 지침**이다.
UI 를 고치거나 새로 만들 때는 이 폴더를 먼저 본다.

- 웹으로 보기: https://together-working.web.app/design/ (낮 · 밤 · 클래식 테마를 바꿔 가며 볼 수 있다)
- 처음 만든 곳: Claude 디자인 시스템 아티팩트(https://claude.ai/artifact/AQ3gQsjpsNi8Mo21xwvgmB · 2026-10-09 판). 지금은 **이 폴더가 정본**이다.

## 무엇이 어디에

| 파일 | 내용 |
|---|---|
| `project/README.md` | 원칙 셋 · 하두리 감성 강도 표 · 테마 · 색 · 글꼴 · 간격 · 움직임 · 아이콘 |
| `project/tokens.json` | 토큰 — 색(낮 · 밤 · 클래식) · 글꼴 · 간격 · 모서리 · 그림자 · 크기 · 겹침 순서 |
| `project/sections/` | 오버레이 원칙 · 아이콘과 글 · 해요/하지 마요 · 현재 앱과 다른 점 · 이행 순서 |
| `project/components/` | 부품별 지침(`README.md`) · 미리보기(`preview.html`) · 공용 모양 `bundle.css`(클래스는 모두 `.tw-*`) |
| `project/assets/Logos/` | 앱 마크 `tw-mini.png`(원본은 `app/assets/icon/tw-mini.png`) |
| `project/design-system.json` | 아티팩트 메타 정보(제목 · 판 · 마지막 변경) |

## 고치는 법

1. `project/` 안의 파일을 고친다(토큰은 `tokens.json`, 부품 모양은 `components/bundle.css`, 지침은 각 `README.md`).
2. `npm run design:build` — `scripts/build-design-site.js` 가 `hosting/design/`(index.html · tokens.css · bundle.css)을 다시 만든다.
   `hosting/design/` 은 손으로 고치지 않는다. `npm run check` 의 `sim-design-site.js` 가 둘이 어긋나면 빨강을 낸다.
3. 웹에 올리기(관리자만): `firebase deploy --only hosting --project together-working`.
   Hosting 배포는 `hosting/` 전체(웹 관리자 `/admin` 포함)를 함께 올린다 — `firebase.json` predeploy 가 웹 관리자를 다시 빌드한다.

미리보기는 아티팩트 환경을 흉내 낸다 — 각 미리보기에 `tokens.css`(tokens.json 에서 만든 CSS 변수)와 `bundle.css` 를 싣고,
`<html data-theme="light|dark|classic">` 으로 테마를 바꾼다.
