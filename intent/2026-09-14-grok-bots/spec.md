# Spec: 그록봇 템플릿 메뉴
Source: intent.md (Status: draft)

## Requirements
1. 로그인한 사용자는 사이드바에서 `그록봇` 메뉴로 `/grok-bots` 에 들어간다.
2. 목록은 카테고리 칩·검색·카드 그리드다. 칩 순서는 전체, 즐겨찾기, 공식 마켓플레이스, 어시스턴트, 엔지니어링, 리서치, 세일즈·마케팅, 금융·비용, 크리에이티브, 개인·생활, 그 외 가나다다.
3. 카드는 한글 이름, 영어 원제(다를 때만), 카테고리, 공식 마켓 배지, 제작자, 설명, 작동 방식(길면 더보기), 루틴·스킬(있으면), 템플릿 열기, 원본(X) 링크를 보여 준다.
4. 템플릿 열기와 원본 링크는 새 탭이다. `rel=noopener noreferrer`.
5. 각 카드에서 즐겨찾기를 켜고 끈다. 켜진 봇은 목록 상단이다. 즐겨찾기 칩은 별이 켜진 봇만 보여 준다.
6. 목록 상단에서 봇을 추가한다. 필수 값은 이름과 템플릿 URL이다. 같은 사용자의 같은 템플릿 URL은 409다.
7. 카드 본문 클릭은 상세 `/grok-bots/[id]` 로 간다. 상세에서 수정·삭제한다.
8. 다솔인 공개 템플릿 710개를 임포트한다. 이미 같은 템플릿 URL이 있으면 건너뛴다. 즐겨찾기는 덮어쓰지 않는다.
9. 소유자는 사용자다. 다른 사용자 행은 보이지 않는다.
10. ⌘K와 통합 검색에 그록봇이 포함된다. 대시보드에 개수가 있다.

## Design
새 테이블 `grok_bots`. 행은 user_id, name, name_en, creator, category, description, how_it_works, notes, skills JSON, routines JSON, template_url, source_url, slug, official_marketplace, is_favorite, created_at, updated_at.

데이터 흐름. 목록 GET은 해당 사용자 전체 행을 준다(710건·약 400KB). 필터·검색·페이징은 클라이언트다. 쓰기 POST/PATCH/DELETE는 `/api/grok-bots`. 임포트는 `scripts/import-grokbot-templates.mjs`가 `scripts/data/grokbot-templates.json`을 읽어 로컬 SQLite와 운영 Supabase에 넣는다.

경계. 다솔인 API를 런타임에 호출하지 않는다. 스냅샷 JSON만 쓴다. 템플릿 URL 정규화는 trim과 끝 슬래시 제거다.

## Decisions
상세 수정·삭제. 넣는다. 추가 가능한 라이브러리는 카피와 같다.
통합 검색·대시보드. 넣는다. 다른 메뉴와 같은 발견 경로다.
중복 키. 사용자+템플릿 URL이다. 이름 중복은 허용한다.

## Conflicts
없음.

## Acceptance
사이드바에 그록봇이 있다.
목록에서 카테고리 칩으로 걸러지고, 검색되고, 즐겨찾기가 상단에 붙는다.
추가 폼으로 봇이 생기고, 같은 템플릿 URL은 거절된다.
다솔인 710개가 들어가고 재실행은 건너뛴다.
템플릿 열기가 x.ai 봇 주소로 새 탭을 연다.
⌘K와 `/search`에서 그록봇이 나온다.
