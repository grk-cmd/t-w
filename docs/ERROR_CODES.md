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
- 같은 번호는 10초 안에 토스트를 한 번만 띄운다(진단 기록에는 매번 남는다).

## 영역
| 영역 | 뜻 |
|---|---|
| `ACC` | 계정 · 로그인 · 초대 |
| `FR` | 친구 · 친구 요청 |
| `MH` | 마이홈 · 방명록 · 우편 |
| `ROOM` | 방 입장 · 나가기 · 방 목록 |
| `CHAT` | 채팅 |
| `CHAR` | 캐릭터 · 꾸미기 · 가챠 |
| `FOCUS` | 포커스 · 레벨 |
| `DATA` | 범용 데이터 통로(서버로 옮긴 경로) |
| `SYS` | 그 밖 |

## 번호
| 번호 | 사용자 문구 | 어디서 |
|---|---|---|
| `E-SYS-01` | 알 수 없는 오류가 났어요 | (예비) 표에 없는 번호를 불렀을 때 |
| `E-FR-01` | 친구 요청을 수락하지 못했어요 | `myhome/friend-manage.js` — 요청 팝업 · 받은 요청 [수락] |
| `E-FR-02` | 친구 요청을 거절하지 못했어요 | `myhome/friend-manage.js` — 요청 팝업 · 받은 요청 [거절] |
| `E-FR-03` | 보낸 친구 요청을 취소하지 못했어요 | `myhome/friend-manage.js` — 보낸 요청 [취소] |
| `E-FR-04` | 선택한 친구 요청 일부를 처리하지 못했어요 | `myhome/friend-manage.js` — 받은 요청 일괄 수락 · 거절 |
| `E-MH-01` | 도움말을 불러오지 못했어요 — 인터넷 연결을 확인하고 다시 시도해 주세요 | `myhome/help-tab.js` — 도움말 탭 틀에서 페이지 알림이 시간 안에 안 옴(`LOAD_MS`) |
| `E-MH-02` | 온라인 고정을 서버에 저장하지 못했어요 — 이 PC 에는 기억했어요 | `myhome/presence-lock.js` — 🔒 고정 · 고정 중 토글 저장(`savePresencePref` · `presencePref/{uid}`) |
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
| `E-CHAR-09` | 로그인이 풀려 있어 뽑지 않았어요 — 다시 로그인한 뒤 뽑아 주세요(횟수는 그대로예요) | `character/gacha.js` — 뽑기 서버 저장 거부 · 내 코드 없음 |
| `E-CHAR-10` | 서버에 닿지 않아 뽑지 않았어요 — 인터넷 연결을 확인하고 다시 시도해 주세요(횟수는 그대로예요) | `character/gacha.js` — 뽑기 전 연결 확인 실패 |
| `E-CHAR-11` | 서버 응답이 늦어 뽑기 결과를 확인하지 못했어요 — 잠시 뒤 보관함을 열어 확인해 주세요 | `character/gacha.js` — 뽑기 트랜잭션 시간 초과(늦게 붙으면 사본에 합침) |
| `E-CHAR-12` | 뽑기를 저장하지 못했어요 — 잠시 후 다시 시도해 주세요(횟수는 그대로예요) | `character/gacha.js` — 뽑기 트랜잭션 오류 |
| `E-DATA-01` | 이 작업을 할 권한이 없어요 | `shared/data-gateway.js` — 서버 범용 통로 `ACCESS_DENIED` |
| `E-DATA-02` | 요청 모양이 맞지 않아 처리하지 못했어요 | `shared/data-gateway.js` — 서버 범용 통로 `INVALID_REQUEST` |
| `E-DATA-03` | 다른 곳에서 먼저 바뀌었어요 — 다시 시도해 주세요 | `shared/data-gateway.js` — 서버 범용 통로 `CONCURRENT_UPDATE` |
| `E-DATA-04` | 서버에서 처리하지 못했어요 — 잠시 후 다시 시도해 주세요 | `shared/data-gateway.js` — 서버 범용 통로 모르는 code |

## 걷은 번호
(아직 없음)
