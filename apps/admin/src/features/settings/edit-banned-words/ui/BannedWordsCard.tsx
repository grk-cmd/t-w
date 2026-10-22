import { useState, type FormEvent } from 'react';
import {
  BANNED_WORD_MAX_LEN,
  BANNED_WORDS_MAX,
  bannedWordsDetail,
  parseBannedInput,
  useBannedWords,
} from '@/entities/room';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSaveBannedWords } from '../model/useSaveBannedWords';
import styles from './BannedWordsCard.module.css';

type Message = { text: string; error: boolean } | null;

/** config/bannedWords — 앱이 방을 만들 · 바꿀 때 막고, 서버 함수가 방 목록에서 한 번 더 걸러 제목을 비운다. */
export function BannedWordsCard() {
  const env = useEnv();
  const { data: saved = [], error, isPending } = useBannedWords();
  const save = useSaveBannedWords();
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const text = draft ?? saved.join('\n');
  const parsed = parseBannedInput(text);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (parsed.tooLong.length) {
      setMessage({ text: `${BANNED_WORD_MAX_LEN}자를 넘는 낱말: ${parsed.tooLong.join(', ')}`, error: true });
      return;
    }
    if (parsed.words.length > BANNED_WORDS_MAX) {
      setMessage({
        text: `${BANNED_WORDS_MAX}개까지 넣을 수 있어요 (지금 ${parsed.words.length}개)`,
        error: true,
      });
      return;
    }
    if (parsed.words.join('\n') === saved.join('\n')) {
      setMessage({ text: '지금 값과 같음', error: true });
      return;
    }
    const warn = parsed.noLetter.length
      ? `\n\n⚠️ 숫자 · 기호만 된 낱말은 걸리지 않아요: ${parsed.noLetter.join(', ')}`
      : '';
    if (
      !confirm(
        withProdMark(
          env,
          `방 제목 금칙어 — ${bannedWordsDetail(saved, parsed.words)}\n방 목록은 1분 안에 걸러져요. 방 만들기 창의 막기는 앱이 원격 설정을 다시 읽을 때(5분 안)부터 — 원격 설정 API 가 이 칸을 주기 전에는 API 를 못 받은 앱만 막아요.${warn}`,
        ),
      )
    )
      return;
    save.mutate(
      { before: saved, words: parsed.words },
      {
        onSuccess: () => {
          setDraft(null);
          setMessage({ text: `저장 · ${parsed.words.length}개`, error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>방 제목 금칙어</h2>
      <p className="soft">
        한 줄에 하나(쉼표로 나눠도 돼요). 띄어쓰기 · 기호 · 숫자를 끼워 넣어도 잡도록 글자만 남겨 비교해요.
        부분 일치라 «욕» 을 넣으면 «욕실» 도 막혀요.
      </p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="bannedWords" className={styles.label}>
            금칙어 목록
          </label>
          <textarea
            id="bannedWords"
            className={styles.box}
            rows={8}
            disabled={isPending}
            value={isPending ? '' : text}
            onChange={(e) => setDraft(e.target.value)}
          />
          {parsed.oneLetter.length > 0 && (
            <p className="msg err">
              한 글자 낱말은 그 글자가 든 제목을 다 막아요: {parsed.oneLetter.join(', ')}
            </p>
          )}
          {parsed.noLetter.length > 0 && (
            <p className="msg err">숫자 · 기호만 된 낱말은 걸리지 않아요: {parsed.noLetter.join(', ')}</p>
          )}
          <div className={styles.row}>
            <button
              type="submit"
              className="btn primary"
              disabled={save.isPending || isPending || draft === null}
            >
              {save.isPending ? '저장 중…' : '저장'}
            </button>
            <small className="soft">
              {parsed.words.length}개 · 낱말은 {BANNED_WORD_MAX_LEN}자까지 · 비우고 저장하면 거르지 않음
            </small>
          </div>
        </form>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
