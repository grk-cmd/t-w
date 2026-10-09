한 창 안의 여러 면 — 위만 둥근 폴더 탭과 아래만 둥근 패널이 붙어 있다.

- `.tw-tabs[role=tablist]` > `.tw-tab[role=tab]` + `.tw-tabpage`.
- 켜진 탭은 패널과 같은 `bg-face-2`, 밑변을 패널 색으로 지워 «이어져» 보이게 한다. 꺼진 탭은 `ink-soft`.
- 탭 글자 `caption`(11px), 낱말 하나 · 두 글자에서 네 글자. 이모지 머리표 금지.
- 탭이 5개를 넘으면 창을 나눈다(설정창 탭은 지금 7개 이상 — 이행 4단계에서 묶는다).

**앱 대응**: `.fs-tab-btn` · `.mh-tab` · `.mh-ds-tab` · `.wd-tab-btn` · `.wd-group-btn` · `.gc-tab` · `.ct-tab` · `.cr-tabs button` · `#crSteps span` — 9종 → `.tw-tab`.
