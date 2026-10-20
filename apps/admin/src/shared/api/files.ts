// Storage 통로 — 기능 코드가 Storage SDK 를 직접 부르지 않게 한다. 테스트에서는 가짜를 넣는다.
export interface Files {
  /** 다운로드 URL(https://firebasestorage.googleapis.com/…) 로 파일을 지운다. 이미 없으면 조용히 넘어간다. */
  deleteByUrl(url: string): Promise<void>;
}
