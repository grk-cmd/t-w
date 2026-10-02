// 🧪 dev(테스트) 빌드용 Firebase 설정 — together-working-dev 프로젝트.
// release.yml 이 프리릴리스 태그(v0.10.2-beta.0 처럼 "-" 가 붙은 태그)일 때 app/parts/firebase-config.js 를 이 파일로 바꿔 빌드한다.
// build/ 는 package.json build.files 에 없어서 정식 설치본에는 들어가지 않는다.
// apiKey 등은 클라이언트 식별자라 공개돼도 된다(실제 보안은 Database 규칙) — 운영 firebase-config.js 와 같은 성격.
export const firebaseConfig = {
  apiKey: "AIzaSyCj9XX0uSp4xDqexIY-AxzDDWIrXCEUZLM",
  authDomain: "together-working-dev.firebaseapp.com",
  databaseURL: "https://together-working-dev-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "together-working-dev",
  storageBucket: "together-working-dev.firebasestorage.app",
  messagingSenderId: "785698867617",
  appId: "1:785698867617:web:9b2657524ec3a8b7ae23e0"
};
