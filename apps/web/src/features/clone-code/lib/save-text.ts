/** 글을 파일로 내려받게 한다 — 서버로 보내지 않고 이 브라우저 안에서 파일을 만든다 */
export function saveText(name: string, text: string, doc: Document = document): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = name;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  // 클릭이 내려받기를 시작한 뒤에 풀어야 한다 — 바로 풀면 일부 브라우저가 빈 파일을 받는다
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
