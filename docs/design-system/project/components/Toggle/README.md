켜고 끄는 설정 하나 — 알약 스위치 + «켬/끔» 낱말 + 설명.

- `label.tw-toggle` > `input[type=checkbox]` + `.st`(켬/끔) + 설명 글.
- 켜짐: 바탕 `accent`, 낱말 `ink-accent` 굵게. 꺼짐: `bg-field` + `line-strong` 틀.
- 색만으로 상태를 말하지 않는다 — «켬/끔» 낱말을 늘 같이 둔다.
- 바뀌는 즉시 적용한다(저장 버튼 없음). 되돌리기 어려운 것(계정·삭제)은 토글로 만들지 않는다.

**앱 대응**: 지금 `.fs-toggle-btn` 은 버튼 글자를 «켜기/끄기» 로 바꾸는 방식 — 스위치로 바꾸되 `refreshToggleBtns()` 가 칠하는 자리를 그대로 쓴다.
