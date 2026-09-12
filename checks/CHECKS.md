# 검사 파일 정본 표 — 핸드오프 3-① 대응

작성: 2026-09-12 · 개정 2 (`sim-sysinput.js` 입수 반영) · 근거: `handoff-mac-runtime.md` §3-①
대상: `sim-*.js` 51개 + `smoke.js` + `audit.py` = **53개**

★ 개정 1 에서 "52개 + 2 = 54" 라고 적었던 것은 **세다 틀린 것이다.** 프로젝트 사본의
`sim-*.js` 는 50개였고 여기에 `sim-sysinput.js` 가 더해져 51개다. 이 표가 정본 표시인 이상
개수부터 맞아야 해서 남겨 둔다.

---

## 0. 이 파일이 있는 이유

검사 파일들이 저장소에 없어서 **어느 판이 진짜인지 가려 주는 자리가 없다.** 그래서 지난
세션에 낡은 판으로 세 번 걸렸고, 그동안 나온 초록·빨강을 근거로 못 썼다.

이 표가 그 자리다. 검사를 저장소에 커밋할 때 **같이 커밋한다.** 검사를 고치면 해시도 같이
고친다. 해시가 안 맞으면 그 판은 정본이 아니다 — 초록이어도 근거로 쓰지 않는다.

---

## 1. 지금 상태

| 확인 | 결과 |
|---|---|
| 검사 파일 수 | 53개 (§3) |
| `sim-sysinput.js` | **입수함.** 받은 것은 §2 표의 **58·1 판**. 6절 한 줄 고쳐 **60·0** |
| `sysinput-win.js` 를 읽는 검사 | 1개 (`sim-sysinput.js`) |
| **`overlay-win.js` 를 읽는 검사** | ★ **0개** |

★ 마지막 줄이 3-① 에 남아 있는 실제 구멍이다. ③(sysinput 분리)은 검사가 따라갔지만
①(오버레이 분리)은 안 따라갔다. `overlay-win.js`(23.5KB) 를 보는 눈이 하나도 없다.

---

## 2. 실행 위치 규칙 ★ 커밋 layout 을 정하기 전에 읽을 것

검사들이 원본을 찾는 방식이 **두 갈래**다.

| 방식 | 수 | 뜻 |
|---|---|---|
| `fs.readFileSync('app.js')` — cwd 상대 | 43 | 원본이 있는 폴더**에서 실행**해야 한다 |
| `path.join(__dirname, …)` — 파일 위치 상대 | 9 | 원본이 있는 폴더**에 들어 있어야** 한다 |
| 둘 다 (`sim-mys-play.js`) | 1 | 어느 쪽이든 맞으면 된다 |

그리고 둘 다 **평평한 폴더**를 가정한다. `sim-overlay-gap.js:254` 는 `__dirname/app.js`,
`sim-pl-loop.js:31` 은 `app.js` · `main.js` · `preload.js` 를 한 폴더에서 찾는다.
`sim-sysinput.js` 도 `HERE = __dirname` 으로 `main.js` · `sysinput-win.js` 를 나란히 찾는다.
지금 저장소는 `main.js` 가 루트, 렌더러가 `app/` 아래다 — **맞지 않는다.**

⇒ `checks/` 하위로 그냥 넣으면 `__dirname` 쪽 10개가 원본을 못 찾는다. 루트에 쏟으면
53개가 루트에 깔리고 `app.js` 는 여전히 `app/` 에 있다. **파일을 옮기는 것만으로는 안 된다.**

원본을 읽는 검사 수: `app.js` 41 · `smoke.js` 17 · `desk-companion-prototype.html` 14 ·
`main.js` 8 · `preload.js` 3 · `sysinput-win.js` 1 · **`overlay-win.js` 0**

---

## 3. 목록 — sha256 앞 12자리

이 해시가 정본 표시다. 출처: Claude 프로젝트 사본(2026-09-12).

| 파일 | 줄 | sha256[:12] |
|---|---|---|
| audit.py | 676 | 9faf2c3a1eb5 |
| smoke.js | 328 | 5ebace067749 |
| sim-admin-rules.js | 93 | 5084b714ba93 |
| sim-char-foot.js | 141 | 9f0e32d97ac7 |
| sim-char-identity.js | 187 | bdad4f71d987 |
| sim-char-z.js | 224 | 24de011f5c83 |
| sim-chat-log-persist.js | 119 | 63e792506df5 |
| sim-chip-chat-ui.js | 111 | 2da628460ae2 |
| sim-clone-code-entry.js | 215 | 53e6e01ede7a |
| sim-dance-unlock-mail.js | 200 | 47b44432e8fa |
| sim-def-send.js | 210 | 5405e87ce5ed |
| sim-desk-floor-clamp.js | 194 | b1b2d0628319 |
| sim-desk-part-scale.js | 82 | 10a689d1eabf |
| sim-dom-boot.js | 83 | 927ab53ecc44 |
| sim-exp-bar-color.js | 135 | 4142ee5559d6 |
| sim-face-loss.js | 289 | 444c6d8ea626 |
| sim-fly-egg.js | 258 | fcfe7bf07c6b |
| sim-fly-replay.js | 160 | 2bdaa91d9741 |
| sim-focus-sync.js | 168 | c293c5aae09e |
| sim-friend-manage.js | 262 | 780d6dc97b68 |
| sim-gacha-prune.js | 158 | 777354d77f58 |
| sim-gacha-race.js | 120 | 85100a1126c6 |
| sim-ghost-cache-sync.js | 273 | 356d2cabc722 |
| sim-google-login.js | 474 | 74d85154c9fe |
| sim-invite-gate.js | 99 | 98990b71a1f1 |
| sim-mh-sanitize.js | 263 | c1c0e3644b1b |
| sim-myhome-steps.js | 126 | 25373df649b5 |
| sim-mys-play.js | 1153 | 7bb7fabc4432 |
| **sim-overlay-gap.js** | 277 | 79ae971b5f52 ★낡음 |
| **sim-overlay-layered.js** | 271 | ec6ab7103924 ★낡음 |
| sim-part-color-entry.js | 133 | 95b28d969c0a |
| sim-pl-grab-pick.js | 181 | d8019ac073af |
| sim-pl-loop.js | 357 | 23a8df9f75be |
| sim-pl-next.js | 166 | 698df7a65fd0 |
| sim-pl-watchdog.js | 392 | 193d4fd3c476 |
| sim-publish-fields.js | 198 | 67aef987d9f9 |
| sim-purikura-deco.js | 894 | 3138f94f5e8c |
| sim-purikura-net.js | 361 | a4029a7ef053 |
| sim-purikura-rules.js | 258 | 9079757f6fbd |
| sim-purikura-stage.js | 231 | 0088fd6cf6d7 |
| sim-ride-height.js | 107 | 51ec14fb65a3 |
| sim-ride-part-top.js | 94 | 9cdba4851913 |
| sim-room-clock.js | 135 | 421b90c3df47 |
| sim-seat-eq.js | 79 | d42385d8e6a4 |
| sim-seat-opacity.js | 157 | 1f520bfe5fa3 |
| sim-slot-fit.js | 227 | 4116d83e6eb8 |
| **sim-sysinput.js** | 367 | **03256a7a7bbf** ← 이번에 고친 판 |
| sim-town-32.js | 87 | ff7b7c796278 |
| sim-unfocused-fps.js | 114 | 69e974270d6f |
| sim-village-addr.js | 53 | f72ef601abbb |
| sim-win-front.js | 108 | 3611b5c18f21 |
| sim-win-layers.js | 197 | a004bf67b98a |
| sim-yard-enter.js | 59 | c323aea595a5 |

### `sim-sysinput.js` 판 계보 — 이 항목만 판이 여러 개다

| 판 | 결과 | 해시 | 비고 |
|---|---|---|---|
| §4-b 이전 | 49 · 1 | (없음) | `handoff-mac-runtime.md` §3-② 가 "받은 것" 이라 한 판 |
| 입수본 | 58 · 1 | b97367bf176e | 360줄. §2 표의 그 판이 맞다 |
| **정본** | **60 · 0** | **03256a7a7bbf** | 367줄. 6절만 고침 — §4-① |
| "65 · 0" | — | — | ★ **실물이 나온 적 없다.** 이전 핸드오프의 말뿐인 수치 |

★ 65·0 을 더 찾지 말 것. 6절을 고쳐 0 이 됐으므로 그 판을 기다릴 이유가 없어졌다.

---

## 4. 손본 것 · 남은 것

### ① `sim-sysinput.js` 6절 — 고쳤다 (58·1 → 60·0)

빨간 항목 하나가 `f.name === exeName` 을 찾고 있었다. `main.js` 는 `keysOf` 한 통로로 갔고
(`main.js:383` 정의 · `:787` 판정), 785줄 주석에는 옛 비교문이 **"되돌리지 말 것" 예시로**
인용돼 있다. 검사가 주석 제거본을 보므로 그 인용에 안 걸렸고, 그래서 빨갛게 남았다.
③ 이 만든 빨강이 아니다 — 분리 전에도 똑같이 빨갰다(§3-②).

못 박는다는 6절의 뜻은 그대로 두고 **대상만** 옮겼다. 한 줄이 두 줄이 됐다:

- `★ 등록 판정이 keysOf 한 통로를 지난다` — `keysOf` 정의 + `keysOf(…).includes(` 통로
- `★ .name / .key 직접 비교가 없다` — §5 의 "직접 비교 금지" 를 검사가 처음으로 지킨다

두 번째 줄이 덤이다. §5 금지 항목 중 이것만 지켜 주는 자리가 없었다.

### ② 오버레이 검사 둘 — 안 고쳤다

`sim-overlay-gap.js` · `sim-overlay-layered.js` 는 `main.js` 만 읽는다
(`SRC = path.join(__dirname,'main.js')` · `readIf('main.js')`). 갭 상수와 레이어 판정이
`overlay-win.js` 로 나갔으므로 못 찾는다. **`overlay-win.js` 를 같이 줘도 소용없다 —
읽는 코드가 없다.**

이번 실측(`main.js`+`overlay-win.js`+`sysinput-win.js` 만, `app.js`·`preload.js` 없이):

```
sim-overlay-gap.js       19 · 7 · 4 · 건너뜀 1
sim-overlay-layered.js   15 · 5 · 4 · 건너뜀 3
```

★ §2 의 20·7·4 / 24·5·4 와 숫자가 다른 것은 **판이 달라서가 아니라** 여기에 `app.js` ·
`preload.js` · `desk-companion-prototype.html` 이 없어 건너뛴 항목이 늘어서다.
빨강 개수(7 · 5)는 같다.

★ 이 둘은 `sim-sysinput.js` 처럼 한 줄로 안 끝난다. `sim-sysinput.js` 는 애초에
**단계 자동 판정**(`sysinput-win.js` 가 있으면 분리 후로 본다)을 넣고 쓰인 파일이라 분리를
견뎠다. 오버레이 검사 둘에는 그 장치가 없어서 **같은 장치를 심는 일**이 된다. 별건이다.

### ③ 남은 구멍

`overlay-win.js` 를 읽는 검사가 0개다. §5 의 금지 항목 중 오버레이 쪽
(갭 상수 · 레이어 판정 · 클릭 통과와 커서 폴링을 쪼개지 말 것) 은 지금 지켜 주는 검사가 없다.
③ 은 `sim-sysinput.js` 가 덮었지만 ① 은 안 덮여 있다.

---

## 5. 커밋 layout — (B) 로 정함

```
t-w/
├─ main.js  preload.js  overlay-win.js  sysinput-win.js  package.json
├─ app/          app.js · desk-companion-prototype.html · parts/ · assets/
└─ checks/       ← 검사 53개 + CHECKS.md(이 파일) + run.js
```

`checks/run.js` 가 OS 임시 폴더에 **평평한 한 층**을 만들어 원본과 검사를 거기 모아 돌린다.
루트를 펼치고 그 위에 `app/` 내용을 같은 층에 펼친다(이름이 겹치면 루트가 이긴다).
cwd 와 `__dirname` 이 같은 곳을 가리키므로 §2 의 두 갈래가 동시에 만족된다 —
**검사 53개는 한 글자도 안 고쳤다.**

```
npm run check                 전부
node checks/run.js sysinput   이름에 그 말이 든 것만
node checks/run.js --list     목록과 정본 대조만
node checks/run.js --hashes   ↑ §3 표에 붙일 줄을 찍는다
node checks/run.js --keep     스테이징을 안 지우고 경로를 알려 준다
```

종료 코드: 0=전부 통과 · 1=빨강 있거나 정본 불일치 · 2=돌리지도 못함

### 러너가 지키는 두 가지

**① 정본 대조가 먼저다.** 돌리기 전에 `checks/*.js` 해시를 §3 표와 맞댄다. 다르면 그 줄을
찍고 **마지막 줄에 "위 초록은 근거로 못 쓴다" 를 남긴다.** 3-① 이 겪은 일이 다시 나면
조용히 지나가지 않는다. 검사를 고쳤으면 `--hashes` 로 표를 다시 찍어 §3 을 갈 것.

**② `원본 없음` 은 빨강이 아니다.** 원본 한 벌이 안 갖춰진 체크아웃에서 46개가 빨갛게
나오면 그 안에 진짜 빨강 2개가 묻힌다. 요약 줄(`통과 N · 실패 N`) 없이 ENOENT ·
MODULE_NOT_FOUND · "못 찾음" 으로 끝난 검사는 **`원본 없음` 으로 따로 센다.** 규칙이 깨진
검사는 반드시 요약 줄을 찍고 끝나므로 이 둘은 안 섞인다.

### 지금 이 저장소에서 돌린 결과 (`main.js`·`overlay-win.js`·`sysinput-win.js` 만 있는 상태)

```
정본 대조   53개 전부 일치
검사 53개 · 초록 5 · 빨강 2 · 원본없음 46 · 건너뜀 0
빨강: sim-overlay-gap.js (19·7·4) · sim-overlay-layered.js (15·5·4)   ← §4-②
없는 원본: app.js · desk-companion-prototype.html · firebase-database-rules.json
          firebase-init.js · purikura-net.js · togetherland-ui-mockup.html
```

★ **빨강 2개가 §4-② 의 그 둘이다.** 그 밖에는 없다. `app/` 을 커밋하면 원본없음 46개가
살아나고, 그때 나오는 숫자가 이 저장소의 첫 진짜 기준선이 된다.

---

## 6. 그 외 확인한 것

- `.gitignore` — 스테이징은 **저장소 밖**(OS 임시 폴더)이라 넣을 것이 없다.
  `oauth-config.js` · `app/parts/firebase-config.js` 는 별건으로 확인할 것(§3-⑤ 푸시 차단).
- `package.json build.files` 는 **허용 목록**이라 `checks/` 는 애초에 설치본에 안 실린다.
  뺄 것이 없다. `scripts.check` 만 더했다.
