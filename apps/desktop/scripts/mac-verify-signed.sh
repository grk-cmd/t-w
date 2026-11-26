#!/usr/bin/env bash
# 맥 앱 번들이 우리 Developer ID 로 서명되고 공증 티켓이 붙었는가 — release.yml 이 빌드 뒤 · dmg 안 · zip 안 앱에 돌린다.
# electron-builder 는 공증 값이 없으면 말없이 공증을 건너뛰고, 인증서가 없으면 서명도 건너뛴다(afterPack ad-hoc 서명만 남는다).
# 두 경우 모두 빌드는 초록이라 여기서 멈춘다.
# 사용: mac-verify-signed.sh <앱.app> <팀 ID>
set -euo pipefail
APP=${1:?앱 경로}
TEAM=${2:?팀 ID}

codesign --verify --deep --strict "$APP" \
  || { echo "::error::$APP 서명이 어긋났다 — «손상되었기 때문에 열 수 없습니다» 로 막힌다"; exit 1; }

INFO=$(codesign -dv --verbose=2 "$APP" 2>&1)
GOT_TEAM=$(printf '%s\n' "$INFO" | sed -n 's/^TeamIdentifier=//p')
[ "$GOT_TEAM" = "$TEAM" ] \
  || { echo "::error::$APP 서명 팀이 ${GOT_TEAM:-없음} 이다 (기대 $TEAM) — Developer ID 로 서명되지 않았다"; exit 1; }
printf '%s\n' "$INFO" | grep -q '^Authority=Developer ID Application:' \
  || { echo "::error::$APP 서명이 Developer ID Application 인증서가 아니다"; exit 1; }
printf '%s\n' "$INFO" | grep -q 'flags=.*runtime' \
  || { echo "::error::$APP 에 hardened runtime 이 없다 — 공증이 거절한다"; exit 1; }

# 공증 티켓이 앱에 붙어 있어야(staple) 처음 여는 맥이 인터넷 없이도 통과한다.
xcrun stapler validate "$APP" >/dev/null \
  || { echo "::error::$APP 에 공증 티켓이 없다 — 공증을 건너뛰었거나 실패했다(APPLE_API_KEY* 확인)"; exit 1; }

echo "서명 · 공증 확인: $APP (팀 $GOT_TEAM)"
