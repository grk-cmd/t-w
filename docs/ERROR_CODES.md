# 에러코드

앱에서 무언가 실패하면 토스트 끝에 `오류 E-FR-01` 같은 번호가 붙습니다.
제보할 때 이 번호를 같이 알려 주면 어디서 났는지 바로 찾을 수 있어요.

- 정본: `apps/desktop/app/parts/shared/error-codes.js` 의 `CODES` 표 — 이 문서는 사람이 읽기 좋게 옮긴 것이다.
- 검사: `checks/sim-error-codes.js` — 표 모양 · 부르는 곳 · 이 문서에 번호가 다 있는지를 본다.

## 규칙
- 모양은 `E-영역-두자리`. 영역은 앱 폴더와 맞춘다(아래 표).
- 사용자에게 보이는 **실패**에만 붙인다(저장 · 불러오기 · 요청 실패 등). «자리가 없어요» 같은 안내는 번호가 아니다.
- 새 번호는 표(`CODES`)에 먼저 넣고 `TwErrorCodes.notify('E-…', err)` 로 부른다. 번호는 글자 그대로 쓴다(검사가 찾는다).
- 한 번 쓴 번호는 **다시 쓰지 않는다.** 안 쓰게 된 번호는 `RETIRED` 로 옮기고 이 문서의 «걷은 번호» 에 남긴다 — 옛 앱 사용자는 옛 번호를 계속 불러 준다.
- 같은 번호는 10초 안에 토스트를 한 번만 띄운다(오류 기록 `tw-error.log` 에는 매번 남는다 — 진단 기록이 아니다).

## 영역
| 영역 | 뜻 |
|---|---|
| `ACC` | 계정 · 로그인 · 초대 |
| `FR` | 친구 · 친구 요청 |
| `MH` | 마이홈 · 우편 |
| `GB` | 방명록 · 웹박수 |
| `ROOM` | 방 입장 · 나가기 · 방 목록 |
| `CHAT` | 채팅 |
| `CHAR` | 캐릭터 · 꾸미기 · 가챠 |
| `FOCUS` | 포커스 · 레벨 |
| `PL` | 플레이리스트 |
| `LIC` | 라이선스 · 프리미엄 |
| `RPT` | 신고 |
| `BUG` | 버그 제보 |
| `GIFT` | 말랑이 · 선물 |
| `ADM` | 앱 관리자 창 |
| `DATA` | (걷음) 범용 데이터 통로 — 걷은 번호만 |
| `NET` | 서버 통로 공통(API · realtime) — 기능 오류는 그 기능 영역 번호로 |
| `RT` | realtime 연결이 끊겨 멈춤(로그인 풀림 · 계정 로그아웃 · 모르는 닫힘) — 다시 붙는 끊김엔 번호 없음 |
| `SYS` | 그 밖 |

## 번호
| 번호 | 사용자 문구 | 어디서 |
|---|---|---|
| `E-SYS-01` | 알 수 없는 오류가 났어요 | (예비) 표에 없는 번호를 불렀을 때 |
| `E-ACC-01` | 닉네임을 저장하지 못했어요 — 다시 해 주세요 | `account/user-name.js` — 닉네임 저장 뒤 서버 계정 이름(`PATCH /v1/me` — login-flow `patchMe`) 실패 |
| `E-ACC-02` | 비밀번호를 확인하지 못했어요 — 잠시 뒤 다시 해 주세요 | `account/account.js` — 비밀번호 바꾸기 · 탈퇴 · 붙이기 전 «비밀번호 확인» 창에서 너무 많이 틀림(too-many-requests) · 네트워크 실패(틀린 비밀번호는 창 안에 알림) |
| `E-FR-01` | 친구 요청을 수락하지 못했어요 | `myhome/friend-manage.js` — 요청 팝업 · 받은 요청 [수락] |
| `E-FR-02` | 친구 요청을 거절하지 못했어요 | `myhome/friend-manage.js` — 요청 팝업 · 받은 요청 [거절] |
| `E-FR-03` | 보낸 친구 요청을 취소하지 못했어요 | `myhome/friend-manage.js` — 보낸 요청 [취소] |
| `E-FR-04` | 선택한 친구 요청 일부를 처리하지 못했어요 | `myhome/friend-manage.js` — 받은 요청 일괄 수락 · 거절 |
| `E-FR-05` | 친구의 접속 상태를 받지 못했어요 — 연결을 확인하고 다시 시도해 주세요 | `myhome/friends-sub.js` — 놀러 가기 · 파도타기 친구 고르기의 접속 상태 한 번 읽기(presenceGet) 실패(이어지는 동안 한 번만) |
| `E-ACC-03` | 서버에 연결하지 못했어요 — 인터넷 연결을 확인하고 다시 시도해 주세요 | `account/license-gate.js` — «서버에 연결할 수 없어요» 화면에서 누른 [다시 시도] 가 또 닿지 못함(켤 때 자동으로 한 확인에는 번호 없음) |
| `E-MH-01` | 도움말을 불러오지 못했어요 — 인터넷 연결을 확인하고 다시 시도해 주세요 | `myhome/help-tab.js` — 도움말 탭 틀에서 페이지 알림이 시간 안에 안 옴(`LOAD_MS`) |
| `E-MH-02` | 배경 그림을 불러오지 못했어요 — https 로 시작하는 주소를 써 주세요 | `myhome/mh-bg-url.js` — http 배경 주소를 https 로 바꿔 불러 봤는데 못 받음(내 마이홈 · 바탕화면만) |
| `E-MH-03` | 선물 그림을 저장하지 못했어요 — 잠시 뒤에 다시 해 주세요 | `myhome/gift-save.js` — 선물함 우클릭 [저장]에서 그림을 못 받음(주소 없음 · 네트워크 · 그림 아님) |
| `E-MH-04` | 일정을 불러오지 못했어요 — 인터넷 연결을 확인하고 안내 글자를 눌러 다시 시도해 주세요 | `myhome/scheduler.js` — 달력 · 기념일 · D-day · 오늘 일정 · 친구 태그 알림 받기 실패(이어지는 동안 한 번만) |
| `E-MH-05` | 카드 그림을 올리지 못해 저장하지 않았어요 — 다시 눌러 주세요 | `myhome/scheduler.js` — 기념일 카드 그림 올리기 실패 · 서버가 그림 주소를 거절(`IMAGE_UPLOAD` · `SCHEDULE_INVALID_IMAGE_URL`) |
| `E-MH-06` | 친구만 태그할 수 있어요 — 친구 목록을 확인해 주세요 | `myhome/scheduler.js` — 일정 · 기념일 저장의 그 밖의 태그 거절(`SCHEDULE_TAG_SELF` 등 — 아무것도 저장되지 않음). 친구가 아닌 사람 태그(`SCHEDULE_TAG_NOT_FRIEND`)는 번호 없이 안내 토스트 |
| `E-MH-07` | 기념일 · D-day 는 각각 10개까지예요 | `myhome/scheduler.js` — 서버가 기념일 · D-day 상한 초과를 거절(`SCHEDULE_DDAY_FULL`) |
| `E-MH-25` | 바탕화면을 저장하지 못했어요 | `myhome/myhome-store.js` — 바탕화면 PUT(`PUT /v1/me/myhome/desktop` · 배경 · 폴더 숨기기 · 폴더 자리) 실패(이어지는 동안 한 번만 · 서버가 거절한 값은 그때마다) |
| `E-MH-26` | 책장을 불러오지 못했어요 — 서랍의 «다시 시도» 를 눌러 주세요 | `myhome/bookshelf-store.js` — 내 책장 받기 실패(서랍을 열 때 · «다시 시도» · 409 뒤 다시 받기) · 구경 중 공개 책 «다시 시도» 가 또 실패(구경을 시작하며 받다 실패하면 번호 없이 서랍에 «못 불러왔어요») |
| `E-MH-27` | 책장을 저장하지 못했어요 — 책을 한 번 더 고치면 다시 올려요 | `myhome/bookshelf-store.js` — 책장 저장(`PUT bookshelf`) 실패(이어지는 동안 한 번만 · 다음 고침 · 로그아웃 올리기가 한 번 다시 보냄) |
| `E-MH-08` | 우편을 불러오지 못했어요 — 우편함의 «다시 시도» 를 눌러 주세요 | `myhome/mail-feed.js` — 내 우편 받기 실패(`fetchMail` 던짐 — 알림함을 열 때 · «다시 시도» 를 누를 때(연 · 누른 받기에서만) · 이어지는 동안 한 번만 알림) |
| `E-MH-09` | 소식을 불러오지 못했어요 — 우편함의 «다시 시도» 를 눌러 주세요 | `launcher/notice-feed.js` — 공지 한 판(소식 · 업데이트 공지 · 배너) 받기 실패(`fetchBoard` 던짐 — 알림함을 열 때 · «다시 시도» 를 누를 때(연 · 누른 받기에서만) · 이어지는 동안 한 번만 알림) |
| `E-MH-10` | 우편을 읽음으로 바꾸지 못했어요 — 잠시 뒤 다시 눌러 주세요 | `myhome/mail-feed.js` — 읽음 · 모두 읽음 서버 쓰기 실패(`markRead` · `markAllRead` failed — 계정이 바뀌는 중(`stale`)은 조용히 버림) |
| `E-MH-11` | 우편을 지우지 못했어요 — 잠시 뒤 다시 눌러 주세요 | `myhome/mail-feed.js` — 우편 지우기 서버 쓰기 실패(`remove` · `removeRead` failed — 읽은 우편 한꺼번에는 한 번에 실패하면 아무것도 안 지운 그대로) |
| `E-MH-12` | 소식을 올리거나 고치지 못했어요 — 관리자 권한과 연결을 확인해 주세요 | `launcher/notice-feed.js` — 관리자 소식 올리기 · 📌 고정 · 내리기 실패(`sendBroadcast` · `togglePin` · `remove` — 409 는 다시 받고 알림) |
| `E-MH-13` | 온라인 고정을 서버에 저장하지 못했어요 — 이 PC 에는 기억했어요 | `myhome/presence-lock.js` — 🔒 고정 · 고정 중 토글 저장(서버 계정 `presencePref` — `PATCH /v1/me`) |
| `E-MH-20` | 마이홈을 불러오지 못했어요 — 마이홈의 «다시 시도» 를 눌러 주세요 | `myhome/myhome-store.js` — 내 홈 받기 실패(fetchMine 던짐 · 판이 없는 답 — 마이홈을 열 때 · 다시 시도 · 409 뒤 다시 받기) |
| `E-MH-21` | 그 마이홈을 불러오지 못했어요 | `myhome/myhome-store.js` — 친구 홈 구경 받기 실패(fetchOf 던짐 — 지금 보던 집은 그대로 · 없는 사람 USER_NOT_FOUND 는 번호 없이 서버 문구 안내) |
| `E-MH-22` | 마이홈을 저장하지 못했어요 | `myhome/myhome-store.js` — 페이지 PATCH 실패(MYHOME_TEXT_TOO_LONG · MYHOME_INVALID_IMAGE_URL · MYHOME_INVALID_LINK · INVALID_REQUEST 포함 — 서버가 거절한 값은 버리고 그때마다 알림 · 망 · 5xx 실패는 이어지는 동안 한 번만) |
| `E-MH-23` | 디자인을 저장하지 못했어요 | `myhome/myhome-store.js` — 디자인 PUT 실패(MYHOME_INVALID_THEME 포함 · PREMIUM_REQUIRED 는 공통 E-NET-03) |
| `E-MH-24` | 그림을 올리지 못했어요 | `myhome/myhome-store.js` · `myhome/bookmark.js` — 그림 올리기 실패(사진 · 스티커 · 배경 · 디자인 · 책등 · IMAGE_UPLOAD 올리기 전 걸러냄 포함) |
| `E-ROOM-01` | 방 목록을 불러오지 못했어요 | `room/room-entry.js` — 랜덤 참여 · 갈아타기(`findRandomRooms`) |
| `E-ROOM-02` | 방을 옮기지 못했어요 | `room/room-entry.js` — 갈아타기 뒤 방 밖에 남음 |
| `E-ROOM-03` | 방 목록을 불러오지 못했어요 | `room/room-lobby-ui.js` — 로비 목록 사본(roomLobby/{채널}) 읽기 실패 |
| `E-ROOM-04` | 방 설정을 저장하지 못했어요 | `room/room-info-ui.js` — 방 안 [방 설정] 제목 · 공개 쓰기(`setRoomInfo`) 실패 |
| `E-ROOM-05` | 같이 듣기 곡을 바꾸지 못했어요 | `room/listen-ui.js` — DJ 의 곡 칸(`rooms/{방}/_music`) 쓰기 실패 |
| `E-ROOM-06` | 이 곡은 여기서 틀 수 없어요 | `room/listen-ui.js` — 재생 창이 곡을 못 틂(유튜브 재생 불가 · 지역 제한) |
| `E-ROOM-07` | 같이 듣기를 불러오지 못했어요 | `room/listen-ui.js` — 곡 칸(`rooms/{방}/_music`) 구독 거부 |
| `E-CHAR-01` | 프리셋을 저장하지 못했어요 | `creator/desk-preset.js` — 생성기 📐 책상 프리셋 저장 · 비우기(`tw.deskPresets`) |
| `E-CHAR-02` | 프리셋을 읽지 못했어요 | `creator/desk-preset-store.js` — 책상 프리셋 읽기 해석 실패 |
| `E-CHAR-03` | 프리셋의 책상 모델을 불러오지 못했어요 | `creator/desk-preset.js` — 프리셋 적용 중 책상 GLB 해석 실패 |
| `E-CHAR-04` | 프리셋을 저장하지 못했어요 | `character/animal.js` — 동물 프리셋 저장 · 삭제(`tw.animalPresets`) |
| `E-CHAR-05` | 프리셋을 읽지 못했어요 | `character/animal.js` — 동물 프리셋 읽기 해석 실패 |
| `E-CHAR-06` | 저장된 프리셋을 읽지 못해 덮어쓰지 않았어요 | `creator/desk-preset.js` — 책상 프리셋 저장 · 비우기를 막음(망가진 저장분 그대로 둠) |
| `E-CHAR-07` | 저장된 프리셋을 읽지 못해 덮어쓰지 않았어요 | `character/animal.js` — 동물 프리셋 저장 · 삭제를 막음(망가진 저장분 그대로 둠) |
| `E-CHAR-08` | 프리셋의 책상을 찾지 못해 기본 책상으로 열었어요 | `creator/desk-preset.js` — 프리셋 적용 중 카탈로그 책상을 못 찾음 · 못 받음(프리셋엔 카탈로그 책상 id 만 담는다) |
| `E-CHAR-09` | 로그인이 풀려 있어 뽑지 않았어요 — 다시 로그인한 뒤 뽑아 주세요(횟수는 그대로예요) | `character/gacha.js` — 내 코드 없음 · 보유분을 받기 전 · 계정이 바뀜 · 서버 길 401/403 |
| `E-CHAR-10` | 서버에 닿지 않아 뽑지 않았어요 — 인터넷 연결을 확인하고 다시 시도해 주세요(횟수는 그대로예요) | `character/gacha.js` — 서버 길 닿지 못함 · 5xx |
| `E-CHAR-11` | 서버 응답이 늦어 뽑기 결과를 확인하지 못했어요 — 잠시 뒤 보관함을 열어 확인해 주세요 | `character/gacha.js` — 뽑기 응답 시간 초과(서버엔 들어갔을 수 있음 — 보관함을 열면 다시 받음) |
| `E-CHAR-12` | 뽑기를 저장하지 못했어요 — 잠시 후 다시 시도해 주세요(횟수는 그대로예요) | `character/gacha.js` — 서버 길 서버 바쁨 · 카탈로그 준비 중 · 그 밖 4xx(`gacha-api.js` reasonOf) |
| `E-CHAR-13` | 책상 모델을 받지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요 | `character/wardrobe.js` — 꾸미기 책상 탭에서 카탈로그 책상 고르기(모델 받기 실패) |
| `E-CHAR-14` | 책상 모델을 받지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요 | `creator/desk-setup.js` — 생성기 책상 카드 고르기(모델 받기 실패) |
| `E-CHAR-15` | 가챠 보관함을 불러오지 못했어요 — 보관함에서 «다시 시도» 를 눌러 주세요 | `character/gacha.js` — 서버에서 보유분 · 뽑기 수 받기 실패(보관함을 열었거나 «다시 시도» 를 누른 받기만 알림 — 서버 신호 · 시작 때는 조용히 «못 불러왔어요» 표시) |
| `E-CHAR-16` | 보관함을 불러오지 못했어요 — 인터넷을 확인하고 «다시 시도» 를 눌러 주세요 | `character/closet.js` — 서버에서 옷장(슬롯 · 보관함) 받기 실패 · [내 정보] 보관함의 «다시 시도» 에서만 알림(시작 · 서버 신호는 조용히 «불러오는 중 / 못 불러왔어요» 표시) · 그림 받기 실패 포함 |
| `E-CHAR-17` | 캐릭터를 서버에 저장하지 못했어요 — 고친 모습은 화면에 그대로 있어요 | `character/closet.js` — 고친 칸 쓰기 실패(닿지 못함 · 서버 오류 · 그림 올리기 실패) · 이어지는 같은 실패는 한 번만 · 혼자 다시 보내지 않고 다음 고침에 다시 시도 |
| `E-CHAR-18` | 캐릭터가 너무 커서 저장하지 못했어요 — 파츠나 그림을 줄여 주세요 | `character/closet.js` — def 크기 초과(JSON 150000자 · 서버 `AVATAR_DEF_TOO_LARGE`) |
| `E-CHAR-19` | 입을 수 없는 물건이 있어 저장하지 못했어요 — 그 파츠를 벗어 주세요 | `character/closet.js` — 서버 착용 검사에 걸림(`AVATAR_ITEM_NOT_USABLE`) |
| `E-CHAR-20` | 서버에 닿지 않아 옮기지 못했어요 — 인터넷을 확인해 주세요 | `character/closet.js` — 슬롯 · 보관함 · 휴지통 · 복원 요청이 서버에 닿지 못함 |
| `E-CHAR-21` | 옮기지 못했어요 — 잠시 뒤 다시 눌러 주세요 | `character/closet.js` — 같은 요청을 서버가 못 함(그 밖의 오류) |
| `E-CHAR-22` | 캐릭터 그림을 받지 못했어요 — 네트워크를 확인해 주세요 | `character/closet.js` — 보관함에서 슬롯에 올릴 때 그림 받기 실패 |
| `E-CHAR-23` | 다른 기기에서 그 칸에 캐릭터가 먼저 생겨 저장하지 못했어요 — 서버 것을 받았어요 | `character/closet.js` — 새 캐릭터 만들기가 `AVATAR_SLOT_TAKEN` 으로 거절됨 · 서버 캐릭터를 받아 앉힌다 |
| `E-PL-01` | 플레이리스트를 저장하지 못했어요 — 고치거나 창을 다시 열면 다시 올려요 | `status/playlist.js` — 내 목록 서버 저장 실패(`_plPublishNow` · `saveMine` failed — 이어지는 동안 한 번만 알림 · 혼자 다시 올리지 않음 — 다음 고침 · 창 열기 · 끌 때 · 로그아웃 때 한 번) |
| `E-PL-02` | 파도타기는 인터넷 연결이 필요해요 | `status/playlist.js` — 🌊 파도타기 무작위 · 친구 지목에서 목록을 못 불러옴(`_plPeek` · `_plPeekFriend` — `fetchRandom` · `fetchOf` 던짐) |
| `E-LIC-01` | 라이선스 상태를 확인하지 못했어요 — 잠시 뒤 다시 해 주세요 | `account/license-premium.js` — 프리미엄 확인(`GET /v1/me`) 실패 — 사용자가 누른 키 등록 · 이 기기 해제 뒤만(켤 때 · 서버 `license` 알림으로 받다 실패하면 번호 없이 지금 값 그대로 · 혼자 다시 하지 않음 · 로그인이 풀린 실패는 알리지 않음) |
| `E-LIC-02` | 이 기기의 라이선스를 해제하지 못했어요 — 잠시 뒤 다시 해 주세요 | `account/license-screen.js` — «이 기기에서 해제» 버튼의 서버 기기 빼기(`DELETE /v1/me/license/devices/{id}`) 실패(프리미엄은 그대로 · 로그인이 풀린 실패는 알리지 않음) |
| `E-LIC-03` | 라이선스 정보를 불러오지 못했어요 | `account/license-screen.js` — 설정 › 라이선스 열기 · [다시 시도] 의 내 라이선스 받기(`GET /v1/me/license`) 실패(사용자가 연 받기만 · 서버 `license` 알림으로 받다 실패하면 번호 없이 «못 불러왔어요» 화면만 · 이어지는 같은 실패는 한 번 · 로그인이 풀린 실패는 알리지 않음) |
| `E-LIC-04` | 기기를 빼지 못했어요 — 잠시 뒤 다시 해 주세요 | `account/license-screen.js` — 기기 목록의 다른 기기 [빼기](`DELETE /v1/me/license/devices/{id}`) 실패(목록은 그대로 · 로그인이 풀린 실패는 알리지 않음) |
| `E-LIC-05` | 이 기기를 등록하지 못했어요 — 잠시 뒤 다시 해 주세요 | `account/license-screen.js` — [이 기기 등록](`PUT /v1/me/license/devices/{id}`) 실패(기기를 모두 썼다는 거절은 번호 없이 «하나를 빼 주세요» 안내 · 로그인이 풀린 실패는 알리지 않음) |
| `E-LIC-06` | 라이선스를 등록하지 못했어요 — 잠시 뒤 다시 해 주세요 | `account/license-screen.js` — 키 [확인](`POST /v1/me/license`)의 사용자가 고칠 수 없는 실패(네트워크 · 서버 오류 · 응답 모양). 없는 키 · 남의 키 · 회수된 키 · 이미 라이선스 있음 · 기기 가득은 번호 없이 입력칸 아래 문구 |
| `E-LIC-07` | 시크릿룸을 발급하지 못했어요 — 잠시 뒤 다시 해 주세요 | `admin/admin-license-bulk.js` — 관리자 시크릿룸 [발급](`POST /v1/admin/secret-rooms`)의 사용자가 고칠 수 없는 실패(네트워크 · 서버 오류). 없는 친구코드 · 남이 가진 코드(경고) · 입력 오류 · 로그인 필요는 번호 없이 발급 칸 아래 문구 |
| `E-GIFT-01` | 말랑이를 불러오지 못했어요 | `myhome/mallang-store.js` — 내 칸(`GET /v1/me/mallangs` — 마이홈 열기 · 등록 창 [다시 시도] · 못 받은 폴더 누름) · 보는 집 칸(`GET /v1/mallangs/{code}` — 친구 홈 구경 · 내 집으로) 받기 실패(그 사람이 없음은 번호 없이 «말랑이 없음» · 혼자 다시 받지 않음) |
| `E-GIFT-02` | 말랑이 그림을 올리지 못했어요 | `myhome/mallang-store.js` — 등록 ① 그림 올리기(`POST /v1/me/images?purpose=mallang`) 실패 · 형식 · 크기 거절(`IMAGE_UPLOAD`) — 칸은 그대로 |
| `E-GIFT-03` | 말랑이를 저장하지 못했어요 | `myhome/mallang-store.js` — 등록 ② · 켜고 끄기 · 지우기의 칸 저장(`PUT /v1/me/mallangs` — `GIFT_MALLANG_INVALID` 포함 · 409 는 번호 없이 다시 받기) 실패(이어지는 동안 한 번만 · 고친 화면은 그대로 · 혼자 다시 보내지 않음 — 다음 고침 · 로그아웃 · 앱 끄기 때 한 번) |
| `E-GIFT-07` | 내 말랑이를 불러오지 못해 선물 창을 열지 못했어요 | `myhome/mallang-store.js` — 친구 줄 우클릭 선물 보내기 창(`mallang.js` `openGift`)을 열 때 내 칸 받기(`pullMine` site `sendOpen` — `GET /v1/me/mallangs`) 실패 · 창을 열지 않음 |
| `E-FOCUS-01` | 포커스 기록을 불러오지 못했어요 | `focus/focus-progress.js` — 서버 진척 받기 실패(GET /v1/me/focus) · 내 정보 · 포커스 기록창을 열 때 못 받은 상태면 다시 받다 실패한 때만 알림(시작 때의 실패는 조용히 «못 불러옴» 상태) |
| `E-FOCUS-02` | 집중 시간을 서버에 올리지 못했어요 — 다음에 같이 올릴게요 | `focus/focus-progress.js` — 집중 시간 올리기 실패(POST /v1/me/focus/accruals) · 이어지는 같은 실패는 한 번만(성공하면 풀림) · 혼자 다시 보내지 않고 다음 올리는 때(10분 · 레벨 경계 · 집중 끝 · 로그아웃 · 켤 때)에 |
| `E-FOCUS-03` | 별 색을 저장하지 못했어요 | `focus/focus-progress.js` — 별 색 저장 실패(PATCH /v1/me/focus) · 서버가 아는 이전 색으로 되돌림 |
| `E-FOCUS-04` | 달성표를 불러오지 못했어요 | `focus/chal-store.js` — 달성표 받기 실패(GET /v1/me/focus/challenges/current · 지난 주) · 사용자가 서랍을 열거나 [다시 시도] 할 때만 알림(시작 · 하루 경계의 실패는 조용히 «못 불러옴») |
| `E-FOCUS-05` | 달성표를 저장하지 못했어요 | `focus/chal-store.js` — 달성표 시작 · 수정 · 자동 · 포기 저장 실패(PUT /v1/me/focus/challenges/{주} — 409 는 번호 없이 받아 와서 알림) |
| `E-FOCUS-06` | 오늘 달성을 적지 못했어요 | `focus/chal-store.js` — 오늘 달성 적기 실패(POST /v1/me/focus/challenges/today) · 이어지는 같은 실패는 한 번 · 혼자 다시 보내지 않고 서랍 [다시 적기] 로 |
| `E-FOCUS-07` | 달성표 보상을 받지 못했어요 | `focus/chal-store.js` — 보상 칸 받기 실패(POST /v1/me/focus/challenges/{주}/rewards/{칸}) · NOT_YET · NOTHING 은 조용히 · 이어지는 같은 실패는 한 번 · 서랍 [보상 받기] 로 |
| `E-FOCUS-08` | 폰 연결 키를 만들지 못했어요 | `focus/focus-api.js` 길 — 폰 연결 새 키 만들기(POST /v1/me/focus/mobile-link) |
| `E-FOCUS-09` | 폰 연결을 끊지 못했어요 | `focus/focus-api.js` 길 — 폰 연결 끊기(DELETE /v1/me/focus/mobile-link) |
| `E-BUG-01` | 제보 목록을 불러오지 못했어요 | `support/bug-board-ui.js` — 버그제보 탭 목록 · 필터 · [다음]/[이전] · [다시 시도](`GET /v1/bugs` — 기능 갈래도 공통 code(`api-errors.js`)도 아닌 실패 · «목록을 불러오지 못했어요 [다시 시도]» · 다시 보내지 않음 · 공지 받기 실패는 번호 없이 공지 칸만 비움) |
| `E-BUG-02` | 제보를 불러오지 못했어요 | `support/bug-board-ui.js` — 글 열기 · 우편함 «가기» · [다시 시도](`GET /v1/bugs/{number}` — 없는 글 · 남의 비공개 글은 번호 없이 «없음» · «비공개» 화면) |
| `E-BUG-03` | 제보를 올리지 못했어요 | `support/bug-board-ui.js` — 글쓰기 [등록](`POST /v1/bugs` — 하루 상한 · 공지 조건은 번호 없이 안내 · 입력은 그대로 · 다시 보내지 않음) |
| `E-BUG-04` | 답글을 올리지 못했어요 | `support/bug-board-ui.js` — 내 글 [답글 등록](`POST /v1/bugs/{number}/replies` — 10초 간격 · 글쓴이 아님 · 공지는 번호 없이 안내) |
| `E-BUG-05` | 공감을 남기지 못했어요 | `support/bug-board-ui.js` — 👍 나도 겪었어요(`PUT /v1/bugs/{number}/like` — 버튼 다시 켬 · 다시 보내지 않음) |
| `E-BUG-06` | 공개 범위를 바꾸지 못했어요 | `support/bug-board-ui.js` — 내 글 «🔒 비공개로 / 🌐 공개로 바꾸기»(`PATCH /v1/bugs/{number}/visibility` — 답변이 달림 · 글쓴이 아님은 번호 없이 안내 · 그사이 바뀜(`CONCURRENT_UPDATE`)은 글 다시 받기) |
| `E-BUG-07` | 오늘 남은 제보 수를 불러오지 못했어요 | `support/bug-board-ui.js` — 글쓰기를 열 때 «오늘 N건 남음»(`GET /v1/me/bugs/quota` — [등록] 은 켜 둔다 · 상한은 서버가 [등록] 때 다시 본다) |
| `E-BUG-20` | 답변을 올리지 못했어요 | `support/bug-board-ui.js` — 관리자 [답변 등록](`POST /v1/admin/bugs/{number}/answers` — 다른 관리자가 먼저 답함(BUG_ANSWER_CONFLICT)은 번호 없이 글 다시 받기 · 비공개 글의 공개 답변(BUG_PRIVATE_ANSWER_ONLY)은 번호 없이 안내 · 쓴 글은 칸에 둠 · 다시 보내지 않음) |
| `E-BUG-21` | 오픈카톡 링크를 불러오지 못했어요 | `support/bug-board-ui.js` — 관리자 [🔗 오픈카톡 링크] 폼 열기(GET /v1/admin/config 의 bug.report 줄 — 폼은 안 엶) |
| `E-BUG-22` | 오픈카톡 링크를 저장하지 못했어요 | `support/bug-board-ui.js` — 관리자 링크 폼 [저장](`PUT /v1/admin/config/bug.report` — 그사이 바뀜(CONCURRENT_UPDATE)은 번호 없이 다시 받아 칸 채움 · 주소 모양이 안 맞음(OPS_INVALID_VALUE) 포함) |
| `E-RPT-01` | 신고하지 못했어요 — 잠시 뒤 다시 해 주세요 | `support/report.js` — 신고 창 [신고] 서버 쓰기 실패(`POST /v1/reports` — 기능 갈래(`report-api.js` `failOf`)도 공통 code(`api-errors.js`)도 아닌 실패 · 숨기지 않고 [신고] 다시 켬 · 다시 보내지 않음) |
| `E-ADM-30` | 신고 목록을 불러오지 못했어요 | `admin/admin-report.js` — 🚩 신고 목록 열기 · [다시 시도] · [더 보기](`GET /v1/admin/reports` — 기능 갈래도 공통 code(`api-errors.js`)도 아닌 실패 · 열 때 · 다시 시도는 «못 불러왔어요 [다시 시도]» · 다시 보내지 않음) |
| `E-ADM-31` | 신고를 비우지 못했어요 | `admin/admin-report.js` — [문제없음](`POST /v1/admin/reports/dismissals` — 그 사람 줄이 ok 가 아님 포함 · [문제없음] 다시 켬) |
| `E-ADM-32` | 자리비움 그림을 내리지 못했어요 | `admin/admin-report.js` — [그림 내리기](`POST /v1/admin/reports/{target}/take-down` — `REPORT_IMAGE_CHANGED` 는 번호 없이 목록 다시 받기 · 그 밖 실패 · [그림 내리기] 다시 켬) |
| `E-GB-01` | 방명록을 불러오지 못했어요 — 창의 «다시 시도» 를 눌러 주세요 | `myhome/guestbook-feed.js` — 방명록 받기 실패(`fetchView` 던짐 — 창을 열 때 · «다시 시도» 를 누를 때(연 · 누른 받기에서만) · 이어지는 동안 한 번만 알림) |
| `E-GB-02` | 방명록 글은 1~100자예요 | `myhome/guestbook-feed.js` — 글 쓰기를 서버가 거절(`GUESTBOOK_TEXT_INVALID`) |
| `E-GB-03` | 친구만 방명록을 남길 수 있어요 | `myhome/guestbook-feed.js` — 글 쓰기를 서버가 거절(`GUESTBOOK_NOT_FRIEND` — 받아 둔 `canWrite` 가 낡았을 때) |
| `E-GB-04` | 내가 쓴 글만 지울 수 있어요 | `myhome/guestbook-feed.js` — 글 지우기를 서버가 거절(`GUESTBOOK_NOT_AUTHOR`) |
| `E-GB-05` | 폭죽은 이모지 한 글자예요 | `myhome/guestbook-feed.js` — 폭죽 바꾸기를 서버가 거절(`GUESTBOOK_EMOJI_INVALID`) |
| `E-GB-06` | 웹박수 이미지로 쓸 수 없는 그림이에요 — png · jpg · webp 그림으로 다시 골라 주세요 | `myhome/guestbook-feed.js` — 박수 그림을 서버가 거절(`IMAGE_INVALID` · `UNSUPPORTED_MEDIA_TYPE` · `GUESTBOOK_IMAGE_INVALID`) 또는 형식이 맞지 않아 올리기 전에 걸러냄 |
| `E-GB-07` | 웹박수 그림이 너무 커요 — 512KB 이하로 다시 골라 주세요 | `myhome/guestbook-feed.js` — 박수 그림이 상한(512KB)을 넘음(`PAYLOAD_TOO_LARGE` — 올리기 전 걸러냄 포함) |
| `E-NET-01` | 로그인이 풀렸어요 — 다시 로그인해 주세요 | `shared/api-errors.js` — 공통 `AUTH_REQUIRED` · 토큰 없음(`NO_TOKEN`) |
| `E-NET-02` | 이 작업을 할 권한이 없어요 | `shared/api-errors.js` — 공통 `ACCESS_DENIED` |
| `E-NET-03` | 프리미엄에서 쓸 수 있는 기능이에요 | `shared/api-errors.js` — 공통 `PREMIUM_REQUIRED`(이 기기 판정 — `X-Device-Id`) |
| `E-NET-04` | 요청이 너무 잦아요 — 잠시 뒤 다시 해 주세요 | `shared/api-errors.js` — 공통 `TOO_MANY_REQUESTS`(`Retry-After`) |
| `E-NET-05` | 다른 곳에서 먼저 바뀌었어요 — 다시 시도해 주세요 | `shared/api-errors.js` — 공통 `CONCURRENT_UPDATE`(다시 받고 한 번 더) |
| `E-NET-06` | 요청 모양이 맞지 않아 처리하지 못했어요 | `shared/api-errors.js` — 공통 `INVALID_REQUEST` · `METHOD_NOT_ALLOWED` · `UNSUPPORTED_MEDIA_TYPE` · `PAYLOAD_TOO_LARGE` |
| `E-NET-07` | 서버에 닿지 못했어요 — 인터넷 연결을 확인하고 다시 해 주세요 | `shared/api-errors.js` — 닿지 못함(네트워크 · 시간 초과 · 5xx · 사본 없음) |
| `E-NET-08` | 서버에서 처리하지 못했어요 — 잠시 뒤 다시 해 주세요 | `shared/api-errors.js` — 표에 없는 code(기능 표 · 공통 표 둘 다 없음) |
| `E-RT-01` | 로그인이 풀렸어요 — 다시 로그인해 주세요 | `realtime/rt-status-ui.js` — realtime 서버가 4001(토큰)로 두 번 닫음(ready 전 error auth 포함) → 로그인 화면 |
| `E-RT-02` | 계정이 이 기기에서 로그아웃됐어요 | `realtime/rt-status-ui.js` — realtime 서버가 4007(탈퇴 · 정지 · 관리자 강제 로그아웃)로 닫음 → 로그아웃 처리 · 로그인 화면 |
| `E-RT-03` | 서버 연결이 끊겼어요 | `realtime/rt-status-ui.js` — realtime 서버가 모르는 4000번대 번호로 닫음(멈춤) — 런처 위 띠에 [다시 연결] |

## 걷은 번호
| 번호 | 사용자 문구 | 언제 · 왜 |
|---|---|---|
| `E-DATA-01` | 이 작업을 할 권한이 없어요 | 0.13 · 범용 데이터 통로(`data-gateway.js`)를 걷음 — 서버 오류는 `api-errors.js`(E-NET) · 옛: 서버 범용 통로 `ACCESS_DENIED` |
| `E-DATA-02` | 요청 모양이 맞지 않아 처리하지 못했어요 | 0.13 · 범용 데이터 통로(`data-gateway.js`)를 걷음 — 서버 오류는 `api-errors.js`(E-NET) · 옛: 서버 범용 통로 `INVALID_REQUEST` |
| `E-DATA-03` | 다른 곳에서 먼저 바뀌었어요 — 다시 시도해 주세요 | 0.13 · 범용 데이터 통로(`data-gateway.js`)를 걷음 — 서버 오류는 `api-errors.js`(E-NET) · 옛: 서버 범용 통로 `CONCURRENT_UPDATE` |
| `E-DATA-04` | 서버에서 처리하지 못했어요 — 잠시 후 다시 시도해 주세요 | 0.13 · 범용 데이터 통로(`data-gateway.js`)를 걷음 — 서버 오류는 `api-errors.js`(E-NET) · 옛: 서버 범용 통로 모르는 code |
