import { useEffect, useMemo, useRef, useState } from 'react';
import { useLicenses, useRefreshLicenses } from '@/entities/license';
import { useDb } from '@/shared/api';
import { copyText } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { downloadBytes, readSheetFile, writeXlsx, type Grid } from '../lib/sheet';
import { lookupRows, runBulkGrant } from '../model/bulkGrant';
import {
  isActionable,
  issuedIndex,
  judge,
  mapRows,
  MAX_ROWS,
  normalizeCode,
  resultSheet,
  TEMPLATE,
  type IssuedIndex,
  type JudgeOptions,
  type PlanRow,
  type RowResult,
  type RowStatus,
  type SheetMap,
} from '../model/rows';
import styles from './BulkGrantCard.module.css';

type Tone = 'go' | 'ok' | 'warn' | 'err';

const CHIP: Record<RowStatus | RowResult, [string, Tone]> = {
  send: ['✓ 발송', 'go'],
  key: ['🔑 키만', 'go'],
  nouser: ['✗ 유저 없음', 'err'],
  dup: ['✗ 중복', 'err'],
  issued: ['⚠ 발급한 적 있음', 'warn'],
  badcode: ['✗ 코드 형식', 'err'],
  neterr: ['✗ 조회 실패', 'err'],
  haskey: ['⚠ 이미 키 있음', 'warn'],
  ok: ['✓ 보냄', 'ok'],
  okkey: ['🔑 키 생성', 'ok'],
  fail: ['✗ 발급 실패', 'err'],
};

interface Sheet {
  fileName: string;
  grid: Grid;
  map: SheetMap;
  cut: boolean;
  issued: IssuedIndex | null;
}

type Phase = 'idle' | 'reading' | 'preview' | 'running' | 'done';

const IDLE_INFO = '.xlsx · .csv';

function Chip({ st, text }: { st: RowStatus | RowResult; text?: string }) {
  const [label, tone] = CHIP[st];
  return <span className={`${styles.chip} ${styles[tone]}`}>{text ?? label}</span>;
}

export function BulkGrantCard() {
  const db = useDb();
  const toast = useToast();
  const { data: licenses } = useLicenses();
  const refreshLicenses = useRefreshLicenses();
  const fileInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [info, setInfo] = useState(IDLE_INFO);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [looked, setLooked] = useState<PlanRow[]>([]);
  const [done, setDone] = useState<PlanRow[] | null>(null);
  const [options, setOptions] = useState<JudgeOptions>({ dupFirst: true, reissue: false });
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const rows = useMemo(
    () => done ?? judge(looked, options, sheet?.issued ?? null),
    [done, looked, options, sheet],
  );
  const busy = phase === 'reading' || phase === 'running';

  // 발급 중에 창을 닫으면 어디까지 됐는지 모르게 된다 — 브라우저가 한 번 묻게 한다.
  useEffect(() => {
    if (phase !== 'running') return;
    const stop = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', stop);
    return () => window.removeEventListener('beforeunload', stop);
  }, [phase]);

  const reset = () => {
    setPhase('idle');
    setSheet(null);
    setLooked([]);
    setDone(null);
    setInfo(IDLE_INFO);
  };

  const load = async (file: File) => {
    reset();
    setPhase('reading');
    setInfo(`${file.name} · 읽는 중…`);
    let grid: Grid;
    try {
      grid = await readSheetFile(file);
    } catch (e) {
      setPhase('idle');
      setInfo(`⚠ ${(e as Error).message || '파일을 읽지 못했어요'}`);
      return;
    }
    const map = mapRows(grid);
    const cut = map.data.length > MAX_ROWS;
    const data = map.data.slice(0, MAX_ROWS);
    if (!data.length) {
      setPhase('idle');
      setInfo(`⚠ ${file.name} · 발급할 행이 없어요`);
      return;
    }
    const head = `${file.name} · ${data.length}행${cut ? ` (앞 ${MAX_ROWS}행만)` : ''}`;
    // 발급된 키 목록은 아래 목록 · 통계와 같은 캐시다. 아직 못 받았으면 «발급한 적 있음» 판정만 빠진다.
    const issued = licenses ? issuedIndex(licenses) : null;
    setInfo(`${head} · 확인 중…`);
    const planned = await lookupRows(db, data, (n, total) => setInfo(`${head} · 확인 중… ${n}/${total}`));
    setSheet({ fileName: file.name, grid, map: { ...map, data }, cut, issued });
    setLooked(planned);
    setInfo(head + (issued ? '' : ' · ⚠ 발급 이력 확인 못 함'));
    setPhase('preview');
  };

  const run = async () => {
    const todo = rows.filter(isActionable);
    if (!todo.length) return;
    const nSend = todo.filter((r) => r.st === 'send').length;
    if (
      !confirm(
        `${todo.length}건을 발급할까요?\n· 수령함으로 보냄 ${nSend}건\n· 키만 만듦 ${todo.length - nSend}건`,
      )
    )
      return;
    setPhase('running');
    setProgress({ done: 0, total: todo.length });
    const result = await runBulkGrant(db, rows, (n, total) => setProgress({ done: n, total }));
    setDone(result);
    setPhase('done');
    refreshLicenses();
    const count = (res: RowResult) => result.filter((r) => r.res === res).length;
    toast(
      `일괄 발급 완료 · 수령함 ${count('ok')} · 키만 ${count('okkey')}` +
        (count('fail') ? ` · 실패 ${count('fail')}` : ''),
    );
  };

  const saveResult = async () => {
    if (!sheet) return;
    try {
      const bytes = await writeXlsx(resultSheet(rows, sheet.map, sheet.grid), '발급 결과');
      downloadBytes(bytes, `${sheet.fileName.replace(/\.(xlsx|csv)$/i, '') || '라이선스'}_발급결과.xlsx`);
    } catch {
      toast('결과 파일을 만들지 못했어요');
    }
  };

  const saveTemplate = async () => {
    try {
      downloadBytes(await writeXlsx(TEMPLATE, '라이선스 발급'), '라이선스_일괄발급_양식.xlsx');
    } catch {
      toast('양식 파일을 만들지 못했어요');
    }
  };

  const todo = rows.filter(isActionable);
  const nSend = todo.filter((r) => r.st === 'send').length;
  const count = (res: RowResult) => rows.filter((r) => r.res === res).length;
  const byHand = done ? done.filter((r) => r.key && r.res !== 'ok') : [];

  return (
    <section className="card">
      <div className="card-head">
        <h2>엑셀로 일괄 발급</h2>
        <button type="button" className="btn" onClick={saveTemplate}>
          양식 받기
        </button>
      </div>
      <div className="field">
        <span className={styles.file}>{info}</span>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx,.csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void load(file);
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={busy}
          title={`첫 시트의 «친구코드» · «메모» 열(없으면 A · B 열), 최대 ${MAX_ROWS}행. 친구코드가 비면 키만 만들어요`}
          onClick={() => fileInput.current?.click()}
        >
          파일 고르기
        </button>
      </div>

      {phase === 'preview' && (
        <>
          <div className={styles.summary}>
            <Chip st="send" text={`수령함 발송 ${nSend}`} />
            <Chip st="key" text={`키만 발급 ${todo.length - nSend}`} />
            {rows.length > todo.length && <Chip st="nouser" text={`건너뜀 ${rows.length - todo.length}`} />}
          </div>
          <div className={styles.options}>
            <label>
              <input
                type="checkbox"
                checked={options.dupFirst}
                onChange={(e) => setOptions({ ...options, dupFirst: e.target.checked })}
              />
              중복 친구코드는 첫 행만
            </label>
            <label>
              <input
                type="checkbox"
                checked={options.reissue}
                onChange={(e) => setOptions({ ...options, reissue: e.target.checked })}
              />
              발급한 적 있어도 다시 발급
            </label>
          </div>
        </>
      )}

      {phase === 'running' && (
        <div className={styles.progress}>
          <span>
            발급 중… <b>{progress.done}</b> / {progress.total}
          </span>
          <progress max={progress.total || 1} value={progress.done} />
        </div>
      )}

      {phase === 'done' && (
        <div className={styles.summary}>
          <b>완료</b>
          <Chip st="ok" text={`수령함 발송 ${count('ok')}`} />
          <Chip st="okkey" text={`키만 발급 ${count('okkey')}`} />
          <Chip st="fail" text={`실패 ${count('fail')}`} />
          {rows.length > count('ok') + count('okkey') + count('fail') && (
            <Chip st="issued" text={`건너뜀 ${rows.length - count('ok') - count('okkey') - count('fail')}`} />
          )}
        </div>
      )}

      {byHand.length > 0 && (
        <div className={styles.byHand}>
          <p className="soft">직접 전달할 키</p>
          {byHand.map((r) => (
            <div key={r.line} className="row">
              <span className="grow">
                <span className="meta">{r.line}행</span>
                <code className="key">{r.key}</code>
                <span className="meta">{r.memo || r.raw || '—'}</span>
              </span>
              <button
                type="button"
                className="btn"
                onClick={async () =>
                  toast((await copyText(r.key ?? '')) ? '복사했어요' : '복사하지 못했어요')
                }
              >
                복사
              </button>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>행</th>
                <th>친구코드</th>
                <th>받는 사람</th>
                <th>메모</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const shown = normalizeCode(r.raw);
                return (
                  <tr key={r.line} className={isActionable(r) || r.res ? undefined : styles.dim}>
                    <td>{r.line}</td>
                    <td>
                      {r.raw || <span className="soft">비어 있음</span>}
                      {r.code && r.code !== shown && <span className="soft"> → {r.code}</span>}
                    </td>
                    <td>{r.name || '—'}</td>
                    <td className={styles.memo} title={r.memo}>
                      {r.memo}
                    </td>
                    <td>
                      <Chip
                        st={r.res ?? r.st}
                        text={r.st === 'dup' && !r.res ? `${CHIP.dup[0]} (${r.dupOf}행)` : undefined}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {phase === 'preview' && (
        <div className="field">
          <button type="button" className="btn primary" disabled={!todo.length} onClick={run}>
            {todo.length}건 발급
          </button>
          <button type="button" className="btn" onClick={reset}>
            취소
          </button>
        </div>
      )}

      {phase === 'done' && (
        <div className="field">
          <button
            type="button"
            className="btn primary"
            title="원본 열 뒤에 발급 키 · 결과 · 사유 열을 붙여요"
            onClick={saveResult}
          >
            결과 저장
          </button>
          <button type="button" className="btn" onClick={reset}>
            새 파일
          </button>
        </div>
      )}
      {sheet?.cut && phase === 'preview' && <small className="warn">앞 {MAX_ROWS}행만 읽었어요.</small>}
    </section>
  );
}
