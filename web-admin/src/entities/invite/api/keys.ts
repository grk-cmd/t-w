/** 쿼리 키 — 훅 · Firebase 판이 같이 쓴다. API 판 번들이 `firebase.ts` 를 끌고 가지 않게 따로 둔다. */
export const GROUP_INVITES_KEY = ['groupInvites'];
export const invitesLeftKey = (uid: string) => ['invitesLeft', uid];
export const USER_INVITE = 'userInvite';
export const userInviteKey = (uid: string) => [USER_INVITE, uid];
