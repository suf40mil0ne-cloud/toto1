// =====================================================================
// Firebase 설정 파일
//
// [설정 방법]
// 1. https://console.firebase.google.com 접속
// 2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
// 3. 프로젝트 설정 > 내 앱 > 웹 앱 추가 > Firebase SDK 구성 복사
// 4. 아래 값들을 복사한 값으로 교체
// 5. Firestore Database > 시작하기 (프로덕션 모드)
// 6. 규칙 탭에 아래 보안 규칙 적용:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /generatedNumbers/{docId} {
//       allow create: if true;
//       allow read, update, delete: if request.auth != null
//         && request.auth.token.email == "ADMIN_EMAIL_HERE";
//     }
//     match /winningNumbers/{drawNo} {
//       allow read, write: if request.auth != null
//         && request.auth.token.email == "ADMIN_EMAIL_HERE";
//     }
//   }
// }
// =====================================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBWzbR40CXglxyH8AfaiyqDPMa2Uv75gnQ",
  authDomain: "toto1-f8202.firebaseapp.com",
  projectId: "toto1-f8202",
  storageBucket: "toto1-f8202.firebasestorage.app",
  messagingSenderId: "635220408683",
  appId: "1:635220408683:web:64122125125817bce4342e"
};

// 관리자 구글 계정 이메일 (admin 페이지 접근 허용)
const ADMIN_EMAIL = "suf40mil0ne@gmail.com";
