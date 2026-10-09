import { useState, type FormEvent } from 'react';
import { useRoomServerConfig } from '@/entities/room-server';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  checkDefault,
  defaultConfirmText,
  defaultOptions,
  NO_DEFAULT,
  PERCENT_STEPS,
  percentLockReason,
  toDefaultInputs,
  useSetDefaultRouting,
  type DefaultInputs,
} from '../model/editDefault';
import styles from './DefaultCard.module.css';

const HINT_ID = 'default-percent-hint';

type Message = { text: string; error: boolean } | null;

// 기본 서버 · 비율 — config/roomServer/default · defaultPercent. 앱 릴리스 없이 새 방을 서버로 넓혀 간다.
// 누가 비율 안인지는 앱이 사용자 코드 해시로 정한다(같은 비율이면 늘 같은 사람 · 올리면 더해지기만).
export function DefaultCard() {
  const env = useEnv();
  const { data: cfg, error, isPending } = useRoomServerConfig();
  const save = useSetDefaultRouting();
  const [draft, setDraft] = useState<DefaultInputs | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const inputs = draft ?? toDefaultInputs(cfg);
  const options = defaultOptions(Object.keys(cfg?.servers ?? {}), cfg?.default ?? null);
  const noServer = inputs.server === NO_DEFAULT;
  const lockReason = percentLockReason(inputs.server, options);
  const busy = isPending || save.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkDefault(cfg, inputs);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, defaultConfirmText(cfg, r.next)))) return;
    save.mutate(
      { cfg, next: r.next },
      {
        onSuccess: () => {
          setDraft(null);
          setMessage({
            text: r.next.server ? `저장 · ${r.next.server} ${r.next.percent}%` : '저장 · 기본 서버 없음',
            error: false,
          });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>기본 서버 · 비율</h2>
      <p className="soft">
        허용 목록에 없는 사람도 이 비율만큼 기본 서버에 방을 열어요 · 0 이면 모두 Firebase · on 이 꺼져 있으면
        모두 Firebase
      </p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <label className={styles.field}>
            기본 서버
            <select
              aria-label="기본 서버"
              value={inputs.server}
              disabled={busy}
              onChange={(e) => setDraft({ ...inputs, server: e.target.value })}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            비율 %
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              aria-label="비율 %"
              aria-describedby={lockReason ? HINT_ID : undefined}
              title={lockReason ?? undefined}
              value={inputs.percent}
              disabled={busy || noServer}
              onChange={(e) => setDraft({ ...inputs, percent: e.target.value })}
            />
          </label>
          <span className={styles.steps}>
            {PERCENT_STEPS.map((p) => (
              <button
                key={p}
                type="button"
                className="btn"
                title={lockReason ?? undefined}
                disabled={busy || noServer}
                onClick={() => setDraft({ ...inputs, percent: String(p) })}
              >
                {p}
              </button>
            ))}
          </span>
          <button type="submit" className="btn primary" disabled={busy}>
            저장
          </button>
          {lockReason && (
            <small id={HINT_ID} className={`soft ${styles.hint}`}>
              {lockReason}
            </small>
          )}
        </form>
      )}
      {cfg && !cfg.on && cfg.default && cfg.defaultPercent > 0 && (
        <p className="warn">스위치가 꺼져 있어 지금은 모두 Firebase</p>
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
