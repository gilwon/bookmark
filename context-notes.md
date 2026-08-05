<!-- Tistory 원문 이관에 필요한 조사 결과와 구현 제약 -->
# 조사 메모

## 원문

- URL은 `https://miny.tistory.com/30`이다.
- 제목은 `UI 디자인 스타일 20가지 총정리 (플랫, 글래스모피즘, 뉴모피즘 등)`이다.
- 실제 본문 컨테이너는 `#article-content .tt_article_useless_p_margin`이다.
- 본문 컨테이너에는 이미지 21개, 링크 48개, `h2`·`h3` 29개가 있다.
- 글 상단 스킨 썸네일은 첫 본문 이미지와 같은 파일이므로 본문 기준 이미지 수는 21개다.
- 이미지 순서는 총정리 표지, 플랫, 머티리얼, 플루언트, 애플 휴먼 인터페이스, 글래스모피즘, 뉴모피즘, 미니멀리즘, 다크 모드, 카드 기반, 그라데이션, 타이포그래픽, 브루탈리즘, 네오브루탈리즘, 3D, 아이소메트릭, 클레이모피즘, 오로라 UI, 프루티거 에어로, 스큐어모피즘, AI 정리 고지다.
- 카카오 CDN URL에는 `expires`와 `signature`가 있어 그대로 저장하면 만료된다. `public/imports/ui-design-styles/`에 원본 21개를 보관하고 Pages 문서는 `/imports/ui-design-styles/...`를 참조한다.

## 프로젝트 흐름

- Pages 본문은 `custom_pages.content`의 TipTap JSON이다.
- 기존 변환 함수는 `src/lib/markdown-to-tiptap.ts`의 `markdownToTiptapDoc`이다.
- 기존 URL 수집 함수는 `src/lib/url-to-markdown.ts`의 `fetchUrlAsMarkdown`이며 Readability와 Turndown을 이미 사용한다.
- 현재 Markdown 변환기는 독립 이미지 문법 `![alt](src)`을 이미지 노드로 처리하지 않아 URL 가져오기 결과에서 이미지를 잃는다.
- 최소 공통 수정은 독립 이미지 한 줄을 `{ type: "image", attrs: { src, alt } }`로 바꾸는 분기와 회귀 테스트다.
- 일회성 가져오기 스크립트는 기존 `scripts/import-*-page.mjs`처럼 `.env.local`, SQLite `dev`, Supabase 사용자 `f72e9a44-79d8-4061-a700-3ec50bb04a97`를 사용한다.
- 다른 사용자의 미추적 스크립트와 `DESIGN-apple.md`는 건드리지 않는다.

## 완료 판정

- `--check` 같은 무변경 검사에서 제목, 이미지 21개, 원문 링크가 확인된다.
- 저장된 TipTap JSON에서 이미지 노드 21개가 모두 로컬 경로이고 링크 마크가 원문 링크를 보존한다.
- 같은 스크립트를 다시 실행해도 중복 페이지가 생기지 않는다.
- 테스트, 린트, 빌드 후 실제 `/pages/{id}`에서 본문 이미지가 표시된다.

## 구현·검증 상태

- `scripts/import-ui-design-styles-page.mjs --check`는 DB를 열지 않고 원문 제목, 이미지 21개, 링크 48개, 로컬 자산 21개, TipTap 이미지 21개, 링크 mark 48개, 표 4개를 검사한다.
- Pages 문서의 이미지는 `/imports/ui-design-styles/` 아래 로컬 자산을 참조한다. 운영 화면에서 보이려면 이 코드와 자산을 먼저 배포해야 한다.
- 실제 SQLite·Supabase 저장과 프로덕션 배포는 실행하지 않았다.
- 대상 테스트와 전체 테스트, 빌드는 통과했다. 전체 린트는 변경 파일 밖 기존 오류 23개 때문에 실패했으며 변경한 코드 파일만 검사하면 통과한다.

## GitHub Star 동기화 번역 조사 메모

- 동기화는 `src/app/api/stars/sync/route.ts`에서 GitHub 목록을 받은 뒤 `src/lib/github.ts`의 `upsertStars`로 저장한다.
- 신규·기존 항목 모두 `src/lib/star-translation.ts`의 `withKoreanTranslation`을 통과한다.
- 현재 번역 함수는 `src/data/star-descriptions-ko.json`의 정적 매핑만 사용하며, 매핑에 없는 레포는 영문 설명을 그대로 반환한다.
- 실제 증상과 같은 실패 테스트를 먼저 만든 뒤 공통 번역 함수만 최소 수정한다.
- 운영 데이터에서 설명이 있는 영문 전용 Star 20개가 모두 정적 매핑 밖인 것을 확인했다.
- 누락된 20개 정적 번역과 `DoHyun468/claw-hwp` 회귀 테스트를 추가했다.
- 대상 테스트 5개와 전체 테스트 21개, 변경 테스트 ESLint, 프로덕션 빌드가 통과했다.
- 화면에 영문으로 남은 항목은 번역표와 테스트만 수정하고 운영 DB 백필을 실행하지 않아 발생했다.
- 운영 DB에는 정적 매핑과 일치하지만 영문 설명만 저장된 항목이 20개 남아 있었다.
- `scripts/add-korean-star-descriptions.mjs`로 운영 DB 20개를 백필했고, 재실행 시 갱신 0개와 매핑 대상 영문 전용 0개를 확인했다.

## dasolin GitHub 링크 이관 조사 메모

- 원문은 `https://dasolin.net/tips/github-links`이며 로그인 후 동적 목록을 표시한다.
- 원문 공개 데이터는 숨김 항목 제외 120개다. GitHub 117개, Hugging Face 1개, 기타 링크 2개다.
- 카테고리는 클로드 87개, 기타 19개, 코덱스 6개 등 11개 문자열로 구성된다.
- 외부 서비스 장애와 로그인에 의존하지 않도록 링크 목록은 프로젝트 정적 데이터로 보관한다.
- 상단 메뉴에는 `GitHub 링크` 한 항목만 추가하고, 전용 페이지에서 검색·출처·카테고리 필터와 모든 설명·링크를 제공한다.
- 원문 장문은 복제하지 않고 링크와 의미를 보존한 자체 한국어 설명을 사용한다.

### GitHub 링크 구현 및 검증 결과

- 정적 데이터 120개와 고유 HTTPS 링크 120개를 저장했으며 GitHub 117개, Hugging Face 1개, 기타 2개다.
- 검색, 출처 필터, 카테고리 필터와 상단 GitHub 링크 메뉴를 추가했다.
- 테스트 22개, 변경 파일 ESLint, 프로덕션 빌드가 통과했다.
- 480px·1024px·1440px에서 가로 넘침 없이 각각 1열·3열·3열로 표시된다.
- 검색과 필터 결과, 키보드 탐색, WCAG 2 A·AA 자동 검사를 확인했고 접근성 위반은 0건이다.
