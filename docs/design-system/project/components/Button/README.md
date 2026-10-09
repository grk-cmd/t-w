누르면 바로 일이 일어나는 글자 버튼 · 아이콘 버튼.

| 종류 | 클래스 | 언제 |
|---|---|---|
| 기본 | `.tw-btn--primary` | 창마다 **하나**. 타이틀바와 같은 그라데이션(`title-a → title-b`) + `title-ink` 굵게 |
| 보조 | `.tw-btn` | 취소·닫기·그 밖 모두. `bg-face` + 광택, 테두리 `line-strong` |
| 위험 | `.tw-btn--danger` | 지우기·나가기 확정. `fill-danger` + `on-danger`. 확인창 안에서만 |
| 조용 | `.tw-btn--quiet` | «자세히» 같은 링크성 동작. `ink-accent` |
| 아이콘 | `.tw-btn--icon` | 28×26(`size-chip-btn`). 반드시 `aria-label` + `title` |
| 알약 | `.tw-btn--pill` | 고르는 것(프리셋·필터) |

- 높이 최소 24px(`size-hit`), 글자 `body` 12px, 좌우 여백 12px.
- 눌림 · 켜짐(`.on`): 광택을 끄고 `bg-select` + `shadow-pressed`. 광택을 켠 채 배경만 바꾸면 눌렸는지 안 읽힌다.
- 비활성은 `opacity:.45`. 안 되는 버튼은 숨기지 말고 비활성 + `title` 로 이유를 쓴다(구버전 앱 미지원처럼 영영 안 되는 것은 숨김).
- 버튼 글자는 동사로 끝낸다: «방에 들어가기», «지우기». «확인» 한 단어는 확인창의 기본 버튼 말고는 쓰지 않는다.
- 이모지는 버튼 글자 앞에 붙이지 않는다(🪣 채우기 → 채우기 + 아이콘). 예외: 상태칩 아이콘 버튼.

**앱 대응**: `.lc-btn`, `.fs-toggle-btn`, `.bb-btn`, `.wd-pic-btn`, `.plBtn` 등 버튼마다 따로 쓴 베젤 → `.tw-btn` 하나.
