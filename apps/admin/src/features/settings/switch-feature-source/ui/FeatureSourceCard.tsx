import { useState } from 'react';
import {
  FEATURE_META,
  FEATURES,
  sourceConfirmText,
  sourceLabel,
  useFeatureSources,
  type Feature,
  type Source,
} from '@/entities/server/feature-source';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useSetFeatureSource } from '../model/useSetFeatureSource';
import styles from './FeatureSourceCard.module.css';

type Message = { text: string; error: boolean } | null;

const SOURCES: Source[] = ['server', 'firebase'];

// config/sources/{기능} — 기능마다 서버 / 파이어베이스. 쓸 때 옛 스위치(friendsApi · roomServer/on)도 같이 써서 옛 앱도 같은 값을 본다.
export function FeatureSourceCard() {
  const env = useEnv();
  const { data, error, isPending } = useFeatureSources();
  const save = useSetFeatureSource();
  const [message, setMessage] = useState<Message>(null);

  const choose = (feature: Feature, source: Source) => {
    if (data?.[feature] === source) return;
    if (!confirm(withProdMark(env, sourceConfirmText(feature, source)))) return;
    save.mutate(
      { feature, source },
      {
        onSuccess: () =>
          setMessage({ text: `${FEATURE_META[feature].label} → ${sourceLabel(source)}`, error: false }),
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  return (
    <section className="card">
      <h2>🎚️ 기능 스위치 — 어디서 받나</h2>
      <p className="soft">
        기능마다 서버(우리 API · 방 서버)와 파이어베이스(옛 길) 중 어디서 받을지 고른다. 서버에 문제가 생기면
        그 기능만 파이어베이스로 돌리는 비상 스위치다.
      </p>
      {error ? (
        <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>
      ) : (
        FEATURES.map((f) => {
          const m = FEATURE_META[f];
          return (
            <div key={f} className={styles.row}>
              <div className={styles.head}>
                <strong>{m.label}</strong>
                <span className="soft">지금: {data ? sourceLabel(data[f]) : '…'}</span>
                <span className={styles.choices}>
                  {SOURCES.map((s) => (
                    <label key={s}>
                      <input
                        type="radio"
                        name={`source-${f}`}
                        checked={data?.[f] === s}
                        disabled={isPending || save.isPending}
                        onChange={() => choose(f, s)}
                      />
                      {sourceLabel(s)}
                    </label>
                  ))}
                </span>
              </div>
              <small className="soft">{m.what}</small>
              <small className="soft">서버 — {m.server}</small>
              <small className="soft">파이어베이스 — {m.firebase}</small>
            </div>
          );
        })
      )}
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </section>
  );
}
