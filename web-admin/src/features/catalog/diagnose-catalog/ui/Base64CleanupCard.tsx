import { useMemo } from 'react';
import { KIND_LABEL, planBase64Cleanup, toMB } from '@/entities/catalog';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useCleanBase64, useDiagnoseSource } from '../model/useDiagnoseCatalog';
import styles from './Diagnose.module.css';

export function Base64CleanupCard() {
  const toast = useToast();
  const env = useEnv();
  const { data } = useDiagnoseSource();
  const clean = useCleanBase64();
  // 받아 둔 목록으로 미리 본다(앱 dryRun) — 지우기 직전에 cleanBase64 가 glbUrl 을 다시 확인한다.
  const plan = useMemo(() => (data ? planBase64Cleanup(data) : null), [data]);

  const onClean = async () => {
    if (!plan?.targets.length) return;
    const ask = `glbUrl 이 있는 ${plan.targets.length}개 항목의 DB glb(${toMB(plan.bytes)}MB)를 지울까요? 되돌릴 수 없어요.`;
    if (!confirm(withProdMark(env, ask))) return;
    try {
      const r = await clean.mutateAsync(plan.targets);
      toast(
        `${r.cleaned.length}개 정리했어요` +
          (r.skipped.length ? ` · ${r.skipped.length}개는 glbUrl 이 없어 건너뜀` : ''),
      );
    } catch (e) {
      toast(errorMessage(e, '정리하지 못했어요. 지운 것은 없어요'));
    }
  };

  return (
    <section className="card">
      <h2>base64 정리</h2>
      {!plan ? (
        <p className="soft">불러오는 중…</p>
      ) : (
        <>
          <dl className={styles.plan}>
            <dt>대상</dt>
            <dd>
              {plan.targets.length}개 · {toMB(plan.bytes)}MB
            </dd>
            <dt>건너뜀 (glbUrl 없음)</dt>
            <dd className={plan.skipped.length ? 'warn' : undefined}>{plan.skipped.length}개</dd>
            <dt>이미 깨끗</dt>
            <dd>{plan.alreadyClean}개</dd>
          </dl>
          {plan.skipped.length > 0 && (
            <div className={styles.chips} aria-label="건너뛸 항목">
              {plan.skipped.map((t) => (
                <code key={`${t.kind}/${t.id}`} className={styles.chip}>
                  {KIND_LABEL[t.kind]}/{t.id}
                </code>
              ))}
            </div>
          )}
        </>
      )}
      <div className="field">
        <span className="grow" />
        <button
          type="button"
          className="btn danger"
          disabled={!plan?.targets.length || clean.isPending}
          onClick={onClean}
        >
          {clean.isPending ? '정리 중…' : '정리'}
        </button>
      </div>
    </section>
  );
}
