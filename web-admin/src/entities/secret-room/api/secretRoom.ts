import type { Db } from '@/shared/api';
import { OWNER_NAME_MAX, type SecretRoomPub } from '../model/secretRoom';

// secretRooms/{코드} 쓰기는 admins 가 아니라 발급 열쇠로 막혀 있다(규칙: newData.k === srKey/v, srKey 는 아무도 못 읽음).
// 열쇠는 부르는 쪽이 화면 입력에서 바로 넘긴다 — 여기서도 어디에 남기지 않는다.
// 노드를 지울 수 없어(삭제에는 k 가 없다) 항상 set 으로 통째 갈아 끼운다.

/** pub 만 누구나 읽을 수 있다. 읽지 못하면 null(빈 코드로 본다 — 앱과 같다). */
export async function getSecretRoomPub(db: Db, code: string): Promise<SecretRoomPub | null> {
  try {
    return await db.get<SecretRoomPub>(`secretRooms/${code}/pub`);
  } catch {
    return null;
  }
}

/** 발급 · 연장 · 영구 전환. set 이라 expMs 없이 부르면 기존 exp 가 사라진다 — 같은 코드로 영구 재발급이 그 뜻이다. */
export function issueSecretRoom(
  db: Db,
  code: string,
  owner: { uid: string; name: string },
  key: string,
  expMs: number,
  now: number = Date.now(),
): Promise<void> {
  const pub: SecretRoomPub = { owner: owner.uid, name: owner.name.slice(0, OWNER_NAME_MAX), ts: now };
  if (expMs > 0) pub.exp = Math.floor(expMs);
  return db.set(`secretRooms/${code}`, { k: key, pub });
}

/**
 * 만료 — 회수(owner 비우기)가 아니라 exp 만 지금으로 내린다. 입장 안내가 자연스럽고, 같은 코드로 재발급해 되살릴 수 있다.
 * 입장 게이트가 `now > exp` 라 같은 밀리초면 통과하므로 1초 과거로 내린다. 발급된 적 없는 코드면 false.
 */
export async function expireSecretRoom(
  db: Db,
  code: string,
  key: string,
  now: number = Date.now(),
): Promise<boolean> {
  const pub = await db.get<SecretRoomPub>(`secretRooms/${code}/pub`);
  if (!pub?.owner) return false;
  await db.set(`secretRooms/${code}`, { k: key, pub: { ...pub, exp: now - 1000 } });
  return true;
}

/** 이 사용자에게 마지막으로 준 코드 — 소유의 증거는 아니다(그새 다른 사람에게 재발급됐을 수 있다). */
export async function getUserSecretRoom(db: Db, uid: string): Promise<string | null> {
  try {
    return await db.get<string>(`users/${uid}/secretRoom`);
  } catch {
    return null;
  }
}

/** 받는 앱의 참여 화면이 이 값으로 코드를 채운다. 규칙상 계정에 연결된 사용자 칸은 관리자도 못 쓴다 — 실패하면 false. */
export async function setUserSecretRoom(db: Db, uid: string, code: string): Promise<boolean> {
  try {
    await db.set(`users/${uid}/secretRoom`, code);
    return true;
  } catch {
    return false;
  }
}
