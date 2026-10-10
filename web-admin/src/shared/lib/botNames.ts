/*
 * 사람이 아닌 쓴이 — Cloud Function 이 Admin SDK 로 쓸 때 updatedBy · adminLog.by 에 넣는 고정 uid.
 * functions/todo-merge.js BOT_UID 와 같아야 한다.
 */
export const BOT_NAMES: Readonly<Record<string, string>> = {
  'github-merge': 'GitHub 머지',
};

export const botName = (uid: string): string | undefined =>
  Object.hasOwn(BOT_NAMES, uid) ? BOT_NAMES[uid] : undefined;
