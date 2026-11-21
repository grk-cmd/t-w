# packages — 앱 · 웹이 같이 쓰는 라이브러리

루트 `package.json` 의 workspaces 가 `packages/*` 를 묶는다(루트에서 `npm install` 한 번).

| 패키지 | 내용 |
|---|---|
| `char-core/` | `@tw/char-core` — 캐릭터 3D 코어(에픽 #430). 앱은 빌드 사본 `apps/desktop/app/vendor/char-core/` 를 싣고, 웹은 ESM 으로 쓴다 |
