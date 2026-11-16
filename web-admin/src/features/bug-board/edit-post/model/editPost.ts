export type EditResult = { ok: true } | { ok: false; reason: string };

/** 확인 문구 — 공개 → 비공개면 이미 보낸 우편함 알림 속 제목은 남는다는 것까지. */
export function editAsk(label: string, changes: string[], toPrivate: boolean): string {
  const tail = toPrivate
    ? '\n공개 답변도 비공개로 옮겨요. 이미 보낸 우편함 알림 속 제목은 그대로 남아요.'
    : '';
  return `${label} 제보를 고칠까요? (${changes.join(' · ')})${tail}`;
}
