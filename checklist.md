# MyMark 개발 체크리스트

## Phase 0: 준비
- [x] Next.js (App Router) + TypeScript + Tailwind 프로젝트 생성
- [x] shadcn 스타일 공통 UI 컴포넌트 (수동 구현)
- [x] SQLite(Drizzle) 스키마: bookmarks, github_stars, custom_pages
- [x] Supabase 호환 SQL 마이그레이션 문서
- [x] `.env.example` 작성

## Phase 1: 인증 & 레이아웃
- [x] NextAuth(Auth.js) GitHub Provider
- [x] 개발용 세션/로컬 폴백 (OAuth 없이도 UI 확인 가능)
- [x] 사이드바 네비게이션
- [x] 다크모드 기본

## Phase 2: 북마크 핵심
- [x] URL 메타 추출 API (open-graph-scraper)
- [x] 북마크 CRUD API / 서버 액션
- [x] 북마크 카드 + Grid 레이아웃
- [x] 태그·카테고리 지원

## Phase 3: GitHub Star
- [x] Octokit으로 Star 목록 동기화
- [x] github_stars 저장
- [x] 북마크와 분리된 Stars 전용 뷰

## Phase 4: Custom Page
- [x] Tiptap 에디터
- [x] 페이지 CRUD
- [x] 북마크/레포 커스텀 임베드 노드

## Phase 5: 검색·필터·폴리싱
- [x] 제목/설명/URL/태그 검색
- [x] 카테고리·태그·타입 필터
- [x] 날짜 필터
- [x] 반응형 레이아웃
- [x] README + 빌드 검증
