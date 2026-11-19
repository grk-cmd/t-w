import { useState, type FormEvent } from 'react';
import {
  BANNED_WORD_MAX_LEN,
  bannedWordsDetail,
  bannedWordsProblem,
  parseBannedInput,
  useBannedWords,
} from '@/entities/room';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSaveBannedWords } from '../model/useSaveBannedWords';
import styles from './BannedWordsCard.module.css';

type Message = { text: string; error: boolean } | null;

// 저장하면 서버가 realtime 에 «다시 받기» 를, 앱에 `config` 알림을 보낸다. realtime 은 알림이 빠져도 room.timing.refreshMs 마다 다시 받는다.
const APPLY_TEXT =
  '저장하면 realtime 서버가 바로 다시 읽어 방 만들기 · 제목 바꾸기를 거절하고 방 목록의 제목을 걸러요(알림이 빠져도 room.timing 의 refreshMs 주기 안에). ' +
  '앱의 방 만들기 · 제목 창은 앱이 원격 설정을 다시 읽은 뒤부터 미리 막아요(서버가 앱에 바뀜 알림을 보내요).';

/** 서버 설정 키 `room.bannedWords` — API 판에만 있다(설정 화면이 포트에 있을 때만 그린다). */
export function BannedWordsCard() {
  const env = useEnv();
  const { data: from, error, isPending } = useBannedWords();
  const save = useSaveBannedWords();
  const saved = from?.value ?? [];
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const text = draft ?? saved.join('\n');
  const parsed = parseBannedInput(text);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!from) return;
    const problem = bannedWordsProblem(parsed, saved);
    if (problem) return setMessage({ text: problem, error: true });
    const warn = parsed.noLetter.length
      ? `\n\n⚠️ 숫자 · 기호만 된 낱말은 걸리지 않아요: ${parsed.noLetter.join(', ')}`
      : '';
    const detail = bannedWordsDetail(saved, parsed.words);
    if (!confirm(withProdMark(env, `방 제목 금칙어 — ${detail}\n${APPLY_TEXT}${warn}`))) return;
    save.mutate(
      { from, words: parsed.words },
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
