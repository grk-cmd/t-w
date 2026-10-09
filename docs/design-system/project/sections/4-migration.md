# 현재 앱과 다른 점 · 이행 순서

앱의 CSS 변수는 이 시스템 이름 앞에 `--tw-` 를 붙여 들인다(`ink` → `--tw-ink`). 이행 동안 옛 `--win-*` · `--acc-*` · 하위 호환 별칭(`--cream`, `--ink`, `--panel` …)과 함께 살아야 하므로 이름이 겹치지 않게 한 것이다. 처음엔 새 토큰이 옛 변수를 **가리키기만** 해서 화면이 1px 도 안 바뀐다 — 앱이 버블 테마를 들일 때 쓴 방법 그대로다.

## 토큰 대응표

| 이 시스템 | 지금 앱 | 바뀌는 점 |
|---|---|---|
| `bg-face` | `--win-face` (버블: `--acc-face`) · 별칭 `--cream` `--panel` | 같음 |
| `bg-face-2` | `--win-face-2` · `--cream-2` | 같음 |
| `bg-field` | `.win98sunken` 의 `#fff` · 곳곳의 `#fff` | 밤 테마에서 어두워진다 |
| `bg-select` | `--win-select-bg` (`--acc-tint`) · `--pink` | 같음 |
| `ink` | `--win-ink` · `--ink` | 같음 |
| `ink-soft` | `--win-ink-soft` · `--ink-soft` · 손 회색 `#999` `#888` `#666` … | 버블 낮 `#6E777A` → `#5E676A`(대비 4.0 → 5.1) |
| `ink-accent` | `--win-accent` (버블: `--acc-d`), 클래식 `#008080` | 글자용으로 한 단 진하게. 클래식 청록 → 남색 |
| `accent` | `--acc-d` · 경험치 바 | 면 전용으로 이름을 갈랐다 |
| `line` | `--acc-brd` · `.bb-row` 의 `--win-face-2` 구분선 | 같음 |
| `line-strong` | (없음) | **새로** — 입력칸 · 버튼 테두리 3:1 |
| `bevel-hi` / `bevel-lo` / `bevel-dark` | `--win-hi` / `--win-lo` / `--win-lo-2` · 별칭 `--wood` | 이름만 |
| `title-a` / `title-b` / `title-ink` | `--win-title-a` / `-b` (`--acc-l`·`--acc-m`) · `--win-title-ink` · 별칭 `--sage` `--sage-d` | 같음 |
| (bundle.css `--title-grad`) | `--win-title-grad` | 같음 |
| `fill-danger` · `ink-danger` | `--win-error` · `--terra` | 글자용(진하게)과 채움용으로 갈랐다 |
| `ink-ok` | (앱 없음) · 관리자 `--ok` | **새로** |
| `pop` | `--win-pop` (`--acc-pop`) | 클래식도 노랑으로 통일(지금은 남색) |
| `star` · `bg-star` | `--win-star` · `--win-star-bg` | 같음 |
| `ink-private` · `bg-private` | `--win-private` · `--win-private-bg` | 버블 글자 한 단 진하게 |
| `premium-*` | `--win-title-premium` · `--win-title-premium-ink` | 그라데이션을 두 색으로 풀었다 |
| `tooltip-*` | `.toast` 의 `#FFFFE1` · `#000` | 토큰으로 |
| `plate-*` | `.seat-nameplate` 의 `#fff` · `rgba(0,0,0,.8)` | 토큰으로 |
| `status-*` | `STATES` (`app.js`) `#9dba8a` `#e0a050` `#e89b9b` `#7fa0c4` | 토큰으로 |
| `sticker-*` | 버블 c4·c5 `--acc-sweep` · `--gb-*` | **새로** — 장식 전용 |
| `radius-sm` · `radius-md` | `--win-radius-sm` · `--win-radius` · `--win-radius-el` | `-el` 은 `-sm` 에 합친다 |
| `shadow-window` | `--win-drop` · `--win-drop-el` | 같음 |
| (bundle.css `--gloss` · `--face-gloss`) | `--win-btn-grad` · `--win-face-grad` | 같음 |
| `font-ui` · `font-classic` | `--win-font` · 하드코딩 Tahoma 121곳 | 하드코딩을 모두 변수로 |
| `font-num` | `--win-font-num` | 같음 |
| 글자 크기 7단계 | 25가지(6 · 7 · 8 · 8.5 · 9 · 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 … 44px) | 줄인다 |
| 밤 테마 `dark` | (없음) | **새로** |
| `Fredoka` · `Nunito` 글꼴 | 선언만 있고 파일이 없다 → 대체 글꼴로 그려짐 | 지운다(`font-ui` 로) |

## 클래스 대응표

| 이 시스템 | 지금 앱 |
|---|---|
| `.tw-win` · `.tw-titlebar` · `.tw-tbtn` | `.win98raised` 창 · `#chatWindow` 등 ID 20곳 · `.win98titlebar` · `.lc-bar` · `.wd-top` · `.mh-*-head` · `.decor-top` · `.win98titlebtn` |
| `.tw-btn` (+ `--primary` `--danger` `--quiet` `--icon` `--pill`) | `.lc-btn` · `.lc-gear` · `.lc-arrow` · `.fs-monitor-btn` · `.bb-btn` · `.wd-pic-btn` · `.plBtn` · `.plTxtBtn` · `#myChatBtn` 등 |
| `.tw-toggle` | `.fs-toggle-btn` · `.plChkBtn` |
| `.tw-tabs` · `.tw-tab` · `.tw-tabpage` | `.fs-tab-btn` · `.fs-tabpage` · `.mh-tab` · `.mh-ds-tab` · `.wd-tab-btn` · `.wd-group-btn` · `.gc-tab` · `.ct-tab` · `.cr-tabs button` · `#crSteps span` |
| `.tw-chip` · `.tw-badge` · `.tw-dot` · `.tw-lv` | `.bb-tag` · `.bb-dot` · `.mh-flv` · 관리자 `StatusChip` |
| `.tw-toast` | `.toast` |
| `.tw-plate` · `.tw-exp` | `.seat-nameplate` · `.seat-exp` · `.exp-fill` |
| `.tw-chipgroup` | `#myStatusChip` · `#myChipGroup` |
| `.tw-input` · `.tw-field` | `input` · `textarea` · `select` 전역 + `.win98sunken` |
| `.tw-list` · `.tw-li` | `.bb-row` · `.bb-main` · `.bb-title` · `.bb-sub` · `.bb-who` |
| `.tw-dialog` | `#mhPromptWin` · 창마다 만든 확인 상자 · `confirm()` |
| `.tw-seg` | `#wdPicPen` · `#wdPicEraser` · `#wdPicFill` |
| `.tw-grip` | 창마다 다른 리사이즈 자리 |
| `.tw-sticker` · `.tw-spark` | 마이홈 · 푸리쿠라 틀 |

## 웹 관리자와 다른 점

- 관리자(`web-admin/src/app/styles/global.css`)는 따뜻한 회백(`--bg #f4f1ec`) + 파랑 강조(`--accent #2f5d8a`) + 시스템 글꼴 14px 로, 앱과 **다른 브랜드처럼 보인다.**
- 맞추는 정도: 관리자는 «약» 레트로 — 색 토큰 이름을 이 시스템과 같게(`--ink` · `--ink-soft` · `--line` · `--ink-danger` · `--ink-ok` · `--ink-accent`), 카드 머리에만 `title-a → title-b` 얇은 띠. 글자 크기는 관리자 14px 그대로(작업 화면이라 앱보다 크게 읽는다).
- 관리자는 이미 `prefers-color-scheme` 밤 테마가 있다 — 앱 `dark` 값을 관리자 밤 값과 같은 뼈대로 만들었다.
- 관리자 상태 칩(`StatusChip.module.css`)은 이 시스템 `Chip` 과 모양이 같다 — 넷의 색 이름만 맞춘다.

## 이행 순서

각 단계는 PR 하나 · 화면 차이 확인 후 다음으로. `checks/` 에 검사를 붙인다.

1. **토큰 다리 놓기** (화면 변화 0) — `:root` 에 `--tw-*` 를 옛 변수에 연결해 선언하고, `html[data-theme="bubble"]` · 클래식 블록에 같은 이름을 둔다. 하드코딩 Tahoma 121곳을 `var(--tw-font-ui)` 로(버블에서 돋움이 비로소 먹는다 — 유일한 «보이는» 변화). `audit.py` 에 «새 규칙은 `#999` 같은 손 회색 · 직접 font-family 금지» 검사를 더한다.
2. **확인창 · 토스트 · 버튼** — `ConfirmDialog` 를 도메인 모듈(`app/parts/ui-dialog.js`, `createDialog(deps)`)로 만들고 `confirm()` 17곳을 바꾼다. 버튼 계열을 `.tw-btn` 으로 묶어 버블 테마의 «광택 목록» · «radius 목록» 나열을 지운다. `ink-soft` 대비 수정이 여기서 들어간다.
3. **창틀 · 탭 통일** — 인라인 타이틀바 그라데이션 49곳 · 탭 9종을 `.tw-titlebar` · `.tw-tab` 으로. 버블 테마의 창 · 타이틀바 ID 나열 블록이 사라진다 — 새 창이 테마를 빠뜨리는 사고가 구조적으로 없어진다.
4. **글자 크기 정리** — 25가지를 7단계로. 반 픽셀(10.5 · 11.5)부터 가장 가까운 단계로. 설정창 탭을 5개 이하로 묶는다.
5. **그리기 도구 세그먼트 · 크기 조절 손잡이** — `_wdPic.tool` 하나로 상태를 합치고 `.tw-seg`, 창 리사이즈를 `.tw-grip` 으로.
6. **밤 테마** — 설정 › 화면 › 모양에 «버블 · 밤» 추가(시스템 따라가기 기본). 1~3단계가 끝나야 손 회색 · `#fff` 가 남지 않아 밤이 깨지지 않는다.
7. **하두리 장식** — 도트 서체(갈무리, OFL) 파일을 `app/assets/fonts/` 에 넣고(CSP `font-src 'self' file:` 안), 마이홈 · 스티커 사진 · 뽑기 결과에 `Sticker` 틀 · `sticker-*` 를 입힌다.
8. **웹 관리자 맞추기** — 색 이름 통일, 카드 머리 띠.
