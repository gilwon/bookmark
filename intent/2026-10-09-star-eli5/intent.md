# Intent: Star 다섯 살 설명
Author: gilwon, 사용자. Status: draft.

## Problem
Stars에 등록된 레포를 열어도, 모르는 사람에게 큰 그림과 짧은 말로 보여주는 HTML 화면이 없다. 설명 문단과 README는 있지만 eli5 스킬이 요구하는 화면은 아니다.

## Proposed outcome
등록된 Star를 열면 HTML 화면이 나온다. 화면에는 큰 그림과 짧은 말이 있다. 그 HTML 주소로 직접 열어도 같은 화면이 나온다. 등록된 Star마다 이 화면이 있다.

## Affected users and systems
이 앱에 로그인한 사용자와 그 사용자의 Stars 상세 화면.

## Constraints
저장돼 있는 설명에 없는 기능을 지어내지 않는다. 기존 설명 문장과 README는 바꾸지 않는다. 등록되지 않은 레포를 새로 넣지 않는다. 설명 문자열이 화면에서 스크립트로 실행되면 안 된다.

## Open questions
없음. 대상은 오늘 등록분만이 아니라 Stars에 등록된 전부다.
