export {
  findUserByFriendCode,
  friendCodeCandidates,
  getUserFocusSec,
  getUserFriendCode,
  getUserLastSeen,
  getUserName,
  getUserPresence,
  listFriendCodes,
  useFriendCodes,
  useUserFocusSec,
  useUserName,
  userPresenceQuery,
  useUserPresence,
  type Presence,
} from './api/user';
export {
  awayImgRemoveWrite,
  getUserBrief,
  isAwayImgUrl,
  useForgetAwayImg,
  useRefreshUserBrief,
  useUserBrief,
  type UserBrief,
} from './api/brief';
export {
  buildUserRows,
  isBadLicense,
  LICENSE_LABEL,
  licenseUseCounts,
  realName,
  sameLicenseUsers,
  type UserLicense,
  type UserRow,
} from './model/userRow';
export {
  ACTIVE_DAYS,
  compareVerDesc,
  matchesVer,
  OLD_VER_LABEL,
  verLabel,
  versionCounts,
  type VersionCount,
} from './model/version';
