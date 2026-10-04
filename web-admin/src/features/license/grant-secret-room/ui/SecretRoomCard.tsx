import { useState, type KeyboardEvent } from 'react';
import { MONTHS_MAX } from '@/entities/secret-room';
import { useDb } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import {
  grantSecretRoom,
  prepareSecretGrant,
  type GrantResult,
  type SecretGrantInput,
  type SecretGrantPlan,
} from '../model/grantSecretRoom';
import styles from './SecretRoomCard.module.css';

type Message = { text: string; error: boolean } | null;

function resultMessage(r: Extract<GrantResult, { ok: true }>, plan: SecretGrantPlan): Message {
  const parts = [
    `발급 완료 ${r.code} [${r.period}]`,
    r.sent ? '수령함으로 보냈어요' : '수령함 전송 실패. 코드를 직접 전달해 주세요',
    // 잘못 간 뒤에 어디로 갔는지 되짚을 수 있게 받는 계정을 늘 남긴다.
    `받는 계정 ${plan.uid}${plan.name ? ` (${plan.name})` : ''}`,
  ];
  if (plan.confusing) parts.push('0 · O · 1 · I 가 섞여 있어요');
  if (r.expiredOld) parts.push(`옛 코드 ${r.expiredOld} 를 만료 처리했어요`);
  if (r.expireFailed) parts.push(`옛 코드 ${r.expireFailed} 만료 실패. 그 코드로도 계속 입장돼요`);
  if (!r.linked) parts.push('참여 화면 자동 채움은 갱신하지 못했어요');
  return { text: parts.join('\n'), error: !r.sent || !!r.expireFailed };
}

/**
 * 발급 열쇠는 이 화면의 입력 칸에만 있다 — 저장소 · 캐시 · 로그 어디에도 남기지 않는다.
 * 쿼리 캐시(useMutation 변수)에도 남지 않게 직접 부른다.
 */
export function SecretRoomCard() {
  const db = useDb();
  const toast = useToast();
  const [input, setInput] = useState<SecretGrantInput>({ target: '', want: '', months: '' });
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<SecretGrantPlan | null>(null);
  const [message, setMessage] = useState<Message>(null);

  // 경고를 본 뒤 칸을 고치면 경고에 적힌 것과 다른 조건으로 나가지 않게 확인을 다시 받는다.
  const edit = (patch: Partial<SecretGrantInput>) => {
    setInput({ ...input, ...patch });
    setPending(null);
  };

  const execute = async (plan: SecretGrantPlan) => {
    const r = await grantSecretRoom(db, plan, secret.trim());
    if (!r.ok) {
      setMessage({
        text: r.denied ? '발급 열쇠가 맞지 않아요' : '발급하지 못했어요',
        error: true,
      });
      return;
    }
    setMessage(resultMessage(r, plan));
    // 개월 수 · 열쇠는 비우지 않는다 — 같은 기간으로 여러 명에게 연달아 발급하는 경우가 대부분이다.
    setInput((cur) => ({ ...cur, target: '', want: '' }));
    toast(`시크릿룸 ${r.code} 발급 · ${r.period}`);
  };

  const run = async (confirmed: SecretGrantPlan | null) => {
    if (busy) return;
    if (!input.target.trim())
      return setMessage({ text: '친구코드 또는 유저 코드를 입력해 주세요', error: true });
    if (!secret.trim()) return setMessage({ text: '발급 열쇠를 입력해 주세요', error: true });
    setBusy(true);
    setMessage({ text: '확인 중…', error: false });
    try {
      let plan = confirmed;
      if (!plan) {
        const prepared = await prepareSecretGrant(db, input);
        if (!prepared.ok) return setMessage({ text: prepared.error, error: true });
        plan = prepared.plan;
        if (plan.warnings.length) {
          setPending(plan);
          setMessage(null);
          return;
        }
      }
      setPending(null);
      await execute(plan);
    } catch (e) {
      setMessage({ text: errorMessage(e, '오류가 났어요'), error: true });
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') void run(pending);
  };

  return (
    <section className="card">
      <h2 title="같은 사람에게 같은 코드로 다시 발급하면 남은 기간에 이어붙여요">🔒 시크릿룸 발급</h2>
      <div className={styles.form} onKeyDown={onEnter}>
        <label>
          받는 사람 친구코드
          <input
            type="text"
            maxLength={48}
            placeholder="MATE-XXXX · 뒤 4자리"
            title="유저 코드(u…)도 받아요"
            value={input.target}
            onChange={(e) => edit({ target: e.target.value })}
          />
        </label>
        <label>
          원하는 코드
          <input
            type="text"
            maxLength={4}
            className={styles.upper}
            placeholder="4자리 · 비우면 자동"
            value={input.want}
            onChange={(e) => edit({ want: e.target.value })}
          />
        </label>
        <label>
          이용 기간(개월)
          <input
            type="text"
            inputMode="numeric"
            maxLength={3}
            placeholder={`1~${MONTHS_MAX} · 비우면 영구`}
            value={input.months}
            onChange={(e) => edit({ months: e.target.value })}
          />
        </label>
        <label>
          발급 열쇠
          <input
            type="password"
            maxLength={64}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            placeholder="저장되지 않아요"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </label>
      </div>

      {pending ? (
        <div className={styles.confirm}>
          {pending.warnings.map((w) => (
            <p key={w} className="warn">
              {w}
            </p>
          ))}
          <div className="field">
            <button type="button" className="btn danger" disabled={busy} onClick={() => run(pending)}>
              {busy ? '발급 중…' : '그대로 발급'}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setPending(null)}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <div className="field">
          <button type="button" className="btn primary" disabled={busy} onClick={() => run(null)}>
            {busy ? '확인 중…' : '발급'}
          </button>
        </div>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
