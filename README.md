# FOCUS — Personal Dashboard

공부·논술·생활 루틴을 기록하는 독립적인 모바일 우선 PWA입니다. 별도의 계정·API 키·빌드 도구가 필요하지 않습니다.

## 무료 배포 (추천: GitHub Pages)

1. GitHub에서 `focus-personal-dashboard`라는 새 저장소를 생성합니다.
2. 이 ZIP 파일을 압축 해제한 뒤 `index.html`, `app.js`, `data.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, 아이콘들을 포함한 **focus-web 폴더 내부 파일들**을 저장소 루트에 업로드하고 커밋합니다.
3. Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root) → Save.
4. 안내된 `https://사용자명.github.io/focus-personal-dashboard/` 주소에서 이용합니다.
5. 갤럭시 Chrome에서 해당 주소를 열고 메뉴 → 홈 화면에 추가(또는 앱 설치)를 선택합니다.

다른 선택: Vercel 정적 배포를 지원하는 웹 인터페이스에서 GitHub 저장소를 연결해 배포할 수 있습니다.

## 실행

개발용: 이 폴더에서 `python -m http.server 8765` 후 `http://localhost:8765` 접속.
`file://`로 직접 열면 JavaScript 모듈이나 오프라인 기능이 작동하지 않을 수 있습니다.

## 테스트

Node.js 22 이상에서 `npm test` (순수 로직 단위테스트 7개)

## 주의

- 모든 데이터는 해당 브라우저의 `localStorage`에 저장됩니다. 다른 기기 자동 동기화/로그인은 아직 없습니다.
- 기록을 옮기려면 설정 → JSON 백업 → 다른 기기에서 복원하세요.
- 사용자의 공부 기록은 서버에 저장하지 않습니다. 기록이 중요한 경우 백업을 권장합니다.
- 정적 배포용으로 구성하고 순수 로직 단위 테스트를 완료했지만, 브라우저 전체 E2E 테스트는 실행 환경의 접근 제한으로 완료하지 못했습니다.
