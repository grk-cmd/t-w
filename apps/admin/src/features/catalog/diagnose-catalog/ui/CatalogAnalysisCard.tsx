import { useMemo } from 'react';
import { analyzeKind, DIAGNOSE_KINDS, KIND_LABEL, useRefreshCatalog } from '@/entities/catalog';
import { errorMessage } from '@/shared/lib';
import { useDiagnoseSource } from '../model/useDiagnoseCatalog';
import styles from './Diagnose.module.css';

export function CatalogAnalysisCard() {
  const { data, error } = useDiagnoseSource();
  const refresh = useRefreshCatalog();
  const rows = useMemo(
    () => (data ? DIAGNOSE_KINDS.map((kind) => ({ kind, ...analyzeKind(data[kind]) })) : null),
    [data],
  );
  const totalKB = rows ? Math.round(rows.reduce((s, r) => s + r.totalKB, 0)) : null;

  return (
    <section className="card">
      <div className="card-head">
        <h2>용량 진단</h2>
        {totalKB !== null && <span className="soft">합계 {totalKB}KB</span>}
        <button type="button" className="btn" onClick={() => DIAGNOSE_KINDS.forEach((k) => refresh(k))}>
          새로고침
        </button>
      </div>
      {error && <p className="msg err">{errorMessage(error, '불러오지 못했어요')}</p>}
      {!error && !rows && <p className="soft">불러오는 중…</p>}
      {rows && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>종류</th>
              <th>개수</th>
              <th>합계</th>
              <th>base64 필드</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kind}>
                <td>{KIND_LABEL[r.kind]}</td>
                <td>{r.count}</td>
                <td>{r.totalKB}KB</td>
                <td className={r.base64Fields ? 'warn' : undefined}>{r.base64Fields}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows?.map(
        (r) =>
          r.top.length > 0 && (
            <details key={r.kind} className={styles.top}>
              <summary>{KIND_LABEL[r.kind]} 큰 항목</summary>
              <ul>
                {r.top.map((t) => (
                  <li key={t.id}>
                    <b>{t.kb}KB</b> <code className="key">{t.id}</code> {t.name}
                    {t.heavy.length > 0 && <span className="warn"> ← {t.heavy.join(', ')}</span>}
                  </li>
                ))}
              </ul>
            </details>
          ),
      )}
    </section>
  );
}
