# Spec: eli5 설명서 메뉴

## 데이터
- `src/data/eli5-shelf.json` 목록. 항목은 `id, title, repo, repoUrl, summary, kind("설명"|"비교"), tags[], date(YYYY-MM-DD), sourceUrl`. date 내림차순, 같으면 title 순.
- `src/data/eli5-shelf-bodies.json` 본문. `{ [id]: html }`. id는 서가 문서 id(영숫자와 하이픈).
- 갱신은 `scripts/import-eli5-shelf.mjs <내보낸 JSON 폴더>`가 두 파일을 다시 만든다. 폴더의 `*.json` 한 개가 서가 행 한 개(`url,title,repo,repoUrl,summary,kind,tags,date,html`)이고 파일 이름이 id다. 제목이 제외 목록에 있으면 건너뛴다.

## 라이브러리
본문 JSON(약 1MB)이 클라이언트 번들에 섞이지 않도록 모듈을 둘로 나눈다.
- `src/lib/eli5-shelf.ts`(목록 JSON만 import, 클라이언트에서도 씀). `listEli5Shelf()`, `getEli5Shelf(id)`, `filterEli5Shelf(items, {query, kind, tag})`.
- `src/lib/eli5-shelf-doc.ts`(서버 전용, 본문 JSON import). `getEli5ShelfBody(id)`, `buildEli5ShelfDocResponse({ id, userId, theme })`는 순수 함수다. userId 없으면 401, id 없거나 본문 없으면 404, 아니면 200 text/html.
- 테마는 `dark`일 때만 dark, 그 외는 light다. 본문 `<html ...>`에 `data-theme`를 넣는다. 기존 속성이 있으면 바꾼다. `<html>`이 없으면 본문 앞에 붙이지 않고 그대로 둔다.

## 응답 헤더 (200)
- `content-type: text/html; charset=utf-8`, `cache-control: private, no-store`, `x-frame-options: SAMEORIGIN`, `referrer-policy: no-referrer`.
- `content-security-policy: default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`.
- 401/404는 text/plain 한국어 문구, 선례(stars eli5)와 같다.

## 라우트
- `src/app/(app)/eli5-shelf/[id]/doc/route.ts` GET. `auth()`로 userId를 얻어 위 함수를 호출한다. 쿼리 `theme`을 넘긴다. nodejs, force-dynamic.

## 화면
- `src/app/(app)/eli5-shelf/page.tsx` 서버 컴포넌트, `src/components/eli5-shelf/shelf-list.tsx` 클라이언트 컴포넌트.
- 검색 입력, 종류(전체/설명/비교)와 태그 필터, 카드 격자. 카드를 누르면 넓은 모달 패널이 열리고 그 안에 iframe `src=/eli5-shelf/{id}/doc?theme=…`, `sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"`(allow-same-origin 없음). 패널에 제목, 레포 링크, 닫기 버튼. Esc와 바깥 클릭으로 닫힌다. 포커스는 패널로 가고 닫으면 카드로 돌아온다.
- 테마는 문서의 `dark` 클래스 유무로 읽어 쿼리에 넘긴다.

## 내비게이션
- 사이드바 GitHub 묶음(Stars·GitHub 링크·스킬)에 `{ href: "/eli5-shelf", label: "eli5 설명서" }` 추가. 명령 팔레트에 같은 항목 추가.

## 테스트 (`tests/eli5-shelf.test.ts`)
- 목록 건수·고유 id·정렬, 제외 문서 없음, 모든 목록 id에 본문 존재.
- 필터(검색, kind, tag).
- 없는 id 404, userId 없음 401, 200 헤더 전부(CSP 문자열 포함), 테마 주입(dark/light/잘못된 값).
- 사이드바와 명령 팔레트에 경로가 있다.

## 범위 밖
DB 테이블, 하단 탭, 서가 자동 동기화, 기존 stars eli5 라우트 변경.

## 보안 보강 기록
- 문서 URL을 새 탭으로 직접 열면 iframe sandbox가 적용되지 않아 앱 origin에서 스크립트가 돌 수 있다. CSP 끝에 `sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox`를 넣어 어느 경우든 opaque origin으로 격리한다.
