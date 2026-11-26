import type { BugNo } from '../model/bugBoard';

/** 번호 — 고정 번호는 그대로, 화면에서 센 번호는 흐린 «(임시)» 를 붙인다. */
export function BugNoText({ value }: { value: BugNo }) {
  return (
    <>
      <code className="key">{value.no}</code>
      {value.temp && (
        <small className="soft" title="고정 번호가 아직 없어 화면에서 센 번호 — 앞 글이 지워지면 바뀜">
          (임시)
        </small>
      )}
    </>
  );
}
