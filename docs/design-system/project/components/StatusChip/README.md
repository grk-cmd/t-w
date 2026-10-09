화면 한쪽에 붙어 있는 내 상태 + 바로가기 묶음 — 오버레이에서 늘 보이는 유일한 조작부.

- `.tw-chipgroup`(세로 기본 · `.horz` 가로) 안 `.tw-btn--icon` 28×26, 사이 겹침 1px(테두리가 한 줄로 보이게), 묶음 바깥 모서리만 둥글다.
- 첫 칸 = 상태 점(`status-*` 12px + 1px 검은 테두리). 이어서 대화 · 알림 · 음악 · 더보기.
- 새 소식은 `.tw-dot`(`pop`)을 칸 오른쪽 위에. 숫자는 붙이지 않는다(작업 중 숫자는 신경을 긁는다).
- 아이콘은 이모지/글리프 한 글자(13px) — 이 자리만 예외로 이모지를 허용한다(작아도 알아보는 모양이 필요).
- 모든 칸에 `aria-label` + `title`. 사무실 숨기기 중에도 상태 칸 하나는 남는다(되돌릴 길).
- 투명도·접힘(.collapsed)은 .18s 페이드. 그 이상 움직이지 않는다.

**앱 대응**: `#myStatusChip` · `#myChipGroup` · `#myStatusChipBtn` · `#myChatBtn` · `#myBellBtn` · `#myPlBtn` · `#myChipMoreBtn`(z `z-chip` 55).
