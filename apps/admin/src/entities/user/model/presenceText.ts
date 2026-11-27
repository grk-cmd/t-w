/** 접속 상태를 모를 때(`online` null) 마지막 접속 칸 글자 — 꺼짐이 아니라 «모름». */
export const onlineUnknownText = (seen: string): string => `접속 여부 모름 · ${seen}`;

/** 접속 상태를 모를 때 짧은 글자(머리 배지 · 삭제 미리 보기). */
export const ONLINE_UNKNOWN_LABEL = '접속 여부 모름';
