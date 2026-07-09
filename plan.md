# 나만의 북마크 웹앱 개발 기획서

## 1. 프로젝트 개요
- **프로젝트명**: Personal Bookmark Hub (가칭: **MyMark**)
- **목적**: 기존 브라우저 북마크와 GitHub Star의 단점을 보완한 개인 지식 관리 도구
- **주요 해결 과제**:
  - 북마크가 많아지면서 찾기 어려움
  - 사이트 정보(메타 태그, OG 이미지 등)를 한눈에 파악하기 어렵다
  - GitHub Star한 레포지토리를 효율적으로 관리하기 어렵다
- **타겟 사용자**: 개발자, 콘텐츠 소비자, 지식 노동자

## 2. 주요 기능

### MVP (필수 기능)
1. **북마크 관리**
   - URL 입력 시 자동으로 **Title, Description, OG Image, Favicon, Meta 태그** 추출
   - 카드 형태 UI (이미지 + 제목 + 요약 + 태그)
   - 자동/수동 분류 (도메인, 키워드 기반)
   - 태그, 카테고리, 폴더 지원

2. **GitHub Star 연동**
   - GitHub OAuth 로그인
   - Star한 Repository 자동 동기화
   - Repo 정보(언어, Stars, Topics, Description) 표시
   - 북마크와 **완전 분리된 뷰**

3. **통합 검색 & 필터**
   - 제목, 설명, URL, 태그全文 검색
   - 카테고리, 태그, 날짜, 타입(북마크/GitHub) 필터

4. **Notion-like Custom Page**
   - 자유롭게 페이지 생성 및 편집 (Rich Text)
   - 북마크나 GitHub 레포를 페이지 내에 임베드 가능

5. **UI/UX**
   - 사이드바 네비게이션
   - Masonry/Grid 카드 레이아웃 (한눈에 보기 편하게)
   - 다크모드 기본 지원

### v1 이후 고려 기능
- AI 자동 태그 및 요약
- 브라우저 익스텐션
- 데이터 Export (JSON, Markdown)
- 공유 컬렉션

## 3. 추천 기술 스택

| 계층       | 기술                          | 이유 |
|------------|-------------------------------|------|
| Frontend   | Next.js 14 (App Router) + TypeScript + TailwindCSS + shadcn/ui | 빠른 개발, SEO, 성능 |
| Backend    | Next.js API Routes 또는 Supabase | 풀스택 간소화 |
| Database   | Supabase Postgres             | 인증, DB, 스토리지 통합 |
| 인증       | NextAuth.js (GitHub Provider) | GitHub 연동 용이 |
| Editor     | Tiptap                        | Notion-like 에디터 |
| URL Meta   | open-graph-scraper            | 서버사이드 메타 추출 |
| GitHub     | Octokit.js                    | Star 관리 |

**배포**: Vercel (추천)

## 4. 데이터 모델 (Supabase 기준)

- `bookmarks` 테이블: `id, user_id, url, title, description, image, favicon, tags[], category, created_at`
- `github_stars` 테이블: `id, user_id, repo_name, description, language, stars, topics[], last_synced`
- `custom_pages` 테이블: `id, user_id, title, content(jsonb), created_at`

## 5. 개발 단계

**Phase 0: 준비** (1일)
- 프로젝트 생성, Supabase 설정, DB 스키마

**Phase 1: 인증 & 레이아웃** (2~3일)
- NextAuth + GitHub 로그인, 사이드바 UI

**Phase 2: 북마크 핵심** (4~5일)
- URL 저장 & 메타 크롤링, 카드 UI, CRUD

**Phase 3: GitHub Star** (2~3일)
- Star 동기화 및 전용 뷰

**Phase 4: Custom Page** (3일)
- Tiptap 에디터 연동

**Phase 5: 검색·필터·폴리싱** (3일)
- 검색 기능, 반응형, UX 개선

**Phase 6: 배포** (선택)
- Vercel 배포, 브라우저 익스텐션

## 6. 개발용 프롬프트 템플릿

**1. 프로젝트 초기화**
```
Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui로 Personal Bookmark 앱을 만들어줘. Supabase 인증 사용. 사이드바와 다크모드 포함.
```

**2. URL 메타 추출 API**
```
Next.js API Route에서 URL을 받아 open-graph-scraper로 메타 정보를 추출하는 서버 액션을 만들어줘.
```

**3. 북마크 카드 UI**
```
shadcn/ui로 북마크 카드 컴포넌트와 Masonry 그리드 레이아웃을 만들어줘.
```

**4. GitHub Star 연동**
```
NextAuth GitHub OAuth와 Octokit을 사용해 Star 레포지토리를 불러와 Supabase에 저장하는 기능을 구현해줘.
```

**5. Tiptap 에디터**
```
Tiptap으로 Notion 스타일 rich text 에디터를 만들어줘. Slash command도 포함.
```

---

이 문서를 기반으로 개발을 진행하세요. 추가 수정이 필요하면 언제든 말씀해주세요!