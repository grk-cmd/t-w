# 앱 린트 — 우리 안티패턴만 막는다

새로 생기는 안티패턴은 린트로 막고, 이미 있던 것은 기준선으로 얼린다.
설정은 `apps/desktop/eslint.config.js`, 기준선은 `apps/desktop/eslint-suppressions.json`, 검사는 `checks/sim-lint.js`.

- 모양(띄어쓰기 · 따옴표 등) 규칙과 ESLint 기본 추천 규칙은 켜지 않는다. 렌더러는 classic script 라 전역이 많아서 «정의 안 된 변수» 같은 규칙은 쓸모없는 경고만 낸다.
- 금지마다 규칙 이름을 따로 단다(`tw/…`). 규칙 몸은 내장 `no-restricted-syntax`(구문 트리 선택자)를 그대로 쓰고, 경로를 풀어야 하는 것(메인 ↔ 렌더러 경계 · Firebase SDK 이름 따라가기)만 설정 파일 안의 작은 규칙 객체다. 기준선은 «파일 × 규칙 이름» 으로 개수를 세서, 이름을 나눠야 «타이머 하나 지우고 firebaseAPI 하나 더하기» 가 빨강이 된다.

| 규칙 | 막는 것 | 대신 할 것 | 대상 |
|---|---|---|---|
| `tw/no-timer` | `setTimeout` · `requestAnimationFrame` 새 호출 | 준비 알림(이벤트 · Promise · 모듈의 on…)을 받는다 | `app/parts/**` |
| `tw/no-firebase-api` | `firebaseAPI` · `window.firebaseAPI` 를 직접 부르기 | 도메인 provider(`…-api.js` · `…-provider.js`)를 deps 로 받는다 | `app/parts/**` (만드는 · 잇는 곳 넷은 뺀다 — 설정 파일에 까닭) |
| `tw/ls-key-prefix` | `localStorage.setItem/getItem/removeItem` 에 `tw.` 로 시작하지 않는 글자 키 | 키를 모듈 위 상수 한 곳에 `tw.…` 로 둔다 | `app/parts/**` |
| `tw/no-main-require-renderer` | 메인 쪽 파일이 `app/` (렌더러) 파일을 가져오기(`require` · `import` · `import()` — 경로를 풀어서 본다) | 두 쪽이 같이 쓰는 순수 규칙은 공용 자리로 옮긴다 | 앱 폴더 맨 위 `*.js` |
| `tw/no-renderer-import-main` | 렌더러가 `require` 를 부르기 · Node · Electron 모듈 가져오기 · `app/` 밖 메인 쪽 파일 가져오기 | 메인의 기능은 preload 가 내놓은 `window.…` 와 IPC 로 부른다 | `app/**` |
| `tw/no-firebase-data` | Firebase DB · Storage SDK 함수를 새로 가져오기 · 새로 부르기 | 서버 API(도메인 `…-api.js`)로 만든다 | `app/parts/**` |
| `tw/no-placeholder-store` | 저장 · 보내기 함수(`setItem` · `save…` · `send…` · `post…` · `put…` · `patch…` · `upload…` · `commit…` · `write…`) 인자에 이름 placeholder(`TwPersonName.shown()` · `getDisplayName()` · `NO_NAME` · `'이름 없음'`) | 이름 그대로(없으면 `''`)를 싣고, placeholder 는 그릴 때만 만든다 | `app/parts/**` |

## 돌리기

```bash
npm run lint          # 기준선 밖 위반이 있으면 빨강
npm run lint:prune    # 고쳐서 줄었으면 기준선을 내린다
npm run lint:baseline # 까닭이 있는 새 위반을 기준선에 올린다 — PR «왜» 에 까닭을 적는다
node checks/run.js sim-lint
```

`sim-lint` 는 세 가지를 본다: ① 저장소를 돌려 기준선 밖 위반 0 · 기준선에 낡은 줄 없음 ② 규칙마다 나쁜 예는 빨강 · 좋은 예는 통과 ③ 기준선이 «늘면 빨강 · 줄면 prune 하라고 빨강» 으로 도는지.

## 기준선 줄이기

손대는 파일의 위반을 고쳤으면 같은 PR 에서 `npm run lint:prune`. 고치기만 하고 prune 하지 않으면 «낡은 줄» 로 빨강이다 — 줄어든 만큼 다시 늘지 못하게.
파일을 지우거나 옮겼으면 기준선의 그 칸은 prune 이 못 지운다 — 손으로 지운다(`sim-lint` 가 «없는 파일» 로 알려 준다).
`lint:baseline` 은 기준선 파일을 통째로 다시 쓴다. PR 에서 `eslint-suppressions.json` 개수가 늘었으면 리뷰에서 까닭을 묻는다.

## 규칙 더하기

같은 지적이 리뷰에서 두 번 나오면 말로 다시 적지 말고 규칙으로 만든다.

1. `eslint.config.js` 에 선택자 묶음을 더하고, 규칙 이름(`tw/…`)을 `plugins.tw.rules` 에 단다. 정규식으로 글자를 찾지 말고 구문 트리 선택자로 쓴다.
2. 오류 문구는 «무엇을 대신 쓰라 — 까닭» 한 줄(한국어).
3. 먼저 `npm run lint` 로 실제 코드에서 몇 곳을 잡는지 세 보고, 엉뚱한 곳을 잡으면 선택자나 대상 파일을 좁힌다.
4. `npm run lint:baseline` 으로 지금 있는 것을 얼린다.
5. `checks/sim-lint.js` 의 `RULES` 와 2절 mutation test 에 나쁜 예 · 좋은 예를 더하고, `checks/CHECKS.md` §3 해시를 같은 커밋에서 맞춘다.
