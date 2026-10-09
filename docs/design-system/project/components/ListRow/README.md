목록 한 줄 — 제목 · 부제 · 오른쪽 메타(작성자/시각 또는 칩).

- `.tw-list` 안 `.tw-li`: 세로 6 · 가로 8 여백, 사이 `line` 1px.
- 제목은 한 줄 말줄임, 부제·메타는 `micro`(10px) `ink-soft`.
- 상태: hover·선택 `bg-select`(선택은 제목 굵게), 공지 `bg-star`, 잠김 `ink-soft` + `not-allowed`.
- 행 전체가 누르는 자리. 행 안 버튼은 오른쪽 끝 하나까지.

**앱 대응**: 버그 게시판 `.bb-row` · `.bb-main` · `.bb-title` · `.bb-sub` · `.bb-who` 를 그대로 옮겨 이름만 일반화했다.
