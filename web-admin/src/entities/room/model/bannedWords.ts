// 방 제목 금칙어 목록 — 여기는 목록 고치기와 안내만 한다(서버 설정 키 `room.bannedWords`).
// 판정(NFKC · 소문자 · 글자만 남기고 부분 일치)은 앱 shared/banned-words.js 와 realtime 서버(domain/bannedWords.ts)가 같은 규칙으로 한다.
// 상한은 서버 키 표(SettingKey ROOM_BANNED_WORDS — 500개 · 낱말 1~20자) · realtime BANNED_MAX(500)와 같다.
export const BANNED_WORD_MAX_LEN = 20;
export const BANNED_WORDS_MAX = 500;

// 판정이 비교하는 모양 — 안내(글자 없음 · 한 글자)를 판정과 같은 뜻으로 내려고 같은 단계를 밟는다.
const lettersOf = (w: string): string[] => [
  ...w
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}]/gu, ''),
];

export type BannedWordsInput = {
  words: string[];
  /** 21자 이상 — 저장할 수 없다 */
  tooLong: string[];
  /** 글자(한글 · 영문 등)가 하나도 없어 판정에서 걸리지 않는다 — 숫자 · 기호만 */
  noLetter: string[];
  /** 한 글자 — 부분 일치라 그 글자가 든 제목을 다 막는다 */
  oneLetter: string[];
};

/** 입력 글(줄 · 쉼표로 나눔) → 저장할 낱말과 알릴 것. 앞뒤 공백을 걷고 겹치는 낱말은 하나로. */
export function parseBannedInput(text: string): BannedWordsInput {
  const words: string[] = [];
  const tooLong: string[] = [];
  const noLetter: string[] = [];
  const oneLetter: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const w = raw.trim();
    if (!w || words.includes(w) || tooLong.includes(w)) continue;
    if (w.length > BANNED_WORD_MAX_LEN) {
      tooLong.push(w);
      continue;
    }
    words.push(w);
    const letters = lettersOf(w);
    if (!letters.length) noLetter.push(w);
    else if (letters.length === 1) oneLetter.push(w);
  }
  return { words, tooLong, noLetter, oneLetter };
}

/** 저장 전 확인 — 저장할 수 없으면 까닭(화면 문구), 저장할 수 있으면 null. */
export function bannedWordsProblem(input: BannedWordsInput, saved: readonly string[]): string | null {
  if (input.tooLong.length) return `${BANNED_WORD_MAX_LEN}자를 넘는 낱말: ${input.tooLong.join(', ')}`;
  if (input.words.length > BANNED_WORDS_MAX)
    return `${BANNED_WORDS_MAX}개까지 넣을 수 있어요 (지금 ${input.words.length}개)`;
  if (input.words.join('\n') === saved.join('\n')) return '지금 값과 같음';
  return null;
}

/** 확인 창 글 — 더한 낱말 · 뺀 낱말 수. */
export function bannedWordsDetail(before: readonly string[], after: readonly string[]): string {
  const added = after.filter((w) => !before.includes(w)).length;
  const removed = before.filter((w) => !after.includes(w)).length;
  return `${before.length}개 → ${after.length}개 (더함 ${added} · 뺌 ${removed})`;
}
