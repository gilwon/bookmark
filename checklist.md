# MyMark 개발 체크리스트

## Phase 0: 준비
- [o] Next.js (App Router) + TypeScript + Tailwind 프로젝트 생성
- [o] shadcn 스타일 공통 UI 컴포넌트 (수동 구현)
- [o] SQLite(Drizzle) 스키마: bookmarks, github_stars, custom_pages
- [o] Supabase 호환 SQL 마이그레이션 문서
- [o] `.env.example` 작성

## Phase 1: 인증 & 레이아웃
- [o] NextAuth(Auth.js) GitHub Provider
- [o] 개발용 세션/로컬 폴백 (OAuth 없이도 UI 확인 가능)
- [o] 사이드바 네비게이션
- [o] 다크모드 기본

## Phase 2: 북마크 핵심
- [o] URL 메타 추출 API (open-graph-scraper)
- [o] 북마크 CRUD API / 서버 액션
- [o] 북마크 카드 + Grid 레이아웃
- [o] 태그·카테고리 지원

## Phase 3: GitHub Star
- [o] Octokit으로 Star 목록 동기화
- [o] github_stars 저장
- [o] 북마크와 분리된 Stars 전용 뷰

## Phase 4: Custom Page
- [o] Tiptap 에디터
- [o] 페이지 CRUD
- [o] 북마크/레포 커스텀 임베드 노드

## Phase 5: 검색·필터·폴리싱
- [o] 제목/설명/URL/태그 검색
- [o] 카테고리·태그·타입 필터
- [o] 날짜 필터
- [o] 반응형 레이아웃
- [o] README + 빌드 검증

## P1 UX
- [o] Stars 페이지 진입 시 자동 동기화 (목록 비어 있고 GitHub 연동 시)
- [o] 동기화 진행 단계 / 마지막 동기화 시각
- [o] Stars 검색·언어 필터
- [o] 사이드바 아바타·GitHub 프로필 링크

## P2 보안·데이터
- [o] access_token 서버 암호 저장 (세션 비노출)
- [o] API user_id 소유권 강화 + authz 헬퍼
- [o] unstar 로컬 정리
- [o] 프로덕션 Dev Login 기본 비활성
- [o] Supabase 스키마 RLS + 이전 가이드
