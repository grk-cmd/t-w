import { NO_NAME, realName } from '@/shared/lib';

/** 사람 이름 — 이름이 없으면 NO_NAME 을 soft 스타일로 그려 실제 이름과 구별한다. */
export function PersonName({ name }: { name: string | null | undefined }) {
  const n = realName(name);
  return n ? <>{n}</> : <span className="soft">{NO_NAME}</span>;
}
