import { useState, type FormEvent } from 'react';
import { errorMessage } from '@/shared/lib';
import { useGrantByFriendCode } from '../model/grantByFriendCode';

type Message = { text: string; error: boolean } | null;

export function GrantByCodeCard() {
  const grant = useGrantByFriendCode();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<Message>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setMessage({ text: '친구코드를 입력해 주세요', error: true });
      return;
    }
    grant.mutate(code, {
      onSuccess: (r) => {
        if (r.ok) {
          setMessage({
            text: `${r.name ?? r.code} 님의 수령함으로 보냈어요`,
            error: false,
          });
          setCode('');
        } else {
          setMessage({ text: '이 친구코드를 가진 사용자를 찾지 못했어요', error: true });
        }
      },
      onError: (err) => setMessage({ text: errorMessage(err, '발급하지 못했어요'), error: true }),
    });
  };

  return (
    <section className="card">
      <h2>친구코드로 발급</h2>
      <form className="field" onSubmit={submit}>
        <input
          type="text"
          maxLength={12}
          placeholder="친구코드 (MATE-XXXX)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="btn primary" disabled={grant.isPending}>
          {grant.isPending ? '확인 중…' : '보내기'}
        </button>
      </form>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
