import { useState } from 'react';
import {
  BUG_BODY_MAX,
  BUG_CATS,
  BUG_TITLE_MAX,
  checkEdit,
  editChanges,
  type BugContent,
  type BugItem,
  type BugVis,
  type EditInput,
} from '@/entities/bug-board';
import { useEnv, withProdMark } from '@/shared/api';
import { errorMessage } from '@/shared/lib';
import { useToast } from '@/shared/ui';
import { editAsk } from '../model/editPost';
import { useEditPost } from '../model/useEditPost';
import styles from './EditPostForm.module.css';

/** 제목 · 본문 · 분류 · 공개 범위 고치기 — 저장하거나 취소하면 onDone. 공지는 공개 글만. */
export function EditPostForm({
  item,
  content,
  label,
  onDone,
}: {
  item: BugItem;
  content: BugContent | null;
  label: string;
  onDone: () => void;
}) {
  const env = useEnv();
  const toast = useToast();
  const edit = useEditPost(item.id, label);
  const [title, setTitle] = useState(content?.title ?? '');
  const [body, setBody] = useState(content?.body ?? '');
  const [cat, setCat] = useState(Object.hasOwn(BUG_CATS, item.cat) ? item.cat : 'etc');
  const [vis, setVis] = useState<BugVis>(item.vis);

  const onSave = () => {
    const input: EditInput = { title, body, cat, vis };
    const bad = checkEdit(item, input);
    if (bad) return toast(bad);
    const changes = editChanges(item, content, input);
    if (!changes.length) return toast('바뀐 것 없음');
    const toPrivate = item.vis === 'pub' && vis === 'prv';
    if (!confirm(withProdMark(env, editAsk(label, changes, toPrivate)))) return;
    edit.mutate(input, {
      onSuccess: (r) => {
        if (!r.ok) return toast(r.reason);
        toast(`${label} 수정됨`);
        onDone();
      },
      onError: (e) => toast(errorMessage(e, '수정 실패')),
    });
  };

  return (
    <div className={styles.form}>
      <input
        type="text"
        aria-label="제목"
        maxLength={BUG_TITLE_MAX}
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className={styles.text}
        aria-label="본문"
        rows={8}
        maxLength={BUG_BODY_MAX}
        placeholder="본문"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <small className="soft">
        제목 {title.trim().length}/{BUG_TITLE_MAX} · 본문 {body.trim().length}/{BUG_BODY_MAX}
      </small>
      <div className={styles.row}>
        <select
          className={styles.select}
          aria-label="분류"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          {Object.entries(BUG_CATS).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <label>
          <input
            type="radio"
            name={`edit-vis-${item.id}`}
            checked={vis === 'pub'}
            onChange={() => setVis('pub')}
          />
          공개
        </label>
        <label>
          <input
            type="radio"
            name={`edit-vis-${item.id}`}
            checked={vis === 'prv'}
            disabled={!!item.notice}
            onChange={() => setVis('prv')}
          />
          🔒 비공개
        </label>
        {item.notice && <small className="soft">공지 — 공개 글만</small>}
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn" disabled={edit.isPending} onClick={onDone}>
          취소
        </button>
        <button type="button" className="btn primary" disabled={edit.isPending} onClick={onSave}>
          {edit.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}
