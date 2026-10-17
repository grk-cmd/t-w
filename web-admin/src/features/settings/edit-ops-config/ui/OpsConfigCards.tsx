import { useState, type FormEvent } from 'react';
import {
  API_CACHE,
  API_CORS_MAX,
  LOG_LEVELS,
  LOG_TARGETS,
  ROOM_FRAME,
  ROOM_TIMING,
  useCorsOrigins,
  useLogLevels,
  type LogLevel,
  type LogTarget,
} from '@/entities/server/ops-config';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import {
  checkCorsInput,
  checkLogLevels,
  corsConfirmText,
  logLevelConfirmText,
  useSaveCorsOrigins,
  useSaveLogLevels,
} from '../model/editOpsConfig';
import { IntGroupForm } from './IntGroupForm';
import styles from './OpsConfig.module.css';

type Message = { text: string; error: boolean } | null;

/** config/apiCors — API 관리자 경로의 브라우저 허용 출처(줄마다 하나). 공개 GET · 앱 경로는 모든 출처라 여기와 상관없다. */
function CorsForm() {
  const env = useEnv();
  const { data: saved = [], error, isPending } = useCorsOrigins();
  const save = useSaveCorsOrigins();
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const text = draft ?? saved.join('\n');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkCorsInput(saved, text);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, corsConfirmText(r.next)))) return;
    save.mutate(
      { before: saved, next: r.next },
      {
        onSuccess: () => {
          setDraft(null);
          setMessage({ text: `저장 · 출처 ${r.next.length}개 · 5초 안 적용`, error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  if (error) return <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>;
  return (
    <form onSubmit={submit}>
      <h3 className={styles.sub}>CORS 허용 출처</h3>
      <div className={styles.row}>
        <textarea
          className={styles.list}
          aria-label="CORS 허용 출처 — 줄마다 하나"
          placeholder={isPending ? '' : '비어 있음 → 서버 env 목록\nhttps://together-working.web.app'}
          disabled={isPending}
          value={isPending ? '' : text}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>
      <div className={styles.row}>
        <button
          type="submit"
          className="btn primary"
          disabled={save.isPending || isPending || draft === null}
        >
          {save.isPending ? '저장 중…' : '저장'}
        </button>
        <small className={`soft ${styles.hint}`}>
          줄마다 https://호스트 하나 · {API_CORS_MAX}개까지 · 와일드카드 · 포트 · 경로 안 됨 · 비우면 서버 env
          목록 · 관리자 경로만(공개 GET · 앱 경로는 모든 출처) · 로컬 http://localhost 는 env 로만
        </small>
      </div>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </form>
  );
}

/** config/logLevel/{api,realtime} — 빈 값 = 서버 기본(info). */
function LogLevelForm() {
  const env = useEnv();
  const { data: saved = {}, error, isPending } = useLogLevels();
  const save = useSaveLogLevels();
  const [drafts, setDrafts] = useState<Partial<Record<LogTarget, LogLevel | ''>>>({});
  const [message, setMessage] = useState<Message>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkLogLevels(saved, drafts);
    if (!r.ok) return setMessage({ text: r.error, error: true });
    if (!confirm(withProdMark(env, logLevelConfirmText(saved, r.next)))) return;
    save.mutate(
      { before: saved, updates: r.next },
      {
        onSuccess: () => {
          setDrafts({});
          setMessage({ text: '저장 · API 20초 안 · 방 서버 다음 설정 읽기 뒤', error: false });
        },
        onError: (err) => setMessage({ text: errorMessage(err, '저장 실패'), error: true }),
      },
    );
  };

  if (error) return <p className="msg err">{errorMessage(error, '불러오기 실패')}</p>;
  return (
    <form onSubmit={submit}>
      <h3 className={styles.sub}>로그 수준</h3>
      {LOG_TARGETS.map(({ key, label }) => (
        <div key={key} className={styles.row}>
          <label htmlFor={`logLevel-${key}`} className={styles.label}>
            {label}
          </label>
          <span className={styles.count}>
            <select
              id={`logLevel-${key}`}
              disabled={isPending}
              value={drafts[key] ?? saved[key] ?? ''}
              onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value as LogLevel | '' })}
            >
              <option value="">기본(info)</option>
              {LOG_LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </span>
        </div>
      ))}
      <div className={styles.row}>
        <button
          type="submit"
          className="btn primary"
          disabled={save.isPending || isPending || !Object.keys(drafts).length}
        >
          {save.isPending ? '저장 중…' : '저장'}
        </button>
        <small className={`soft ${styles.hint}`}>
          error · warn 이면 info 줄([stats] · [config] 등)을 숨기고 오류만 · 문제를 볼 때만 debug
        </small>
      </div>
      {message && <p className={message.error ? 'msg err' : 'msg'}>{message.text}</p>}
    </form>
  );
}

/** API 서버가 읽는 칸 — CORS · 공개 캐시 · 로그 수준. 쓰는 곳은 이 화면뿐, 읽는 곳은 t-w-server(봇 계정 · 방 서버). */
export function ApiOpsCard() {
  return (
    <section className="card">
      <h2>서버 운영 설정</h2>
      <p className="soft">서버(API · 방 서버)가 다시 시작하지 않고 읽는 값이에요. 앱은 읽지 않아요.</p>
      <CorsForm />
      <IntGroupForm
        title="공개 캐시 초"
        group={API_CACHE}
        action="settings.apiCache"
        apply="5초 안 · 다음 응답부터(이미 받은 캐시는 그 시간까지)"
      />
      <LogLevelForm />
    </section>
  );
}

/** 방 서버가 읽는 칸 — 프레임 상한 · 타이밍(config/roomServer/{frame,timing}). 키 없이 공개 읽기. */
export function RoomServerTuningCard() {
  return (
    <section className="card">
      <h2>방 서버 상한 · 타이밍</h2>
      <IntGroupForm
        title="방 서버 프레임 상한"
        group={ROOM_FRAME}
        action="roomServer.frame"
        apply="방 서버가 다음에 설정을 읽은 뒤 프레임부터"
      />
      <IntGroupForm
        title="방 서버 타이밍"
        group={ROOM_TIMING}
        action="roomServer.timing"
        apply="방 서버가 다음에 설정을 읽은 뒤 바퀴부터(되살리기 창은 다음 재시작부터)"
      />
    </section>
  );
}
