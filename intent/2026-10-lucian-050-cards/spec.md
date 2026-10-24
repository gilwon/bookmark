# Spec: 북마크·Star 카드에 Lucian 050 적용
Source: intent.md (Status: draft)

## Requirements
1. `LucianCard` 공통 컴포넌트(`src/components/ui/lucian-card.tsx`)가 있다. 기존 `Card` 를 감싸 050의 기울기, 반사광, 테두리 빛을 더한다. `Card` 에 가던 className 은 안쪽 `Card` 로 그대로 전달된다.
2. 마우스(pointerType 이 touch 가 아님)가 카드 위를 움직이면 카드가 가로 최대 7도, 세로 최대 5도 기울고 반사광과 테두리 빛이 커서 자리를 따른다. 벗어나면 0도로 돌아온다. 곡선과 시간은 050 원본 값이다.
3. `prefers-reduced-motion` 이면 기울기는 없고 반사광과 테두리 빛만 보인다. 터치 입력에서는 아무것도 보이지 않는다.
4. `tilt={false}` 이면 기울기와 빛을 모두 끈다. 북마크 카드는 인라인 편집 중에 이를 쓴다.
5. `BookmarkCard` 와 `StarCard` 의 최상위 `<Card>` 가 `<LucianCard>` 로 바뀐다. 두 카드의 props, 이벤트, 내용, 상태 테두리 클래스는 그대로다.
6. 그리드 안에서 카드 높이와 간격이 바뀌기 전과 같다(행에서 같은 높이로 늘어남).
7. 050 첫 줄 라이선스 주석이 `lucian-card.tsx` 와 `lucian-050.css` 에 있다.

## Design
- `LucianCard` 는 `"use client"`. 구조는 `<div class="ux u050"><Card class="u050-card …"><span class="u050-glare"/>…children</Card></div>`.
- 포인터 리스너는 루트 div 에 React `onPointerMove`/`onPointerLeave` 로 붙이고 CSS 변수(`--mx --my --rx --ry`)를 `style.setProperty` 로 쓴다. 전역 리스너가 없으므로 cleanup 이 필요 없다.
- CSS 는 050 에서 카드 틀(`.u050`, `.u050-card`, `::after` 테두리 빛, `.u050-glare`)만 가져온다. 고정 크기 340×400 은 `width:auto;height:100%` 로 바꾼다. `.u050-card` 반경 28px 대신 앱 카드가 작으므로 `border-radius:16px` 로 줄이고 이를 보고한다. 이중 테두리를 피하려고 050 의 `0 0 0 1px` 링 그림자는 빼고 `Card` 의 border 를 쓴다.
- 이미지 영역(`.u050-img`), 출처 줄, 점, 헤드라인, 본문, 푸터, 읽음 버튼과 해당 CSS·스크립트는 가져오지 않는다.

## Decisions
- 읽음 표시 기능은 만들지 않는다. 이 앱에 읽음 상태가 없고 intent 에 없다.
- 반경 16px. 근거는 밀집 그리드에서 28px 이 과하다는 판단이며 화면을 보고 조정한다.

## Conflicts
- 3D 변환(`transform`)이 있는 요소 안의 `position:absolute` 링크와 드롭다운은 계속 동작하지만 `perspective` 가 스택 컨텍스트를 만든다. 북마크 카드 인라인 편집의 자동완성 목록(`z-20`)이 카드 밖으로 잘리는지 화면 확인이 필요하다(기존에도 카드가 `overflow-hidden`).

## Acceptance
- 북마크와 Star 목록에서 마우스를 올리면 카드가 기울고 빛이 따라온다. 손을 떼면 돌아온다.
- 북마크 카드 편집 중에는 기울지 않고, 기존 기능이 모두 그대로 동작한다.
- 모바일(터치)에서는 효과가 없다.
- `npx tsc --noEmit` 통과.
