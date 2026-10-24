# Intent: Lucian UX/UI 요소 적용
Author: 길원 (MyMark 사용자). Status: draft.

## Problem
앱의 UI가 Linear 계열 평면 디자인 하나로 통일돼 있어 상태 화면에 변화가 없다. 빈 목록, 로딩, 저장 결과 알림이 파일마다 제각각 만든 문구뿐이고, 토스트와 스켈레톤은 아예 없다. Lucian UX/UI Prompt 라이브러리의 요소를 쓰면 이 부분을 일관되게 채울 수 있다.

## Proposed outcome
공통 컴포넌트와 빈 상태, 로딩, 알림, 검색 입력이 Lucian 요소로 바뀌고, 앱 전체 색이 Lucian 기본 테마(보라 액센트, 따뜻한 회색 배경)가 된다. 사람이 화면에서 확인할 수 있는 결과는 다음과 같다.
- 라이트와 다크 모두 Lucian 팔레트로 보인다.
- 목록이 비면 Lucian 빈 상태 요소가 나온다.
- 목록을 불러오는 동안 Lucian 스켈레톤이 나온다.
- 저장·복사 같은 동작의 결과가 Lucian 토스트로 나온다.
- 검색 입력이 Lucian 입력 요소의 동작을 한다.
- 모바일에서 당겨서 새로고침이 된다(커밋 47fa40b에서 완료).

## Affected users and systems
앱 사용자 본인. `src/components/ui/`, `src/app/globals.css`, 빈 상태가 있는 약 20개 컴포넌트, 검색 입력을 쓰는 8개 컴포넌트.

## Constraints
- Lucian 요소는 `lucian-uxui` 스킬의 `get`으로 받은 코드만 쓴다. 요소 첫 줄의 MIT 라이선스 주석을 지킨다.
- 요소의 구조, 모양, 모션 값은 그대로 두고 프레임워크와 데이터와 색만 바꾼다.
- 사이드바, 대시보드, 로그인, 개별 페이지 레이아웃은 바꾸지 않는다.
- 기존 `ui/` 컴포넌트의 props와 import 경로는 유지한다.
- Tailwind 유틸로 다시 쓰지 않는다. Lucian CSS는 `.uNNN` 범위로 그대로 둔다.

## Open questions
- 어떤 Lucian 요소를 어떤 역할에 쓸지(빈 상태, 스켈레톤, 토스트, 검색 입력, 복사 버튼).
- 전역 테마 교체 후 기존 `indigo-*` 재매핑과 반경(4/6/8/12px)을 어떻게 할지.
