import { clearReportsWrite } from '@/entities/report';
import { awayImgRemoveWrite } from '@/entities/user';
import type { Db, Files } from '@/shared/api';

export type TakeDownResult = { ok: true; fileDeleted: boolean } | { ok: false; reason: 'changed' };

/**
 * 자리비움 그림 내리기 — 앱과 같이 DB 를 먼저 지우고 Storage 파일은 그다음.
 * 거꾸로 하면 DB 가 실패했을 때 모두의 화면에 깨진 그림 주소가 남는다. 이 순서면 최악이 «주인 없는 파일 하나» 다.
 * 그림 칸과 신고 비우기는 한 묶음이라, 실패하면 둘 다 그대로이고 파일도 건드리지 않는다.
 * 목록을 연 뒤 주인이 그림을 바꿨으면 새 그림을 지우지 않도록 멈춘다.
 */
export async function takeDownAwayImg(
  db: Db,
  files: Files,
  target: string,
  shownUrl: string,
): Promise<TakeDownResult> {
  const current = await db.get<unknown>(`users/${target}/awayImg`);
  if (current !== shownUrl) return { ok: false, reason: 'changed' };

  await db.commit({ ...awayImgRemoveWrite(target), ...clearReportsWrite(target) });

  try {
    await files.deleteByUrl(shownUrl);
    return { ok: true, fileDeleted: true };
  } catch {
    return { ok: true, fileDeleted: false };
  }
}

/** 문제없음 — 신고만 비운다. */
export function dismissReports(db: Db, target: string): Promise<void> {
  return db.commit(clearReportsWrite(target));
}
