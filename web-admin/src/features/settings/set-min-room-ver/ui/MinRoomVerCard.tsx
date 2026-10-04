import { useState, type FormEvent } from 'react';
import { checkMinRoomVer, MIN_ROOM_VER_MAX, useMinRoomVer } from '@/entities/min-room-ver';
import { errorMessage } from '@/shared/lib';
import { useSetMinRoomVer } from '../model/setMinRoomVer';
import styles from './MinRoomVerCard.module.css';

type Message = { text: string; error: boolean } | null;
type Pending = { next: string; current: string | null; change: 'first' | 'raise' | 'lower' };

function Impact({ pending }: { pending: Pending }) {
  if (pending.change === 'lower') {
    return (
      <ul>
        <li>
          {pending.next} 이상인 앱이 다시 방에 들어올 수 있어요. 방 통신 형식이 다른 옛 판과 섞이면 서로 잘 안
          보이거나 정원이 어긋날 수 있어요.
        </li>
      </ul>
    );
  }
  return (
    <ul>
      <li>
        앱 버전이 <b>{pending.next}</b> 보다 낮은 사용자는 워킹룸 · 투게더룸을 만들거나 들어갈 수 없어요(초대
        수락 포함). 업데이트 안내만 떠요.
      </li>
      <li>
        <b>{pending.next}</b> 이 GitHub Releases 에 <b>공개된</b> 버전인지 먼저 확인하세요. 아직 없는 버전으로
        올리면 아무도 방에 못 들어가요.
      </li>
      <li>사용자 대부분이 업데이트한 뒤에 올리세요. 이 확인 단계 외에 승인 절차는 따로 없어요.</li>
    </ul>
  );
}

export function MinRoomVerCard() {
  const { data: current, error, isPending } = useMinRoomVer();
  const apply = useSetMinRoomVer();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [retype, setRetype] = useState('');
  const [message, setMessage] = useState<Message>(null);

  const prepare = (e: FormEvent) => {
    e.preventDefault();
    if (current === undefined) return;
    const next = input.trim();
    const check = checkMinRoomVer(next, current);
    if (!check.ok) {
      setMessage({ text: check.reason, error: true });
      return;
    }
    setMessage(null);
    setRetype('');
    setPending({ next, current, change: check.change });
  };

  const cancel = () => {
    setPending(null);
    setRetype('');
  };

  const run = () => {
    if (!pending || retype.trim() !== pending.next) return;
    apply.mutate(
      { next: pending.next, expected: pending.current },
      {
        onSuccess: (r) => {
          if (r.ok) {
            setMessage({ text: `방 입장 최소 버전을 ${pending.next} 로 바꿨어요`, error: false });
            setInput('');
          } else if (r.reason === 'changed') {
            setMessage({
              text: `그 사이 값이 ${r.current ?? '(없음)'} 로 바뀌어 있어 쓰지 않았어요 — 다시 확인해 주세요`,
              error: true,
            });
          } else {
            setMessage({ text: r.message, error: true });
          }
          cancel();
        },
        onError: (err) =>
          setMessage({ text: errorMessage(err, '바꾸지 못했어요 — 아무것도 바뀌지 않았어요'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>방 입장 최소 버전</h2>
      <p className="soft">
        이 값보다 낮은 앱은 방에 들어갈 수 없어요. 방 통신 형식이 바뀐 버전을 공개하고, 사용자 대부분이
        업데이트한 뒤에만 올려요.
      </p>
      <p>
        지금 값:{' '}
        {error ? (
          <span className="warn">{errorMessage(error, '불러오지 못했어요')}</span>
        ) : isPending ? (
          <span className="soft">불러오는 중…</span>
        ) : (
          <b className="key">{current ?? '없음 (제한 없음)'}</b>
        )}
      </p>
      <form className="field" onSubmit={prepare}>
        <input
          type="text"
          maxLength={MIN_ROOM_VER_MAX}
          placeholder="새 최소 버전 (예: 0.10.2)"
          value={input}
          disabled={!!pending}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn" disabled={!!pending || isPending || !!error}>
          바꾸기 전에 확인
        </button>
      </form>

      {pending && (
        <div className={styles.confirm}>
          <b className="warn">
            지금 연결된 DB(맨 위 표시)에 바로 써요 — «운영» 이면 모든 사용자에게 즉시 적용돼요.
          </b>
          <div className={styles.change}>
            <code className="key">{pending.current ?? '없음'}</code>→
            <code className="key">{pending.next}</code>
          </div>
          <Impact pending={pending} />
          <p>
            확인을 위해 새 값 <code className="key">{pending.next}</code> 을 똑같이 다시 입력해 주세요.
          </p>
          <div className="field">
            <input
              type="text"
              maxLength={MIN_ROOM_VER_MAX}
              placeholder={pending.next}
              value={retype}
              onChange={(e) => setRetype(e.target.value)}
            />
            <button
              type="button"
              className="btn danger"
              disabled={apply.isPending || retype.trim() !== pending.next}
              onClick={run}
            >
              {apply.isPending ? '바꾸는 중…' : `${pending.next} 로 바꾸기`}
            </button>
            <button type="button" className="btn" disabled={apply.isPending} onClick={cancel}>
              취소
            </button>
          </div>
        </div>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
