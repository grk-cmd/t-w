import { adminUid, expect, test } from './fixtures';
import { dbGet, dbSetAs, PROJECT, signUpUser } from './support/emulator';

// 규칙 잠금 A(RULES_LOCK_PLAN) — «안 묶인 uid 는 누구나 쓴다» 갈래를 걷은 뒤 실제 규칙 엔진(에뮬레이터)에서 확인한다.
// 앱이 쓰는 칸 몇 곳을 골라 주인 · 다른 사람 · 로그인 없음 · 관리자로 써 본다. 식 전체는 checks/sim-rules-lock-unbound.js 가 본다.

const NS = `${PROJECT}-default-rtdb`;
/** 로그인 없이(토큰 없이) 쓰기 — 옛 앱 · 로그인 안 한 기기 · 폰 연결 페이지가 이렇다. */
async function dbSetAnon(path: string, value: unknown): Promise<number> {
  const res = await fetch(`http://127.0.0.1:9000/${path}.json?ns=${NS}`, {
    method: 'PUT',
    body: JSON.stringify(value),
  });
  return res.status;
}

const NOW = { '.sv': 'timestamp' };
const KEY = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // mobileKeys 모양 — [A-Z2-9]{24}

// 경로 → 규칙을 통과하는 값(모양 검사에 걸려서 거부되는 일이 없게)
const CASES: [string, (uid: string) => string, unknown][] = [
  ['profile', (u) => `users/${u}/profile`, { name: '테스터' }],
  ['presence', (u) => `users/${u}/presence`, { online: true, lastSeen: 1 }],
  ['friendCode', (u) => `users/${u}/friendCode`, 'MATE-AB12'],
  ['awaySz', (u) => `users/${u}/awaySz`, 80],
  ['bugSeen', (u) => `users/${u}/bugSeen/p1`, 1],
  ['leaderboard', (u) => `leaderboard/${u}`, { sec: 10, ts: 1 }],
  ['mobileKeys', (u) => `mobileKeys/${u}`, KEY],
  ['mobileLink live', (u) => `mobileLink/${u}/live`, { at: NOW }],
  ['inbox', (u) => `inbox/${u}/m1`, { tag: 'notice', title: '알림', ts: 1 }],
];

test.describe('규칙 잠금 A — 안 묶인 uid 갈래 없음', () => {
  test('묶인 주인만 쓴다 · 다른 사람 · 로그인 없음 · 익명은 거부 · 안 묶인 uid 에는 아무도', async ({
    seed,
  }) => {
    const owner = await signUpUser(`lock-owner-${Date.now()}@e2e.test`);
    const other = await signUpUser(`lock-other-${Date.now()}@e2e.test`);
    await seed({ userAuth: { UBOUND: owner.uid, UOTHER: other.uid } });

    for (const [name, path, value] of CASES) {
      expect(await dbSetAs(owner.idToken, path('UBOUND'), value), `${name} · 주인`).toBe(200);
      expect(await dbSetAs(other.idToken, path('UBOUND'), value), `${name} · 다른 사람`).toBe(401);
      expect(await dbSetAnon(path('UBOUND'), value), `${name} · 로그인 없음`).toBe(401);
      // 예전에는 여기가 열려 있었다 — 아무 계정에도 안 묶인 uid 는 누구든(로그인 없이도) 썼다
      expect(await dbSetAnon(path('UNBOUND'), value), `${name} · 안 묶인 uid · 로그인 없음`).toBe(401);
      expect(await dbSetAs(owner.idToken, path('UNBOUND'), value), `${name} · 안 묶인 uid · 남`).toBe(401);
    }
    expect(await dbGet('users/UNBOUND')).toBeNull();
  });

  test('관리자 — 관리자 갈래가 있는 곳(secretRoom · invite · inbox)만 남의 칸에 쓴다', async ({ seed }) => {
    const owner = await signUpUser(`lock-o2-${Date.now()}@e2e.test`);
    const admin = await signUpUser(`lock-admin-${Date.now()}@e2e.test`);
    await seed({ admins: { [adminUid()]: true, [admin.uid]: true }, userAuth: { UBOUND: owner.uid } });

    // 시크릿룸 발급(웹 관리자 setUserSecretRoom) — 잠그며 관리자 갈래를 넣었다
    expect(await dbSetAs(admin.idToken, 'users/UBOUND/secretRoom', 'SCRT-AB12')).toBe(200);
    expect(await dbSetAs(admin.idToken, 'users/UNBOUND/secretRoom', 'SCRT-AB12')).toBe(200);
    expect(await dbSetAs(admin.idToken, 'inbox/UBOUND/m1', { tag: 'reward', title: '키', ts: 1 })).toBe(200);
    expect(await dbSetAs(admin.idToken, 'users/UBOUND/invite', { invitesLeft: 0 })).toBe(200);
    // 관리자라도 주인 칸(프로필)은 못 쓴다
    expect(await dbSetAs(admin.idToken, 'users/UBOUND/profile', { name: '관리자' })).toBe(401);
  });

  test('폰 연결 페이지(로그인 없음) — 키가 맞고 PC 가 켜져 있으면 state 를 쓴다', async ({ seed }) => {
    const owner = await signUpUser(`lock-o3-${Date.now()}@e2e.test`);
    await seed({ userAuth: { UBOUND: owner.uid }, mobileKeys: { UBOUND: KEY } });
    const state = { on: true, app: '테스트', ts: NOW, key: KEY };

    expect(await dbSetAnon('mobileLink/UBOUND/state', state), 'PC 꺼짐(live 없음)').toBe(401);
    expect(await dbSetAs(owner.idToken, 'mobileLink/UBOUND/live', { at: NOW })).toBe(200);
    expect(await dbSetAnon('mobileLink/UBOUND/state', state), '키 맞음 · PC 켜짐').toBe(200);
    expect(await dbSetAnon('mobileLink/UBOUND/state', { ...state, key: 'X'.repeat(24) }), '키 틀림').toBe(
      401,
    );
  });
});
