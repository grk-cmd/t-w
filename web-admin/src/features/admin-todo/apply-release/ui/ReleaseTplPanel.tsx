import { useState } from 'react';
import { useReleaseDownloads } from '@/entities/release';
import { useEnv, withProdMark, type Versioned } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { useApplyReleasePort } from '../api';
import { RELEASE_TPL_MAX, RELEASE_TPL_VARS } from '../model/applyRelease';
import type { ReleaseTemplate } from '../model/releaseTpl';
import { useReleaseTpl, useSaveReleaseTpl } from '../model/useApplyRelease';
import styles from './ApplyRelease.module.css';

function Editor({ template }: { template: Versioned<ReleaseTemplate> }) {
  const env = useEnv();
  const toast = useToast();
  const save = useSaveReleaseTpl();
  const port = useApplyReleasePort();
  const { saved, fallback } = template.value;
  const latest = useReleaseDownloads().data?.[0]?.version ?? '0.11.3';
  const [tpl, setTpl] = useState(saved ?? fallback);
  const bad = port.check(tpl);
  const current = saved ?? fallback;

  const write = (value: string | null, done: string) =>
    save.mutate(
      { from: template, tpl: value },
      {
        onSuccess: () => toast(done),
        onError: (e) => toast(errorMessage(e, '템플릿 저장 실패')),
      },
    );
  const reset = () => {
    if (!confirm(withProdMark(env, '저장된 템플릿을 지우고 기본 문구로 되돌릴까요?'))) return;
    setTpl(fallback);
    write(null, '기본 문구로 되돌림');
  };

  return (
    <div className={styles.tpl}>
      <textarea
        rows={3}
        maxLength={RELEASE_TPL_MAX}
        aria-label="릴리스 답변 템플릿"
        value={tpl}
        onChange={(e) => setTpl(e.target.value)}
      />
      <small className="soft">
        {RELEASE_TPL_VARS.map((v) => `${v.key} ${v.label}`).join(' · ')} —{' '}
        {saved ? '저장된 템플릿' : '기본 문구'} 사용 중
      </small>
      <p className={styles.preview}>
        <small className="soft">미리 보기 (공개 글 예)</small>
        <br />
        {port.fill(tpl, { version: latest, title: '«제보 제목»', todo: '«할 일 제목»' }) || (
          <span className="warn">빈 답변</span>
        )}
      </p>
      {bad && <p className="msg err">{bad}</p>}
      <div className={styles.foot}>
        <button
          type="button"
          className="btn"
          disabled={save.isPending || saved === null}
          onClick={reset}
          title="저장된 템플릿을 지워 코드 기본 문구로"
        >
          기본값으로 되돌리기
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={save.isPending || !!bad || tpl.trim() === current.trim()}
          onClick={() => write(tpl, '템플릿 저장')}
        >
          {save.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}

/** 릴리스 반영 답변 템플릿 — 접어 두고, 펼치면 고치기. 관리자끼리 같은 값(config/releaseAnswerTpl)을 쓴다. */
export function ReleaseTplPanel() {
  const tpl = useReleaseTpl();
  return (
    <details className={styles.panel}>
      <summary>🏷 릴리스 답변 템플릿</summary>
      {tpl.error && <p className="msg err">{errorMessage(tpl.error, '템플릿 불러오기 실패')}</p>}
      {tpl.isLoading && <p className="soft">불러오는 중…</p>}
      {/* 저장된 값이 바뀌면(다른 창 · 확인 창에서 저장) 입력칸을 새 값으로. */}
      {tpl.isSuccess && (
        <Editor key={`${tpl.data.version}:${tpl.data.value.saved ?? ''}`} template={tpl.data} />
      )}
    </details>
  );
}
