# Spec: Lucian UX/UI 요소 적용
Source: intent.md (Status: draft)

## Requirements
1. `globals.css`의 `html.light`와 `html.dark` 변수(`--background`, `--card`, `--accent`, `--border` 등)가 Lucian 토큰 값을 가리킨다. 라이트는 `--ux-page`·`--ux-surface`·`--ux-accent` 계열, 다크는 같은 토큰의 다크 값이다.
2. `--ux-*` 토큰이 `html.light`와 `html.dark`에 모두 정의돼, 테마를 바꾸면 Lucian 요소가 즉시 따라 바뀐다. `.ux` 기반 규칙(박스 모델, 포커스 링, reduced-motion)도 한 번만 들어간다.
3. 기존 `indigo-*` 재매핑과 `Button` 기본색이 Lucian 액센트(`--ux-accent`)로 보인다. 이 클래스를 쓰는 파일은 수정하지 않는다.
4. 빈 상태가 있는 컴포넌트가 공통 `EmptyState` 하나를 쓰고, 이 컴포넌트는 `get`으로 받은 빈 상태 계열 Lucian 요소(088 또는 092 후보)를 포팅한 것이다. 문구는 각 화면의 기존 문구를 props로 받는다.
5. 목록 로딩 중에는 079 계열 스켈레톤을 포팅한 `ListSkeleton`이 나온다. 이를 쓸 자리는 서버에서 목록을 불러오는 `page.tsx`의 `loading.tsx`다.
6. 저장·복사·삭제 같은 동작의 결과를 보여 주는 토스트가 있고, 070 계열을 포팅한 `ToastProvider`와 `useToast()`로 쓴다. 기존 PWA 설치 토스트는 그대로 둔다.
7. `SearchSuggestInput`의 겉모습과 키보드 동작(방향키, Enter, Esc)이 검색 입력 계열 Lucian 요소(027 또는 034 후보)에 맞는다. props는 그대로이고 이를 쓰는 8개 컴포넌트는 수정하지 않는다.
8. `Button`, `Input`, `Select`, `Textarea`, `Card`, `Badge`의 props와 export는 바뀌지 않는다. 겉모습만 새 토큰을 따른다.
9. 각 포팅 파일 첫 줄에 해당 요소의 `Lucian UX/UI Prompt #ID · MIT License` 주석이 있다.
10. 모든 새 요소가 `prefers-reduced-motion`에서 동작하고, 키보드로 쓸 수 있고, 375px에서 가로 스크롤이 없다.

## Design
- Lucian 요소는 한 요소가 한 역할을 가진 완결된 조각이라 `Button` 같은 범용 프리미티브의 variant로 바로 대응하지 않는다. 그래서 프리미티브는 테마 토큰으로 겉모습만 바꾸고, Lucian 요소는 역할이 맞는 곳(빈 상태, 스켈레톤, 토스트, 검색 입력)에만 새 컴포넌트로 넣는다.
- 새 파일은 `src/components/ui/` 아래에 둔다. 요소별 CSS는 `lucian-NNN.css`로 분리하고 `.uNNN` 범위를 지킨다(`src/components/pwa/lucian-085.css`와 같은 방식).
- 테마는 `--ux-*`를 새로 정의하고 기존 `--background` 등이 그것을 가리키게 한다. 다크 전환은 현재처럼 `html.dark` 클래스를 따른다.
- 빈 상태 교체는 컴포넌트마다 기존 인라인 문구 블록을 `EmptyState` 호출로 바꾸는 작은 변경으로 한다.

## Decisions
- 범위. 공통 프리미티브와 빈·로딩·알림·검색 입력만 한다. 근거는 사용자 선택이다.
- 테마. Lucian 기본 토큰으로 교체한다. 근거는 사용자 선택이다.
- 프리미티브 교체 방식. 코드를 새로 쓰지 않고 토큰으로 겉모습을 바꾼다. 근거는 위 Design의 첫 항목이다.
- 요소 번호. 각 역할의 후보를 plan 단계에서 `get`으로 받아 읽고 하나로 확정한다. 지금은 미결이고, 코드를 보기 전에 정하면 맞지 않을 수 있어서다.
- 반경. 미결. Lucian 요소는 자체 반경을 가지므로 프리미티브 반경을 바꿀지는 토큰 교체 후 화면을 보고 정한다.

## Conflicts
- `globals.css`의 `@utility glass*`는 "사용처를 건드리지 않고 룩을 바꾼다"는 주석 아래 평면 표면으로 재정의돼 있다. 토큰 교체는 이 유틸에도 영향을 주며, 값을 바꾸는 것만으로 반영되므로 충돌은 아니다.
- 기존 `PwaInstallToast`와 새 `ToastProvider`가 화면 아래쪽에서 겹칠 수 있다. 확인 필요.
- 요구사항 5의 `loading.tsx`는 현재 하나도 없다. 새로 만드는 파일이므로 intent의 "개별 페이지 레이아웃은 바꾸지 않는다"와 부딪히는지 확인이 필요하다. 레이아웃은 건드리지 않고 로딩 표시만 추가하는 것으로 본다.

## Acceptance
- 라이트와 다크에서 앱 전체가 Lucian 팔레트로 보이고, 테마를 바꿔도 깨진 색이 없다.
- 북마크, 프롬프트, Star 등 목록을 비우거나 검색 결과를 0건으로 만들면 Lucian 빈 상태가 나온다.
- 느린 네트워크에서 목록 페이지를 열면 스켈레톤이 보인다.
- 복사나 저장을 하면 토스트가 뜨고 자동으로 사라진다.
- 검색 입력에서 방향키, Enter, Esc가 동작한다.
- 480px, 1024px, 1440px에서 레이아웃이 깨지지 않는다.
- `npx tsc --noEmit`에서 이번 변경으로 새 오류가 생기지 않는다. 기존 오류 `eli5/route.ts:62`는 제외한다.
