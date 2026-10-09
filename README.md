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


## FOCUS V2 — Supabase account sync

This version keeps the existing V1 browser localStorage key and adds optional email/password login.
- In **설정 > 클라우드 동기화**, create an account, confirm your email if requested, then log in.
- First login never silently overwrites existing meaningful records. Choose to upload local records or download the cloud copy; local/cloud backups are stored before replacement.
- Sync updates are revision-checked; concurrent edits stop and ask for a choice. Offline work stays in browser storage.
- Another device must sign in with the **same account**. Automatic cloud checks run approximately every 20 seconds while the app is active. Real-time WebSocket sync is not implemented.
- This is not end-to-end encrypted: Supabase stores routine data behind per-user Row Level Security.
- The web client uses a publishable Supabase key; service-role secrets are not used.

**Owner setup required for email confirmation**: In Supabase dashboard > Authentication > URL Configuration, set
Site URL: `https://focus-personal-dashboard.vercel.app`
and add Redirect URL: `https://focus-personal-dashboard.vercel.app/**`.
If using GitHub Pages too, allow `https://bduidohd937-beep.github.io/focus-personal-dashboard/**`.
Until URL Configuration is set, email verification links may return to localhost.
V2 relies on an external ESM module CDN for sign-in functionality, which requires an internet connection on first load.

Run `npm test` for local model + sync-logic unit tests. Actual multi-device sign-in / browser E2E must still be verified.


## V2.1 — 집중 타이머, 통계, D-Day, 테마

집중 탭에서 타이머(시작·일시정지·다시 시작·기록 저장)를 사용합니다. **기록 저장**을 선택한 측정 시간만 공부 통계 및 클라우드에 반영됩니다. 12시간/회 제한, 기기당 하나의 실행 중 타이머 지원. 타이머 자체는 기기 브라우저에 저장되며, 완료된 세션은 클라우드 동기화 대상입니다.

설정 > 개인화 설정에서 에메랄드·바이올렛·오션·앰버 테마, 하루 집중 목표(분), 시험 이름·D-Day를 수정합니다. 기존 데이터 구조(version 1)와 로컬 저장 키를 유지하고, 선택 필드 `sessions`, `preferences`를 추가합니다. 오래된 백업도 유효하며 새 필드가 없으면 기본값으로 복원합니다.

클라우드 동기화의 버전 충돌 시 자동 병합하지 않으며 기존 방식대로 어느 쪽을 사용할지 선택합니다. 실제 양방향 동기화 검증은 사용자 기기에서 진행해야 합니다.
